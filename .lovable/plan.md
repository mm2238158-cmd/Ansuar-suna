

# Plan — Payment Review Modal + Mobile UI Polish

## Part 1 — Payment Review Modal (admin & super_admin)

Both `AdminPayments.tsx` and `SuperAdminPayments.tsx` need a unified review experience:
- Click a payment row/card → opens **Review Dialog** showing the screenshot inline (image preview, not a new tab)
- Inside the dialog: member name, month, amount, submitted date, current status, optional comment textarea
- Two action buttons: **Approve** and **Reject** (Reject requires a comment)
- After action → status updates, dialog closes, list refreshes
- Super admins get the same approve/reject powers as admins (currently they only view)

This forces reviewers to *see* the screenshot before deciding, fixing the issue that approve/reject was possible without viewing.

## Part 2 — Mobile UI Improvements

### A. AppLayout header (`src/components/layout/AppLayout.tsx`)
- Replace plain name text with **Avatar component** on the right (initials fallback, gold ring)
- Tap avatar → navigate to `/profile`
- Tighter padding, sticky header with subtle shadow

### B. MemberHome (`src/pages/member/MemberHome.tsx`)
- **Countdown card**: large card showing `Days : Hours : Minutes : Seconds` ticking each second
- **Progress bar** of remaining time vs total month duration; bar color shifts:
  - green (>50% time left) → yellow (10–50%) → red (<10% or overdue)
- **Status pill** at top of current month card: Pending / Approved / Late / Not Submitted with matching color
- **Upload button**: larger (h-14), full width, stronger shadow, icon + text, primary gradient feel
- **Quick link cards** ("Payment History" / "Notifications"):
  - Add description line ("View all your past payments" / "Stay updated with announcements")
  - Add right-arrow `→` (ChevronRight icon) indicator
  - Hover lift effect
- **Summary section** (new, above quick links): 3 small stat cards
  - Paid months (count of approved payments)
  - Pending (count of pending)
  - Missed (count of late/rejected or unpaid open months)
  - Each with icon, number, label, color-coded background

### C. BottomNav (`src/components/layout/BottomNav.tsx`)
- Active tab: filled background pill in primary/10, primary text+icon, slightly larger icon
- Inactive: brighter muted color (foreground/70 instead of muted-foreground) for better contrast
- Add subtle top divider shadow

### D. Login (`src/pages/Login.tsx`)
- Increase card max-width to `max-w-md`, more vertical padding, bigger logo halo
- Stronger shadow (`shadow-2xl`), subtle border glow
- More generous spacing between fields (space-y-5)
- Slight gold-tinted gradient background behind the card

## Files Touched
- `src/components/layout/AppLayout.tsx` — avatar header
- `src/components/layout/BottomNav.tsx` — stronger active state
- `src/pages/member/MemberHome.tsx` — countdown, progress, summary, big upload, quick-link improvements, status indicator
- `src/pages/Login.tsx` — card polish, spacing
- `src/pages/admin/AdminPayments.tsx` — review modal with inline screenshot + actions
- `src/pages/superadmin/SuperAdminPayments.tsx` — review modal with inline screenshot + approve/reject

## Out of Scope
- Desktop sidebar redesign (mobile-focused request)
- i18n string additions beyond what already exists (will reuse existing keys; add a couple of new ones to `en.ts`/`am.ts`/`om.ts` for "paid months", "missed", "review payment" descriptions)

