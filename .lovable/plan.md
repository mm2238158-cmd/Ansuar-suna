# Final Pass: Clearing "Requires Human Decision" and "Not Applicable"

Goal: land everything from the audit that can be implemented in code, and reduce the remaining human steps to a short console checklist rather than blocking work.

## 1. Items previously blocked on humans — now implemented in code

| Item | Approach |
|---|---|
| Firebase App Check | Add a guarded initializer in `src/lib/firebase.ts` using reCAPTCHA v3. Reads `VITE_APPCHECK_SITE_KEY`; if absent, App Check is skipped silently so dev/preview keeps working. Debug token auto-enabled in dev. Human step shrinks to: paste one site key. |
| Error logging / monitoring | Add `src/lib/logger.ts` — a single `logError(scope, err, meta)` used by all `catch` blocks. Ships to console always, and to Sentry only if `VITE_SENTRY_DSN` exists (dynamic import, no bundle cost when unset). Replaces raw `err.message` toasts with safe user-facing text. |
| Service worker / real PWA | Add `vite-plugin-pwa` (generateSW, `injectRegister: null`, `devOptions.enabled: false`) plus a guarded registration wrapper that refuses to register in dev, iframes, and any Lovable preview host, and supports `?sw=off`. NetworkFirst for navigations, CacheFirst for hashed assets. |
| Missing PWA icons | Generate `logo-192.png`, `logo-512.png`, and maskable icon into `public/`, wire into `manifest.json` and `index.html`. |
| Firestore backups | Cannot be created from app code (needs GCP scheduler + billing). Add `docs/RUNBOOK.md` with exact `gcloud firestore export` schedule commands, restore steps, and an incident checklist. Stays a human action, but fully scripted. |
| Firebase Analytics | Initialize `getAnalytics` behind `isSupported()` so the existing `measurementId` is actually used. |

## 2. Recommended items to complete

- **CSV export** for payments and users (super admin) — client-side blob download, respects current filters.
- **Search inputs** on Users, Payments, Admin Members (debounced, client-side over loaded page).
- **Pagination** on Users and Payments via Firestore `startAfter` cursors, page size 25.
- **React Query migration** for the heaviest reads (dashboard, users, payments) — caching, dedup, background refetch; `onSnapshot` for the admin verification queue so approvals appear live.
- **Loading skeletons + real empty states** (icon, one-line explanation, primary CTA) across Member/Admin/SuperAdmin pages.
- **Shared components**: extract `PaymentReviewDialog` and `UserRoleBadge` from the duplicated Admin/SuperAdmin code.
- **Penalty logic**: read `penaltyEnabled` / `penaltyAmount` at payment submission and verification; show expected total to the member, include penalties in `totalCollected`. (Settings currently misleads users.)
- **Payment screenshots**: `loading="lazy"`, sensible sizing, and zoom/expand in the review dialog so tall receipts aren't cropped.
- **i18n all toast titles** across EN/AM/OM — no more hardcoded "Error", "Role updated", etc.
- **Accessibility**: `htmlFor`/`id` on all form labels, `aria-label` on icon-only buttons, focus rings preserved.
- **zod schemas** extended to profile, month, announcement, and payment forms (register already done).
- **Tests**: unit tests for `assignment.ts`, `month-utils.ts`, `phone-utils.ts`, and the new logger; a smoke render test for MemberHome.
- **Data Health safety**: replace `window.confirm` with a typed-confirmation dialog and a dry-run preview listing exactly what would be deleted.

## 3. Nice-to-have to include

- Adaptive/lazy image loading already covered above.
- Dark mode via the existing token system (toggle in Profile).
- Audit log collection `auditLogs` written on role change, payment verify/reject, and destructive Data Health actions, with rules allowing super-admin read and no client deletes.
- CSV-based analytics chart (recharts) on the SuperAdmin dashboard: last 6 months collected vs expected.

Explicitly **not** doing: in-app PDF receipts, email/SMS status notifications, and the attendance module — each needs Cloud Functions or a paid provider and is a separate project.

## Technical notes

- New deps: `vite-plugin-pwa`, `workbox-window` (transitively), optional `@sentry/react` only if a DSN is provided.
- New env vars (all optional, app degrades gracefully): `VITE_APPCHECK_SITE_KEY`, `VITE_SENTRY_DSN`.
- Firestore rules gain an `auditLogs` block: super-admin read, authenticated create with server timestamp, no update/delete.
- New index needed: `payments (monthId ASC, status ASC)` and `payments (submittedAt DESC)` for pagination — added to `firestore.indexes.json`.
- After this lands you must run `npm run rules:deploy` again (rules + indexes changed).

## Remaining human-only steps after this pass

1. Register a reCAPTCHA v3 key and paste it as `VITE_APPCHECK_SITE_KEY`, then enable App Check enforcement in Firebase Console.
2. Schedule Firestore exports with the commands in `docs/RUNBOOK.md`.
3. Optional: create a Sentry project and paste the DSN.
4. Deploy rules + indexes.

## Expected score after this pass

Security 8, Performance 8, UI/UX 9, Architecture 8, Business Logic 8, Scalability 8, Maintainability 8, Deployment 7, Testing 6, Documentation 8 — roughly **80/100**, i.e. "Yes, ready for a controlled production rollout" once the four console steps above are done. It does not reach the 90s without Cloud Functions moving activation, penalties, and late-detection fully server-side.
