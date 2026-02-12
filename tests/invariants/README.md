# Invariant Test Suite

Security and integrity tests that MUST pass before any deployment.

## Overview

These tests run against the Firestore emulator and verify non-negotiable security properties.

## Test Files

| File | Purpose | Tests |
|------|---------|-------|
| `tenant-isolation.test.ts` | Cross-tenant access denied | Read/write isolation for all collections |
| `rbac.test.ts` | Role-based access control | VIEWER, ACCOUNTANT, MANAGER, OWNER permissions |
| `status-transitions.test.ts` | Status machine enforcement | MonthClose, FileAsset, Match transitions |
| `server-only-writes.test.ts` | Client write denial | tenants, users, invoices, bankTx, matches, events, periods, readmodels, exports, jobs, exceptions |

## Running Tests

```bash
# Run with Firestore emulator
firebase emulators:exec --only firestore "npm test -- tests/invariants"

# Run specific file
firebase emulators:exec --only firestore "npm test -- tests/invariants/tenant-isolation.test.ts"
```

## Invariants Tested

### Tenant Isolation (P0)
- Tenant A cannot read Tenant B's data
- Tenant A cannot write to Tenant B's documents
- Jobs and exceptions are tenant-scoped

### RBAC Enforcement (P0)
- VIEWER: read-only, no writes
- ACCOUNTANT: operational writes, no finalization
- MANAGER: can approve, cannot finalize
- OWNER: full access including finalization

### Status Transitions (P0)
- MonthClose: DRAFT → IN_REVIEW → FINALIZED only
- FINALIZED is immutable (no client updates)
- Client cannot set status directly (server-only)

### Server-Only Collections (P0)
- Client cannot create/update: tenants, users
- Client cannot write: invoices, bankTx, matches, events
- Client cannot write: periods, readmodels, exports, jobs, exceptions

## Adding New Invariants

1. Create test in appropriate file or new file
2. Follow pattern: `it("denies <action> for <role/tenant>", ...)`
3. Use `assertFails()` for expected denials
4. Run full suite to verify no regressions

## CI Integration

These tests run in CI via:
```yaml
firebase emulators:exec --only firestore "npm test"
```

All invariant tests MUST pass for CI to be green.
