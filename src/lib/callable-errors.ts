import { FirebaseError } from "firebase/app";

export const getCallableErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof FirebaseError) {
    if (err.code === "functions/not-found" || err.code === "functions/unavailable") {
      return "Activation service is not deployed yet. Please deploy Cloud Functions and try again.";
    }
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
};
