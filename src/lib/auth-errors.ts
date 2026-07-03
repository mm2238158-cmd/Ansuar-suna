import { FirebaseError } from "firebase/app";
import type { TranslationKeys } from "@/i18n/en";

type AuthMessages = TranslationKeys["auth"];

export const getAuthErrorMessage = (err: unknown, messages: AuthMessages): string => {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/captcha-check-failed":
        return messages.authCaptchaFailed;
      case "auth/invalid-phone-number":
        return messages.authInvalidPhone;
      case "auth/too-many-requests":
        return messages.authTooManyRequests;
      case "auth/code-expired":
        return messages.authCodeExpired;
      case "auth/invalid-verification-code":
        return messages.authInvalidVerificationCode;
      case "auth/missing-verification-code":
        return messages.authInvalidVerificationCode;
      case "auth/credential-already-in-use":
        return messages.authPhoneAlreadyInUse;
      case "auth/provider-already-linked":
        return messages.authPhoneAlreadyLinked;
      default:
        return err.message || messages.authGenericError;
    }
  }

  if (err instanceof Error) {
    switch (err.message) {
      case "NOT_SIGNED_IN":
        return messages.authNotSignedIn;
      case "INVALID_PHONE":
        return messages.authInvalidPhone;
      case "OTP_NOT_SENT":
        return messages.authOtpNotSent;
      default:
        return err.message || messages.authGenericError;
    }
  }

  return messages.authGenericError;
};
