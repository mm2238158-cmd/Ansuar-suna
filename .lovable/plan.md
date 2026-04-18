

# Two Fixes — Storage Layout Explanation + Approve/Reject Bug

## 1. How the image upload works (and is it efficient?)

**Current flow (`src/pages/member/MemberPayments.tsx`):**
```
storageRef = `payments/${appUser.id}/${currentMonth.id}_${Date.now()}`
uploadBytes(...) → getDownloadURL(...) → store URL in Firestore payment doc
```

**Is it efficient?** Yes. Two important facts about Firebase Storage:

- **There are no real folders.** Firebase Storage is a flat object store (like S3/GCS). The "/" in `payments/userId/file` is just part of the object name. Nothing is "created" for the prefix — no extra cost, no extra latency, no metadata overhead.
- **Per-user prefixes are the recommended pattern**, because security rules match on the path (`match /payments/{userId}/{file}`) which is exactly how `storage.rules` is set up — owner-only writes, owner+admin reads.

Each payment screenshot becomes one object: `payments/<uid>/<monthId>_<timestamp>`. Unique by timestamp, scoped by user, easy to enumerate per member, easy to secure. This is the correct and efficient design — no change needed.

**One small improvement worth doing later (not now):** delete the old screenshot from Storage if a member re-uploads for the same month, so we don't accumulate orphaned files. Currently a re-upload leaves the previous file behind. Flagging only — out of scope for this fix.

## 2. The `updateDoc` error on Approve

**Error:** `Function updateDoc() called with invalid data. Unsupported field value: undefined (found in field adminComment...)`

**Root cause** — in both `SuperAdminPayments.tsx` (line 70) and `AdminPayments.tsx` (line 84):
```ts
adminComment: comment || undefined
```
When the reviewer approves without typing a comment, `comment` is `""`, so this evaluates to `undefined`. **Firestore rejects `undefined` values** — you must either omit the field entirely or pass `null`/a string.

**Fix** — only include `adminComment` in the update payload when it's a non-empty string. Build the update object conditionally:
```ts
const updates: Record<string, unknown> = {
  status,
  verifiedBy: appUser?.id,
  verifiedAt: Timestamp.now(),
};
if (comment.trim()) updates.adminComment = comment.trim();
await updateDoc(doc(db, "payments", selectedPayment.id), updates);
```

Apply the same fix in both files.

## Files touched
- `src/pages/superadmin/SuperAdminPayments.tsx` — conditional `adminComment` in `handleAction`
- `src/pages/admin/AdminPayments.tsx` — same fix

## Out of scope
- Storage cleanup of old screenshots on re-upload (note for later)
- Any UI/UX changes

