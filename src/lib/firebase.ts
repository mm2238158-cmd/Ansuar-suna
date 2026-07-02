import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCM7vX7YjBKmSQg9bb9mim0-AShv_4t33Q",
  authDomain: "ansuarusunacharityms.firebaseapp.com",
  projectId: "ansuarusunacharityms",
  storageBucket: "ansuarusunacharityms.firebasestorage.app",
  messagingSenderId: "343344669873",
  appId: "1:343344669873:web:62a1f7416d97a00c3bee90",
  measurementId: "G-T998SEDT4N",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
