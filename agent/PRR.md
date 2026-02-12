# Production Readiness Review (PRR)

## Purpose
Checklist to verify Calybra is ready for production usage. All items must be PASS before GA release.

---

## 1. Security (P0 — Non-Negotiable)

| ID | Check | Status | Evidence |
|----|-------|--------|----------|
| SEC-01 | Tenant isolation enforced at Firestore rules level | PASS | `tests/invariants/tenant-isolation.test.ts`, `firestore.rules` |
| SEC-02 | RBAC enforced at rules level for all collections | PASS | `tests/invariants/rbac.test.ts` |
| SEC-03 | Terminal state immutability enforced | PASS | `tests/invariants/status-transitions.test.ts` |
| SEC-04 | Server-only collections protected from client writes | PASS | `tests/invariants/server-only-writes.test.ts` |
| SEC-05 | No secrets in repository | PASS | `.env.local` removed from tracking, `.gitignore` updated |
| SEC-06 | Storage paths tenant-scoped | PASS | `storage.rules` |
| SEC-07 | Status machine enforcement for ALL actors (including server) | PASS | Defense-in-depth rules (ADR-0009) |
| SEC-08 | Freeze enforcement after FINALIZED | PASS | Steps 1-4 integrity proofs |
| SEC-09 | Default deny in rules | PASS | `match /{path=**} { allow read, write: if false; }` |

## 2. Data Integrity (P0)

| ID | Check | Status | Evidence |
|----|-------|--------|----------|
| DAT-01 | Deterministic document IDs (SHA256-based) | PASS | Step 1 audit, `ingestion.ts` |
| DAT-02 | Transactional monthClose recompute | PASS | Step 2 audit |
| DAT-03 | Freeze enforcement in rules | PASS | Step 3 audit |
| DAT-04 | Readmodel snapshot generation | PASS | Step 4 audit |
| DAT-05 | Idempotent retryJob | PASS | E2E emulator proof |
| DAT-06 | No duplicate artifacts on re-run | PASS | E2E emulator proof |
| DAT-07 | Confirmed matches preserved on retry | PASS | Critical integrity fix release |

## 3. Availability & Reliability (P1)

| ID | Check | Status | Evidence |
|----|-------|--------|----------|
| AVL-01 | App Hosting deployed in EU | PASS | Release 0022-0023 |
| AVL-02 | Auth triggers working (onAuthCreate) | PASS | Release 0003 (ensureUserProvisioned fallback) |
| AVL-03 | Emulator-based CI pipeline | PASS | `.github/workflows/ci.yml` |
| AVL-04 | Rollback documentation per release | PASS | All RELEASE.md entries include rollback |

## 4. UX Completeness (P1)

| ID | Check | Status | Evidence |
|----|-------|--------|----------|
| UX-01 | All core pages render with real data | PASS | Dashboard, invoices, matches, month-closes, exceptions, exports, upload |
| UX-02 | i18n parity (en/es) | PASS | Release 0018 + `tests/i18n-parity.test.ts` |
| UX-03 | Auth error messages localized | PASS | Release 0020 |
| UX-04 | Loading/empty/error states on core pages | PARTIAL | Some pages need polish |
| UX-05 | Permission errors handled in UI | PARTIAL | Orchestration layer handles, not all pages wired |

## 5. Observability (P2)

| ID | Check | Status | Evidence |
|----|-------|--------|----------|
| OBS-01 | Structured logging module | PASS | `/observability/logging/` |
| OBS-02 | Non-interference proven (30 tests) | PASS | Release 0010 |
| OBS-03 | Trace context propagation | PASS | `/observability/context/` |
| OBS-04 | Error telemetry | PASS | `/observability/errors/` |

## 6. Testing Coverage (P1)

| ID | Check | Status | Evidence |
|----|-------|--------|----------|
| TST-01 | Server logic tests (152+) | PASS | `server/tests/` |
| TST-02 | Observability tests (41+) | PASS | `observability/tests/` |
| TST-03 | Invariant tests (4 suites) | PASS | `tests/invariants/` |
| TST-04 | Firestore rules tests | PASS | `tests/firestore.rules.test.ts` |
| TST-05 | i18n parity tests | PASS | `tests/i18n-parity.test.ts` |
| TST-06 | Total test count | PASS | 570 tests (446 non-emulator + 124 emulator) |

## 7. Documentation (P2)

| ID | Check | Status | Evidence |
|----|-------|--------|----------|
| DOC-01 | Architecture doc matches repo truth | PASS | `agent/ARCHITECTURE.md` + truth lock |
| DOC-02 | Firestore schema contract | PASS | `contracts/firestore.schema.md` |
| DOC-03 | Status machine contract | PASS | `contracts/status-machines.md` |
| DOC-04 | Counterfactual contract | PASS | `contracts/counterfactual-month-close.contract.md` |
| DOC-05 | Golden Paths documented | PASS | `agent/GOLDEN_PATHS/` (5 paths) |
| DOC-06 | Incident playbook | PASS | `ops/INCIDENT_PLAYBOOK.md` |

---

## Overall Verdict

**MVP: READY** — All P0 security and data integrity checks PASS.

**GA: CONDITIONAL** — UX polish (UX-04, UX-05) and manual Golden Path execution needed.

---

## Sign-off

| Role | Date | Status |
|------|------|--------|
| Architecture | 2026-02-12 | APPROVED |
| Security | 2026-02-12 | APPROVED (all invariants enforced) |
| QA | — | Pending manual Golden Path execution |
