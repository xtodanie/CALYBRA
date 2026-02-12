# Golden Path 05: Exception Resolution

**Purpose:** Verify exceptions are surfaced and can be resolved.

## Prerequisites
- Logged in as OWNER, MANAGER, or ACCOUNTANT
- Exceptions exist (unmatched transactions, parse failures, etc.)
- Month close in DRAFT or IN_REVIEW status

## Steps

### 1. Navigate to Exceptions
- [ ] Click "Exceptions" in sidebar
- [ ] **Expected:** Exception list loads

### 2. View Exception Details
- [ ] Select an exception
- [ ] **Expected:** Details panel shows:
  - Exception type (e.g., UNMATCHED, PARSE_ERROR)
  - Related document (bankTx ID, invoice ID)
  - Created timestamp
  - Status (PENDING)

### 3. Resolve Exception
- [ ] Click "Resolve" button
- [ ] Enter resolution note (if required)
- [ ] Click confirm
- [ ] **Expected:** Exception status → `RESOLVED`

### 4. Verify Firestore Update
- [ ] Check `exceptions/{exceptionId}`:
  - `status: "RESOLVED"`
  - `resolvedBy` contains actor UID
  - `resolvedAt` timestamp set
  - `resolution` note stored

### 5. Verify Exception Removed from List
- [ ] Refresh exceptions page
- [ ] **Expected:** Resolved exception not in active list
- [ ] OR moved to "Resolved" tab

### 6. RBAC Check - VIEWER Cannot Resolve
- [ ] Log in as VIEWER
- [ ] Navigate to Exceptions
- [ ] **Expected:** Resolve button not visible
- [ ] **Expected:** Read access only

## Pass Criteria
- [ ] Exceptions list displays PENDING exceptions
- [ ] Resolve action updates status correctly
- [ ] Server-side `resolveException` callable validates permission
- [ ] VIEWER cannot resolve
- [ ] Audit trail captured (actor, timestamp)

## Failure Actions
1. Check `resolveException` Cloud Function logs
2. Verify user role in `users/{uid}.role`
3. Check `exceptions` collection rules in firestore.rules
