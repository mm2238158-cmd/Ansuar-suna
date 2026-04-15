

# Deploy Firestore Rules & Indexes

Since Lovable can't run the Firebase CLI directly, here are your two options:

## Option A: Firebase Console (Manual — No CLI needed)

### Rules
1. Go to [Firebase Console](https://console.firebase.google.com) → your project **ansuarusunacharityms**
2. Navigate to **Firestore Database → Rules**
3. Delete the existing rules and paste the entire contents of your `firestore.rules` file
4. Click **Publish**

### Indexes
1. In Firestore, go to the **Indexes** tab
2. Create these 4 composite indexes manually:

| Collection | Field 1 | Field 2 |
|---|---|---|
| `payments` | `userId` ↑ | `submittedAt` ↓ |
| `notifications` | `userId` ↑ | `createdAt` ↓ |
| `announcements` | `target` ↑ | `createdAt` ↓ |
| `months` | `status` ↑ | `createdAt` ↓ |

## Option B: Firebase CLI (Recommended if you have Node.js)

Run these commands in your local terminal:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes --project ansuarusunacharityms
```

This uses the `firebase.json`, `firestore.rules`, and `firestore.indexes.json` files already in your project.

---

**No code changes needed** — this is purely a Firebase deployment step on your end.

