# Golden Path 03: Match Workflow

**Purpose:** Verify auto-matching runs and manual confirm/reject works.

## Prerequisites
- Logged in as OWNER, MANAGER, or ACCOUNTANT
- BankTx and Invoice documents exist (from GP-02)
- Month close in DRAFT or IN_REVIEW status

## Steps

### 1. Navigate to Matches
- [ ] Click "Matches" in sidebar
- [ ] **Expected:** Match list page loads

### 2. Verify Auto-Match Results
- [ ] Check for matches with status `PENDING`
- [ ] **Expected:** Matches show bank transaction + invoice pairing
- [ ] Confidence score displayed (if implemented)

### 3. Confirm a Match (MANAGER/OWNER)
- [ ] Select a PENDING match
- [ ] Click "Confirm" button
- [ ] **Expected:** Status changes to `CONFIRMED`
- [ ] Match disappears from pending list or moves to confirmed section

### 4. Verify Firestore Update
- [ ] Check `tenants/{tenantId}/monthCloses/{mcId}/matches/{matchId}`:
  - `status: "CONFIRMED"`
  - `confirmedBy` contains actor UID
  - `confirmedAt` timestamp set

### 5. Reject a Match
- [ ] Select another PENDING match
- [ ] Click "Reject" button
- [ ] **Expected:** Status changes to `REJECTED`

### 6. RBAC Check - VIEWER Cannot Confirm
- [ ] Log in as VIEWER role user
- [ ] Navigate to Matches
- [ ] **Expected:** Confirm/Reject buttons disabled or hidden
- [ ] Attempting confirm via console → permission denied

## Pass Criteria
- [ ] Auto-matches displayed correctly
- [ ] Confirm changes status to CONFIRMED
- [ ] Reject changes status to REJECTED
- [ ] VIEWER cannot perform status changes
- [ ] Server validates transitions (no client forgery)

## Failure Actions
1. Check `transitionMatch` Cloud Function logs
2. Verify user has correct role in `users/{uid}.role`
3. Check firestore.rules for match permissions
