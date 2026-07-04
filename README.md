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
3. **Authentication → Settings → reCAPTCHA Enterprise** tab — set to **OFF**
   or **Audit only** (not Enforce). The Firebase JS SDK ships its own invisible
   reCAPTCHA v2 for phone auth; enforce mode requires a fully configured
   Enterprise site key and is not needed here.
4. **App Check** — no provider should be registered for
   `identitytoolkit.googleapis.com` unless you also configure Enterprise above.
5. Wait ~1 min for propagation, hard-refresh, retry.
