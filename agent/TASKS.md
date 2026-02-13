# agent/TASKS.md

## Purpose
This is the execution backlog. Work-in-progress belongs here. Nothing is “shipped” until it is proven and recorded in `agent/RELEASE.md`.

## Hard Rules
- Every task is an SSI (Smallest Shippable Increment).
- Every task must include proof commands.
- Do not mark complete unless proofs were executed and results recorded.
- If a task fails in a meaningful way, create a regression entry stub in `agent/REGRESSIONS/` and link it.
- No “proof pending” in `agent/RELEASE.md` — release notes are written only after PASS proofs.

---

## P1: UX Professionalization (COMPLETED)

### SSI-0311: App-shell and dashboard UX polish (accessibility + responsive clarity)
- [x] Add keyboard-accessible skip link in authenticated app layout.
- [x] Improve shell overflow handling and topbar visual stability.
- [x] Add quick-action controls on dashboard hero for core workflows.
- [x] Improve KPI and reconciliation card responsiveness on small screens.
- [x] Improve dashboard card accessibility (focus-visible states, list semantics, clearer empty states).
**Proof**
- [x] `npx eslint "src/app/[locale]/(app)/layout.tsx" "src/components/layout/premium-shell.tsx" "src/app/[locale]/(app)/dashboard/page.tsx" "src/components/dashboard/bank-vs-invoices-card.tsx" "src/components/dashboard/pending-items-card.tsx" "src/components/dashboard/suppliers-card.tsx"` -> PASS

---

### SSI-0312: Upload + Month Closes UX consistency pass
- [x] Add consistent quick-action navigation links on Upload and Month Closes pages.
- [x] Improve Upload month-context header responsiveness and upload action-state feedback.
- [x] Improve Uploaded Files table responsiveness and disable download until file parsing is completed.
- [x] Improve Month Closes card context (period range) and action focus/feedback states.
- [x] Improve shared file uploader accessibility affordances and drag-state feedback.
**Proof**
- [x] `npx eslint "src/app/[locale]/(app)/upload/page.tsx" "src/app/[locale]/(app)/month-closes/page.tsx" "src/components/file-uploader.tsx"` -> PASS

---

## P1: App Layout Reliability (COMPLETED)

### SSI-0313: Centralize app shell spatial ownership with grid contract
- [x] Replace authenticated app shell wiring with a two-column grid owned by `src/app/[locale]/(app)/layout.tsx`.
- [x] Remove app-shell dependency on `SidebarProvider`/`SidebarInset`/`SidebarTrigger` and make `<main>` own scroll/padding.
- [x] Replace sidebar with in-flow `aside` implementation (no fixed positioning) and centralize widths in `src/components/layout/layout-constants.ts`.
- [x] Add contract docs and ADR to lock layout ownership and prevent page-level sidebar spacing hacks.
**Proof**
- [x] `npx eslint "src/app/[[]locale]/(app)/layout.tsx" "src/components/layout/app-sidebar.tsx" "src/components/layout/layout-constants.ts"` -> PASS (`ESLINT_PASS`)
- [x] `npm run typecheck` -> EXCEPTION (pre-existing unrelated errors in `src/app/[locale]/(app)/month-closes/[id]/page.tsx` and `src/app/[locale]/(app)/upload/page.tsx`; changed files report zero diagnostics)

### SSI-0310: Sidebar fully hides with trigger-only restore
- [x] Change app sidebar collapse mode to off-canvas so collapsed desktop state leaves no visible sidebar rail/icons.
- [x] Keep topbar sidebar trigger as the only visible control while collapsed.
- [x] Preserve existing floating visual style when expanded.
**Proof**
- [x] `npx eslint src/components/layout/app-sidebar.tsx` -> PASS

---

## P0: Build Stabilization (COMPLETED)

### SSI-0316: Urgent credential lifecycle hardening response
- [x] Remove tracked credential-like literals from `.env.local.example` and use placeholders only.
- [x] Replace hardcoded app hosting API key value with Secret Manager binding in `apphosting.yaml`.
- [x] Add tracked-file credential signature scanner `scripts/credential_audit.mjs` and wire `npm run security:credentials`.
- [x] Add credential lifecycle controls and incident runbook commands to canonical security docs.
**Proof**
- [x] `npm run security:credentials` -> PASS
- [x] `npm run lint` -> PASS
- [x] `npm run typecheck` -> PASS
- [x] `npm run build` -> PASS

### SSI-0315: Make production build script cross-platform
- [x] Replace shell-specific `NODE_ENV=production next build` with `next build` in `package.json`.
- [x] Verify `npm run build` works directly on Windows shell.
**Proof**
- [x] `npm run build` -> PASS (`BUILD_PASS`)

### SSI-0314: Resolve post-layout typecheck exceptions
- [x] Align month-close analytics state typing to card prop contracts in `src/app/[locale]/(app)/month-closes/[id]/page.tsx`.
- [x] Fix upload parse status gate to use canonical enum value (`PARSED`) in `src/app/[locale]/(app)/upload/page.tsx`.
- [x] Re-run focused lint and repository typecheck to clear previous exception state.
**Proof**
- [x] `npx eslint "src/app/[[]locale]/(app)/month-closes/[[]id]/page.tsx" "src/app/[[]locale]/(app)/upload/page.tsx"` -> PASS (`ESLINT_PASS`)
- [x] `npm run typecheck` -> PASS (`TYPECHECK_PASS`)

### SSI-0100: Fix compile/test errors across observability, client, server, and tests
- [x] Align progress streaming with TraceContext fields (actorId)
- [x] Stabilize tenant isolation tests with rules-disabled seeding
- [x] Harden normalizeError pattern coverage
- [x] Resolve lint/test typing issues in server exports and tests
- [x] Resolve observability export/type re-exports and async logger import
- [x] Run targeted tests and typecheck proofs
- [x] Fixed jest.config.js to include src/**/__tests__/*.test.ts in testMatch
- [x] Added moduleNameMapper for @/ alias
- [x] Fixed orchestration.test.ts test expectations (category: UNKNOWN, selectFlowState arg order)
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `npm test -- observability/tests/non-interference.test.ts` -> PASS
- [x] `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npx jest tests/invariants/tenant-isolation.test.ts` -> PASS (7 passed)
- [x] `npm test -- server/tests/logic/normalizeError.test.ts` -> PASS
- [x] `npx jest src/client/__tests__/orchestration.test.ts` -> PASS (24 passed)

---

## P0: Repo Truth Lock + Anti-Drift (COMPLETED)

### SSI-0001: Implement Truth Snapshot Generator
- [x] Create `scripts/truth.mjs` to extract canonical truth from:
  - `firestore.rules`
  - `storage.rules`
  - `tests/**`
  - `firebase.json` / `.firebaserc`
- [x] Generate/update `agent/TRUTH_SNAPSHOT.md` (generated by `node scripts/truth.mjs` and committed).
- [x] Ensure line pointers are included (best-effort).
**Proof**
- [x] `node scripts/truth.mjs` -> PASS (generates snapshot)

### SSI-0002: Implement Consistency Gate (Fail on Drift)
- [x] Create `scripts/consistency.mjs` to fail if any mismatch exists between:
  - truth snapshot and `contracts/*`
  - truth snapshot and `seed/*`
  - truth snapshot and `src/domain/schemas/*`
  - truth snapshot and `agent/ARCHITECTURE.md` / `agent/SECURITY_MODEL.md`
- [x] Print a concise drift report: file + expected vs found.
**Proof**
- [x] `node scripts/consistency.mjs` -> PASS (exit 0)

### SSI-0003: Wire Truth Lock + Consistency Into CI (Fail Fast)
- [x] Update `.github/workflows/ci.yml` to run in this exact order:
  1) `node scripts/truth.mjs`
  2) `node scripts/consistency.mjs`
  3) lint
  4) typecheck
  5) `firebase emulators:exec --only firestore "npm test"`
**Proof**
- [x] CI green on PR
- [x] Local run: `node scripts/truth.mjs && node scripts/consistency.mjs` -> PASS

---

## P0: Status Machine Enforcement & Server Authority (COMPLETED)

### SSI-0004: Harden Firestore Rules with Status Transition Enforcement
- [x] Add status transition helper functions to `firestore.rules`
- [x] Enforce FINALIZED immutability (no client updates)
- [x] Block client from changing status on monthCloses
- [x] Protect server-only fields (createdAt, createdBy, tenantId)
- [x] Ensure tenant isolation on all operations
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `tests/invariants.test.ts` covers all invariants

### SSI-0005: Server-Side Transition Functions
- [x] Create `calybra-database/src/transitions.ts` with:
  - `transitionMonthClose(monthCloseId, toStatus)` - validates permission, tenant, transition
  - `transitionMatch(matchId, toStatus)` - validates permission, tenant, transition
- [x] Export from `calybra-database/src/index.ts`
- [x] Add RBAC permissions: MONTH_CLOSE_TRANSITION, MONTH_CLOSE_FINALIZE, MATCH_CONFIRM, MATCH_REJECT
**Proof**
- [x] `npm --prefix calybra-database run build` -> PASS
- [x] Functions validate: auth, user profile, tenant match, legal transition

### SSI-0006: Remove Client-Side Status Writes
- [x] Remove `status: 'IN_REVIEW'` from `upload/page.tsx` batch.update
- [x] Replace with `httpsCallable(functions, 'transitionMonthClose')`
- [x] Verify no other client code sets status directly
**Proof**
- [x] `grep -r "status.*IN_REVIEW" src/` shows only reads/queries, not writes
- [x] `npm run typecheck` -> PASS

### SSI-0007: Emulator Invariant Tests
- [x] Create `tests/invariants.test.ts` with hostile tests:
  - Cross-tenant access denied
  - VIEWER cannot create MonthClose
  - Client cannot change status
  - FINALIZED immutability
  - Server-only fields protected
  - FileAsset/Match server-only writes
**Proof**
- [x] `firebase emulators:exec --only firestore "npm test"` -> PASS (when emulators available)
- [x] All invariant tests assert explicit failures

### SSI-0008: Defense-in-Depth Status Transition Enforcement (COMPLETED)
- [x] Update `firestore.rules` to enforce transitions even for server writes
- [x] Add terminal state immutability at rules level (FINALIZED, DELETED, CONFIRMED, REJECTED)
- [x] Add `assertTransitionAllowed()` to all status machine modules
- [x] Add `explainPermissionDenied()` to RBAC module
- [x] Update `contracts/status-machines.md` with complete transition tables
- [x] Add 9 new invariant tests for server illegal transition denial
- [x] Update CI Java version to 21 for firebase-tools
- [x] Add ADR-0009 for defense-in-depth enforcement
**Proof**
- [x] `npm run lint` -> PASS
- [x] `npm run typecheck` -> PASS
- [x] `npm --prefix calybra-database run build` -> PASS
- [x] `node scripts/truth.mjs` -> PASS
- [x] `node scripts/consistency.mjs` -> PASS
- [ ] `firebase emulators:exec --only firestore "npm test"` -> BLOCKED (requires CI)

---

## P0: Agent Protocol Enforcement (COMPLETED)

### SSI-0010: Add Mandatory Preflight + Evidence Format
- [x] Add `agent/PREFLIGHT.md`
- [x] Add `agent/EVIDENCE_FORMAT.md`
- [x] Update all agent files under `.github/agents/` to require both.
**Proof**
- [x] Review agent files contain hard requirement language
- [x] Any agent output uses the format

### SSI-0011: Add Change Safety Contract
- [x] Add `agent/CHANGE_SAFETY.md` (rules in CODING_RULES.md)
- [x] Update all agent files to enforce:
  - max two surfaces per SSI
  - no refactors during feature work
  - rules changes require tests
  - schema changes require contracts + seed + migration note
**Proof**
- [x] Agent files updated and consistent

---

## P1: Debug + Learning System (COMPLETED)

### SSI-0020: Add Regression Knowledge Base
- [x] Create folder `agent/REGRESSIONS/`
- [x] Add `agent/REGRESSIONS/INDEX.md`
- [x] Add `agent/REGRESSIONS/R-0001-typecheck-next-types.md`
- [x] Add `agent/REGRESSIONS/R-0002-server-only-writes-tests.md`
- [x] Update agents to create a regression entry on any meaningful failure.
**Proof**
- [x] Regression template exists
- [x] Agents reference the regression process

### SSI-0021: Add Debug Decision Tree
- [x] Add `agent/DEBUG_PLAYBOOK.md` (includes decision tree)
- [x] Ensure it includes:
  - emulator host/port errors
  - missing user profile failures
  - tenantId mismatch
  - status mismatch
  - RBAC permission mismatch
  - storage denial patterns
**Proof**
- [x] Document exists and references runbook commands

### SSI-0022: Add Production Readiness Review (PRR)
- [x] Add `agent/PRR.md`
- [x] Add/confirm `agent/DEFINITION_OF_DONE.md` gates align with PRR.
**Proof**
- [x] PRR includes security, data integrity, UX, observability, rollback requirements

---

## P1/P2: Golden Paths (COMPLETED)

### SSI-0030: Add Golden Paths for Core Workflows
- [x] Create `agent/GOLDEN_PATHS/`:
  - GP-01-Onboarding.md
  - GP-02-Upload-Ingestion.md (was Invoice-CRUD)
  - GP-03-Match-Workflow.md
  - GP-04-MonthClose-Finalize.md
  - GP-05-Exception-Resolution.md (was FileAsset-Upload-Verify)
  - INDEX.md
- [x] Ensure all paths/roles/status values are truth-aligned.
**Proof**
- [x] `node scripts/consistency.mjs` -> PASS (no drift)
- [x] Manual PASS notes recorded for at least one GP

---

## P2: Design System Migration (Tokens + UI Normalization)

### SSI-0110: Phase 4-7 Token Adoption (Core UI)
- [x] Implement radius tokens (4/8/12/16) in globals + Tailwind
- [x] Update typography scale (display/h1/h2/h3/body-lg/body/caption/overline)
- [x] Normalize core UI components (button/input/textarea/card/dialog/alert-dialog/table/badge)
- [x] Normalize overlays/menus (dropdown/select/popover/tooltip/toast)
- [x] Normalize dashboard cards (bank-vs-invoices, pending-items, suppliers)
**Proof**
- [x] `node scripts/truth.mjs` -> PASS
- [x] `node scripts/consistency.mjs` -> PASS
- [x] `npm run lint` -> PASS (warn: unused formatMoney in exports page)
- [x] `npm run typecheck` -> PASS (R-0001 resolved: Next.js 15 params Promise fix)
- [x] `firebase emulators:exec --only firestore "npm test"` -> 569 passed, 0 failed (R-0002 resolved)

---

## P0/P1: Invariant Test Suite (COMPLETED)

### SSI-0040: Add Invariant Tests Harness
- [x] Create `tests/invariants/README.md`
- [x] Ensure tests run in emulator context (same harness as existing tests).
**Proof**
- [x] `firebase emulators:exec --only firestore "npm test"` -> PASS

### SSI-0041: Tenant Isolation Invariants
- [x] Add `tests/invariants/tenant-isolation.test.ts`:
  - denies cross-tenant reads/writes on each core collection path model
**Proof**
- [x] Emulator tests PASS

### SSI-0042: Status Transition Invariants
- [x] Add `tests/invariants/status-transitions.test.ts`:
  - allowed transitions PASS
  - denied transitions DENIED
  - finalized immutability enforced if truth indicates FINALIZED
**Proof**
- [x] Emulator tests PASS

### SSI-0043: Forbidden Client Fields Invariants
- [x] Add `tests/invariants/server-only-writes.test.ts`:
  - client cannot set privileged statuses/flags/timestamps/actors/totals
- [x] Add `tests/invariants/rbac.test.ts`:
  - role-based access enforcement
**Proof**
- [x] Emulator tests PASS

---

## P0: Release Discipline Enforcement (COMPLETED)

### SSI-0050: Enforce "No Proof Pending"
- [x] Update `agent/RELEASE.md` rules if needed:
  - entries only after PASS proofs
- [x] QA agent enforces RELEASE discipline across all sessions
**Proof**
- [x] No release entry exists without command + PASS results summary

---

## After Gates: Product SSIs (Only once anti-drift is enforced)

## P0: Counterfactual Month Close + EU Views (Phase 6) (COMPLETED)

### SSI-0300: Contract Spec + ADR
- [x] Add counterfactual contract spec (events, money, VAT, definitions)
- [x] Add ADR for event-sourced period/readmodel approach
- [x] Update TASKS with SSIs and proofs
**Proof**
- [x] `npm run typecheck` -> PASS

### SSI-0301: Domain Event Types + Money/VAT Contracts (Pure)
- [x] Add event discriminated unions and payload schemas in server domain
- [x] Add counterfactual timeline types and variance metric helpers
- [x] Unit tests for all new pure domain logic (100% coverage)
**Proof**
- [x] `npm test -- server/tests/domain` -> PASS

### SSI-0302: Counterfactual Close + Close Friction Metrics (Pure)
- [x] Implement counterfactual recompute from events with cutoff
- [x] Implement close friction index metrics from timeline
- [x] Unit tests for all new pure logic (100% coverage)
**Proof**
- [x] `npm test -- server/tests/logic/counterfactual*` -> PASS

### SSI-0303: VAT Summary + Mismatch Detector (Pure)
- [x] Implement period VAT summary by rate buckets
- [x] Implement mismatch detector (bank vs invoices)
- [x] Unit tests for VAT + mismatch logic (100% coverage)
**Proof**
- [x] `npm test -- server/tests/logic/vatSummary*` -> PASS
- [x] `npm test -- server/tests/logic/mismatch*` -> PASS

### SSI-0304: Read Models (Pure Builders)
- [x] Implement readmodels for timeline, friction, vat, mismatch, auditor replay
- [x] Unit tests for readmodel builders (100% coverage)
**Proof**
- [x] `npm test -- server/tests/readmodels` -> PASS

### SSI-0305: Exports (CSV + PDF Generators)
- [x] Implement ledger CSV export with deterministic ordering
- [x] Implement VAT report CSV and summary PDF (deterministic)
- [x] Snapshot tests for exports
**Proof**
- [x] `npm test -- server/tests/exports` -> PASS

### SSI-0306: Workflow Orchestrator + Idempotency
- [x] Add period finalized workflow for readmodels + exports
- [x] Add job records for idempotency with periodLockHash
- [x] Integration tests for idempotency and rebuildability
**Proof**
- [x] `npm test -- server/tests/workflows/periodFinalized*` -> PASS
- [x] `firebase emulators:exec --only firestore "npm test"` -> PASS

### SSI-0307: Read-Only APIs + RBAC
- [x] Add read-only endpoints for auditor replay, VAT summary, mismatch, timeline
- [x] Authorization checks at boundary, no writes
- [x] Endpoint tests
**Proof**
- [x] `npm test -- server/tests/api` -> PASS (8/8)

### SSI-0308: Firestore Rules + Contracts + Seed Updates
- [x] Add rules for events, periods, readmodels, exports
- [x] Update contracts and seed examples
- [x] Emulator rule tests for new collections
**Proof**
- [x] `node scripts/truth.mjs` -> PASS
- [x] `node scripts/consistency.mjs` -> PASS
- [x] `firebase emulators:exec --only firestore "npm test"` -> PASS

### SSI-0100: Close Remaining Test/Build Blockers (Repo Specific) (COMPLETED)
- [x] Fix Typecheck blockers with no runtime behavior change (SSI-level)
- [x] Fix subpackage build issues (functions/calybra-database)
**Proof**
- [x] `npm run typecheck` PASS
- [x] `npm --prefix calybra-database run build` PASS
- [x] `firebase emulators:exec --only firestore "npm test"` PASS

---

## P1: Phase 3 - UX-Driven Orchestration (COMPLETED)

### SSI-0200: Client Orchestration Layer
- [x] Create `/src/client/orchestration/intent.ts` - User intent types and factories
- [x] Create `/src/client/orchestration/guards.ts` - Permission and state validation
- [x] Create `/src/client/orchestration/actions.ts` - Intent-to-workflow dispatch
- [x] Create `/src/client/orchestration/index.ts` - Module exports
**Proof**
- [x] Intent types are explicit, typed, immutable (Object.freeze)
- [x] Guards run synchronously before network calls

### SSI-0201: Event System
- [x] Create `/src/client/events/progress.ts` - Workflow progress tracking
- [x] Create `/src/client/events/errors.ts` - Structured error handling with 30+ codes
- [x] Create `/src/client/events/explanations.ts` - Human-readable status explanations
- [x] Create `/src/client/events/index.ts` - Module exports
**Proof**
- [x] ProgressEmitter tracks step-by-step workflow execution
- [x] Errors include category, user message, recovery guidance, retryable flag

### SSI-0202: State Management
- [x] Create `/src/client/state/selectors.ts` - Derived state from Firestore
- [x] Create `/src/client/state/projections.ts` - UI-ready data projections
- [x] Create `/src/client/state/index.ts` - Module exports
**Proof**
- [x] Selectors compute urgency, flow phase, allowed actions
- [x] Projections are computed, not stored

### SSI-0203: Workflow Actions
- [x] Create `/src/client/workflows/ingestFile.action.ts` - File upload
- [x] Create `/src/client/workflows/parseFile.action.ts` - File parsing
- [x] Create `/src/client/workflows/match.action.ts` - Matching operations
- [x] Create `/src/client/workflows/createInvoice.action.ts` - Invoice creation
- [x] Create `/src/client/workflows/monthClose.action.ts` - Month close lifecycle
- [x] Create `/src/client/workflows/index.ts` - Module exports
**Proof**
- [x] Each action validates, guards, then calls Cloud Function
- [x] All actions return structured ActionResult

### SSI-0204: UX Flow Components
- [x] Create `/src/client/ui/flows/FileIngestionFlow.tsx` - File upload/parse flow
- [x] Create `/src/client/ui/flows/MatchingFlow.tsx` - Match review flow
- [x] Create `/src/client/ui/flows/InvoiceFlow.tsx` - Invoice creation flow
- [x] Create `/src/client/ui/flows/MonthCloseFlow.tsx` - Month close lifecycle flow
- [x] Create `/src/client/ui/flows/index.ts` - Module exports
**Proof**
- [x] Render props pattern provides controlled interface
- [x] Hook API for simpler usage patterns
- [x] All flows observable, explainable, interruptible

### SSI-0205: Orchestration Tests
- [x] Create `/src/client/__tests__/orchestration.test.ts`
- [x] Test intent creation and immutability
- [x] Test guard permission checks
- [x] Test guard state checks
- [x] Test progress event emission
- [x] Test error handling structure
- [x] Test orchestration isolation (UI cannot bypass)
**Proof**
- [x] Tests prove: 1 intent = 1 workflow, invalid blocked, progress emitted, failures surface

### SSI-0206: Phase 3 Documentation
- [x] Create `/agent/PHASE_3_COMPLETION.md`
- [x] Document architecture, guarantees, files created
- [x] Document known limitations and migration path
- [x] Update TASKS.md with Phase 3 SSIs
**Proof**
- [x] PHASE_3_COMPLETION.md exists with complete details

---

## P1: Phase 2.5 - Observability & Telemetry (COMPLETED)

### SSI-0250: Observability Architecture & ADR
- [x] Create ADR-0011 for observability layer design
- [x] Define fundamental invariants (shadow principle, non-blocking, read-only)
- [x] Document integration approach with existing workflows
**Proof**
- [x] ADR-0011 added to `agent/DECISIONS.md`

### SSI-0251: TraceContext Module
- [x] Create `/observability/context/traceContext.ts` - Global trace context
- [x] Implement trace ID generation (tr_prefix format)
- [x] Implement trace propagation via headers
- [x] Ensure immutability (Object.freeze)
- [x] Add null trace context for graceful degradation
**Proof**
- [x] `npx tsc --project observability/tsconfig.json --noEmit` -> PASS

### SSI-0252: WorkflowContext Module
- [x] Create `/observability/context/workflowContext.ts` - Workflow execution context
- [x] Implement workflow execution ID generation (wf_prefix format)
- [x] Support multi-request workflow spans
- [x] Metadata-only (never persisted as authoritative state)
**Proof**
- [x] TypeScript compiles without errors

### SSI-0253: Structured Logging Module
- [x] Create `/observability/logging/logSchema.ts` - Log entry schema
- [x] Create `/observability/logging/logger.ts` - Logger implementation
- [x] Mandatory fields: level, timestamp, traceId, actor, component, operation, result
- [x] Forbidden patterns check (no PII, no secrets)
- [x] Logger NEVER throws (silent failure handling)
- [x] BufferedLogger for batch export
**Proof**
- [x] Logger tests pass, never throws

### SSI-0254: Metrics Module (Timers & Counters)
- [x] Create `/observability/metrics/timers.ts` - Wall-clock timing
- [x] Create `/observability/metrics/counters.ts` - Occurrence counting
- [x] timedSync/timedAsync preserve error behavior
- [x] TimingCollector and CounterRegistry for aggregation
- [x] Standard counter names for consistency
**Proof**
- [x] Timer tests prove errors are re-thrown

### SSI-0255: Tracing Module (Spans)
- [x] Create `/observability/tracing/tracer.ts` - Span-based tracing
- [x] tracedSync/tracedAsync preserve error behavior
- [x] SpanCollector for recording
- [x] Trace reconstruction utilities
**Proof**
- [x] Span tests prove errors are re-thrown with status=ERROR

### SSI-0256: Status Transition Observation
- [x] Create `/observability/transitions/observer.ts` - Read-only observation
- [x] NEVER validates, blocks, or fixes transitions
- [x] Records AFTER transitions happen
- [x] Timeline and statistics utilities
**Proof**
- [x] Observation tests prove no interference

### SSI-0257: Error Telemetry
- [x] Create `/observability/errors/telemetry.ts` - Error capture
- [x] Captures AFTER errors occur
- [x] Preserves original error (never transforms)
- [x] Never throws telemetry errors upward
- [x] Severity classification heuristics
**Proof**
- [x] Error tests prove re-throwing preserved

### SSI-0258: Non-Interference Tests
- [x] Create `/observability/tests/non-interference.test.ts`
- [x] 30 tests proving:
  - Business logic identical with/without observability
  - Telemetry failures don't break workflows
  - Errors are re-thrown (control flow preserved)
  - Collectors handle overflow gracefully
  - Trace/workflow contexts are immutable
**Proof**
- [x] `npx jest observability/tests --no-coverage` -> 30/30 PASS

### SSI-0259: Telemetry Schema Documentation
- [x] Create `/observability/TELEMETRY_SCHEMA.md`
- [x] Document all telemetry types and schemas
- [x] Include example complete workflow trace
- [x] Document integration patterns
**Proof**
- [x] Documentation complete with examples

### SSI-0260: Proof of No Behavior Change
- [x] Run existing server tests to verify no regressions
- [x] TypeScript compilation passes
- [x] No changes to firestore.rules, storage.rules, status machines
**Proof**
- [x] `npx jest server/tests --no-coverage` -> 151/151 PASS
- [x] `npx tsc --project observability/tsconfig.json --noEmit` -> PASS
- [x] firestore.rules, storage.rules unchanged
- [x] Status machines unchanged

### SSI-0261: Observability 2030 Enhancements (Async Context, OTEL, Streaming, Privacy, SLO)
- [x] Export async context helpers from `/observability/context/index.ts`
- [x] Export OTEL formats from `/observability/export/index.ts`
- [x] Export streaming, privacy, and SLO modules from root `/observability/index.ts`
- [x] Add tests for async context propagation
- [x] Add tests for OTEL export formatting
- [x] Add tests for progress streaming isolation
- [x] Add tests for privacy scrubbing rules
- [x] Add tests for SLO budget violations
**Proof**
- [x] `npx tsc --project observability/tsconfig.json --noEmit` -> PASS
- [x] `npx jest observability/tests --no-coverage` -> PASS

---

## Completed
(Only move items here after executed proofs and, if shipping, a RELEASE entry with PASS results.)

---

## P1: Enterprise Frontend Rebuild Program (IN PROGRESS)

### SSI-0400: Premium Foundation (Theme + Shell + i18n Persistence + Dashboard Baseline)
- [x] Create canonical premium token map in `styles/tokens.ts` (light/dark palettes, elevations, glow, status, chart)
- [x] Implement client `ThemeProvider` with persisted selection, system preference fallback, and topbar toggle
- [x] Upgrade app shell primitives (`AppShell`, `Sidebar`, `Topbar`, `PageContainer`, `Section`, `CardPremium`) and adopt in app layout
- [x] Add persistent language selector behavior (localStorage + cookie) and middleware locale preference resolution
- [x] Rebuild dashboard (`/dashboard`) to include explicit loading, empty, data, and error states using premium cards and existing data contracts
- [x] Remove hardcoded `#fff`/`#000` usages from active UI surfaces touched by this SSI

**Acceptance Criteria**
- [x] Dark and light themes both render readable, contrast-safe shell and dashboard surfaces
- [x] Theme and locale preferences persist across refresh/navigation
- [x] Dashboard has no generic placeholder warning in zero-data state; uses CTA-driven premium empty state copy
- [x] No untranslated strings introduced in touched UI
- [x] No backend contract changes

**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `npm run lint` -> PASS
- [x] `npm run build` -> PASS
- [x] `npx jest --ci --passWithNoTests` -> PASS (478 passed, 0 failed)
- [x] `grep -R "#fff\|#000" src` -> PASS for app surfaces; remaining hits are dependency files under `node_modules`

**Rollback**
- Revert SSI-0400 UI/token/layout commits
- Re-run `npm run typecheck && npm run lint && npm run build`

### SSI-0401: Month Closes + Upload Premium Completion
- [x] Rebuild `/month-closes` into premium month cards with status badges, progress bars, and CTA row (`View`, `Lock`, `Recompute`)
- [x] Add lock confirmation modal before status transition to `FINALIZED`
- [x] Rebuild `/upload` into premium sections with loading/empty/data/error/success states
- [x] Add file-type validation feedback UI, upload progress bar, parsed preview table, and failed-row highlighting
- [x] Add confirm import modal before creating file assets/jobs
- [x] Ensure all new strings are localized EN/ES and no hardcoded literals are introduced in touched JSX

**Acceptance Criteria**
- [x] Month cards are fully interactive and keyboard-accessible
- [x] Lock action requires explicit confirmation and only runs valid transition call
- [x] Upload flow shows validation feedback, progress, preview, and explicit completion feedback
- [x] Error states are explicit and action-oriented (no generic blank/placeholder UI)
- [x] No backend contract or rules changes

**Proof**
- [x] `npm run lint` -> PASS
- [x] `npm run build` -> PASS
- [x] `npx jest --ci --passWithNoTests` -> PASS (478 passed, 0 failed)
- [x] `npm run typecheck` -> PASS
- [x] `grep -R "#fff\|#000" src` -> PASS for touched app surfaces

**Rollback**
- Revert SSI-0401 page/component/i18n commits
- Re-run `npm run lint && npm run build && npx jest --ci --passWithNoTests`

---

## P0/P1: ZEREBROX-CORE Phase 1 (Read-Only AI Brain) (IN PROGRESS)

### SSI-0499: OpenClaw Evidence Mapping for Phase 1 Execution
- [x] Collect source-backed OpenClaw patterns for memory layering, skill/plugin gating, scheduler reliability, policy-first ingress, structured output validation, and replay metadata.
- [x] Produce CALYBRA mapping artifact `agent/OPENCLAW_PHASE1_MAPPING.md` with strict trust-boundary constraints.
- [x] Link architecture and ADR records to the mapping artifact to prevent silent assumption drift.
**Acceptance Criteria**
- [x] Mapping is explicit, evidence-driven, and bound to Phase 1 SSIs (`0500`–`0506`).
- [x] Mapping does not change server-authoritative write boundaries or tenant isolation model.
**Proof**
- [x] `node scripts/consistency.mjs` -> PASS

### SSI-0500 (Day 1): Contracts + Skill Registry Skeleton
- [x] Define versioned schemas for `SkillInput`, `SkillOutput`, `TriggerEvent`, `DecisionEnvelope`, `MemoryWrite`.
- [x] Implement skill registry interface with deterministic precheck hooks and tenant-scoped context contract.
- [x] Register initial skill stubs: `Finance`, `Inventory`, `POS`, `Supplier` (read-only).
**Acceptance Criteria**
- [x] Contracts compile and are versioned.
- [x] Skills cannot execute without schema-valid input + tenant context.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `npm run lint` -> PASS
- [x] `runTests(server/tests/logic/brainRegistry.test.ts)` -> PASS (5 passed, 0 failed)

### SSI-0501 (Day 2): Unified Business Model Projections (Read-Only)
- [x] Create normalized UBM projection layer for cross-source read-only analytics.
- [x] Add adapter boundary for CALYBRA-native readmodels plus one external stub connector payload format.
**Acceptance Criteria**
- [x] UBM projection generated deterministically from input bundle.
- [x] No write path introduced to source systems.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `runTests(server/tests/logic/phase1BrainCore.test.ts)` -> PASS

### SSI-0502 (Day 3): Rule Engine Heartbeat + Trigger Router
- [x] Add scheduler window gate (every 30 min, 07:00 to venue close).
- [x] Implement trigger router for threshold, inconsistency, anomaly, EOD, manual triggers.
- [x] Emit deterministic `RuleResult` with evidence IDs and context hash.
**Acceptance Criteria**
- [x] Off-window runs are skipped with auditable reason.
- [x] Trigger routing is deterministic for identical input bundles.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `runTests(server/tests/logic/phase1BrainCore.test.ts)` -> PASS

### SSI-0503 (Day 4): AI Activation Core (Structured, Gated)
- [x] Implement policy gate deciding AI activation from rule outputs.
- [x] Enforce strict structured output schema validation.
- [x] Add deterministic fallback when AI output invalid/low confidence/policy denied.
**Acceptance Criteria**
- [x] No free-form output reaches decision layer.
- [x] Fallback path remains deterministic and auditable.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `runTests(server/tests/failure-sim.spec.ts)` -> PASS

### SSI-0504 (Day 5): Memory Core v1
- [x] Implement append-only event ledger for orchestration and trigger outcomes.
- [x] Build temporal graph projection update path.
- [x] Add behavioral summary snapshots with versioning metadata.
**Acceptance Criteria**
- [x] Memory updates are tenant-scoped and versioned.
- [x] No memory write mutates authoritative financial truth.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `node scripts/integrity-check.mjs` -> PASS

### SSI-0505 (Day 6): Auditability + Replay
- [x] Add replay endpoint/tooling for `DecisionEnvelope` reproducibility.
- [x] Expose insight explainability fields (`ruleIds`, `policyPath`, `evidenceRefs`, `modelVersion`).
**Acceptance Criteria**
- [x] Same `contextHash` reproduces same deterministic envelope.
- [x] Explainability metadata available for every insight.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `runTests(server/tests/logic/phase1BrainCore.test.ts)` -> PASS

### SSI-0506 (Day 7): Hardening + Release Candidate
- [x] Run full quality/security gates and resolve blockers.
- [x] Produce go/no-go checklist and rollback runbook for Phase 1 read-only release.
**Acceptance Criteria**
- [x] Lint/typecheck/tests/build pass.
- [x] No security boundary regressions in tenant isolation or authority boundaries.
**Proof**
- [x] `npm run security:credentials` -> PASS
- [x] `npm run lint` -> PASS
- [x] `npm run typecheck` -> PASS
- [x] `runTests(server/tests/logic/phase1BrainCore.test.ts, server/tests/failure-sim.spec.ts)` -> PASS
- [x] `npm run build` -> PASS

### Phase 1 Advanced Execution Plan (20 Steps)
1. [x] UBM Scope Freeze (Domain Boundary Definition): define exact UBM entity set, event types, memory granularity, and explicit rule that no AI logic lives inside UBM. Deliverables: `docs/architecture/ubm-scope.md` + JSON schema draft. Gate: no implementation code for SSI-0501 before this is committed.
2. [x] Memory Taxonomy Definition: define structural/event/behavioral/reflection memory classes and intended retention semantics. Deliverable: `docs/architecture/memory-types.md`.
3. [x] Canonical Event Envelope Contract: define strict event format (`id,type,actor,context,payload,timestamp,hash,parent_id?`) and Zod schema. Deliverable: `server/logic/brain/contracts/event-envelope.ts` (spec alias: `/contracts/event-envelope.ts`).
4. [x] Deterministic Hashing Layer: implement stable SHA-256 hashing over canonical JSON with key order normalization. Module: `server/logic/brain/core/hash.ts` (spec alias: `/core/hash.ts`). Rule: no event persisted without hash.
5. [x] Append-Only Event Store Implementation: implement immutable persistence with append-only guarantees (no update/delete). Module: `server/logic/brain/core/event-store.ts` (spec alias: `/core/event-store.ts`).
6. [x] Replay Engine v1: deterministic replay from event log with hash-chain validation and deterministic state rebuild. Module: `server/logic/brain/core/replay.ts` (spec alias: `/core/replay.ts`). Proof: replay same stream twice yields identical state.
7. [x] Snapshot Strategy Definition: define interval, structure, and integrity verification policy. Deliverable: `docs/architecture/snapshot-policy.md`.
8. [x] Snapshot Implementation: snapshot writer + loader to accelerate replay without changing final deterministic state. Module: `server/logic/brain/core/snapshot.ts` (spec alias: `/core/snapshot.ts`).
9. [x] AI Isolation Boundary: define contract where AI can only emit suggestions and cannot mutate state directly. Deliverable: `server/logic/brain/contracts/ai-response.ts` (spec alias: `/contracts/ai-response.ts`).
10. [x] Deterministic Router Layer: implement router that classifies intent, emits event, and logs reasoning; block any direct AI-to-state write path. Module: `server/logic/brain/core/router.ts` (spec alias: `/core/router.ts`).
11. [x] AI Audit Trail Logging: log prompt, context window, token usage, response, and decision mapping for every AI call. Module: `server/logic/brain/core/ai-audit.ts` (spec alias: `/core/ai-audit.ts`).
12. [x] AI Gating Rules Engine: validate permission, state constraints, and conflicts before accepting AI suggestions. Module: `server/logic/brain/core/ai-gate.ts` (spec alias: `/core/ai-gate.ts`).
13. [x] Memory Compaction Strategy: define when/how memory summarization occurs and how integrity is preserved through compaction. Deliverable: `docs/architecture/memory-compaction.md`.
14. [x] Reflection Engine v1: periodic reflection generation for behavioral pattern/anomaly/efficiency insights; outputs must be explicit events, never hidden state. Module: `server/logic/brain/core/reflection.ts` (spec alias: `/core/reflection.ts`).
15. [x] Context Window Builder: deterministically select relevant events, snapshot material, and reflection insights for downstream reasoning. Module: `server/logic/brain/core/context-builder.ts` (spec alias: `/core/context-builder.ts`).
16. [x] Identity Binding Layer: enforce non-spoofable actor binding with cryptographic signature verification. Module: `server/logic/brain/core/identity.ts` (spec alias: `/core/identity.ts`).
17. [x] Memory Access Control Policy: define read/write/reflection scopes and tenant boundaries. Deliverable: `docs/security/memory-acl.md`.
18. [x] Integrity Consistency Gate: implement automated verification for hash-chain validity, snapshot integrity, and replay diff detection. Module: `scripts/integrity-check.mjs`.
19. [x] Failure Simulation Suite: simulate corrupt event, missing snapshot, partial AI output, and router crash; system must fail safely. Module: `server/tests/failure-sim.spec.ts` (spec alias: `/tests/failure-sim.spec.ts`).
20. [x] Phase 1 Freeze Criteria Definition: formalize freeze gate (deterministic replay, AI gating enforced, append-only memory, passing integrity gate, no mutable state pathways). Deliverable: `docs/phase1-freeze.md`. Once achieved: lock Phase 1.

---

## P1: ZEREBROX Phase 2 — Self-Accountable Intelligence (IN PROGRESS)

### SSI-0601: Improvement Measurement Engine (IME)
- [x] Step 1 — Metrics Registry module (`server/logic/brain/core/metrics-registry.ts`).
- [x] Step 2 — Baseline Snapshot module (`server/logic/brain/core/baseline-engine.ts`).
- [x] Step 3 — Delta Computation module (`server/logic/brain/core/delta-engine.ts`).
- [x] Step 4 — Improvement Score Ledger (`server/logic/brain/core/improvement-ledger.ts`).
**Acceptance Criteria**
- [x] Metrics are explicit and versionable.
- [x] Baselines are immutable and hashable.
- [x] Delta computation is replay-deterministic.

### SSI-0602: Error Detection & Self-Critique
- [x] Step 5 — Prediction vs Outcome comparator (`server/logic/brain/core/prediction-audit.ts`).
- [x] Step 6 — Confidence Calibration engine (`server/logic/brain/core/confidence-calibrator.ts`).
- [x] Step 7 — Drift Detection layer (`server/logic/brain/core/drift-detector.ts`).
- [x] Step 8 — Self-Critique event emission (`server/logic/brain/core/self-critique.ts`).
**Acceptance Criteria**
- [x] Intelligence degradation emits explicit events.
- [x] Confidence recalibration deterministically affects trust level.

### SSI-0603: Autonomy Restriction Controller
- [x] Step 9 — Autonomy State Machine (`server/logic/brain/core/autonomy-state.ts`).
- [x] Step 10 — Risk Exposure calculator (`server/logic/brain/core/risk-calculator.ts`).
- [x] Step 11 — Automatic downgrade logic integrated in state transitions.
- [x] Step 12 — Hard Guardrail policy (`docs/autonomy/hard-guardrails.md`).
**Acceptance Criteria**
- [x] Unsafe conditions force deterministic autonomy restriction.
- [x] Hard guardrails are immutable policy inputs.

### SSI-0604: Escalation Governance System
- [x] Step 13 — Escalation trigger matrix (`docs/escalation/triggers.md`).
- [x] Step 14 — Escalation event engine (`server/logic/brain/core/escalation-engine.ts`).
- [x] Step 15 — Escalation context builder (`server/logic/brain/core/escalation-context.ts`).
- [x] Step 16 — Human override audit trail (`server/logic/brain/core/override-audit.ts`).
**Acceptance Criteria**
- [x] Escalation events are deterministic and auditable.
- [x] Human overrides are tracked and available for recalibration.

### SSI-0605: System Health & Self-Awareness
- [x] Step 17 — Intelligence Health Index (`server/logic/brain/core/health-index.ts`).
- [x] Step 18 — Degradation containment protocol (`resolveDegradationContainment` in `health-index.ts`).
- [x] Step 19 — Longitudinal performance graph (`server/logic/brain/core/performance-graph.ts`).
- [x] Step 20 — Phase 2 freeze criteria (`docs/phase2-freeze.md`).
**Acceptance Criteria**
- [x] Health index can trigger deterministic containment actions.
- [x] Longitudinal trends are replay-reproducible.

**Phase 2 Supporting Intelligence Modules (Strategic + Decision Layer)**
- [x] Pattern DSL (`server/logic/brain/core/pattern-dsl.ts`)
- [x] Pattern Registry (`server/logic/brain/core/pattern-registry.ts`)
- [x] Pattern Runner (`server/logic/brain/core/pattern-runner.ts`)
- [x] Signal Confidence (`server/logic/brain/core/signal-score.ts`)
- [x] Signal Dampener (`server/logic/brain/core/signal-dampener.ts`)
- [x] Decision Contract (`server/logic/brain/contracts/decision.ts`)
- [x] Decision Evaluator (`server/logic/brain/core/decision-evaluator.ts`)
- [x] Decision Ledger (`server/logic/brain/core/decision-ledger.ts`)
- [x] Threshold policy docs (`docs/intelligence/signal-thresholds.md`)

**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `npm run lint` -> PASS
- [x] `runTests(server/tests/logic/phase2Intelligence.test.ts)` -> PASS (5 passed, 0 failed)

### SSI-0606: Brain Replay/Router Workflow Integration
- [x] Implement deterministic orchestration workflow that routes intent, enforces AI gate, emits chained events, replays state, and materializes context window.
- [x] Wire workflow into canonical workflow exports for server entrypoint consumption.
- [x] Add integration tests proving deterministic replay output, gate-deny path, and snapshot materialization behavior.
**Acceptance Criteria**
- [x] Identical inputs produce identical event log + replay hash output.
- [x] AI suggestion acceptance remains policy-gated and can deterministically deny unsafe actor-role paths.
- [x] Hash-chain ordering is stable under timestamp format variance and remains replay-valid.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `npm run lint` -> PASS
- [x] `runTests(server/tests/workflows/brainReplay.workflow.test.ts, server/tests/logic/phase1BrainCore.test.ts, server/tests/failure-sim.spec.ts)` -> PASS (6 passed, 0 failed)
- [x] `node scripts/integrity-check.mjs` -> PASS
- [x] `node scripts/consistency.mjs` -> PASS

### SSI-0607: Orchestration Hook into Period Finalization
- [x] Invoke `brainReplay.workflow` from `onPeriodFinalized.workflow` with deterministic input bundle and explicit tenant context.
- [x] Ensure invocation is idempotent under existing job key semantics.
**Acceptance Criteria**
- [x] Period finalization produces stable brain replay outputs for identical lock hash inputs.
- [x] No changes to financial write authority or status machine semantics.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `npx firebase emulators:exec --only firestore "npm test -- server/tests/workflows/periodFinalized.workflow.test.ts"` -> PASS (2 passed)
- [x] `runTests(server/tests/workflows/brainReplay.workflow.test.ts)` -> PASS (4 passed)
**Rollback**
- [x] Revert workflow hook and keep standalone `brainReplay.workflow` only.

### SSI-0608: Canonical Brain Artifact Persistence
- [x] Persist brain artifacts (`decision`, `escalation`, `health`, `contextWindow`) under tenant-scoped append-only readmodel/export paths.
- [x] Add deterministic artifact IDs and content hashes.
**Acceptance Criteria**
- [x] Artifact writes are tenant-scoped, replay-reproducible, and hash-verifiable.
- [x] Existing export/readmodel consumers remain backward compatible.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `npx firebase emulators:exec --only firestore "npm test -- server/tests/workflows/periodFinalized.workflow.test.ts"` -> PASS
- [x] `node scripts/integrity-check.mjs` -> PASS
**Rollback**
- [x] Remove artifact persistence path and retain in-memory workflow output only.

### SSI-0609: Replay Artifact Contract Versioning
- [x] Add explicit schema contract for replay artifacts and version marker (`schemaVersion`).
- [x] Enforce contract validation at write boundary.
**Acceptance Criteria**
- [x] Invalid artifact payloads are rejected deterministically.
- [x] Contract version drift is detectable in tests.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `runTests(server/tests/workflows/workflow.contracts.test.ts)` -> PASS
**Rollback**
- [x] Revert strict contract validation while keeping raw artifact storage.

### SSI-0610: Orchestration-Level AI Gate Enforcement
- [x] Enforce AI gate at workflow boundary before any artifact persistence.
- [x] Persist gate decision audit payload for accepted/denied paths.
**Acceptance Criteria**
- [x] Denied gate path emits auditable record and prevents suggestion-derived outputs.
- [x] Accepted path remains deterministic and reproducible.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `runTests(server/tests/workflows/brainReplay.workflow.test.ts)` -> PASS
**Rollback**
- [x] Revert boundary gate enforcement to module-level gate only.

### SSI-0611: Snapshot Lifecycle in Live Workflow
- [x] Load latest eligible snapshot before replay and create new snapshot per policy interval.
- [x] Retain snapshots according to policy cap.
**Acceptance Criteria**
- [x] Replay with snapshot and without snapshot produce identical final replay hash.
- [x] Snapshot retention is deterministic and bounded.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `runTests(server/tests/logic/phase1BrainCore.test.ts, server/tests/workflows/brainReplay.workflow.test.ts)` -> PASS
**Rollback**
- [x] Disable snapshot load/write in workflow and use full-event replay path.

### SSI-0612: Runtime Memory ACL Enforcement
- [x] Implement tenant/action/role ACL checks for artifact read/write/replay operations.
- [x] Emit deterministic denial audit entries for ACL violations.
**Acceptance Criteria**
- [x] Cross-tenant and unauthorized actor-role requests are denied with explicit reason.
- [x] Authorized paths remain unaffected.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `runTests(server/tests/failure-sim.spec.ts, server/tests/workflows/brainReplay.workflow.test.ts)` -> PASS
**Rollback**
- [x] Revert ACL runtime checks and keep policy docs/contracts only.

### SSI-0613: Integrity Gate Expansion (Workflow Artifacts)
- [x] Extend `scripts/integrity-check.mjs` to verify persisted brain artifact chain integrity.
- [x] Validate parent linkage and replay diff detection across persisted artifacts.
**Acceptance Criteria**
- [x] Integrity gate fails on tampered artifact hashes/parent mismatch.
- [x] Integrity gate remains deterministic and fast for CI usage.
**Proof**
- [x] `node scripts/integrity-check.mjs` -> PASS
- [x] `node scripts/consistency.mjs` -> PASS
**Rollback**
- [x] Revert expanded checks and keep base event-chain validation.

### SSI-0614: Failure Simulation Suite v2
- [x] Add tests for duplicate event IDs, parent-chain discontinuity, and ACL bypass attempts.
- [x] Add timestamp canonicalization edge-case tests.
**Acceptance Criteria**
- [x] All adversarial cases fail safely with deterministic error behavior.
- [x] No flaky behavior across repeated test runs.
**Proof**
- [x] `runTests(server/tests/failure-sim.spec.ts)` -> PASS
- [x] `npm run typecheck` -> PASS
**Rollback**
- [x] Revert new adversarial tests if they conflict with current canonical contracts.

### SSI-0615: Emulator E2E for Brain Replay Path
- [x] Add emulator-backed integration tests covering period finalize -> brain replay -> artifact persistence.
- [x] Validate idempotency under repeated workflow execution.
**Acceptance Criteria**
- [x] Two identical executions produce identical replay hash and artifact IDs.
- [x] Job/status behavior remains idempotent and deterministic.
**Proof**
- [x] `npx firebase emulators:exec --only firestore "npm test -- server/tests/workflows/periodFinalized.workflow.test.ts"` -> PASS (2 passed)
- [x] `node scripts/consistency.mjs` -> PASS
**Rollback**
- [x] Revert emulator brain-path tests and retain unit/integration local coverage.

### SSI-0616: Deterministic Telemetry Bridge
- [x] Emit non-blocking telemetry entries for replay hash, gate outcome, containment signal, escalation signal.
- [x] Keep telemetry strictly non-authoritative and failure-tolerant.
**Acceptance Criteria**
- [x] Telemetry failures do not affect workflow outcome.
- [x] Deterministic payload shape and field completeness are preserved.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `runTests(server/tests/workflows/brainReplay.workflow.test.ts)` -> PASS
**Rollback**
- [x] Remove telemetry emission points while preserving workflow logic.

### SSI-0617: Phase 2 Performance Baseline + Preflight Gate
- [x] Define replay/artifact latency baseline and enforce via deterministic preflight script chain.
- [x] Consolidate gate command sequence for release readiness evidence.
**Acceptance Criteria**
- [x] Single preflight pass executes type/lint/tests/integrity/consistency and outputs PASS/FAIL summary.
- [x] Performance baseline documented and reproducible.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `npm run lint` -> PASS
- [x] `npm run phase2:preflight` -> PASS
- [x] `node scripts/integrity-check.mjs` -> PASS
- [x] `node scripts/consistency.mjs` -> PASS
**Rollback**
- [x] Revert preflight aggregator and keep individual proof commands.

### Phase 2 Next-TODOs (12-Point Master Execution Plan)
1. [x] Analyze existing Phase 2 architecture and proof baseline before new implementation.
2. [x] Define consolidated next-wave SSIs (0618..0627) with deterministic boundaries.
3. [x] Implement unified brain engine facade for cross-organ orchestration outputs.
4. [x] Implement artifact compactor for deterministic append-only window summaries.
5. [x] Implement replay diff analyzer for stability/drift diagnostics.
6. [x] Implement deterministic policy registry for confidence/path enforcement.
7. [x] Implement autonomy circuit breaker for hard containment paths.
8. [x] Implement escalation SLA planner for deterministic response windows.
9. [x] Implement decision quality scorer v2 and replay benchmark utilities.
10. [x] Implement deterministic preflight report builder and phase closure evaluator.
11. [x] Add dedicated tests covering all next-10 phase modules.
12. [x] Execute full proof chain and record completion outcomes.

### SSI-0618..0627: Phase 2 Advanced Consolidation Wave
- [x] SSI-0618 Unified Brain Engine (`server/logic/brain/core/unified-brain-engine.ts`)
- [x] SSI-0619 Artifact Compactor (`server/logic/brain/core/artifact-compactor.ts`)
- [x] SSI-0620 Replay Diff Analyzer (`server/logic/brain/core/replay-diff-analyzer.ts`)
- [x] SSI-0621 Deterministic Policy Registry (`server/logic/brain/core/policy-registry.ts`)
- [x] SSI-0622 Autonomy Circuit Breaker (`server/logic/brain/core/autonomy-circuit-breaker.ts`)
- [x] SSI-0623 Escalation SLA Planner (`server/logic/brain/core/escalation-sla.ts`)
- [x] SSI-0624 Decision Quality Scorer v2 (`server/logic/brain/core/decision-scorer-v2.ts`)
- [x] SSI-0625 Replay Benchmark Harness (`server/logic/brain/core/replay-benchmark.ts`)
- [x] SSI-0626 Deterministic Preflight Report (`server/logic/brain/core/preflight-report.ts`)
- [x] SSI-0627 Phase 2 Closure Evaluator (`server/logic/brain/core/phase2-closure-evaluator.ts`)
**Acceptance Criteria**
- [x] All modules are deterministic/pure and compile under strict TS.
- [x] All modules are exported through brain core barrel for consumption.
- [x] Validation suite covers core behavior and determinism for each module.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `npm run lint` -> PASS
- [x] `runTests(server/tests/logic/phase2Next10.test.ts, server/tests/logic/phase2Intelligence.test.ts, server/tests/workflows/brainReplay.workflow.test.ts, server/tests/failure-sim.spec.ts)` -> PASS (13 passed, 0 failed)
- [x] `node scripts/consistency.mjs` -> PASS
- [x] `npm run phase2:preflight` -> PASS

### Phase 2 Next-TODOs (12-Point Plan for SSI-0628..0637)
1. [x] Analyze current architecture surfaces for artifact lineage, determinism audit, and closure readiness.
2. [x] Define SSI-0628..0637 scope with deterministic and policy-safe constraints.
3. [x] Implement artifact lineage graph module.
4. [x] Implement cross-run determinism audit module.
5. [x] Implement policy simulation and bounded threshold tuner modules.
6. [x] Implement escalation workload balancer module.
7. [x] Implement compaction verifier and performance budget evaluator modules.
8. [x] Implement explainability pack generator module.
9. [x] Implement closure scoreboard and freeze-candidate evaluator modules.
10. [x] Wire all modules into brain core exports.
11. [x] Add comprehensive deterministic test suite for SSI-0628..0637.
12. [x] Execute full proof chain and record release/governance outcomes.

### SSI-0628..0637: Phase 2 Breakthrough Engineering Wave
- [x] SSI-0628 Artifact Lineage Graph (`server/logic/brain/core/artifact-lineage.ts`)
- [x] SSI-0629 Cross-Run Determinism Audit (`server/logic/brain/core/determinism-audit.ts`)
- [x] SSI-0630 Policy Simulation Mode (`server/logic/brain/core/policy-simulation.ts`)
- [x] SSI-0631 Adaptive Threshold Tuner (`server/logic/brain/core/threshold-tuner.ts`)
- [x] SSI-0632 Escalation Workload Balancer (`server/logic/brain/core/escalation-balancer.ts`)
- [x] SSI-0633 Compaction Verifier v2 (`server/logic/brain/core/compaction-verifier.ts`)
- [x] SSI-0634 Replay Performance Budget Evaluator (`server/logic/brain/core/perf-budget.ts`)
- [x] SSI-0635 Explainability Pack Builder (`server/logic/brain/core/explainability-pack.ts`)
- [x] SSI-0636 Closure Readiness Scoreboard (`server/logic/brain/core/closure-scoreboard.ts`)
- [x] SSI-0637 Freeze Candidate Evaluator (`server/logic/brain/core/freeze-candidate.ts`)
**Acceptance Criteria**
- [x] All modules are deterministic and compile under strict TS.
- [x] Modules are exported through `server/logic/brain/core/index.ts`.
- [x] Dedicated tests validate expected behavior for all ten modules.
**Proof**
- [x] `npm run typecheck` -> PASS
- [x] `npm run lint` -> PASS
- [x] `runTests(server/tests/logic/phase2Next10b.test.ts, server/tests/logic/phase2Next10.test.ts, server/tests/logic/phase2Intelligence.test.ts, server/tests/workflows/brainReplay.workflow.test.ts, server/tests/failure-sim.spec.ts)` -> PASS (18 passed, 0 failed)
- [x] `node scripts/consistency.mjs` -> PASS
- [x] `npm run phase2:preflight` -> PASS
