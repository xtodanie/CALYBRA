# SECURITY_INVARIANTS.md

> **CANONICAL SECURITY CONTRACT — BINDING AND AUTHORITATIVE**
>
> This document defines the non-negotiable security invariants of the CALYBRA system.  
> All contributors, reviewers, and automated systems must treat these invariants as law.  
> Violations are treated as security incidents.

---

## 1. Purpose & Scope

### What This Document Protects

This document protects the data integrity, tenant isolation, and audit guarantees of the CALYBRA month-close reconciliation system. It defines:

- Hard boundaries that no code, refactor, or optimization may cross
- Invariants that must hold in perpetuity, regardless of business pressure
- Explicit prohibitions on common "convenience" patterns that break security

### Why These Invariants Exist

CALYBRA handles financial reconciliation data for multiple independent tenants. A breach of any invariant could result in:

- **Cross-tenant data leakage**: Confidential financial data exposed to unauthorized parties
- **Audit trail corruption**: Finalized periods modified, destroying regulatory compliance
- **Privilege escalation**: Lower-privileged users performing administrative actions
- **State corruption**: Invalid status transitions causing data inconsistency

These invariants exist because the system will be audited, multiple teams will build on it, and future engineers will attempt to "simplify" it. This document makes that impossible without conscious violation.

---

## 2. Threat Model Summary

### Primary Threats (P0)

| Threat | Risk | Mitigation |
|--------|------|------------|
| **Cross-tenant data access** | User A reads/writes User B's financial data | Tenant isolation enforced at Firestore rules level |
| **Privilege escalation** | VIEWER forges OWNER role to modify data | Server-authoritative user profiles; roles cannot be client-set |
| **State corruption** | Invalid status transitions corrupt workflow | State machine enforcement in Firestore rules |
| **Audit trail destruction** | Finalized periods modified after audit | Terminal state immutability enforced for ALL actors |
| **Client forging server fields** | Client sets verification status or computed totals | Field allowlists and server-only write enforcement |

### Threat Categories

1. **Tenant Isolation Breach**: Any read or write that crosses tenant boundaries
2. **Privilege Escalation**: Any action performed without required role authorization
3. **State Corruption**: Any status transition not in the defined state machine
4. **Audit Integrity Violation**: Any mutation of a document in terminal state
5. **Identity Forgery**: Client-side creation or modification of identity documents

---

## 3. Actors

### Client (Authenticated User)

- Authenticated via Firebase Authentication
- Possesses a valid JWT token WITHOUT `admin: true` claim
- Subject to RBAC role checks
- Subject to tenant isolation checks
- Subject to field-level write restrictions
- **CANNOT change status fields** (server-only)
- **CANNOT write to server-only collections**

### Server (Trusted Backend)

- Authenticated via Firebase Admin SDK
- Possesses a valid JWT token WITH `admin: true` claim
- Bypasses RBAC role checks (can operate on any tenant)
- Bypasses tenant membership checks (can read/write any tenant path)
- **DOES NOT bypass state machine enforcement**
- **DOES NOT bypass terminal state immutability**
- **DOES NOT have unrestricted authority**

### Critical Distinction

> **"Trusted" does not mean "unrestricted."**
>
> The server is trusted to perform cross-tenant operations and bypass RBAC for automation purposes. The server is NOT trusted to violate state machine invariants or mutate terminal states.
>
> This is intentional. State machine and terminal state rules protect against bugs, misconfigurations, or compromised backend code. They are the last line of defense.

---

## 4. Global Invariants (NON-NEGOTIABLE)

These invariants are absolute. They apply to ALL actors, including server.

- **INV-001**: No unauthenticated actor may read or write any document.
- **INV-002**: No actor may read a document belonging to a tenant they are not a member of (except server).
- **INV-003**: No actor may write a document to a tenant path with a `tenantId` field that does not match the path.
- **INV-004**: No actor, including server, may update a document whose status is in a terminal state.
- **INV-005**: No actor, including server, may perform a status transition not defined in the state machine.
- **INV-006**: No actor, including server, may create a document with a status other than the initial state.
- **INV-007**: No client may create or modify documents in server-only collections.
- **INV-008**: No client may change the `status` field on any document (status is server-controlled).
- **INV-009**: No client may modify their own `users/{uid}` document (identity is server-controlled).
- **INV-010**: Default deny applies: any path not explicitly allowed is denied.

---

## 5. Tenant Isolation Invariants

### What Must Always Be Checked

1. Every read operation must verify the user's `tenantId` from `/users/{uid}` matches the target document's tenant path or `tenantId` field.
2. Every write operation must verify:
   - The user is a member of the target tenant (path-based check)
   - The document's `tenantId` field (if present) matches the path

### What May Never Be Bypassed

- Tenant membership lookup via `users/{uid}.tenantId` — this is the source of truth for user-to-tenant binding
- Path-based tenant scoping in `/tenants/{tenantId}/**` collections
- `tenantId` field validation on document create (must match path)

### Explicit Prohibitions

- A user may NOT read data from `/tenants/{tenantId}/**` if their `users/{uid}.tenantId` is different
- A user may NOT create a document with a forged `tenantId` claiming another tenant
- The absence of a user profile (`users/{uid}` does not exist) results in DENY, not assume-guest

---

## 6. RBAC Invariants

### Role Hierarchy

| Role | Capabilities |
|------|-------------|
| **VIEWER** | Read all tenant data. No write access. |
| **ACCOUNTANT** | VIEWER + Create monthClose, Update monthClose (not status), Create fileAsset |
| **MANAGER** | VIEWER + Create monthClose, Create fileAsset. No monthClose update. |
| **OWNER** | ACCOUNTANT capabilities. Full client authority within tenant boundaries. |

### What Roles Can Do

- **VIEWER**: Read tenant documents, jobs, exceptions
- **ACCOUNTANT**: Create/update monthCloses (excluding status), create fileAssets
- **MANAGER**: Create monthCloses, create fileAssets
- **OWNER**: All client-permissible operations

### What Roles Can NEVER Do

- **No role** may change `status` fields (server-only)
- **No role** may write to server-only collections (tenants, users, invoices, bankTx, matches, jobs, exceptions)
- **No role** may delete documents (server-only, where applicable)
- **No role** may update a FINALIZED monthClose
- **No role** may update or delete fileAssets after creation

### Server RBAC Bypass

The server bypasses RBAC role checks. This is intentional for automation:
- Backend jobs may create/update documents across any tenant
- Status transitions are server-initiated
- Data ingestion (bankTx, invoices) is server-initiated

The server bypass is auditable — all server writes should include `createdBy`/`updatedBy` identifying the process or trigger.

---

## 7. Status Machine Invariants (CRITICAL)

Status fields are the backbone of workflow integrity. Violations corrupt the audit trail.

### MonthClose Status Machine

```
DRAFT → IN_REVIEW → FINALIZED
         ↓
       DRAFT (rollback)
```

| Current State | Allowed Transitions |
|---------------|---------------------|
| DRAFT | IN_REVIEW |
| IN_REVIEW | DRAFT, FINALIZED |
| FINALIZED | NONE (terminal) |

**Enforcement**:
- Create requires `status == "DRAFT"`
- Client may NOT change status (must remain same value)
- Server must follow transition table
- FINALIZED is terminal — no actor may update

### FileAsset Status Machine

```
PENDING_UPLOAD → UPLOADED → VERIFIED → DELETED
                    ↓           ↓
                 REJECTED    DELETED
                    ↓
                 DELETED
```

| Current State | Allowed Transitions |
|---------------|---------------------|
| PENDING_UPLOAD | UPLOADED, DELETED |
| UPLOADED | VERIFIED, REJECTED, DELETED |
| VERIFIED | DELETED |
| REJECTED | DELETED |
| DELETED | NONE (terminal) |

**Enforcement**:
- Create requires `status == "PENDING_UPLOAD"`
- Client may NOT update or delete after creation (server-only)
- Server must follow transition table
- DELETED is terminal — no actor may update

### Match Status Machine

```
PROPOSED → CONFIRMED (terminal)
    ↓
 REJECTED (terminal)
```

| Current State | Allowed Transitions |
|---------------|---------------------|
| PROPOSED | CONFIRMED, REJECTED |
| CONFIRMED | NONE (terminal) |
| REJECTED | NONE (terminal) |

**Enforcement**:
- All match operations are server-only
- Create requires `status == "PROPOSED"`
- Server must follow transition table
- CONFIRMED and REJECTED are terminal — no actor may update

---

## 8. Terminal States (HARD STOP)

### Explicit Terminal State List

| Entity | Terminal States |
|--------|-----------------|
| MonthClose | `FINALIZED` |
| FileAsset | `DELETED` |
| Match | `CONFIRMED`, `REJECTED` |

### Terminal State Rule (ABSOLUTE)

> **No actor, including server, may mutate a document in a terminal state.**

This rule has no exceptions. It exists to:
- Protect audit integrity
- Prevent accidental or malicious modification after finalization
- Ensure regulatory compliance for financial records

If a business requirement demands "undoing" a finalization:
- This is a new business process requiring architectural review
- It must NOT be implemented by relaxing terminal state immutability
- A new pattern (e.g., amendment records) must be designed with ADR

---

## 9. Server Authority Model

### What Server Bypasses

| Bypass | Reason |
|--------|--------|
| Tenant membership check | Enables cross-tenant automation (e.g., batch jobs) |
| RBAC role check | Enables backend processes without human role |
| Field restrictions | Enables setting computed/derived fields |

### What Server Does NOT Bypass

| Enforcement | Reason |
|-------------|--------|
| State machine transitions | Prevents bugs/misconfigurations from corrupting state |
| Terminal state immutability | Protects audit trail from any actor, including compromised backend |
| Initial state enforcement | Ensures documents enter workflow correctly |

### Why This Is Intentional

The server bypass model is carefully scoped:

1. **RBAC bypass**: Server performs automated tasks that no human role should do (data ingestion, AI matching). These are audited via `createdBy`/`updatedBy` fields.

2. **Tenant bypass**: Server orchestrates multi-tenant operations (e.g., scheduled jobs). This is safe because the server is not user-impersonating.

3. **State machine enforcement**: The server does NOT bypass this because state machine bugs in backend code could corrupt data at scale. The rules layer is a safety net.

4. **Terminal state enforcement**: Even if backend code has a bug or is compromised, terminal documents remain immutable. This is the last line of defense for audit compliance.

---

## 10. Tests as Contracts

### Test Suites and Their Invariants

| Test File | Invariant Enforced |
|-----------|-------------------|
| `tests/invariants/tenant-isolation.test.ts` | INV-002, INV-003: Cross-tenant access denied |
| `tests/invariants/rbac.test.ts` | INV-007, INV-008: Role-based write restrictions |
| `tests/invariants/status-transitions.test.ts` | INV-004, INV-005, INV-006: State machine enforcement, terminal immutability |
| `tests/invariants/server-only-writes.test.ts` | INV-007: Server-only collection protection |
| `tests/invariants.test.ts` | Comprehensive hostile tests for all invariants |
| `tests/firestore.rules.test.ts` | Integration tests for rule logic |

### Security Boundary Statement

> **Tests are part of the security boundary.**
>
> The invariant test suites are not "nice to have" — they are security proofs. A test failure is a potential security incident. Tests must:
> - Run on every PR
> - Block merge if failing
> - Be reviewed with the same rigor as the rules themselves

### Test Modification Policy

- Modifying a test to make it pass without fixing the underlying rule is forbidden
- Adding new tests for new invariants is encouraged
- Removing tests requires security review and ADR

---

## 11. Change Policy

### Before Modifying Firestore Rules

Any modification to `firestore.rules` requires:

1. **Written justification**: Why is this change necessary?
2. **Invariant impact analysis**: Which invariants are affected?
3. **Test coverage**: New/modified tests proving the invariant still holds
4. **Architectural review**: Sign-off from security-aware reviewer
5. **ADR if significant**: Major changes require Architecture Decision Record

### Before Modifying Invariant Tests

Any modification to invariant test files requires:

1. **Written justification**: Why is this test being changed?
2. **Proof of equivalence**: Show the invariant is still enforced
3. **No relaxation**: Removing assertions or making tests less strict is forbidden without ADR
4. **Peer review**: Security-focused review required

### Prohibited Practices

- Commenting out failing tests
- Changing rules to "fix tests" without understanding the invariant
- Adding `// TODO: fix later` in security-critical code
- Relaxing terminal state checks for "edge cases"
- Introducing server omnipotence (server bypass of state machines)

---

## 12. Explicit Anti-Patterns (FORBIDDEN)

The following changes are explicitly forbidden. Any PR containing these patterns must be rejected.

### Forbidden Rule Changes

```javascript
// FORBIDDEN: Allowing server to update terminal states
allow update: if isServer();

// CORRECT: Server respects terminal state
allow update: if isServer() && !isTerminal();
```

```javascript
// FORBIDDEN: Removing state machine check
allow update: if isServer();

// CORRECT: Server follows state machine
allow update: if isServer() && isValidTransition(from, to);
```

```javascript
// FORBIDDEN: Client can change status
allow update: if isTenantMember(tenantId);

// CORRECT: Client cannot change status
allow update: if isTenantMember(tenantId) && statusUnchanged();
```

```javascript
// FORBIDDEN: Removing tenant isolation
allow read: if isSignedIn();

// CORRECT: Tenant isolation enforced
allow read: if isTenantMember(tenantId);
```

### Forbidden Test Changes

```typescript
// FORBIDDEN: Skipping security test
it.skip("SERVER CANNOT update FINALIZED monthClose", ...);

// FORBIDDEN: Weakening assertion
// Old: expect status change to fail
// New: expect status change to succeed "because server"

// FORBIDDEN: Removing terminal state tests
// Deleting tests for FINALIZED/DELETED/CONFIRMED/REJECTED immutability
```

### Forbidden Architectural Patterns

- Introducing a "super-admin" role that bypasses all checks
- Creating a "maintenance mode" that disables security rules
- Adding a "debug" flag that relaxes invariants
- Implementing "soft delete" by updating terminal state documents

---

## 13. Security-Critical Files

### Rule Files

| File | Invariant Enforced | Blast Radius if Modified Incorrectly |
|------|-------------------|-------------------------------------|
| `firestore.rules` | ALL invariants (INV-001 through INV-010) | Complete security model failure. Cross-tenant leakage, privilege escalation, audit destruction. |
| `storage.rules` | Storage access control, tenant file isolation | Unauthorized file access, cross-tenant file leakage. |

### Contract Files

| File | Invariant Enforced | Blast Radius if Modified Incorrectly |
|------|-------------------|-------------------------------------|
| `contracts/status-machines.md` | INV-004, INV-005, INV-006 (state machine definitions) | State machine drift between docs and rules, confusion about valid transitions. |
| `contracts/firestore.schema.md` | Schema expectations for validation | Validation drift, incorrect field enforcement. |

### Domain Files

| File | Invariant Enforced | Blast Radius if Modified Incorrectly |
|------|-------------------|-------------------------------------|
| `src/domain/rbac.ts` | Client-side RBAC permission model | UI/UX confusion, but rules still enforce server-side. |
| `src/domain/statusMachines/**` | Client-side state machine definitions | UI allows invalid transitions (rejected by rules). |

### Test Files

| File | Invariant Enforced | Blast Radius if Modified Incorrectly |
|------|-------------------|-------------------------------------|
| `tests/invariants.test.ts` | Comprehensive security invariant proofs | Loss of security proof. Regressions go undetected. |
| `tests/invariants/tenant-isolation.test.ts` | INV-002, INV-003 (tenant isolation) | Cross-tenant access regressions undetected. |
| `tests/invariants/rbac.test.ts` | INV-007 (role-based access) | RBAC regressions undetected. |
| `tests/invariants/status-transitions.test.ts` | INV-004, INV-005, INV-006 (state machines, terminal states) | State corruption regressions undetected. |
| `tests/invariants/server-only-writes.test.ts` | INV-007 (server-only collections) | Client write to protected collections undetected. |
| `tests/firestore.rules.test.ts` | Integration coverage for rules | Rule logic regressions undetected. |

---

## 14. Incident Response

If an invariant violation is detected:

1. **Treat as security incident** — not a bug, not a flaky test
2. **Stop deployment** — do not ship code that violates invariants
3. **Root cause analysis** — understand how the violation occurred
4. **Fix forward** — restore invariant enforcement, do not work around
5. **Postmortem** — document in `ops/INCIDENT_PLAYBOOK.md`

---

## 15. Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-11 | Security Phase Lockdown | Initial canonical version. Phase closed. |

---

> **END OF SECURITY INVARIANTS**
>
> This document is final. Modifications require architectural review and ADR.
> Treat any attempt to relax invariants as a potential security incident.
