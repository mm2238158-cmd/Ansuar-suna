

# Plan — Role Governance Safeguards + Storage Permissions

## Decisions locked in
- **Governance**: Founder-only mints super_admins
- **Founder**: Manual `isFounder: true` flag set in Firebase Console
- **Audit logs**: Deferred

## What gets built

### 1. Storage rules (fixes the upload error)
Create `storage.rules` with RBAC:
- Members can write to `payments/{their_uid}/...` only — images only, < 1 MB
- Members read their own screenshots
- Assigned admins read screenshots of their assigned members
- Super admins: full read
- Everything else: deny

Register in `firebase.json` so `firebase deploy --only storage` works.

### 2. Firestore rules hardening (`firestore.rules`)
Add to the `users/{userId}` update branch:
- **Founder protection**: any change to a user with `isFounder: true` is denied unless the requester *is* that founder
- **Self role/status protection**: a super_admin cannot modify their own `role`, `status`, or `isActive`
- **Founder-only super_admin minting**: only the founder can set `role == "super_admin"` on any user (other super_admins can manage member/admin roles only)
- **`isFounder` is immutable**: cannot be set or cleared via app writes (must be done in console)

Last-super-admin guard stays in the UI (Firestore rules can't count documents inline).

### 3. Type update (`src/lib/types.ts`)
Add `isFounder?: boolean` to `AppUser`.

### 4. UI safeguards (`src/pages/superadmin/SuperAdminUsers.tsx`)
- Disable role dropdown + deactivate button on the **current user's own row**
- Disable role dropdown + deactivate button on any **founder** row (unless current user is the founder)
- Show a small "Founder" / "You" badge on those rows
- **Confirmation dialog** before promoting any user to `super_admin` (lists implications)
- **Pre-flight check**: before demoting or deactivating any super_admin, count active super_admins; if it's the last one, refuse with a toast
- Hide the "promote to super_admin" option entirely when the current user is not the founder

### 5. Deployment instructions
After code lands, you run:
- Firestore rules: paste updated `firestore.rules` in console **or** `firebase deploy --only firestore:rules`
- Storage rules: paste new `storage.rules` in Firebase Console → Storage → Rules **or** `firebase deploy --only storage`
- One-time: in Firestore console, edit your founder user document and add `isFounder: true`

## Files touched
- `storage.rules` (new)
- `firebase.json` (add storage block)
- `firestore.rules` (governance rules)
- `src/lib/types.ts` (add `isFounder`)
- `src/pages/superadmin/SuperAdminUsers.tsx` (UI guards + confirmation + last-admin check)

## Out of scope (per your decision)
- `auditLogs` collection + viewer — deferred to a follow-up task

