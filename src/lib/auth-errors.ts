import { FirebaseError } from "firebase/app";
import type { TranslationKeys } from "@/i18n/en";

type AuthMessages = TranslationKeys["auth"];

export const getAuthErrorMessage = (err: unknown, messages: AuthMessages): string => {
  if (err instanceof FirebaseError) {
    const msg = err.message || "";
    // Firebase internal reCAPTCHA failure (both Enterprise + v2 fallback failed)
    if (/error-code:\s*-39/i.test(msg) || /error-code:-39/i.test(msg)) {
      return messages.authRecaptchaMinus39;
    }
    if (/reCAPTCHA Enterprise/i.test(msg)) {
      return messages.authRecaptchaEnterprise;
    }
    switch (err.code) {
      case "auth/captcha-check-failed":
        return messages.authCaptchaFailed;
      case "auth/unauthorized-domain":
        return messages.authUnauthorizedDomain;
      case "auth/invalid-app-credential":
        return messages.authRecaptchaMinus39;
      case "auth/internal-error":
        return messages.authRecaptchaEnterprise;
      case "auth/quota-exceeded":
        return messages.authTooManyRequests;
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
