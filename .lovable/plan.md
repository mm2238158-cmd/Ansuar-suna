# Fix login redirect + rebuild admin assignment

## 1. No more "verify account" flash on login

Cause (confirmed in `src/contexts/AuthContext.tsx`): after the first page load, `loading` is already `false`. When a user signs in, the sign-in listener sets the Firebase user immediately but the member profile is fetched a moment later, so for those 1-3 seconds the app sees "signed in, no profile" and sends everyone to the verify page.

Fix: keep the app in its loading state until the profile has actually been read.
- Set `loading` back to `true` whenever the signed-in account changes, and only clear it after the profile fetch finishes (success or failure).
- Guard the route checks so a missing profile only redirects once loading is genuinely done.

Result: members, admins and super admins land straight on their own home page.

## 2. Remove automatic assignment

- `activateAccount()` in `AuthContext.tsx`: strip out the admin lookup, load counting, assignment creation and `assignedAdminId` write. Activation only flips the account to active after email verification.
- Delete the now-unused `src/lib/assignment.ts` and the auto-pick helper `pickLeastLoadedAdmin` in `src/lib/assignment-utils.ts` (keep the counting helper, which the new page uses).
- Remove the "assign admin" dialog and its column/actions from `src/pages/superadmin/SuperAdminUsers.tsx`; that page goes back to being purely user management (roles, activate/deactivate).
- Tighten `firestore.rules`: members can no longer create or delete assignment records; only a super admin may create, change or delete them. Members/admins keep read access to their own records.
- Retire the "no admin available" activation messages in the three language files.

## 3. New page: Super Admin > Assignments

New route `/assignments` (`src/pages/superadmin/SuperAdminUserAssignments.tsx`), added to the super-admin sidebar and mobile navigation with its own icon.

Layout, responsive by design:
- Top summary: total active members, how many are assigned, how many are unassigned.
- Filter row: search by name/phone/email, filter by Unassigned / Assigned / a specific admin, optional gender filter.
- Admin panel: every active admin as a card showing name, gender and current member count, so load is visible at a glance.
- Member list: cards on phones, a table on desktop. Each row shows the member, their gender and their current admin, with a dropdown to pick a new admin and a button to unassign.

Actions:
- Assign or reassign one member: replaces any existing assignment record and updates the member's admin field in one go.
- Unassign: removes the record and clears the field.
- Bulk assign: tick several members, choose an admin, apply in one batch.
- "Balance unassigned": one click spreads all currently unassigned members across admins evenly (respecting gender match where both sides have a gender set). Shows a preview count before confirming.

Everything is written through a single shared helper so the member document and the assignment record can never drift apart. Each action writes an audit entry and shows a success/failure message; all labels added to English, Amharic and Oromo.

## Technical notes

- Files touched: `src/contexts/AuthContext.tsx`, `src/App.tsx`, `src/components/layout/DesktopSidebar.tsx`, `src/components/layout/BottomNav.tsx`, `src/pages/superadmin/SuperAdminUsers.tsx`, `firestore.rules`, `src/i18n/{en,am,om}.ts`, `src/lib/assignment-utils.ts` (rewrite as the single write API: `assignMember`, `unassignMember`, `bulkAssign`, `fetchAdminAssignmentCounts`, `balanceUnassigned`), delete `src/lib/assignment.ts`.
- New page uses `onSnapshot` on `users` and `assignments`, `writeBatch` for bulk operations, and the existing shared `ListToolbar` / `EmptyState` / `ListSkeleton` components.
- Rules change requires a deploy afterwards: `npm run rules:deploy`.
- Existing assignment records stay valid; nothing needs migrating.
