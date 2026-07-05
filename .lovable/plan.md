## Diagnosis

Your screenshot shows `Firebase: Error (auth/error-code:-39)` right after the console message *"Failed to verify with reCAPTCHA Enterprise. Automatically triggering the reCAPTCHA v2 flow…"*.

- The "Automatically triggering v2" line is **informational**, not the failure.
- `auth/error-code:-39` is Firebase's internal reCAPTCHA error meaning **both** the Enterprise path **and** the v2 fallback failed to produce a valid token for this domain. It is almost always a Firebase Console / domain configuration problem, not an app-code bug.

The current lovable preview domain (`*.lovableproject.com` / `id-preview--….lovable.app`) is very likely **not** in Firebase's **Authorized domains** list, and/or the project has **reCAPTCHA Enterprise enforcement = Enforce** without a real Web site key that covers this domain. When that happens Firebase tries Enterprise → fails → falls back to v2 → v2 also can't run on an unauthorized domain → `-39`.

## Plan

### 1. Firebase Console fixes (required — no code can replace these)
1. **Authentication → Settings → Authorized domains** — add:
   - `localhost`
   - `id-preview--0191d12d-f5fd-4987-84e5-e3995d4c670c.lovable.app`
   - `0191d12d-f5fd-4987-84e5-e3995d4c670c.lovableproject.com`
   - your production custom domain (when live)
2. **Authentication → Settings → reCAPTCHA Enterprise** — set enforcement to **Audit only** (or OFF) until SMS is confirmed working. Only switch back to **Enforce** after you register a real Web reCAPTCHA site key covering all the domains above.
3. **Authentication → Settings → SMS region policy** — make sure Ethiopia (+251) and any other target countries are **allowed**.
4. **Authentication → Settings → SMS fraud protection** — keep on **Don't block** while testing.

### 2. Code hardening (small, targeted)
Only changes that improve resilience and error messaging — no behavior change to the verification flow itself:

- `src/contexts/AuthContext.tsx`
  - When creating `RecaptchaVerifier`, wait for the container element to actually be in the DOM (`document.getElementById`) before construction; retry once on the next animation frame if missing. Prevents intermittent init failures on slow renders.
  - After a failed `linkWithPhoneNumber`, always `clear()` and null the verifier so the next attempt gets a fresh widget (already partly done — make it unconditional in `catch`).
  - Detect and surface these codes distinctly: `auth/error-code:-39`, `auth/captcha-check-failed`, `auth/invalid-app-credential`, `auth/unauthorized-domain`, `auth/quota-exceeded`, `auth/too-many-requests`, `auth/invalid-phone-number`.

- `src/lib/auth-errors.ts`
  - Map the codes above to clear, translated, actionable messages (e.g. `-39` → "Phone verification could not run on this domain. Add the current domain to Firebase Authorized Domains and set reCAPTCHA Enterprise to Audit only.").
  - Add matching keys to `src/i18n/en.ts`, `am.ts`, `om.ts`.

- `src/pages/VerifyAccount.tsx`
  - Keep the `<div id="recaptcha-container" />` mounted for the whole page lifecycle (already is). Ensure it is **not** conditionally rendered behind a step guard.
  - On send-OTP failure, re-render the container (key bump) so Firebase can attach a fresh widget on retry.
  - Show the new specific error strings via toast + inline helper text.

### 3. Docs update
- `README.md`: add a "Phone verification — Firebase Console checklist" section documenting the four Console settings above and the meaning of `-39`. Note that Enterprise **Enforce** requires a real registered Web site key covering every domain (preview + prod).

### 4. Verify
- After you apply the Console changes, reload the app, open Register → Verify phone step, click Send OTP. Expected: SMS arrives, no `-39`. If it still fails, the new error mapping will tell us exactly which of the four Console settings is still wrong.

## Files that will change
- `src/contexts/AuthContext.tsx` (verifier creation + error handling)
- `src/lib/auth-errors.ts` (new code mappings)
- `src/i18n/en.ts`, `src/i18n/am.ts`, `src/i18n/om.ts` (new strings)
- `src/pages/VerifyAccount.tsx` (container remount on retry, clearer errors)
- `README.md` (Console checklist)

No changes to auth logic, no new dependencies, no backend changes.