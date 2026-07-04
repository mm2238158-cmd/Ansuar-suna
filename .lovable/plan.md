# Plan — Fix Phone Verification (SMS not sending / reCAPTCHA Enterprise error)

## Root cause

The error `Failed to verify with reCAPTCHA Enterprise` + `400 sendVerificationCode` means Firebase is still trying to verify calls through **reCAPTCHA Enterprise**, but the enterprise provider is either not configured or the current origin isn't authorized.

This is **not** the App Check setting you already removed — it's a **separate** setting on the Authentication service itself:

> Firebase Console → Authentication → Settings → **reCAPTCHA Enterprise** tab
> ("Protect phone provider from abuse")

When that tab is set to **Enforce** (or its site key was removed) all phone auth calls fail with exactly this error. It has to be either turned OFF (falls back to classic invisible reCAPTCHA v2 which the SDK bundles automatically — no config needed) or fully configured with a valid site key + all required domains.

Since you want the simple built-in flow, we'll turn it off and clean up code + docs.

The client code itself (`AuthContext.createPhoneRecaptcha`, `linkWithPhoneNumber`, `VerifyAccount.tsx`) is correct — it's already using the recommended pattern. No functional rewrite needed, just a few robustness tweaks and clearer error messages.

## What you must do in the Firebase Console (I cannot do this for you)

Ordered, each step is 30 seconds.

1. **Authentication → Sign-in method → Phone** — make sure the provider is **enabled**.
2. **Authentication → Settings → Authorized domains** — add all of:
   - `localhost`
   - `ansuarusunacharityms.firebaseapp.com` (default; usually present)
   - `id-preview--0191d12d-f5fd-4987-84e5-e3995d4c670c.lovable.app` (your current Lovable preview)
   - Any published `*.lovable.app` domain
   - Your custom production domain (if any)
3. **Authentication → Settings → reCAPTCHA Enterprise** tab → set to **OFF / Audit only** (not Enforce). If it shows a site key, note it but disable enforcement. This makes phone auth fall back to the classic invisible reCAPTCHA v2 that the Firebase SDK handles automatically.
4. **App Check** → confirm no provider is registered for the `identitytoolkit.googleapis.com` API (you said you removed it — this is the second-check).
5. Wait ~1 minute for propagation, then hard-refresh the app.

## Code changes (small, defensive)

### `src/contexts/AuthContext.tsx`
- Replace the vague `console.log` reCAPTCHA callbacks with silent no-ops (they leak noise in prod).
- After a failed `linkWithPhoneNumber`, guarantee the container `<div>` is emptied so a retry can render a fresh widget (currently we clear the verifier object but Firebase leaves DOM nodes behind on some error paths, which breaks re-render).
- Surface a friendlier error when the SDK reports the enterprise / auth-domain problem so you don't have to open DevTools next time.

### `src/lib/auth-errors.ts`
- Map two more Firebase codes to translated strings:
  - `auth/internal-error` when the message contains `"reCAPTCHA Enterprise"` → point the user to Auth Settings.
  - `auth/unauthorized-domain` → point the user to Authorized domains.

### `src/i18n/{en,am,om}.ts`
- Add matching keys: `authRecaptchaEnterprise`, `authUnauthorizedDomain`.

### `src/pages/VerifyAccount.tsx`
- Render the reCAPTCHA container **outside** the conditional block so it's always mounted the moment the section is visible. Prevents a race where "Send OTP" is clicked before the container is in the DOM after a state flip.
- Show the friendlier error text from `auth-errors` verbatim (already wired via toast).

### `.env`
- Remove the stale `VITE_RECAPTCHA_SITE_KEY` — it is unused (nothing in `src/` references it) and confuses future debugging. If you keep it, it's harmless but misleading.

### `README.md` (short section)
- Add a "Phone verification setup" block documenting the 5 console steps above so this doesn't get re-broken later.

## Files touched
- `src/contexts/AuthContext.tsx` — silent recaptcha callbacks, container cleanup on error
- `src/lib/auth-errors.ts` — map enterprise + unauthorized-domain errors
- `src/i18n/en.ts`, `am.ts`, `om.ts` — 2 new keys each
- `src/pages/VerifyAccount.tsx` — always-mounted container, no logic change
- `.env` — drop unused key
- `README.md` — 10-line setup note

## Out of scope
- Migrating to reCAPTCHA Enterprise properly (only relevant if abuse becomes a problem; today the classic v2 SDK-managed flow is enough)
- Changing from `linkWithPhoneNumber` to any other flow — the current approach is correct for "verify an existing user's phone"
- Cloud Functions changes — `activateAccount` already correctly requires `authUser.phoneNumber`