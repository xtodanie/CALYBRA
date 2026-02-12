# Golden Path 01: User Onboarding

**Purpose:** Verify new user signup creates tenant + user documents correctly.

## Prerequisites
- App running locally (`npm run dev`)
- Firebase emulators running OR connected to staging

## Steps

### 1. Create Account
- [ ] Navigate to `/signup`
- [ ] Enter email and password
- [ ] Click "Create Account"
- [ ] **Expected:** Redirect to dashboard

### 2. Verify Firestore Documents
- [ ] Open Firebase Console → Firestore
- [ ] Check `users/{uid}` document exists with:
  - `tenantId` (non-empty string)
  - `role: "OWNER"`
  - `email` matches signup email
- [ ] Check `tenants/{tenantId}` document exists with:
  - `ownerId` matches user UID
  - `createdAt` timestamp

### 3. Verify Dashboard Access
- [ ] Dashboard shows "Welcome" state (no data)
- [ ] Sidebar navigation is visible
- [ ] No permission errors in console

## Pass Criteria
- [ ] All checkboxes above are checked
- [ ] No console errors related to auth/permissions

## Failure Actions
If any step fails:
1. Check `agent/DEBUG_PLAYBOOK.md` for common issues
2. Create regression entry in `agent/REGRESSIONS/` if new issue
