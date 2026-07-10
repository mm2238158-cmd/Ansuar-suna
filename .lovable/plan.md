## Diagnosis

The latest network evidence shows two separate Firebase server responses:

1. `400 INVALID_APP_CREDENTIAL` on the Enterprise token request.
2. `503 Error code: 39` on the fallback request.

That means the app is reaching Firebase correctly, but Firebase is rejecting/restricting the phone verification request server-side. Since you already completed the Console domain/enforcement steps, the next safest path is to stop depending on real SMS while testing and add better in-app diagnostics for the remaining cases.

## Plan

### 1. Use Firebase test phone numbers for registration testing
- In Firebase Console → Authentication → Sign-in method → Phone → **Phone numbers for testing**.
- Add your test number, for example `+251715026866`, with a fixed code like `123456`.
- This bypasses real SMS delivery, toll-fraud scoring, carrier restrictions, and quota restrictions.
- You can finish testing account registration immediately without waiting for Firebase/Google SMS approval.

### 2. Update app error handling for the real observed responses
- Treat `INVALID_APP_CREDENTIAL` as a domain/site-key mismatch message.
- Treat `503 Error code: 39` as a Firebase SMS restriction/quota/region/backend restriction message, not only a reCAPTCHA setup issue.
- Show the user a clear next action: use a Firebase test phone number now, or contact Firebase support / verify billing + SMS region policy for real numbers.

### 3. Add a visible testing hint on the phone verification step
- If the app is running on Lovable preview/project domains, show a short note explaining that real SMS may be blocked by Firebase and test phone numbers are recommended during development.
- Keep this small and only near the OTP button.

### 4. Keep the existing reCAPTCHA cleanup/remount logic
- The current verifier cleanup and fresh container retry logic should stay.
- No need to rewrite the auth flow; the failure is not coming from React state or the form.

### 5. Verify
- Typecheck the frontend.
- Confirm the new messages compile in English, Amharic, and Oromo translation files.

## Technical details

Observed request:

```text
POST accounts:sendVerificationCode
Origin: https://0191d12d-f5fd-4987-84e5-e3995d4c670c.lovableproject.com
Response 1: 400 INVALID_APP_CREDENTIAL
Response 2: 503 Error code: 39
```

This confirms the remaining issue is Firebase Auth phone-verification infrastructure/configuration for real SMS, not a broken button or missing reCAPTCHA container.