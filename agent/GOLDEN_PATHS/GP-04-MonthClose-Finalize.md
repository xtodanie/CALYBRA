# Golden Path 04: Month Close Lifecycle

**Purpose:** Verify month close transitions DRAFT → IN_REVIEW → FINALIZED.

## Prerequisites
- Logged in as OWNER
- Month close exists in DRAFT status
- Some matches confirmed (for realistic scenario)

## Steps

### 1. Navigate to Month Closes
- [ ] Click "Month Closes" in sidebar
- [ ] **Expected:** List of month closes displayed
- [ ] Find month close in `DRAFT` status

### 2. Submit for Review (DRAFT → IN_REVIEW)
- [ ] Select DRAFT month close
- [ ] Click "Submit for Review"
- [ ] **Expected:** Status changes to `IN_REVIEW`
- [ ] UI reflects new status

### 3. Verify Firestore Update
- [ ] Check `tenants/{tenantId}/monthCloses/{mcId}`:
  - `status: "IN_REVIEW"`
  - `updatedAt` timestamp updated
  - `updatedBy` contains actor UID

### 4. Finalize (IN_REVIEW → FINALIZED) - OWNER Only
- [ ] With OWNER role, click "Finalize"
- [ ] Confirm dialog if present
- [ ] **Expected:** Status changes to `FINALIZED`

### 5. Verify Immutability
- [ ] Try to edit any field on FINALIZED month close
- [ ] **Expected:** Edit buttons disabled/hidden
- [ ] Console attempt to update → permission denied

### 6. Verify FINALIZED Cannot Revert
- [ ] Try to change status back to IN_REVIEW or DRAFT
- [ ] **Expected:** Operation denied (no button, or error)

### 7. RBAC Check - MANAGER Cannot Finalize
- [ ] Log in as MANAGER role
- [ ] Navigate to IN_REVIEW month close
- [ ] **Expected:** No "Finalize" button visible
- [ ] Console attempt → permission denied

## Pass Criteria
- [ ] DRAFT → IN_REVIEW transition works for ACCOUNTANT+
- [ ] IN_REVIEW → FINALIZED works only for OWNER
- [ ] FINALIZED is immutable (no client updates)
- [ ] Cannot revert from FINALIZED
- [ ] Server validates all transitions

## Failure Actions
1. Check `transitionMonthClose` Cloud Function logs
2. Verify RBAC permissions in firestore.rules
3. Check status machine in `contracts/status-machines.md`
