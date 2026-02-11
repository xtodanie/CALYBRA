# ACCOUNTING INTEGRITY INFRASTRUCTURE ROADMAP

## Purpose
This document defines the strict execution plan for building accounting integrity infrastructure. Each step has hard gates. No forward progress without gate pass.

## Current Status: 65% → Target: 90%

---

## 🚨 MVP PIVOT NOTICE (2025-01)

**Steps 5-10 are DEFERRED for MVP.**

The project is pivoting from ERP-level compliance infrastructure to a simple, operator-first financial control platform for small restaurants and PYMEs.

**What we ship for MVP:**
- ✅ Deterministic IDs (Step 1 - PASSED)
- ✅ Transactional recompute (Step 2 - PASSED)
- ✅ Server-authoritative writes (Step 3 - PASSED)
- ✅ Readmodel foundation (Step 4 - PASSED)
- ✅ Simple CSV export from live data (client-side)
- ✅ Basic matching confirmation flow
- ✅ Exception resolution workflow

**What we defer to ERP Phase:**
- Readmodel-based export engine
- Concurrency stress testing
- Regression harness
- Truth lock CI gates
- RBAC hardening beyond OWNER/ACCOUNTANT
- System lockdown review

---

## EXECUTION ORDER (STRICT — NO SKIPPING)

| Step | Name | Risk | Gate Type | Status |
|------|------|------|-----------|--------|
| 1 | Resolution Determinism Audit | 🔴 P0 | HARD | ✅ PASSED |
| 2 | Finalization State Machine | 🟣 P0 | HARD | ✅ PASSED |
| 3 | Freeze Rule Enforcement | 🟡 P0 | HARD | ✅ PASSED |
| 4 | Readmodel Snapshot Generation | 🔵 P1 | HARD | ✅ PASSED |
| 5 | Export Engine (Readmodel-Based) | 🟢 P1 | HARD | 🔒 DEFERRED (MVP) |
| 6 | Concurrency Stress Test | 🟠 P0 | HARD | 🔒 DEFERRED (MVP) |
| 7 | Regression Harness | 🔴 P1 | HARD | 🔒 DEFERRED (MVP) |
| 8 | Truth Lock + CI Gate | 🟣 P1 | HARD | 🔒 DEFERRED (MVP) |
| 9 | Role Hardening + RBAC Validation | 🟡 P1 | HARD | 🔒 DEFERRED (MVP) |
| 10 | System Lockdown Review | 🔵 P0 | HARD | 🔒 DEFERRED (MVP) |

---

## STEP 1 — RESOLUTION DETERMINISM AUDIT

### Why
Resolution touches canonical relationships. If retry or ingestion breaks it, accounting is corrupted.

### Proof Requirements
| ID | Assertion | Proof Method |
|----|-----------|--------------|
| 1.1 | Resolve exception → creates deterministic match | Compare match ID before/after |
| 1.2 | Retry job → does NOT delete resolved exception | Exception doc exists after retry |
| 1.3 | Retry job → does NOT duplicate match | Match count unchanged |
| 1.4 | Retry job → does NOT revert resolution state | Exception.status still RESOLVED |
| 1.5 | MonthClose totals remain stable after retry | Compare summary before/after |
| 1.6 | Resolving same exception twice → fails | HttpsError thrown |

### Implementation Tasks
- [ ] Create test script: `scripts/step1_resolution_audit.mjs`
- [ ] Run against emulator
- [ ] Document proof results

### Gate: PASS when
- No duplicate artifacts
- No resurrected OPEN exception
- No drift in totals
- All 6 assertions verified

---

## STEP 2 — FINALIZATION STATE MACHINE

### Why
Without freeze, you don't have accounting. You have a spreadsheet.

### Implementation Requirements
```typescript
finalizeMonthClose(monthCloseId)
```

| ID | Enforcement | Implementation |
|----|-------------|----------------|
| 2.1 | Role check (OWNER/ADMIN only) | loadAndAuthorize with FINALIZE permission |
| 2.2 | No OPEN exceptions allowed | Query count in transaction |
| 2.3 | Status OPEN → FINALIZED only | Transition map enforcement |
| 2.4 | Block retryJob after FINALIZED | Check in retryJob callable |
| 2.5 | Block resolveException after FINALIZED | Already implemented |
| 2.6 | Block transitionMatch after FINALIZED | Already implemented |
| 2.7 | Block ingestion after FINALIZED | Check in ingestion |

### Files to Modify
- `calybra-database/src/transitions.ts` — Add finalizeMonthClose callable
- `calybra-database/src/ingestion.ts` — Add FINALIZED check to runIngestion

### Gate: PASS when
After FINALIZED:
- retryJob throws `failed-precondition`
- resolveException throws `failed-precondition`
- transitionMatch throws `failed-precondition`
- ingestion throws `failed-precondition`

---

## STEP 3 — FREEZE RULE ENFORCEMENT

### Why
Callables enforce logic. Rules enforce integrity.

### Implementation Requirements
Firestore rules must prevent mutation if `monthClose.status == "FINALIZED"` for:
- `/tenants/{tenantId}/invoices/{invoiceId}`
- `/tenants/{tenantId}/bankTx/{bankTxId}`
- `/tenants/{tenantId}/matches/{matchId}`
- `/exceptions/{exceptionId}`

### Files to Modify
- `firestore.rules` — Add freeze checks

### Gate: PASS when
- Manual Firestore console edit fails post-finalization
- Rule tests verify freeze enforcement

---

## STEP 4 — READMODEL SNAPSHOT GENERATION

### Why
Exports must not read live collections.

### Implementation Requirements
Trigger: `onMonthCloseFinalized` (Firestore trigger)

Generate: `/tenants/{tenantId}/readmodels/{monthCloseId}`

Snapshot schema:
```typescript
{
  monthCloseId: string;
  bankTotal: number;
  invoiceTotal: number;
  matchCount: number;
  exceptionCount: number;
  openExceptionCount: number;
  finalizedAt: Timestamp;
  finalizedBy: string;
  schemaVersion: number;
  // Denormalized data for export
  invoices: Invoice[];
  bankTx: BankTx[];
  matches: Match[];
  exceptions: Exception[];
}
```

### Files to Create
- `calybra-database/src/triggers.ts` — onMonthCloseFinalized trigger

### Gate: PASS when
- Snapshot created automatically on finalize
- Snapshot never changes after creation
- Live collection changes do not affect snapshot

---

## STEP 5 — EXPORT ENGINE (READMODEL-BASED ONLY)

### Why
Exports from live data are unstable.

### Implementation Requirements
```typescript
generateExport(monthCloseId, format: "CSV" | "XLSX" | "JSON")
```

Must read ONLY from readmodel snapshot. Not from invoices/bankTx.

### Files to Create
- `calybra-database/src/exports.ts` — generateExport callable

### Gate: PASS when
- Export file identical across multiple calls
- Freeze guarantees identical output
- No live collection reads during export

---

## STEP 6 — CONCURRENCY STRESS TEST

### Why
System must survive race conditions.

### Test Scenarios
| ID | Scenario | Expected Outcome |
|----|----------|------------------|
| 6.1 | Double-click resolveException | Second call fails, no duplicate |
| 6.2 | Double-click retryJob | Second call fails or is no-op |
| 6.3 | Finalize while retry running | One succeeds, other fails cleanly |
| 6.4 | Resolve during ingestion | Either succeeds, no corruption |

### Files to Create
- `scripts/step6_concurrency_stress.mjs`

### Gate: PASS when
- No duplicate matches
- No partial writes
- No corrupted summary
- No inconsistent state

---

## STEP 7 — REGRESSION HARNESS

### Why
Manual testing is not engineering.

### Implementation Requirements
Create `/scripts/regression/` scripts that:
1. Ingest file
2. Resolve exception
3. Retry
4. Finalize
5. Attempt illegal mutation (must fail)

Automate via emulator.

### Files to Create
- `scripts/regression/run_all.mjs`
- `scripts/regression/01_ingest.mjs`
- `scripts/regression/02_resolve.mjs`
- `scripts/regression/03_retry.mjs`
- `scripts/regression/04_finalize.mjs`
- `scripts/regression/05_verify_freeze.mjs`

### Gate: PASS when
- Script runs clean without manual console steps
- Exit code 0 = all assertions pass
- Exit code 1 = failure with specific assertion

---

## STEP 8 — TRUTH LOCK + CONSISTENCY GATE IN CI

### Why
Future drift is inevitable.

### Implementation Requirements
CI must run:
```bash
node scripts/truth.mjs
node scripts/consistency.mjs
```

Fail build if mismatch.

### Files to Modify
- `.github/workflows/ci.yml` (or create if not exists)
- `scripts/truth.mjs` — Verify schema matches contracts
- `scripts/consistency.mjs` — Verify cross-document consistency

### Gate: PASS when
- PR cannot merge if truth mismatch exists
- CI runs both scripts on every PR

---

## STEP 9 — ROLE HARDENING + RBAC VALIDATION

### Why
Security must match architecture.

### Audit Matrix
| Role | Ingest | Resolve | Finalize | Transition | View |
|------|--------|---------|----------|------------|------|
| OWNER | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| ACCOUNTANT | ✅ | ✅ | ❌ | ✅ | ✅ |
| AUDITOR | ❌ | ❌ | ❌ | ❌ | ✅ |
| VIEWER | ❌ | ❌ | ❌ | ❌ | ✅ |

### Implementation Requirements
- Test each role manually via emulator
- Create script to verify each permission

### Files to Create
- `scripts/step9_rbac_validation.mjs`

### Gate: PASS when
- Each role strictly enforced server-side
- All permission denials logged

---

## STEP 10 — SYSTEM LOCKDOWN REVIEW

### Why
You are about to have a real product.

### Verification Checklist
| ID | Assertion | Status |
|----|-----------|--------|
| 10.1 | No client writes to canonical collections | ⏳ |
| 10.2 | No autoId in content documents | ⏳ |
| 10.3 | All state transitions centralized | ⏳ |
| 10.4 | All recomputes transactional | ⏳ |
| 10.5 | Freeze fully enforced | ⏳ |
| 10.6 | Retry safe | ⏳ |
| 10.7 | No mock data anywhere | ⏳ |
| 10.8 | No optimistic UI logic | ⏳ |
| 10.9 | No derived data authoritative | ⏳ |
| 10.10 | Production deploy tested | ⏳ |

### Files to Create
- `agent/LOCKDOWN_CHECKLIST.md` — Final verification document

### Gate: PASS when
- All 10 assertions verified
- Document signed off

---

## FORBIDDEN ACTIONS

Until all 10 steps complete:
- ❌ Do not add features
- ❌ Do not add analytics
- ❌ Do not add dashboards
- ❌ Do not add billing
- ❌ Do not add AI enhancements
- ❌ Do not add UX polish

---

## POST-COMPLETION PATH (After Step 10)

Only after 90% structural completion:
1. Polish UX
2. Improve performance
3. Expand AI parsing
4. Add enterprise controls

---

## PROOF LOG

### Step 1 Proof — PASSED ✅
```
Date: 2026-02-11
Assertions: 6/6 PASS
Script: scripts/step1_resolution_audit.mjs

Results:
  ✓ 1.1: Resolve exception → creates deterministic match (dc884ace6ffd5ee7532c)
  ✓ 1.2: Exception preserved after simulated retry
  ✓ 1.3: Single MANUAL match preserved (no duplicates)
  ✓ 1.4: Exception status remains RESOLVED
  ✓ 1.5: MonthClose totals stable (bank=1250, invoice=500, matches=1)
  ✓ 1.6: Second resolution correctly rejected

Cleanup Query Verification:
  - PROPOSED matches deleted: 0 (none existed)
  - OPEN exceptions in delete set: 1 (other exception, not resolved one)
  - Resolved exception in delete set: NO (CORRECT)
  - Manual match in delete set: NO (CORRECT - it's CONFIRMED)

Evidence: Console output from emulator test run
```

### Step 2 Proof — PASSED ✅
```
Date: 2026-02-11
Assertions: 7/7 PASS
Script: scripts/step2_finalization_audit.mjs

Results:
  ✓ 2.1: Cannot finalize with OPEN exceptions
  ✓ 2.2: Can finalize after resolving all exceptions
  ✓ 2.3: retryJob blocked after FINALIZED
  ✓ 2.4: resolveException blocked after FINALIZED
  ✓ 2.5: transitionMatch blocked after FINALIZED
  ✓ 2.6: createJob blocked after FINALIZED
  ✓ 2.7: ACCOUNTANT role denied finalize permission

Implementation:
  - Added OPEN exceptions check to transitionMonthClose
  - Added FINALIZED check to retryJob
  - createJob already had FINALIZED check
  - resolveException already had FINALIZED check
  - transitionMatch already had FINALIZED check

Evidence: Console output from emulator test run
```

### Step 3 Proof — PASSED ✅
```
Date: 2026-02-11
Assertions: 8/8 PASS
Script: scripts/step3_freeze_audit.mjs

Results:
  ✓ 3.1: Server can write invoices BEFORE finalize
  ✓ 3.2: Server CANNOT write invoices AFTER finalize
  ✓ 3.3: Server can write bankTx BEFORE finalize
  ✓ 3.4: Server CANNOT write bankTx AFTER finalize
  ✓ 3.5: Server can write matches BEFORE finalize
  ✓ 3.6: Server CANNOT write matches AFTER finalize
  ✓ 3.7: Server can write exceptions BEFORE finalize
  ✓ 3.8: Server CANNOT write exceptions AFTER finalize

Implementation:
  - Added isMonthCloseFrozen() helper function to firestore.rules
  - Updated invoices, bankTx, matches rules to check freeze
  - Updated exceptions rules with create/update/delete freeze checks
  - All 21 existing firestore.rules.test.ts tests still pass

Evidence: Console output from emulator test run
```

### Step 4 Proof
```
Date: 2026-02-11
Assertions: 7/7 PASS

  ✅ PASS: No readmodel before FINALIZED
  ✅ PASS: Readmodel created on FINALIZED
  ✅ PASS: Readmodel has correct status and immutable flag
  ✅ PASS: Readmodel has correct denormalized counts
  ✅ PASS: Readmodel has correct financial totals
  ✅ PASS: Readmodel idempotency: re-trigger does not modify
  ✅ PASS: No snapshot for non-FINALIZED updates

Implementation:
  - Added readmodel creation logic to transitionMonthClose callable
  - Readmodel created at tenants/{tenantId}/readmodels/{monthCloseId}
  - Snapshot includes: bankTotal, invoiceTotal, diff, matchCount,
    exceptionCount, invoiceCount, bankTxCount, finalizedAt, finalizedBy
  - isImmutable flag set to true
  - Firestore rules updated to block update/delete after creation
  - Note: Firestore trigger disabled due to firebase-functions v7 emulator compatibility
    issues. Readmodel creation happens synchronously in transitionMonthClose.

Evidence: Console output from npx firebase emulators:exec with demo-calybra project
```

(Continue for each step...)

---

## ESCALATION PROTOCOL

If any gate fails:
1. STOP immediately
2. Document failure in this file
3. Root cause analysis
4. Fix implementation
5. Re-run gate
6. Only proceed after PASS
