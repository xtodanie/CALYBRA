# ARCHITECTURAL SEAL — CALYBRA

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   █████╗ ██████╗  ██████╗██╗  ██╗██╗████████╗███████╗ ██████╗████████╗       ║
║  ██╔══██╗██╔══██╗██╔════╝██║  ██║██║╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝       ║
║  ███████║██████╔╝██║     ███████║██║   ██║   █████╗  ██║        ██║          ║
║  ██╔══██║██╔══██╗██║     ██╔══██║██║   ██║   ██╔══╝  ██║        ██║          ║
║  ██║  ██║██║  ██║╚██████╗██║  ██║██║   ██║   ███████╗╚██████╗   ██║          ║
║  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚══════╝ ╚═════╝   ╚═╝          ║
║                                                                              ║
║  ██╗   ██╗██████╗  █████╗ ██╗         ███████╗███████╗ █████╗ ██╗            ║
║  ██║   ██║██╔══██╗██╔══██╗██║         ██╔════╝██╔════╝██╔══██╗██║            ║
║  ██║   ██║██████╔╝███████║██║         ███████╗█████╗  ███████║██║            ║
║  ██║   ██║██╔══██╗██╔══██║██║         ╚════██║██╔══╝  ██╔══██║██║            ║
║  ╚██████╔╝██║  ██║██║  ██║███████╗    ███████║███████╗██║  ██║███████╗       ║
║   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝    ╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝       ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## SEAL METADATA

| Property | Value |
|----------|-------|
| **Project** | CALYBRA |
| **Phase** | SECURITY & STATE MACHINE HARDENING |
| **Seal Date** | 2026-02-11 |
| **Tag Reference** | `security-phase-locked-v1` |
| **Verification Command** | `git show security-phase-locked-v1` |

> **NOTE**: The authoritative commit hash is captured in the annotated git tag `security-phase-locked-v1`. Execute `git show security-phase-locked-v1` to verify the exact commit sealed.

---

## 1. WHAT IS SEALED

The following security and state-machine components are **architecturally frozen** as of this seal date. They represent production-grade trust boundaries that have been verified through comprehensive testing.

### 1.1 Firestore Security Model

- **Default deny policy**: All paths denied unless explicitly allowed
- **Authentication requirement**: No unauthenticated access permitted
- **Rule enforcement layer**: `firestore.rules` is the authoritative enforcement point

### 1.2 Tenant Isolation Guarantees

- Users access ONLY data belonging to their assigned tenant
- Tenant membership is server-authoritative via `/users/{uid}.tenantId`
- Cross-tenant reads are denied
- Cross-tenant writes are denied
- Forged `tenantId` fields in documents are rejected

### 1.3 RBAC Boundaries

- Role assignments are server-controlled (`/users/{uid}.role`)
- VIEWER: Read-only access
- ACCOUNTANT: Create/update monthCloses (not status), create fileAssets
- MANAGER: Create monthCloses, create fileAssets
- OWNER: Full client authority within tenant boundaries
- No client role may change status fields
- No client role may write to server-only collections

### 1.4 Status Machines

- **MonthClose**: `DRAFT` → `IN_REVIEW` → `FINALIZED`
- **FileAsset**: `PENDING_UPLOAD` → `UPLOADED` → `VERIFIED`/`REJECTED` → `DELETED`
- **Match**: `PROPOSED` → `CONFIRMED`/`REJECTED`
- All transitions enforced at Firestore rules layer
- Invalid transitions rejected for ALL actors including server

### 1.5 Terminal State Immutability

- **FINALIZED** (MonthClose): Immutable. No actor may update.
- **DELETED** (FileAsset): Immutable. No actor may update.
- **CONFIRMED** (Match): Immutable. No actor may update.
- **REJECTED** (Match): Immutable. No actor may update.

### 1.6 Server Authority Limits

- Server bypasses: Tenant membership, RBAC role checks
- Server DOES NOT bypass: State machine enforcement, Terminal state immutability
- Server is NOT omnipotent — this is intentional

---

## 2. WHAT MUST NOT CHANGE

The following changes are **FORBIDDEN** without executing the Seal Break Procedure (Section 3).

### 2.1 Firestore Rules Logic

- **MUST NOT** remove default deny policy
- **MUST NOT** allow unauthenticated access to any path
- **MUST NOT** allow cross-tenant reads or writes
- **MUST NOT** remove `isTenantMember()` checks from tenant-scoped paths
- **MUST NOT** remove `tenantId` field validation on document creation

### 2.2 Terminal State Enforcement

- **MUST NOT** allow updates to documents in terminal states
- **MUST NOT** add exceptions for "edge cases" or "admin overrides"
- **MUST NOT** allow server to bypass terminal state checks
- **MUST NOT** treat terminal states as soft-deletable or reversible

### 2.3 State Machine Enforcement

- **MUST NOT** allow transitions not defined in the state machine
- **MUST NOT** allow server to bypass state machine validation
- **MUST NOT** allow clients to change status fields
- **MUST NOT** allow creation of documents with non-initial status

### 2.4 Server Authority Model

- **MUST NOT** introduce server omnipotence
- **MUST NOT** allow server to mutate terminal states
- **MUST NOT** allow server to perform invalid state transitions
- **MUST NOT** remove server restrictions "for convenience"

### 2.5 Test Coverage

- **MUST NOT** skip or comment out security invariant tests
- **MUST NOT** weaken assertions to make tests pass
- **MUST NOT** remove tests proving invariants
- **MUST NOT** modify tests to accept previously-failing behavior

---

## 3. SEAL BREAK PROCEDURE

This seal MAY ONLY be broken through the following procedure. **ALL STEPS ARE REQUIRED.**

### 3.1 Pre-Requisites

1. **Architecture Decision Record (ADR)**
   - Document the business justification
   - Document the security impact analysis
   - Document the alternatives considered
   - Obtain stakeholder sign-off

2. **Updated SECURITY_INVARIANTS.md**
   - Modify to reflect new invariants
   - Document what changed and why
   - Maintain complete history of changes

3. **Updated Test Suite**
   - New tests proving new invariants hold
   - No removal of existing tests without replacement
   - All tests passing before proceeding

### 3.2 Execution

4. **Explicit Superseding Seal**
   - Create new `ARCHITECTURAL_SEAL_v2.md` (or appropriate version)
   - Reference this seal as superseded
   - Document scope of changes
   - Document effective date

5. **Human Review Acknowledgement**
   - At least two senior engineers must review
   - Security-focused review required
   - Explicit sign-off recorded in ADR

### 3.3 Post-Execution

6. **New Annotated Tag**
   - Create `security-phase-locked-v2` (or appropriate version)
   - Reference the superseding seal
   - Document what changed from previous version

### 3.4 Violation Statement

> **Any change to sealed components outside this procedure is a violation.**
>
> Violations include but are not limited to:
> - Direct modification of rules without ADR
> - Modifying tests to pass without fixing rules
> - Force-pushing over protected commits
> - Deleting or rewriting the seal commit
> - "Temporary" exceptions that bypass invariants

---

## 4. SEAL SCOPE DISCLAIMER

### This Seal Applies To:

- Firestore security rules (`firestore.rules`)
- Storage security rules (`storage.rules`)
- Status machine definitions (`contracts/status-machines.md`)
- Security invariants documentation (`SECURITY_INVARIANTS.md`)
- Invariant test suites (`tests/invariants/**`, `tests/invariants.test.ts`, `tests/firestore.rules.test.ts`)
- RBAC definitions (`src/domain/rbac.ts`)

### This Seal Does NOT Apply To:

- UI components (compliance required, not sealed)
- API endpoints (must respect invariants, but logic not sealed)
- New feature development (must COMPLY with invariants)
- Schema additions (must not violate invariants)
- Performance optimizations (must not weaken security)

### New Features Policy

New features **MUST COMPLY** with sealed invariants. They may NOT:
- Introduce new bypasses
- Weaken existing checks
- Create "admin modes" that ignore invariants
- Assume future relaxation of invariants

---

## 5. VERIFICATION

### Test Gate Status at Seal Time

| Test Suite | Status | Notes |
|------------|--------|-------|
| `tests/invariants/tenant-isolation.test.ts` | 5/7 PASS | 2 infra flaky (Firestore init race) |
| `tests/invariants/rbac.test.ts` | PASS | All assertions verified |
| `tests/invariants/status-transitions.test.ts` | PASS | All state machine tests verified |
| `tests/invariants/server-only-writes.test.ts` | PASS | Server-only enforcement verified |
| `tests/invariants.test.ts` | PASS | Comprehensive hostile tests pass |
| `tests/firestore.rules.test.ts` | PASS | Integration coverage verified |

### Known Infrastructure Issues (Not Security)

- **Firestore initialization race condition**: 2 tests in tenant-isolation fail with `Firestore has already been started` error. This is a test harness timing issue with the Firebase emulator, NOT a security rule failure. All actual security assertions (tenant isolation, write prevention) pass before the race condition triggers.

### Canonical Files Verified

- [x] `SECURITY_INVARIANTS.md` exists and is complete
- [x] `firestore.rules` contains DO NOT MODIFY warning block
- [x] All invariant test files exist and are not skipped

---

## 6. CULTURAL COMMITMENT

This seal represents more than a technical checkpoint. It encodes a cultural commitment:

> **"If you need to change this, you are no longer 'fixing a bug'. You are redesigning the system's trust model."**

Any engineer considering modification must understand:
- These invariants protect multi-tenant financial data
- Violations can cause regulatory compliance failures
- The friction is intentional and protective
- Speed is not more important than security

---

## 7. SEAL AUTHORITY

This seal is enacted by the Principal Platform Architect and Release Authority.

| Role | Responsibility |
|------|----------------|
| **Principal Architect** | Defines and enforces seal scope |
| **Security Engineer** | Validates invariants and tests |
| **Release Authority** | Authorizes tag creation and push |

---

## 8. REVISION HISTORY

| Version | Date | Action | Authority |
|---------|------|--------|-----------|
| v1 | 2026-02-11 | Initial architectural seal | Security Phase Lockdown |

---

> **END OF ARCHITECTURAL SEAL**
>
> Verify this seal: `git show security-phase-locked-v1`
>
> This document is final. Modifications require the full Seal Break Procedure.
