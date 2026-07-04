# Ansuarusuna Charity Management

## Phone verification setup (Firebase)

If SMS OTPs don't send and you see `Failed to verify with reCAPTCHA Enterprise`
or `400 sendVerificationCode`, check the Firebase Console:

1. **Authentication → Sign-in method → Phone** — provider must be **enabled**.
2. **Authentication → Settings → Authorized domains** — add:
   - `localhost`
   - `ansuarusunacharityms.firebaseapp.com`
   - your Lovable preview host (`id-preview--<id>.lovable.app`)
   - any published `*.lovable.app` domain
   - your custom production domain
3. **Authentication → Settings → reCAPTCHA** tab:
   - **Phone authentication enforcement mode** → `AUDIT` (or `OFF`).
   - **SMS fraud risk threshold score** → **Don't block**. Any
     "Block some/most/all" setting will silently drop OTP SMS on
     localhost and preview domains because they have no device
     signal and score high. Only tighten this after you've
     registered a real Web site key under **Configured platform
     site keys** and verified prod works.

4. **App Check** — no provider should be registered for
   `identitytoolkit.googleapis.com` unless you also configure Enterprise above.
5. Wait ~1 min for propagation, hard-refresh, retry.
