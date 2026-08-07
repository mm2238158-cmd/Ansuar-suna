import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
export const googleProvider = new GoogleAuthProvider();

/**
 * App Check (reCAPTCHA v3).
 * Opt-in: only initializes when VITE_APPCHECK_SITE_KEY is provided, so dev and
 * preview environments keep working without any console configuration.
 * IMPORTANT: keep this separate from Firebase Phone Auth's own reCAPTCHA.
 */
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY as string | undefined;
if (appCheckSiteKey && typeof window !== "undefined") {
  void (async () => {
    try {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import("firebase/app-check");
      if (import.meta.env.DEV) {
        // Lets localhost register a debug token in the Firebase console.
        (window as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      console.warn("[firebase] App Check initialization skipped", err);
    }
  })();
}

/** Analytics — the config already carries a measurementId; use it when supported. */
if (typeof window !== "undefined" && import.meta.env.PROD) {
  void (async () => {
    try {
      const { getAnalytics, isSupported } = await import("firebase/analytics");
      if (await isSupported()) getAnalytics(app);
    } catch {
      /* analytics is best-effort */
    }
  })();
}

export default app;
