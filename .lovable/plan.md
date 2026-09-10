# Users table cleanup, profile photos, fixed sidebar

## 1. Manage Users: drop the gender column, better "promote to admin"

- Remove the Gender column from the desktop table and the gender dropdown from the mobile cards. Gender is still used to match members with admins, so it stays on the account — it is just no longer edited inline in this list.
- Replace the inline role dropdown with a single **Manage role** button per user that opens one clear dialog:
  - Shows the person's name, email, current role.
  - Role choices: Member, Admin, Super Admin (Super Admin only visible to the founder).
  - Choosing **Admin** reveals a required Male/Female choice (needed for member matching), pre-filled if already known.
  - Choosing **Super Admin** shows the existing high-privilege warning list.
  - Explains what each role can do, then a Confirm button. Nothing changes until Confirm.
- Keep all existing safety rules: cannot change your own role, founder protected, cannot demote the last active super admin, only the founder can mint super admins. Keep the audit log entries.
- Gender stays in the CSV export.

## 2. Profile photo (avatar) for every signed-in user

- On the Profile page, add an avatar block: current photo (or initials), **Upload photo**, **Change**, **Remove**.
- Accepts image files only, max 1 MB; larger or non-image files are rejected with a clear message before upload.
- Stored in Cloud Storage under `avatars/{uid}/`; the download URL is saved on the user's record as `photoURL`, replacing any previous file.
- The avatar then shows in the mobile header, the desktop sidebar, and the Manage Users list instead of the generic icon.
- Available to members, admins and super admins alike.

## 3. Static sidebar on large screens

- The desktop sidebar becomes fixed full-height: it stays in place while only the page content scrolls, with its own scroll if the link list ever gets long.
- Mobile layout (top bar + bottom nav) is unchanged.

## Technical notes

- `src/pages/superadmin/SuperAdminUsers.tsx`: remove gender cell/select and the inline role `Select`; merge `promoteDialog` + `adminRoleDialog` into one `roleDialog` state driving a single dialog; reuse `performRoleChange`, guards and `writeAuditLog`.
- `src/pages/Profile.tsx`: file input + `uploadBytes`/`getDownloadURL` from `firebase/storage`, `deleteObject` on remove/replace, size guard `<= 1MB`, `updateDoc(users/{uid}, { photoURL })`, then `refreshUser()`.
- `src/lib/types.ts`: add `photoURL?: string` to `AppUser`.
- `firestore.rules`: add `photoURL` to the owner self-edit `affectedKeys` allowlist.
- `storage.rules`: new `match /avatars/{userId}/{fileName}` — read for any signed-in user, create/update/delete only by the owner (or super admin), `request.resource.size < 1MB` and `contentType.matches('image/.*')`.
- `AppLayout.tsx` / `DesktopSidebar.tsx`: sidebar `md:fixed md:inset-y-0 md:w-64 md:h-screen md:overflow-y-auto`, content wrapper gets `md:pl-64`; keep `main` as the scroll area.
- New i18n keys (EN/AM/OM) for the role dialog and avatar actions/errors.
- Requires deploying rules afterwards with `npm run rules:deploy`.
