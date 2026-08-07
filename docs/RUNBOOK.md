# Ansuarusuna — Operations Runbook

Everything an operator needs to keep the platform healthy. Commands assume the
`gcloud` and `firebase` CLIs are installed and authenticated against project
`ansuarusunacharityms`.

---

## 1. Deploying

| What changed | Command |
| --- | --- |
| Firestore rules / indexes / Storage rules | `npm run rules:deploy` |
| Frontend | Push to the deployment branch (Vercel builds automatically) |

Always deploy rules **before** frontend changes that depend on them.

---

## 2. Backups (scheduled Firestore exports)

Firestore exports cannot be triggered from the web app — they need a GCP
service account and a billing-enabled project. Set this up once.

### One-time setup

```bash
PROJECT=ansuarusunacharityms
BUCKET=gs://${PROJECT}-backups

# 1. Create the backup bucket (single region, near your users)
gsutil mb -p $PROJECT -l europe-west1 $BUCKET

# 2. Give the Firestore export service agent write access
gsutil iam ch \
  serviceAccount:service-$(gcloud projects describe $PROJECT --format='value(projectNumber)')@gcp-sa-firestore.iam.gserviceaccount.com:roles/storage.admin \
  $BUCKET

# 3. Lifecycle: delete exports older than 90 days
cat > /tmp/lifecycle.json <<'JSON'
{"rule":[{"action":{"type":"Delete"},"condition":{"age":90}}]}
JSON
gsutil lifecycle set /tmp/lifecycle.json $BUCKET
```

### Daily scheduled export

```bash
gcloud services enable cloudscheduler.googleapis.com firestore.googleapis.com

gcloud firestore databases update --type=firestore-native

gcloud scheduler jobs create http firestore-daily-export \
  --project=ansuarusunacharityms \
  --schedule="0 2 * * *" \
  --time-zone="Africa/Addis_Ababa" \
  --location=europe-west1 \
  --uri="https://firestore.googleapis.com/v1/projects/ansuarusunacharityms/databases/(default):exportDocuments" \
  --oauth-service-account-email="ansuarusunacharityms@appspot.gserviceaccount.com" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"outputUriPrefix":"gs://ansuarusunacharityms-backups"}'
```

### Manual export (before any risky migration or Data Health cleanup)

```bash
gcloud firestore export gs://ansuarusunacharityms-backups/manual-$(date +%Y%m%d-%H%M)
```

### Restore

```bash
gcloud firestore import gs://ansuarusunacharityms-backups/<EXPORT_FOLDER>
```

Import **merges** into existing collections. To restore a clean state, restore
into a scratch project first and verify before touching production.

---

## 3. App Check

1. Google Cloud Console → reCAPTCHA → create a **reCAPTCHA v3** key for
   `ansuarusuna.vercel.app` and any custom domain.
2. Firebase Console → App Check → register the web app with that key.
3. Add the site key to the deployment environment as `VITE_APPCHECK_SITE_KEY`
   and redeploy the frontend.
4. Keep App Check in **Monitor** mode for a week, confirm traffic is verified,
   then switch Firestore and Storage to **Enforce**.

Local development prints a debug token in the browser console — register it in
Firebase Console → App Check → Apps → Manage debug tokens.

Do not confuse this with the phone-auth reCAPTCHA. Phone verification uses the
SDK's own invisible widget; App Check enforcement for Authentication should be
left in **Audit** mode.

---

## 4. Error monitoring

Set `VITE_SENTRY_DSN` in the deployment environment to forward errors. Without
it the app logs to the console only — nothing breaks.

---

## 5. Common incidents

| Symptom | First checks |
| --- | --- |
| "Missing or insufficient permissions" | Rules not deployed — run `npm run rules:deploy` |
| Members cannot upload | Is a month open? Super Admin → Settings / Dashboard |
| Reminder notifications failing | Confirm the notification write includes `title` |
| Stale app after deploy | Ask the user to load the site with `?sw=off` once |
| SMS code never arrives | Firebase Console → Authentication → SMS region policy and fraud threshold |

---

## 6. Escalation

1. Export Firestore manually (section 2) before any destructive fix.
2. Roll back the frontend in Vercel (instant, previous deployment).
3. Rules cannot be rolled back automatically — keep `firestore.rules` in git and
   redeploy the previous commit.
