import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, collection, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { normalizePhone } from "@/lib/phone-utils";
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
  refreshUser: () => Promise<void>;
  reloadFirebaseUser: () => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  activateAccount: () => Promise<ActivateAccountResult>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

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
    const normalizedPhone = normalizePhone(phone);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name: name.trim(),
      phone: normalizedPhone,
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


  const activateAccount = async (): Promise<ActivateAccountResult> => {
    await reloadFirebaseUser();
    const user = auth.currentUser;
    if (!user) throw new Error("NOT_SIGNED_IN");
    if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

    // Force-refresh the ID token so Firestore rules see email_verified claim
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

    // Fetch eligible admins (filter isActive==true so Firestore rules permit the read)
    const adminsSnap = await getDocs(
      query(collection(db, "users"), where("role", "==", "admin"), where("isActive", "==", true))
    );
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
      phoneVerified: false,
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
    await signOut(auth);
    setAppUser(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
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
        refreshUser,
        reloadFirebaseUser,
        resendEmailVerification,
        activateAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
