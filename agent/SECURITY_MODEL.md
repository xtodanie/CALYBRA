# agent/SECURITY_MODEL.md

## Purpose

This document is the security contract for Calybra. It defines:

- tenant isolation invariants
- RBAC model and role-to-action expectations
- client vs server authority boundaries
- status transition enforcement
- storage authorization model
- required automated proofs (rules tests + invariants)

This is not aspirational. It must match repo truth.

---

## Source of Truth (Non-Negotiable)

Primary sources:

1) `firestore.rules`  
2) `storage.rules`  
3) `tests/**`  
4) `firebase.json` / `.firebaserc`

Secondary sources (must match primary):

- `agent/**`
- `contracts/**`
- `seed/**`
- `src/domain/schemas/**`

If any mismatch exists:

- STOP.
- Fix drift (docs/contracts/seed/schemas) to match rules/tests, **or** change rules/tests with proof + ADR.

---

## Threat Model (What We Defend Against)

P0 threats:

- Cross-tenant data access (read or write)
- Privilege escalation (forging roles, bypassing RBAC)
- Client forging server-authoritative fields (statuses, verification, totals)
- Tampering with month-close finalization (mutating finalized periods)
- Unauthorized file access or uploads in Storage
- Reference integrity corruption (cross-tenant matches)

---

## Security Objectives (P0)

1) **Default deny**: nothing is accessible unless explicitly allowed.  
2) **Tenant isolation**: a user can only access data for their tenant.  
3) **RBAC**: privileged actions require correct role checks.  
4) **Server-authoritative boundaries**: identity and privileged states cannot be client-forged.  
5) **Explicit state machines**: only allowed transitions; finalized is immutable.  
6) **Storage isolation**: files are tenant-scoped and authorized.

---

## Identity Model (Authoritative)

### Canonical user profile

A server-authoritative `users/{uid}` doc is the source of truth for:

- `tenantId`
- `role`
- `status` (`active`/`disabled`)

Rules must enforce:

- no profile => deny (do not assume tenantId)
- disabled user => deny (if implemented in rules)

### Provisioning boundary

Client must never be allowed to create or modify:

- `users/{uid}` identity fields
- any tenant membership primitives

Provisioning is server-only (Cloud Function/Admin).

---

## Multi-Tenancy Model (Truth-Derived)

The active canonical path model MUST match `firestore.rules`. This document does not choose; it reflects current truth.

Two models exist:

- **Model A**: `tenants/{tenantId}/<subcollections>`
- **Model B**: top-level collections with a `tenantId` field

The actual active model must be recorded in `agent/TRUTH_SNAPSHOT.md`.

Non-negotiable invariant:

- A user can only read/write documents belonging to their `users/{uid}.tenantId`.

---

## RBAC Model (Truth-Derived)

### Canonical role strings

Role names must match rules/tests exactly (no inventions).

If present in repo truth, the expected roles are:

- `VIEWER` (read-only)
- `ACCOUNTANT` (operational write)
- `MANAGER` (review/approve)
- `OWNER` (admin/final authority)

If the repo truth differs, follow the truth snapshot.

### Role matrix (Product-level intent; must match rules)

This matrix is only valid if it matches rules. If rules differ, update this matrix to match truth.

| Capability | VIEWER | ACCOUNTANT | MANAGER | OWNER |
|---|---:|---:|---:|---:|
| Read tenant data | Yes | Yes | Yes | Yes |
| Create invoices | No | No | No | No |
| Update invoices | No | No | No | No |
| Read bankTx | Yes | Yes | Yes | Yes |
| Create matches | No | No | No | No |
| Confirm matches | No | No | No | No |
| Create monthCloses | No | Yes | Yes | Yes |
| Change monthClose status | No | No | No | No |
| Finalize monthClose | No | No | No | No |
| Create fileAssets metadata | No | Yes | Yes | Yes |
| Update fileAssets privileged fields | No | No | No | No (server only) |

Truth note:

- “Finalize” and privileged status updates are server-only.

---

## Authority Boundaries (Client vs Server)

### Server-only (Typical, must match truth)

- `users/*` (identity)
- `tenants/*` (tenant metadata)
- `bankTx/*` writes (ingestion)
- privileged transitions (finalization, verification)
- derived totals and reconciliation outputs
- `events/*` writes (authoritative event stream)
- `periods/*` writes (period control)
- `readmodels/*` writes (derived projections)
- `exports/*` writes (generated artifacts)

### Client-limited writes (Typical, must match truth)

- monthCloses non-status field updates within allowlist + RBAC
- fileAssets minimal metadata create (no privileged fields)

### Server-only (Enforced by current rules)

- invoices create/update
- matches create/update

Hard rule:

- If a field is server-authoritative, clients must not set it at create time.
- Enforce via:
  - rules field allowlists
  - runtime validation schemas
  - invariant tests

---

## Status Machines (Explicit and Enforced)

Status values and transitions must match repo truth and are defined in:

- `contracts/status-machines.md`

Security requirements:

- Allowed transitions succeed only with required role(s).
- Disallowed transitions are denied.
- Finalized states are immutable.

Examples of invariants (truth-dependent):

- `monthCloses.status == "FINALIZED"` => deny any update
- `fileAssets` privileged statuses can only be set by server

---

## Firestore Rules Requirements

Minimum patterns required:

- Default deny match
- Helpers:
  - `isSignedIn`
  - user profile getter
  - tenant membership checks
  - `hasRole` checks
- Tenant isolation checks for every collection
- Create/update rules enforce:
  - `tenantId` matches caller tenant
  - field allowlist
  - status transition rules
  - immutability rules

---

## Storage Rules Requirements

Must enforce:

- default deny
- authenticated user
- tenant membership
- tenant-scoped storage paths

Hard rule:

- Storage path must not allow traversal into other tenant paths.

---

## Required Automated Proofs (P0)

These proofs must exist and pass in CI.

### Firestore rules tests

Must cover:

- unauthenticated denied (read + write)
- cross-tenant denied (read + write) for each core collection
- RBAC gates for privileged writes
- finalized immutability enforced
- forbidden client fields denied

Command:

```bash
firebase emulators:exec --only firestore "npm test"
```

### Invariant tests (required P0)

- tenant isolation (read + write) enforced
- RBAC enforced per role
- status transitions enforced
- server-only writes enforced

---

## Change Control (Hard Gate)

Any change to:

- canonical path model
- role strings
- authority boundaries
- status vocabulary or transitions

requires:

- ADR in `agent/DECISIONS.md`
- rules + tests updated with proof
- contracts/schemas/seed aligned
- truth lock + consistency gates PASS
- release note only after proofs PASS

---

## Security Incident Response (Summary)

If a P0 security regression is suspected:

1) Stop feature work.
2) Roll back rules to last known-good.
3) Run proofs (lint/typecheck/tests).
4) Create regression entry: `agent/REGRESSIONS/`.
5) Document incident in ops docs (if present).
