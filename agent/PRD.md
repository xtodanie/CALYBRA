# agent/PRD.md

## Product Name
Calybra

## One-Sentence Definition
Calybra is a multi-tenant, security-first workflow system for invoice management and bank transaction verification, designed to make month-end reconciliation fast, auditable, and reliable without compromising tenant isolation or data integrity.

---

## 0) Product Principles (Immutable)
1) **Tenant Isolation is sacred.** No cross-tenant access, ever.
2) **Proof-driven shipping.** No “done” without executed proofs.
3) **Server-authoritative boundaries.** Identity, ingestion, and privileged states are not client-forgeable.
4) **Auditability over convenience.** Every critical action must be traceable.
5) **Small diffs win.** Ship in SSIs with minimal blast radius.
6) **No architecture drift.** Repo truth (rules/tests/config) is canonical; docs must match.

---

## 1) Target Users and Roles (Product-Level)
These are product roles; actual RBAC strings must match repo truth and are recorded in
`agent/TRUTH_SNAPSHOT.md`.
- OWNER: tenant administrator, final approver
- MANAGER: reviewer/approver
- ACCOUNTANT: operational reconciliation user
- VIEWER: read-only observer (see `agent/TRUTH_SNAPSHOT.md` for canonical RBAC)

---

## 2) Core Jobs-To-Be-Done (JTBD)
### JTBD-01: Track invoices without losing accuracy
User wants to capture invoices reliably, see what’s due, and maintain clean records.

### JTBD-02: Verify bank transactions and reconcile faster
User wants to view bank transactions and connect them to invoices with minimal friction and clear proof.

### JTBD-03: Match invoices to bank transactions with audit trails
User wants to propose/confirm/unmatch links and always know who did what.

### JTBD-04: Close a month with a controlled workflow
User wants a month close process with a clear status machine and immutability once finalized.

### JTBD-05: Upload and verify supporting documents
User wants to attach statements/invoice PDFs securely, with verified metadata and controlled lifecycle states.

---

## 3) Scope Definition

### In Scope (MVP-Ready, Shipping)
1) **Auth + tenant membership**
   - users/{uid} exists server-side with tenantId and role.
2) **Invoice CRUD (tenant-scoped)**
   - Create, view, edit with RBAC and safe fields.
3) **BankTx visibility (tenant-scoped, server-ingested)**
   - Read-only list, filters, basic detail view.
4) **Matching workflow**
   - Propose match, confirm match (role-gated), unmatch (role-gated), maintain integrity.
5) **Month close workflow**
   - Draft -> review -> finalized (exact strings per truth).
   - Finalized is immutable.
6) **File assets**
   - Upload metadata + storage path enforcement.
   - Server verification/parsing if implemented, with lifecycle controls.

### Explicit Non-Goals (For MVP)
- Autonomous AI changes to financial truth without review.
- Cross-tenant analytics or comparisons.
- Complex accounting exports unless explicitly decided and scoped.

---

## 4) Functional Requirements (Engineering-Grade)

### FR-01: Tenant-Scoped Data Access
- Every read/write must be tenant-scoped.
- Client must never be able to query or access other tenant data.

### FR-02: RBAC Enforcement
- Role gates must exist at rule level for:
  - privileged writes
  - status transitions
  - finalization
- UI must reflect permissions but rules are the final authority.

### FR-03: Status Machines Are Explicit and Enforced
- `monthCloses`, `matches`, `fileAssets` must have explicit status enums and valid transition rules.
- Finalized states must be immutable (where applicable).

### FR-04: Auditability
For critical actions, record:
- actor (uid)
- timestamp
- operation type (implicitly via document changes)
If full audit logs are added, define schema and tests.

### FR-05: Deterministic Dev + CI
- Emulators are the standard for testing.
- CI runs truth lock, consistency gate, lint/typecheck, tests.
- No “works locally” only.

---

## 5) Security Requirements (P0)
- Default deny in rules.
- Tenant isolation tested across all core collections.
- Forbidden client fields denied.
- No secrets in repo.
- Storage paths tenant-scoped and authorized.

---

## 6) UX Requirements (P1/P2)
- All core screens must have:
  - loading state
  - empty state
  - error state
- Permission errors must be handled and explained.
- Core flows must pass Golden Paths.

---

## 7) Quality & Proof Requirements (Hard)
A feature is not shippable unless:
- `agent/DEFINITION_OF_DONE.md` gates are met
- EVALS E0–E4 PASS in CI
- Relevant Golden Paths PASS (manual or automated)
- Release notes contain executed proof results (no pending)

---

## 8) Success Metrics (MVP)
- Reconciliation time per month reduced vs baseline
- Zero cross-tenant access regressions in CI
- Zero “proof pending” releases
- Decrease in manual mismatch correction time

---

## 9) Key Risks and Mitigations
### Risk: Architecture Drift
Mitigation:
- Truth Lock + Consistency Gate enforced in CI

### Risk: Security Regression
Mitigation:
- Rules tests + invariants + CODEOWNERS review

### Risk: Status Vocabulary Divergence (UI vs Rules)
Mitigation:
- Contracts + schemas + invariants must match truth; gate it

### Risk: Ingestion/verification complexity
Mitigation:
- Keep server-authoritative pipelines minimal in MVP
- Expand only via ADR + proofs

---

## 10) Open Questions (Must Become ADRs)
- Exact canonical path model (see `agent/TRUTH_SNAPSHOT.md`; do not guess)
- Exact role strings and permission mapping (see `agent/TRUTH_SNAPSHOT.md`; do not guess)
- Exact status enums per doc type (see `agent/TRUTH_SNAPSHOT.md`; do not guess)
- Which operations are server-only vs client-limited (see `agent/TRUTH_SNAPSHOT.md`; do not guess)

These must be resolved by reading repo truth and then updating ADRs/contracts accordingly.
