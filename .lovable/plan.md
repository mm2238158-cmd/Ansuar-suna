## Problem diagnosis

**1. "Missing or insufficient permissions" on production**

The `firestore.rules` file in this repo has been updated many times (owner self-activation branch, gender validation, phone removal), but **the deployed Firebase project (`ansuarusunacharityms`) is still running an older ruleset**. The Vercel deploy only ships the React app — it does **not** push `firestore.rules` to Firebase. That is the true root cause of both the registration failure and the earlier activation failure.

Secondary fragility in `activateAccount()`: it calls `getDocs(query(users, where role==admin))` and `getDocs(collection(assignments))` from a *pending* member. RLS only lets a member read admin docs where `isActive == true`, and any admin row failing that predicate fails the whole query with `permission-denied`. So even with correct rules, activation can break the moment an inactive admin exists.

**2. Super Admin Dashboard is cluttered**

Current layout mixes 2 hero cards + 4 quick actions + 5 secondary cards + trend chips = visual noise, competing emphases, redundant links (`/payments` appears twice), and metrics that don't drive action (rejected count, admins count).

---

## Plan

### Step 1 — Make registration & activation permanently unblockable on production

**A. Deploy the rules (one-time user action, cannot be automated from Lovable)**

Add a short note in the plan output telling the user to run:

```
firebase deploy --only firestore:rules,storage
```

from their local machine (or wire it into their Vercel build). Without this, no code change here fixes production.

**B. Harden `activateAccount()` so it never depends on reading other users/assignments**

Rewrite `src/contexts/AuthContext.tsx` `activateAccount()` to do the minimum:

1. Reload user, force ID token refresh.
2. `updateDoc(users/{uid}, { status:"active", isActive:true, emailVerified:true, activatedAt: serverTimestamp() })`.
3. Return `{ success:true, noAdminAvailable:true }` (Super Admin will assign later from the Users page — that flow already exists).

Drop the admin query, assignments query, assignment create, and delete logic entirely from the member-side path. Admin auto-assignment stays available inside Super Admin tools where the caller actually has permission.

**C. Simplify the matching Firestore rule**

In `firestore.rules`, the self-activation branch becomes:

```
isOwnUser(userId)
&& resource.data.status == "pending"
&& request.resource.data.status == "active"
&& request.resource.data.isActive == true
&& request.auth.token.email_verified == true
&& request.resource.data.diff(resource.data).affectedKeys()
     .hasOnly(["status","isActive","emailVerified","activatedAt"])
```

Remove `assignedAdminId` and `phoneVerified` from the allowed keys (no longer written on this path). Also remove the member-side create/delete branches on `/assignments` — they're no longer needed and were widening the surface.

**D. VerifyAccount.tsx**

Already good after the previous round; no further change needed beyond confirming the "phone step" UI is fully hidden (already done).

### Step 2 — Rebuild Super Admin Dashboard

Rewrite `src/pages/superadmin/SuperAdminDashboard.tsx` with a focused, professional layout:

```text
┌────────────────────────────────────────────────────┐
│  System Overview                                   │
│  Small greeting + last-updated timestamp           │
├────────────────────────────────────────────────────┤
│  [ Pending Approvals ]   [ Collected this month ]  │  ← 2 hero KPIs only
│   number + CTA            amount ETB + Δ vs prev   │
├────────────────────────────────────────────────────┤
│  KPI strip (4 compact tiles, no icons noise):      │
│  Active Members │ Admins │ Approved │ Pending      │
├────────────────────────────────────────────────────┤
│  Quick Actions (3 buttons max, deduped):           │
│  Review pending users │ Review pending payments │  │
│  Data health                                       │
└────────────────────────────────────────────────────┘
```

Concrete changes:

- Drop the gradient hero cards; use flat `Card` with a single accent border-left in the primary/warning color.
- Drop the "Create month" and duplicate "View pending" buttons (create-month lives on Payments page, view-pending is redundant with the Payments quick action).
- Drop the rejected-payments tile from the top view (available on Payments page).
- Keep trend chip only on "Collected" — that's the only metric where 30-day delta is meaningful.
- Add a lightweight loading skeleton (currently the page renders zeros while fetching).
- Fetch once with `Promise.all([usersSnap, paymentsSnap])`.
- Keep i18n keys already defined; no new translations required (reuse `pendingApprovals`, `totalCollected`, `activeMembers`, `totalAdmins`, `approvedPayments`, `pendingPayments`, `quickActions`, `overview`).

No routing, types, or i18n file changes.

---

## Files touched

- `firestore.rules` — trim self-activation rule; remove member branches on `/assignments`.
- `src/contexts/AuthContext.tsx` — slim `activateAccount()` to a single `updateDoc`.
- `src/pages/superadmin/SuperAdminDashboard.tsx` — rewritten for clarity.

## User action required after implementation

Run once from a terminal that has Firebase CLI configured for project `ansuarusunacharityms`:

```
firebase deploy --only firestore:rules
```

Until this is run, production will keep showing "Missing or insufficient permissions" no matter what we change in code.  
  
BUT DURING ACCOUNT ACTIVATION, I WANT USERS TO BE AUTOMATICALLY ASSIGNED TO LEAST LOADED AND GENDER MATCHING ADMINS!