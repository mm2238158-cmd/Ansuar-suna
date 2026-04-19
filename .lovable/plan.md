

# Plan — Member Home Refinement + Admin/SuperAdmin Polish

## Part 1 — MemberHome refinement (`src/pages/member/MemberHome.tsx`)

**A. Current Month card restructure** (main focus = action)
- Header row: title + status badge inline next to amount (tighter visual grouping)
- Amount row prominent
- **Status feedback message** below amount based on `currentPayment.status`:
  - approved → "Payment completed successfully" (success tone)
  - pending → "Awaiting admin review" (warning tone)
  - rejected → admin comment + "Please re-upload" (destructive tone)
  - none → "Please complete your payment before deadline" (muted tone)
- **Countdown reduced**: smaller number size (`text-lg` instead of `text-2xl`), more compact padding
- **Progress bar** gets a label row: "Time remaining" on left, `XX% left` on right
- **Primary action button INSIDE the card**, centered, prominent (h-14, full width, gradient + shadow):
  - no payment → "Upload Payment" → links to `/payments?upload=true`
  - pending → disabled "Awaiting Review" with clock icon
  - approved → "View Receipt" (opens screenshot in new tab) — secondary style
  - rejected → "Re-upload Payment" (destructive-toned primary)

**B. Summary cards softened**
- Remove colored borders, use `bg-muted/30` neutral background
- Keep colored icon + colored number only
- Lighter visual weight, no `border-*` color rings

**C. Next Month Preview** (new small section)
- Query the next non-open month (status `upcoming` or by `createdAt` after current) limited to 1
- Render as compact card: "Next: <name> — <amount> ETB" with `CalendarDays` icon, muted styling
- If none exists, hide the section

**D. Hierarchy adjustments**
- Order: Summary → Current Month (with action) → Next Month preview → Quick Links
- Reduced countdown emphasis ensures action button is the main focal point

## Part 2 — AdminPayments priority visualization (`src/pages/admin/AdminPayments.tsx`)

- **Pending payments**: card/row gets `bg-warning/5 border-l-4 border-l-warning` for visual priority
- **Approved**: muted `opacity-70` + neutral background
- **Rejected**: subtle destructive tint `bg-destructive/5`
- Default sort already by `submittedAt desc` — additionally re-sort filtered list so pending appears first when "all" filter is selected
- Mobile cards: pending shows a subtle "Action needed" pill above member name
- Desktop table: same row tinting via `className` per status

## Part 3 — SuperAdminDashboard improvements (`src/pages/superadmin/SuperAdminDashboard.tsx`)

**A. Priority metrics (hero row)** — 2 large cards on top:
- **Pending Approvals** (gold/warning gradient) — count + small caption "Members awaiting approval" + "Review now" button → `/super-admin/users?status=pending`
- **Total Collected** (primary gradient) — large amount + caption "Across all approved payments"

**B. Trend indicators** (lightweight, no new collection)
- Compute approved payments in last 30 days vs prior 30 days from existing payments query (using `verifiedAt`)
- Show small `↑ 12%` / `↓ 5%` next to Total Collected and Approved counts, color-coded
- If no historical data, hide the indicator (no fake data)

**C. Quick Actions section** (3 buttons in a row)
- "Create Month" → navigates to `/super-admin/payments` (existing month management lives there)
- "Assign Members" → navigates to `/super-admin/users`
- "View Pending Payments" → navigates to `/super-admin/payments?status=pending`
- Use outline/secondary variant with leading icons (`Plus`, `UserPlus`, `Clock`)

**D. Secondary metrics row** — remaining cards (Active Members, Total Admins, Approved, Pending Payments, Rejected) in smaller grid below, less visual weight

**E. Spacing & hierarchy**
- Section headers: "Priority", "Quick Actions", "Overview"
- Consistent `space-y-6`, gold/brown accents preserved

## Part 4 — i18n additions
Add keys to `src/i18n/{en,am,om}.ts`:
- `member.statusMessage.approved/pending/rejected/notSubmitted`
- `member.viewReceipt`, `member.reupload`, `member.awaitingReview`, `member.timeRemaining`, `member.percentLeft`, `member.nextMonth`
- `superAdmin.priorityMetrics`, `superAdmin.quickActions`, `superAdmin.overview`, `superAdmin.createMonth`, `superAdmin.assignMembers`, `superAdmin.viewPending`, `superAdmin.reviewNow`, `superAdmin.vsPrev30`
- `admin.actionNeeded`

## Files touched
- `src/pages/member/MemberHome.tsx` — restructure + status messages + next month + softer summary
- `src/pages/admin/AdminPayments.tsx` — priority tinting + sort
- `src/pages/superadmin/SuperAdminDashboard.tsx` — hero metrics, trends, quick actions, hierarchy
- `src/i18n/en.ts`, `src/i18n/am.ts`, `src/i18n/om.ts` — new keys

## Out of scope
- New Firestore collections or schema changes
- Backend trend tracking (computed client-side from existing payments)
- Desktop sidebar redesign

