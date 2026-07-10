## Problem

Clicking **Activate account** calls the `activateAccount` Cloud Function via `httpsCallable`. It returns `internal`, which means either:

1. The Cloud Function isn't deployed to your Firebase project (very likely — there's no evidence `firebase deploy --only functions` has ever been run against `ansuarusunacharityms`), or
2. It is deployed but crashes at runtime (e.g. Firestore permission on `assignments`, cold-start error, region mismatch).

Either way, the current architecture **hard-blocks account activation on a Cloud Function** you may never be able to deploy from Lovable (Cloud Functions require the Blaze plan + a local `firebase deploy`). Your Firestore rules also explicitly forbid the `pending → active` transition from any client, so there is no fallback path today. That's the root cause of "once and for all" pain here.

## Fix — remove the Cloud Function dependency for activation

Do activation **entirely client-side**, using Firebase Auth's own verified state as the source of truth (Firestore rules can read `request.auth.token.email_verified` and `request.auth.token.phone_number`). Admin assignment stays a Super Admin responsibility (done later from the admin UI), so members are never blocked on a backend deploy.

### 1. `firestore.rules` — allow owner self-activation

Add a third branch to the `users/{userId}` `allow update` rule:

```
// Owner self-activation after verifying email + phone
|| (
  isOwnUser(userId)
  && resource.data.status == "pending"
  && request.resource.data.status == "active"
  && request.resource.data.isActive == true
  && request.auth.token.email_verified == true
  && request.auth.token.phone_number is string
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
       "status", "isActive", "emailVerified", "phoneVerified", "activatedAt"
     ])
)
```

Also remove the `!(pending → active)` block from the super-admin branch (no longer needed; owner path handles it and super admin can still edit everything else). Keep every other rule untouched.

### 2. `src/contexts/AuthContext.tsx` — replace callable with direct Firestore write

Rewrite `activateAccount()`:

- `reloadFirebaseUser()` first.
- Guard: `auth.currentUser.emailVerified` and `auth.currentUser.phoneNumber` must both be truthy — otherwise throw a clear i18n error.
- `updateDoc(doc(db, "users", uid), { status: "active", isActive: true, emailVerified: true, phoneVerified: true, activatedAt: serverTimestamp() })`.
- Return `{ success: true, noAdminAvailable: true }` (assignment happens later via Super Admin) so the existing UI shows the "activated, awaiting admin" toast.
- Drop the `httpsCallable` import and the `functions` usage from this file.

### 3. `src/pages/VerifyAccount.tsx` — clearer error

Swap `getCallableErrorMessage` for `getAuthErrorMessage` in the activate handler so Firestore permission / verification errors surface with real messages instead of the opaque "Internal".

### 4. Leave `functions/src/index.ts` alone

The Cloud Function stays in the repo for future auto-assignment work, but the app no longer depends on it being deployed.

### 5. Verify

- `tsgo` typecheck.
- Manually walk the flow in preview: verify email → verify phone (test number) → Activate account → should land on `/` with a success toast, no "internal" error.
- Confirm Firestore rules compile (via `firebase deploy --only firestore:rules` when you're ready, or the rules simulator).

## Why this ends the loop

- No Cloud Function deploy needed for signup to work.
- Rules cryptographically require `email_verified` + `phone_number` in the ID token, so the security posture is equivalent to what the function was enforcing.
- Admin assignment is decoupled — Super Admin assigns from the existing admin panel; missing assignment no longer blocks the member from finishing sign-up.
