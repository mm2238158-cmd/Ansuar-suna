## What your screenshot shows

- **Phone auth enforcement: ENFORCE** — Firebase requires a valid reCAPTCHA Enterprise token for every `sendVerificationCode` call.
- **SMS fraud threshold: Block some (0.5)** — any request scoring ≥ 0.5 is silently dropped.
- **Configured site keys: only "Ansuarusuna production key"** — that key is almost certainly restricted to your production domain, not the Lovable preview host.

Result on the preview URL (`id-preview--…lovable.app`):
1. Enterprise runs with a key that doesn't cover this domain → token invalid / low score.
2. Fraud filter (0.5) drops the SMS.
3. SDK falls back to reCAPTCHA v2, which also can't attach on an unregistered domain.
4. You get `auth/error-code:-39`.

No app code change can bypass this — it's 100% a Console config problem. Below is the exact fix.

## Plan — Firebase Console changes (do these, in order)

### 1. Authorized domains
Authentication → **Settings → Authorized domains** → Add domain, add each of:
- `localhost`
- `id-preview--0191d12d-f5fd-4987-84e5-e3995d4c670c.lovable.app`
- `0191d12d-f5fd-4987-84e5-e3995d4c670c.lovableproject.com`
- your published `*.lovable.app` host (after first publish)
- your custom production domain (when live)

### 2. Phone auth enforcement → AUDIT
Same page → **Phone authentication enforcement mode** → pencil → change **ENFORCE → AUDIT** → Save.
This lets SMS send while Firebase still scores requests, so you can confirm the flow works before re-tightening.

### 3. SMS fraud threshold → Don't block
**SMS fraud risk threshold score** → pencil → move slider all the way left to **Don't block** → Save.
`Block some (0.5)` will silently drop OTPs on preview/localhost because those domains have no device signal and always score high.

### 4. Site key coverage (only if you later switch back to ENFORCE)
**Configured platform site keys → Configure site keys →** open "Ansuarusuna production key" and add every domain from step 1 to its allowed domains list in Google Cloud reCAPTCHA console. If it can't be edited, create a new Web key covering all domains and register it here. Do **not** switch enforcement back to ENFORCE until this is done and tested.

### 5. SMS region policy
Authentication → **Settings → SMS regions** → confirm **Ethiopia (+251)** is allowed. Deny-list everything else you don't need to avoid toll fraud.

### 6. Propagation + retry
Wait ~60s, hard-refresh the app (Cmd/Ctrl-Shift-R), open Register → Verify phone → Send OTP.
Expected: SMS arrives, no `-39`.

## What I will NOT change in code

The app-side hardening (specific `-39` messaging, container remount on retry, verifier cleanup, i18n strings, README checklist) is already in place from the previous turn. There is nothing else code can do — Firebase blocks the request before the SDK can retry.

## Verify

After step 6:
- **Success** → SMS arrives, code confirms, account activates. Then optionally redo step 4 and flip enforcement back to ENFORCE for production hardening.
- **Still fails** → the new error mapping will show a specific code (`auth/unauthorized-domain`, `auth/quota-exceeded`, `auth/invalid-phone-number`, etc.) that pinpoints which of the five settings above is still wrong. Send me the new message and I'll narrow it further.

## Files that will change

None. This is a Console-only fix.
