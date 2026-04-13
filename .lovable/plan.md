
# Charity Contribution Management System — MVP Plan

## Branding & Theme
- **Logo**: Embed the uploaded organization logo throughout the app
- **Colors**: Gold/brown primary (`#B8860B` / `#8B6914`), white/cream backgrounds, warm neutrals
- **Style**: Clean, minimal, soft shadows, subtle borders — respectful and professional

## Tech Stack
- React + TypeScript + Tailwind CSS + shadcn/ui
- Firebase Auth (Email/Password + Google Sign-In)
- Firestore (database)
- Firebase Storage (payment screenshot uploads)
- PWA (production-only service worker, install support)
- i18n support for English (default), Amharic, Oromo

## Authentication & Registration
- Login page with email/password and Google sign-in
- Self-registration form (name, phone, email, password)
- New users default to `pending` status — Super Admin approves before access
- Role-based redirect after login (member → home, admin → dashboard, super admin → dashboard)

## Responsive Layout
- **Mobile**: Bottom tab navigation, card-based views, large touch targets
- **Desktop/Tablet**: Left sidebar navigation, multi-column dashboard, table views for data

## Navigation by Role

### Member Tabs
1. **Home** — Current month contribution card (amount, deadline, countdown timer), quick upload button
2. **Payments** — Personal payment history (cards on mobile, table on desktop)
3. **Notifications** — Announcements + personal notifications
4. **Profile** — Edit name/phone, language selector (EN/AM/OM)

### Admin Tabs
1. **Dashboard** — Summary cards (total assigned members, approved/pending/rejected counts, amount collected)
2. **Payments** — Verification queue for assigned members; approve/reject with comments; filter by status
3. **Members** — List of assigned members with payment status indicators
4. **Profile** — Edit profile, language selector

### Super Admin Tabs
1. **Dashboard** — System-wide analytics cards (total members, total payments, approved, pending, amount collected)
2. **Payments** — All payments across system; filter/search
3. **Users** — Manage all users: approve pending registrations, assign members to admins, activate/deactivate, change roles
4. **Settings** — Monthly amount, payment deadline day, penalty toggle & amount, create monthly records, announcements

## Firestore Collections
All collections as specified: `users`, `months`, `payments`, `assignments`, `notifications`, `announcements`, `settings`

## Core Features

### Payment Flow
- Member uploads screenshot (max 1MB) → stored in Firebase Storage → URL saved in Firestore
- One payment per user per month
- Status flow: `pending` → `approved` / `rejected` → `late` (auto or manual)
- Late payments can include penalty amount from settings

### Admin Verification
- Queue view showing pending payments for assigned members
- Approve or reject with comment
- Status color coding: 🟢 approved, 🟡 pending, 🔴 rejected/late

### Super Admin Management
- Approve new user registrations
- Assign members to admins
- Create monthly contribution records (month name, amount, deadline)
- System settings (monthly amount, deadline day, penalty config)
- Send reminder notifications to unpaid users
- Post announcements (target: all / members / admins)

### Notifications & Announcements
- In-app notification list with read/unread state
- Admin announcements displayed in member notification tab
- "Send Reminder" button for admins to ping unpaid members

## Security (Firestore Rules)
- Members: read/write only own data
- Admins: read/write only assigned members' data
- Super Admins: full access

## Internationalization (i18n)
- Language context with JSON translation files for English, Amharic, Oromo
- User can switch language in Profile/Settings
- Preference saved to Firestore user profile

## PWA Setup
- Web app manifest for installability (Add to Home Screen)
- Service worker disabled in dev/preview, active only in production
- Guarded against iframe and preview hosts
