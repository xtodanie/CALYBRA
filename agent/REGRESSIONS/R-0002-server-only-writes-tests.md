# R-0002: Server-only-writes tests failing

## Status: RESOLVED

## Summary
- Command: firebase emulators:exec --only firestore "npm test"
- Result: 569 tests passed, 0 failed

## Root Cause
The tests were missing required fields (`monthCloseId`) that Firestore rules require for server writes to invoices, bankTx, matches, and exceptions collections.

## Fix Applied
1. Added `monthCloseId` constant
2. Created monthClose document with status DRAFT in test setup
3. Added `monthCloseId` to all test data that requires it
4. Updated server write tests to include required `monthCloseId` field

## Files Modified
- `tests/invariants/server-only-writes.test.ts`

## Proof
- `firebase emulators:exec --only firestore "npm test"` -> 569 passed, 0 failed
