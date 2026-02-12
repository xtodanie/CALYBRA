# Production Deployment Guide

## Overview

Calybra uses Firebase for backend services and Firebase App Hosting for the Next.js frontend.

**Project ID:** `studio-5801368156-a6af7`

## Pre-Deployment Checklist

### 1. Local Verification
```bash
# All must pass before deploy
npm run truth-lock          # Truth + consistency gates
npm run lint                 # ESLint
npm run typecheck            # TypeScript
npm --prefix calybra-database run build  # Functions build
firebase emulators:exec --only firestore "npm test"  # 569+ tests
```

### 2. Golden Paths (Manual)
- [ ] GP-01: Onboarding passes on staging
- [ ] GP-02: Upload & Ingestion passes
- [ ] GP-03: Match Workflow passes
- [ ] GP-04: Month Close Finalize passes
- [ ] GP-05: Exception Resolution passes

See `agent/GOLDEN_PATHS/INDEX.md`

### 3. Security Review
- [ ] No secrets in code (grep for API keys)
- [ ] `firestore.rules` reviewed since last deploy
- [ ] `storage.rules` reviewed since last deploy

---

## Deployment Steps

### Step 1: Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```
**Verify:** Firebase Console → Firestore → Rules shows new timestamp

### Step 2: Deploy Storage Rules
```bash
firebase deploy --only storage
```
**Verify:** Firebase Console → Storage → Rules shows new timestamp

### Step 3: Deploy Cloud Functions
```bash
firebase deploy --only functions
```
**Verify:** Firebase Console → Functions shows:
- `transitionMonthClose`
- `transitionMatch`
- `resolveException`
- `createJob`, `processJob`, `retryJob`
- `onAuthCreate`

### Step 4: Deploy Frontend (App Hosting)
```bash
# One-time setup (if backend does not exist)
firebase apphosting:backends:create --backend calybra-prod --primary-region us-central1 --app <webAppId> --root-dir .

# Deploy from GitHub-connected backend
firebase apphosting:rollouts:create calybra-prod --git-branch main --force

# If backend is not connected to GitHub, deploy from local source:
firebase deploy
```
**Verify:** Visit production URL, login works

---

## Post-Deployment Verification

### 1. Smoke Test
- [ ] Can login (auth works)
- [ ] Dashboard loads (Firestore read works)
- [ ] Upload page accessible (permissions work)

### 2. Function Test
- [ ] Create a test month close (transitionMonthClose works)
- [ ] Upload a test file (processJob works)

### 3. Monitor Logs
```bash
firebase functions:log --only transitionMonthClose
firebase functions:log --only processJob
```
Check for errors in first 5 minutes.

---

## Rollback Procedures

### Rollback Rules
```bash
# Revert to previous rules version in Firebase Console
# OR redeploy from previous git commit
git checkout <prev-sha> -- firestore.rules storage.rules
firebase deploy --only firestore:rules,storage
```

### Rollback Functions
```bash
git checkout <prev-sha> -- calybra-database/
npm --prefix calybra-database run build
firebase deploy --only functions
```

### Rollback Frontend
- Use Firebase App Hosting console to rollback to previous build
- OR redeploy from previous commit

---

## Environment Variables

Functions use Firebase params (not env vars):
- `ANTHROPIC_API_KEY` - For AI features (if enabled)

Set via:
```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

---

## Monitoring

### Key Metrics
- Function invocation count
- Function error rate
- Firestore read/write operations
- App Hosting request latency

### Alerts to Configure
- Function error rate > 1%
- Firestore quota approaching limit
- Auth failures spike

---

## Emergency Contacts

- **Firebase Status:** https://status.firebase.google.com
- **Firebase Support:** Console → Help → Contact Support
