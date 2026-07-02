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
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, googleProvider, functions } from "@/lib/firebase";
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
  initPhoneRecaptcha: (containerId: string) => void;
  sendPhoneOtp: (phoneNumber: string) => Promise<void>;
  confirmPhoneOtp: (code: string) => Promise<void>;
  activateAccount: () => Promise<ActivateAccountResult>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const normalizePhone = (phone: string) => {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("0")) return `+251${trimmed.slice(1)}`;
  return `+251${trimmed}`;
};

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

  const initPhoneRecaptcha = (containerId: string) => {
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
    recaptchaVerifierRef.current = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
    });
  };

  const sendPhoneOtp = async (phoneNumber: string) => {
    if (!auth.currentUser) throw new Error("NOT_SIGNED_IN");
    if (!recaptchaVerifierRef.current) throw new Error("RECAPTCHA_NOT_READY");

    const normalized = normalizePhone(phoneNumber);
    phoneConfirmationRef.current = await linkWithPhoneNumber(
      auth.currentUser,
      normalized,
      recaptchaVerifierRef.current
    );
  };

  const confirmPhoneOtp = async (code: string) => {
    if (!phoneConfirmationRef.current) throw new Error("OTP_NOT_SENT");
    await phoneConfirmationRef.current.confirm(code);
    phoneConfirmationRef.current = null;
    await reloadFirebaseUser();
  };

  const activateAccount = async (): Promise<ActivateAccountResult> => {
    const callable = httpsCallable<void, ActivateAccountResult>(functions, "activateAccount");
    const result = await callable();
    await reloadFirebaseUser();
    await refreshUser();
    return result.data;
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
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
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
        initPhoneRecaptcha,
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
