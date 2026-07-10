import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  sendPasswordResetEmail,
  updatePassword,
  sendEmailVerification,
  linkWithPhoneNumber,
  RecaptchaVerifier,
  type User,
  type ConfirmationResult,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, collection, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { isValidE164, normalizePhone, RECAPTCHA_CONTAINER_ID } from "@/lib/phone-utils";
import { getEligibleAdmins, pickLeastLoadedAdmin, type AdminUser } from "@/lib/assignment";
import type { AppUser, Gender } from "@/lib/types";

interface ActivateAccountResult {
  success: boolean;
  alreadyActive?: boolean;
  assignedAdminId?: string | null;
  noAdminAvailable?: boolean;
}

interface AuthContextType {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone: string, gender: Gender) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  reloadFirebaseUser: () => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  clearPhoneRecaptcha: () => void;
  sendPhoneOtp: (phoneNumber: string, recaptchaContainerId?: string) => Promise<void>;
  confirmPhoneOtp: (code: string) => Promise<void>;
  activateAccount: () => Promise<ActivateAccountResult>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const phoneConfirmationRef = useRef<ConfirmationResult | null>(null);

  const fetchAppUser = async (uid: string): Promise<AppUser | null> => {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as AppUser;
    }
    return null;
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      const user = await fetchAppUser(firebaseUser.uid);
      setAppUser(user);
    }
  };

  const reloadFirebaseUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setFirebaseUser(auth.currentUser);
    }
  };

  const clearPhoneRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // Widget may already be cleared
      }
      recaptchaVerifierRef.current = null;
    }
    // Reset grecaptcha if available to allow clean retry
    if (typeof window !== "undefined" && (window as any).grecaptcha) {
      try {
        (window as any).grecaptcha.reset();
      } catch {
        // grecaptcha may not be initialized
      }
    }
  };

  const waitForContainer = (containerId: string, tries = 10): Promise<HTMLElement> =>
    new Promise((resolve, reject) => {
      const attempt = (remaining: number) => {
        const el = typeof document !== "undefined" ? document.getElementById(containerId) : null;
        if (el) return resolve(el);
        if (remaining <= 0) return reject(new Error("RECAPTCHA_CONTAINER_MISSING"));
        requestAnimationFrame(() => attempt(remaining - 1));
      };
      attempt(tries);
    });

  const createPhoneRecaptcha = async (containerId: string) => {
    // Clear any existing verifier first
    clearPhoneRecaptcha();
    // Ensure the container is empty so a fresh widget can render after a prior failure
    const container = typeof document !== "undefined" ? document.getElementById(containerId) : null;
    if (container) container.innerHTML = "";
    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => undefined,
      "expired-callback": () => undefined,
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };


  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const appU = await fetchAppUser(user.uid);
        setAppUser(appU);
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, name: string, phone: string, gender: Gender) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      phone,
      email,
      gender,
      role: "member",
      status: "pending",
      isActive: false,
      emailVerified: false,
      phoneVerified: false,
      joinedAt: Timestamp.now(),
    });
    await sendEmailVerification(cred.user);
    setFirebaseUser(cred.user);
    const appU = await fetchAppUser(cred.user.uid);
    setAppUser(appU);
  };

  const resendEmailVerification = async () => {
    if (!auth.currentUser) throw new Error("NOT_SIGNED_IN");
    await sendEmailVerification(auth.currentUser);
  };

  const sendPhoneOtp = async (
    phoneNumber: string,
    recaptchaContainerId: string = RECAPTCHA_CONTAINER_ID
  ) => {
    if (!auth.currentUser) throw new Error("NOT_SIGNED_IN");

    const normalized = normalizePhone(phoneNumber);
    if (!isValidE164(normalized)) {
      throw new Error("INVALID_PHONE");
    }

    try {
      const verifier = await createPhoneRecaptcha(recaptchaContainerId);
      phoneConfirmationRef.current = await linkWithPhoneNumber(
        auth.currentUser,
        normalized,
        verifier
      );
    } catch (err) {
      clearPhoneRecaptcha();
      throw err;
    }
  };

  const confirmPhoneOtp = async (code: string) => {
    if (!phoneConfirmationRef.current) throw new Error("OTP_NOT_SENT");
    await phoneConfirmationRef.current.confirm(code);
    phoneConfirmationRef.current = null;
    clearPhoneRecaptcha();
    await reloadFirebaseUser();
  };

  const activateAccount = async (): Promise<ActivateAccountResult> => {
    await reloadFirebaseUser();
    const user = auth.currentUser;
    if (!user) throw new Error("NOT_SIGNED_IN");
    if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");
    if (!user.phoneNumber) throw new Error("PHONE_NOT_VERIFIED");

    // Force-refresh the ID token so Firestore rules see email_verified + phone_number claims
    await user.getIdToken(true);

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("USER_PROFILE_NOT_FOUND");
    }

    const userData = userSnap.data() as AppUser;

    if (userData.role !== "member") {
      throw new Error("ONLY_MEMBERS_CAN_ACTIVATE");
    }

    if (userData.status === "active" && userData.isActive === true) {
      return { success: true, alreadyActive: true, assignedAdminId: userData.assignedAdminId ?? null };
    }

    if (userData.status !== "pending") {
      throw new Error("ACCOUNT_NOT_ELIGIBLE_FOR_ACTIVATION");
    }

    // Fetch eligible admins
    const adminsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "admin")));
    const admins: AdminUser[] = adminsSnap.docs.map((d) => ({
      id: d.id,
      name: (d.data().name as string) || "",
      gender: d.data().gender as "male" | "female" | undefined,
      isActive: d.data().isActive as boolean | undefined,
      role: d.data().role as string,
    }));

    // Fetch current assignment counts
    const assignmentsSnap = await getDocs(collection(db, "assignments"));
    const counts: Record<string, number> = {};
    assignmentsSnap.docs.forEach((d) => {
      const adminId = d.data().adminId as string;
      counts[adminId] = (counts[adminId] ?? 0) + 1;
    });

    // Pick best admin
    const eligible = getEligibleAdmins(admins, userData.gender as "male" | "female" | undefined);
    const bestAdmin = pickLeastLoadedAdmin(eligible, counts);

    // Clean up existing assignments
    const existingAssignments = await getDocs(query(collection(db, "assignments"), where("memberId", "==", user.uid)));
    const batchPromises = existingAssignments.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(batchPromises);

    // Update user status
    const updateData: any = {
      status: "active",
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      activatedAt: serverTimestamp(),
    };

    if (bestAdmin) {
      // Create new assignment
      const assignmentRef = doc(collection(db, "assignments"));
      await setDoc(assignmentRef, {
        adminId: bestAdmin.id,
        memberId: user.uid,
        assignedAt: serverTimestamp(),
      });
      updateData.assignedAdminId = bestAdmin.id;
    }

    await updateDoc(userRef, updateData);
    await reloadFirebaseUser();
    await refreshUser();

    return {
      success: true,
      assignedAdminId: bestAdmin?.id ?? null,
      noAdminAvailable: !bestAdmin,
    };
  };


  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const existing = await fetchAppUser(cred.user.uid);
    if (!existing) {
      await signOut(auth);
      throw new Error("SIGN_UP_REQUIRED");
    }
  };

  const logout = async () => {
    clearPhoneRecaptcha();
    phoneConfirmationRef.current = null;
    await signOut(auth);
    setAppUser(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const changePassword = async (newPassword: string) => {
    if (auth.currentUser) {
      await updatePassword(auth.currentUser, newPassword);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        loading,
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword,
        changePassword,
        refreshUser,
        reloadFirebaseUser,
        resendEmailVerification,
        clearPhoneRecaptcha,
        sendPhoneOtp,
        confirmPhoneOtp,
        activateAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
