# agent/DECISIONS.md

## Purpose
This is the Architectural Decision Record (ADR) log for Calybra. Any meaningful change in:
- architecture model (paths)
- roles or RBAC policy
- status vocabulary / state machines
- client vs server authority
- CI enforcement
- dependencies/toolchain pinning
must be recorded here BEFORE implementation (or immediately if discovered mid-fix).

## Rules
- Decisions must be explicit and reversible.
- Every decision must state consequences.
- No “silent assumptions”.

## Exception: Release History Immutability
Historical release notes are immutable; any legacy “optional/next step” language is non-authoritative and does not imply roadmap or obligation.
This exception applies only to immutable historical entries in `agent/RELEASE.md`.

---

## ADR Index
- ADR-0001: Tenant Isolation is Non-Negotiable
- ADR-0002: Server-Authoritative User Provisioning
- ADR-0003: Truth Lock + Consistency Gates Required
- ADR-0004: Proof-First Releases (No “Proof Pending”)
- ADR-0005: Invariant Test Suite Enforced in CI
- ADR-0006: Smallest Shippable Increment (SSI) + Max Two Surfaces Rule
- ADR-0007: Truth Snapshot Committed Artifact
- ADR-0008: Server-Only Invoices/Matches + MonthCloseStatus IN_REVIEW + Tenant-Scoped FileAsset Downloads
- ADR-0009: Defense-in-Depth Status Transition Enforcement at Rules Level
- ADR-0010: Server Business Logic Layer (/server module)
- ADR-0011: Observability & Telemetry Layer (Read-Only, Non-Blocking)
- ADR-0012: Phase 3 - UX-Driven Orchestration Layer
- ADR-0013: Observability 2030 Enhancements (Async Context, OTEL Export, Streaming, Privacy, SLO)
- ADR-0014: Jobs + Exports + Auditor Replay Pathing
- ADR-0015: Server-Authoritative Ingestion Pipeline
- ADR-0016: Comprehensive Agent Self-Improvement System
- ADR-0017: UX Polish via Incremental, Data-Safe SSIs
- ADR-0018: Authenticated App Shell Layout Contract (Grid-Owned Spatial Authority)
- ADR-0019: Credential Lifecycle Hardening + Tracked-File Secret Scan
- ADR-0020: ZEREBROX-CORE Phase 1 (Read-Only AI Brain with Structured Memory)
- ADR-0021: OpenClaw Evidence Mapping as Reference Architecture Input (No Trust Boundary Changes)
- ADR-0022: Phase 1 Path Convention Mapping (/core and /contracts Aliases)
- ADR-0023: Phase 2 Self-Accountable Intelligence (Deterministic ROI + Self-Restriction)
- ADR-0024: Phase Ordering Enforcement + Phase 1 Freeze Execution
- ADR-0025: SSI-0606 Deterministic Brain Workflow Integration
- ADR-0026: SSI-0607..0617 Full Integration (Artifacts + ACL + Preflight)
- ADR-0027: SSI-0618..0627 Advanced Consolidation Layer
- ADR-0028: SSI-0628..0637 Breakthrough Engineering Layer

## ADR-0001: Tenant Isolation is Non-Negotiable
**Status:** Accepted  
**Decision:** All tenant-owned data must be isolated. A user can only access documents belonging to their tenant as defined by the canonical user profile (`users/{uid}.tenantId`).  
**Rationale:** Prevents data leakage across tenants (P0).  
**Consequences:** Rules complexity increases; tests must cover cross-tenant denial across all relevant collections.

---

## ADR-0002: Server-Authoritative User Provisioning
**Status:** Accepted  
**Decision:** `users/{uid}` and any tenant membership primitives are created server-side (Cloud Functions / Admin SDK). Clients must never create or mutate user identity documents.  
**Rationale:** Removes race conditions and ensures tenantId/role cannot be forged.  
**Consequences:** Onboarding requires server pipeline availability; tests must seed user docs as admin context.

---

## ADR-0003: Truth Lock + Consistency Gates Required
**Status:** Accepted  
**Decision:** The repo’s primary sources (rules/tests/firebase config) are the canonical truth. A Truth Snapshot is generated and a Consistency Gate fails CI if docs/contracts/seed/schemas drift.  
**Rationale:** Prevents agent-induced architecture drift and eliminates “consistent-with-itself but wrong” changes.  
**Consequences:** Slight overhead in CI; faster debugging and fewer regressions.

---

## ADR-0004: Proof-First Releases (No “Proof Pending”)
**Status:** Accepted  
**Decision:** `agent/RELEASE.md` is updated only after proofs are executed and PASS results are recorded. No release notes with “proof pending”.  
**Rationale:** Prevents false confidence and shipping broken builds.  
**Consequences:** Work-in-progress is tracked in TASKS only until proofs pass.

---

## ADR-0005: Invariant Test Suite Enforced in CI
**Status:** Accepted  
**Decision:** Add and enforce `tests/invariants/**` to prevent regressions in tenant isolation, forbidden client fields, and status transitions.  
**Rationale:** Rules tests alone do not catch all drift; invariants enforce global correctness.  
**Consequences:** Additional test time; requires seed/profile setup in emulator tests.

---

## ADR-0006: Smallest Shippable Increment (SSI) + Max Two Surfaces Rule
**Status:** Accepted  
**Decision:** Work is split into SSIs that touch at most two surfaces. Examples: Rules+Tests, UI+Domain, Scripts+CI. Anything larger must be split or explicitly justified.  
**Rationale:** Keeps diffs reviewable and reduces blast radius.  
**Consequences:** More PRs/commits, but far fewer regressions.

---

## ADR-0007: Truth Snapshot Committed Artifact
**Status:** Accepted  
**Decision:** `agent/TRUTH_SNAPSHOT.md` is generated by `node scripts/truth.mjs` and committed to the repo (not a CI-only artifact).  
**Rationale:** Ensures the snapshot is reviewable in PRs and eliminates CI-vs-local drift ambiguity.  
**Consequences:** Developers must regenerate the snapshot when rules/tests change. Consistency gate fails if stale.

---

## ADR Template
**ADR-XXXX: Title**  
Status: Proposed | Accepted | Rejected  
Decision:  
Rationale:  
Consequences:  
Proof requirements (tests/commands):  
Rollback approach:

---

## ADR-0008: Server-Only Invoices/Matches + MonthCloseStatus IN_REVIEW + Tenant-Scoped FileAsset Downloads
**Status:** Accepted  
**Decision:**
- Enforce server-only writes for `invoices` and `matches` in Firestore rules.
- Adopt `IN_REVIEW` as a valid `monthCloses.status` value across contracts and schemas.
- Require file asset downloads to read from `tenants/{tenantId}/fileAssets/{fileAssetId}` only.
**Rationale:**
- Aligns authority boundaries with security model and eliminates client-forgeable financial writes.
- Matches UI workflow state already in use.
- Fixes the download path drift and enforces tenant isolation for file assets.
**Consequences:**
- UI and docs must not assume client can write invoices/matches.
- Rules tests updated to deny client writes for invoices/matches.
- Functions must use tenant-scoped fileAsset path for download URLs.
**Proof requirements (tests/commands):**
- `npm run truth-lock`
- `npm run lint`
- `npm run typecheck`
- `firebase emulators:exec --only firestore "npm test"`
- `npm --prefix functions run build`
- `npm --prefix calybra-database run build`
**Rollback approach:**
- Revert ADR + rule changes + docs, redeploy rules/functions, rerun proofs.

---

## ADR-0009: Defense-in-Depth Status Transition Enforcement at Rules Level
**Status:** Accepted  
**Decision:**
- Firestore rules now enforce status transition validity for ALL writes, including server (admin) writes.
- Terminal states (FINALIZED for monthCloses, DELETED for fileAssets, CONFIRMED/REJECTED for matches) are immutable at the rules level.
- Server writes are now constrained: if changing status, the transition must be in the allowed transition table.
- Added helper functions: `statusChanging()`, `monthCloseIsTerminal()`, `fileAssetIsTerminal()`, `matchIsTerminal()`.
- Match creation now requires status=PROPOSED at rules level.
**Rationale:**
- Provides defense-in-depth: even if server code has a bug, rules prevent illegal state changes.
- Terminal state immutability prevents accidental corruption of finalized records.
- Transition tables in rules duplicate server-side logic intentionally for redundancy.
**Consequences:**
- Server code that attempts illegal transitions will be denied by rules.
- All status machines are now enforced at two layers: Cloud Functions + Firestore Rules.
- Tests added for server illegal transition denial in `tests/invariants/status-transitions.test.ts`.
**Proof requirements (tests/commands):**
- `npm run truth-lock`
- `npm run lint`
- `npm run typecheck`
- `firebase emulators:exec --only firestore "npm test"`
- `npm --prefix calybra-database run build`
**Rollback approach:**
- Revert firestore.rules to allow server writes without transition checks.
- Remove new test cases.
- Redeploy rules.
---

## ADR-0010: Server Business Logic Layer (/server module)
**Status:** Accepted  
**Decision:**
- Create `/server` module with strict layered architecture for all business logic.
- Layer structure: `/domain` (pure value objects) → `/logic` (pure functions) → `/state` (status machines) → `/persistence` (Firestore IO) → `/workflows` (orchestration)
- Enforce determinism: no Date.now(), no Math.random(), no locale-dependent behavior in /domain or /logic.
- Enforce IO isolation: Firestore access ONLY in /persistence, called ONLY from /workflows.
- Use integer arithmetic (cents) for all monetary calculations with banker's rounding.
- Status machines are canonical in /state/statusMachine.ts - all transitions validated before persistence.
- Workflows are idempotent and recomputable.
**Rationale:**
- Enables testable, deterministic business logic independent of Firestore.
- "Delete and rebuild" invariant: recomputing with same inputs produces identical results.
- Separation of concerns:
  - Domain: What is money, what is a date, what is a match
  - Logic: How to parse, score, reconcile (no IO)
  - State: What transitions are valid
  - Persistence: How to read/write Firestore
  - Workflows: Orchestrate the above with idempotency
**Consequences:**
- All business logic changes go through /server module.
- Cloud Functions become thin wrappers calling workflows.
- Tests can validate purity (no side effects), determinism (same input → same output), and recomputability.
- No auth, RBAC, or tenant checks in business logic layer (handled at rules/functions layer).
**Proof requirements:**
- `npx tsc --project server/tsconfig.json --noEmit`
- Unit tests in /server/tests validate determinism and idempotency
- Integration tests (with emulator) validate workflow orchestration
**Rollback approach:**
- `rm -rf server/`
- No deployed surfaces affected.

---

## ADR-0011: Observability & Telemetry Layer (Read-Only, Non-Blocking)
**Status:** Accepted  
**Decision:**
- Create `/observability` module with isolated observability code that is purely read-only and non-blocking.
- Layer structure: `/context` (TraceContext, WorkflowContext) → `/logging` (structured logger) → `/metrics` (timing, counters) → `/tracing` (span observation) → `/transitions` (status transition observation)
- All observability is a shadow: it watches reality but never alters it.
- Core invariants:
  - INVARIANT: If all observability code were removed, system behavior is IDENTICAL
  - INVARIANT: Telemetry failures do NOT break workflows
  - INVARIANT: No conditional logic in business code based on telemetry success/failure
  - INVARIANT: No writes that influence business state
  - INVARIANT: No retries of core logic based on telemetry
- TraceContext: Immutable once created, generated at system entry, propagated through all layers.
- WorkflowExecutionContext: Spans multiple requests, metadata-only (not persisted as authoritative state).
- Structured logging: All logs are structured objects with mandatory fields (level, timestamp, traceId, workflowExecutionId, tenantId, actor, component, operation, result, durationMs).
- Status transition observation: Records fromStatus, toStatus, actor, timestamp, traceId AFTER transitions occur (never validates or blocks).
- Error telemetry: Captures errors AFTER they occur, preserves original error, never throws telemetry errors upward.
- Timing metrics: Wall-clock only, no timeouts or retries introduced.
**Rationale:**
- Enables post-mortem debugging and operational visibility without affecting system behavior.
- UX team can rely on telemetry for Phase 3 progress indicators.
- Security model untouched, status machines untouched, workflows untouched.
**Consequences:**
- Non-interference tests must prove observability removal doesn't change behavior.
- All integration points use try/catch with silent observation failure handling.
- Dashboards are read-only (no mutation buttons).
**Proof requirements:**
- `npx tsc --project observability/tsconfig.json --noEmit`
- `npx jest observability/tests --no-coverage`
- Non-interference test: business logic tests pass with observability mocked/disabled
- No changes to firestore.rules, storage.rules, status machines, or workflow logic
**Rollback approach:**
- `rm -rf observability/`
- Remove integration points from server/workflows (they handle missing observability gracefully).
- No deployed surfaces affected (observability is metadata-only).

---

## ADR-0012: Phase 3 - UX-Driven Orchestration Layer
**Status:** Accepted  
**Decision:**
- Create `/src/client` module with orchestration layer for mapping user intents to server workflows.
- Layer structure:
  - `/orchestration` (intents, guards, action executor)
  - `/events` (progress tracking, errors, explanations)
  - `/state` (selectors, projections)
  - `/workflows` (action handlers calling Cloud Functions)
  - `/ui/flows` (React flow components with render props)
- Core invariants:
  - INVARIANT: Every UX action MUST route through intent → guard → workflow (no bypassing)
  - INVARIANT: Each intent triggers exactly ONE workflow
  - INVARIANT: Invalid intents are blocked BEFORE network calls
  - INVARIANT: Progress events are emitted at each workflow step
  - INVARIANT: Failures surface with structured errors and recovery guidance
- Intents: Explicit, typed, immutable (Object.freeze), auditable (timestamp, tenantId).
- Guards: Synchronous permission and state validation before action execution.
- ActionExecutor: Maps intents to Cloud Function calls with structured results.
- UX Flows: Render props pattern + hooks for observable, explainable, interruptible operations.
**Rationale:**
- System state becomes observable, explainable, and interruptible.
**Consequences:**
- UX actions map 1:1 to server workflows - no ambiguity.
- Fail-fast guards prevent wasted network calls.
- Structured errors enable recovery guidance in UI.
- Separation of concerns: UI renders, flows orchestrate, guards validate, workflows execute.
**Proof requirements:**
- Intent types enforce immutability via Object.freeze
- Guard tests prove invalid operations are blocked
- Flow components expose controlled interface (render props)
- Orchestration tests in `/src/client/__tests__/orchestration.test.ts`
**Rollback approach:**
- `rm -rf src/client/`
- Remove PHASE_3_COMPLETION.md
- No deployed surfaces affected (client-only code).

---

## ADR-0021: OpenClaw Evidence Mapping as Reference Architecture Input (No Trust Boundary Changes)
**Status:** Accepted
**Decision:**
- Adopt OpenClaw implementation patterns as evidence input for ZEREBROX Phase 1 architecture decomposition.
- Record the canonical mapping in `agent/OPENCLAW_PHASE1_MAPPING.md`.
- Keep CALYBRA trust boundaries unchanged:
  - no autonomous writes to authoritative financial data,
  - no tenant boundary relaxation,
  - no server-authoritative field ownership changes.

**Rationale:**
- OpenClaw provides mature, production-tested patterns for skill gating, memory layering, scheduler reliability, and schema-validated outputs.
- Mapping these patterns reduces architecture guesswork while preserving CALYBRA-specific invariants.

**Consequences:**
- Phase 1 SSIs must explicitly map to evidence-backed patterns (registry gate, trigger router, structured fallback, replay metadata).
- Any future proposal to import additional OpenClaw behavior that affects security/authority requires a new ADR before implementation.
- Mapping document becomes a required input artifact for Phase 1 execution reviews.

**Proof requirements (tests/commands):**
- `node scripts/consistency.mjs`

**Rollback approach:**
- Revert ADR-0021 and remove mapping references from architecture/task artifacts if Phase 1 direction is re-baselined.

---

## ADR-0017: UX Polish via Incremental, Data-Safe SSIs
**Status:** Accepted  
**Decision:** Broad UX improvement requests are executed as incremental UI-only SSIs that do not alter business logic, schema, security rules, or tenant boundaries. This increment targets app-shell usability and dashboard readability/accessibility only.  
**Rationale:** A full-app redesign in one pass creates high regression risk and weak proof quality. Incremental UX SSIs keep changes reviewable and shippable while preserving multi-tenant and server-authoritative guarantees.  
**Consequences:**
- UX improvements are delivered in focused waves, each with explicit acceptance criteria and proof commands.
- No Firestore/Storage rules, status machines, or workflow authority changes are allowed under UX SSIs.
- Additional UX surfaces are queued as follow-up SSIs instead of bundled into one risky diff.
**Proof requirements (tests/commands):**
- `npx eslint src/app/[locale]/(app)/dashboard/page.tsx src/components/dashboard/bank-vs-invoices-card.tsx src/components/dashboard/pending-items-card.tsx src/components/dashboard/suppliers-card.tsx src/app/[locale]/(app)/layout.tsx`
**Rollback approach:**
- Revert the UI commit and re-run the same lint proof command.

---

## ADR-0013: Counterfactual Month Close + EU Read Models (Event-Sourced)
**Status:** Accepted  
**Decision:**
- Introduce authoritative event collection under tenant scope: `tenants/{tenantId}/events/{eventId}`.
- Introduce period control documents under tenant scope: `tenants/{tenantId}/periods/{monthKey}` with `status`, `finalizedAt`, `closeConfig`, and `periodLockHash`.
- Derive counterfactual close timeline, close friction metrics, VAT summary, mismatch summary, and auditor replay as read models only.
- Use tenant timezone as canonical for period boundaries, cutoff calculations, and monthKey derivation.
- Define data arrival as `recordedAt` (ingestion time) and counterfactual cutoffs by `occurredAt`.
- Compute narrative outputs only as:
  - "Final accuracy was reached on Day X."
  - "Y% of variance resolved in the last Z days."
**Rationale:**
- Enables deterministic, rebuildable audit views without mutating authoritative records.
- Aligns with server-authoritative boundaries and multi-tenant isolation.
- Provides EU-required VAT and mismatch clarity while keeping workflows read-only.
**Consequences:**
- New schema requires rules updates and emulator/invariant tests.
- Period lock hash becomes part of idempotency key for finalize workflows.
- Read models are non-authoritative and must be rebuildable from events.
**Proof requirements (tests/commands):**
- `npm run typecheck`
- `npm test -- server/tests/logic/*counterfactual*`
- `npm test -- server/tests/readmodels/*`
- `npm test -- server/tests/workflows/*periodFinalized*`
- `firebase emulators:exec --only firestore "npm test"`
**Rollback approach:**
- Remove new readmodels and exports write paths.
- Revert rules and delete `events`/`periods` documents.
- Re-run truth lock and emulator tests.

---

## ADR-0014: Jobs + Exports + Auditor Replay Pathing
**Status:** Accepted  
**Decision:**
- Idempotency job records remain in top-level `jobs/{jobId}` per `firestore.rules` and truth snapshot.
- Exports are stored under `tenants/{tenantId}/exports/{monthKey}/artifacts/{artifactId}` where `artifactId` is `ledgerCsv` or `summaryPdf`.
- Auditor replay snapshots are stored under `tenants/{tenantId}/readmodels/auditorReplay/{monthKey}/{asOfDateKey}` (collection per monthKey).
**Rationale:**
- Matches repo truth: `jobs` is already top-level and server-only.
- Firestore requires even path segments for documents; `artifacts` subcollection avoids ambiguity.
- Auditor replay path aligns with requested shape while remaining valid Firestore structure.
**Consequences:**
- Rules and contracts must reflect these paths.
- Readmodel rebuilders must target the exact collections above.
**Proof requirements (tests/commands):**
- `node scripts/truth.mjs`
- `node scripts/consistency.mjs`
- `firebase emulators:exec --only firestore "npm test"`
**Rollback approach:**
- Revert path changes in rules/contracts and remove new docs.

---

## ADR-0013: Observability 2030 Enhancements (Async Context, OTEL Export, Streaming, Privacy, SLO)
**Status:** Accepted  
**Decision:**
- Extend `/observability` with:
  - `context/asyncContext.ts` using AsyncLocalStorage for automatic context propagation.
  - `export/otel.ts` providing OTEL-compatible span/log export formats and OTLP HTTP export.
  - `streaming/progress.ts` for real-time progress events (non-blocking pub/sub).
  - `privacy/scrubber.ts` for PII scrubbing of telemetry payloads.
  - `slo/tracker.ts` for performance budget tracking (no behavior changes).
- Keep all telemetry paths read-only and non-blocking; no workflow or rules changes.
- No new vendors; OTEL support is export format only.
**Rationale:**
- Automatic context propagation and streaming enable best-in-class UX diagnostics.
- OTEL compatibility enables vendor integration without lock-in.
- Privacy scrubbing and SLO tracking improve operational safety and accountability.
**Consequences:**
- New observability modules must remain safe if unused.
- Tests are required for async context propagation, OTEL export formatting, streaming isolation, scrubbing rules, and SLO violations.
**Proof requirements (tests/commands):**
- `npx tsc --project observability/tsconfig.json --noEmit`
- `npx jest observability/tests --no-coverage` (include new tests)
**Rollback approach:**
- Remove new modules and root exports under `/observability`.
- No deployed surfaces affected.

---

## ADR-0015: Server-Authoritative Ingestion Pipeline
**Status:** Accepted  
**Decision:**
- Jobs collection is server-only (write protected from clients by firestore.rules).
- New `createJob` callable in `calybra-database/src/ingestion.ts` is the ONLY way to create jobs.
- New `processJob` Firestore trigger runs the full deterministic pipeline on job creation.
- Upload page calls `createJob` callable instead of direct job writes.
- Pipeline stages: PENDING → PROCESSING → PARSED → MATCHED → COMPLETED (or FAILED).
- Idempotent processing via SHA256 fingerprints prevents duplicate records.
- MonthClose summary recomputed from raw counts (no stale increments).
**Rationale:**
- Jobs were previously fake/simulated (not deployed) - breaking the contract.
- Client writes to jobs were blocked by rules but UI tried anyway - silent failures.
- Server authority ensures deterministic, auditable processing with proper error handling.
**Consequences:**
- Upload page must use callable (implemented).
- Real file processing requires proper storage bucket configuration.
- Matching engine is deterministic but may need tuning for edge cases.
**Proof requirements (tests/commands):**
- `cd calybra-database ; npm run build` (TypeScript compiles)
- `firebase emulators:exec --only firestore,functions "npm test"` (e2e with triggers)
**Rollback approach:**
- `git revert <sha>` to remove ingestion.ts changes.
- `firebase deploy --only functions` to redeploy without ingestion.
- Upload page would need revert as well (jobs would fail silently until fixed).

---

## ADR-0016: Comprehensive Agent Self-Improvement System
**Status:** Accepted  
**Decision:**
Implement a comprehensive self-improvement system for agents comprising 11 interconnected components:

1. **SELF_IMPROVEMENT.md** - Master architecture (OMAR cycle: Observe, Measure, Analyze, Adapt)
2. **SELF_EVAL.md** - Post-task reflection with 5-dimension scoring
3. **METRICS.md** - Quantitative performance tracking (tasks, tools, accuracy)
4. **FEEDBACK_LOG.md** - Structured user correction capture and analysis
5. **PATTERNS.md** - Reusable solution catalog indexed by problem type
6. **ESTIMATION.md** - Complexity prediction calibration (predicted vs actual)
7. **TOOL_PRIORS.md** - Tool selection optimization through learned success rates
8. **DEPENDENCY_MAP.md** - System impact relationships for blast radius prediction
9. **CONFIDENCE_LOG.md** - Certainty calibration (Brier score tracking)
10. **SKILLS.md** - Capability certification with evidence-based leveling (0-5)
11. **FAILURE_MODES.md** - Failure class taxonomy (regressions are instances; modes are patterns)

Integration points:
- AGENT_ROUTING.md updated with 9-step pre-work and 11-step post-work protocols
- MEMORY.md updated with cross-references to self-improvement components
- Each component has explicit integration with related components

**Rationale:**
- Prevents duplicate debugging cycles
- Enables data-driven tool selection
- Calibrates confidence and estimation accuracy
- Compounds knowledge across sessions
- Certifies capabilities with evidence

**Consequences:**
- Agents have more documentation to consult (offset by improved efficiency)
- More artifacts to maintain (offset by structured formats)
- Quantitative tracking enables trend analysis

**Proof requirements:**
- `node scripts/truth.mjs` PASS
- `node scripts/consistency.mjs` PASS
- All new files syntactically valid markdown

**Rollback approach:**
- Delete new agent/*.md files
- Revert AGENT_ROUTING.md, MEMORY.md, DECISIONS.md changes
- No runtime impact (documentation-only change)

---

## ADR-0017: Enterprise Frontend Rebuild Delivered as SSI Program
**Status:** Accepted  
**Decision:**
- Deliver the premium frontend rebuild as a sequenced SSI program instead of a single monolithic change.
- SSI scope for UI work is constrained to at most two implementation surfaces per increment (for example: shell+tokens, or one page+its shared components), plus required documentation updates.
- Preserve backend behavior and authority boundaries; no Firestore rules, status machine, schema, or callable behavior changes are allowed under this rebuild program unless a separate ADR is approved.
- Enforce mandatory gates per SSI: typecheck, lint, build, i18n scan (literal JSX text), hardcoded color scan (`#fff` / `#000`), and accessibility smoke checks.
- Release notes are written only after PASS proofs and include rollback for each shipped SSI.
**Rationale:**
- The requested scope spans global system design and eight application pages, which is high blast-radius if shipped in one diff.
- SSI sequencing preserves shipping velocity while reducing regression risk and rework.
- Frontend quality requirements (dark/light parity, i18n completeness, accessibility, consistency) require repeatable validation at each increment.
**Consequences:**
- Multiple sequential SSIs will be used to complete the full rebuild.
- Each SSI must include acceptance criteria, proof plan, and rollback plan in `agent/TASKS.md`.
- Any behavior-impacting assumption (UX flow, locale persistence semantics, theme defaults) must be recorded before implementation.
**Proof requirements:**
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx jest --ci --passWithNoTests`
- `npx tsc --noEmit`
- `grep` scans proving no forbidden hardcoded colors in `src/**` where applicable
**Rollback approach:**
- Revert the SSI commit(s) impacting frontend surfaces.
- Re-run validation gates to ensure stable fallback behavior.
- If deployed, roll forward with revert release entry documenting scope and proofs.

---

## ADR-0018: Authenticated App Shell Layout Contract (Grid-Owned Spatial Authority)
**Status:** Accepted  
**Decision:**
- Centralize authenticated-route spatial ownership in `src/app/[locale]/(app)/layout.tsx` using a two-column grid (`sidebar + content`).
- Remove sidebar fixed-position shell behavior from authenticated app navigation; sidebar must render as an in-flow grid child.
- Make app content width and padding layout-owned (`main` with centered max-width container) rather than page-owned sidebar compensation.
- Define sidebar widths in one constant surface (`src/components/layout/layout-constants.ts`) and consume as CSS variables in shell.
- Prohibit page-level sidebar offset hacks (`ml-*`, `pl-*`, `calc(100%-...)`) for authenticated routes.
**Rationale:**
- Previous shell behavior mixed component-level positioning and page-level spacing workarounds, creating route-specific overlap risk.
- Grid-owned spatial contracts eliminate overlap classes of bugs and keep UX predictable as features/pages scale.
- Single-source sidebar width definitions reduce drift and future regressions.
**Consequences:**
- Authenticated app layout changes must be made at shell level, not in individual pages.
- Existing and future app pages must not encode sidebar width assumptions.
- Sidebar primitives that rely on fixed positioning are disallowed for app-shell ownership.
**Proof requirements:**
- `npx eslint "src/app/[[]locale]/(app)/layout.tsx" "src/components/layout/app-sidebar.tsx" "src/components/layout/layout-constants.ts"`
- `npm run typecheck` (record explicit exception if failing due unrelated pre-existing errors)
- Verify changed files have zero diagnostics via editor/tooling checks.
**Rollback approach:**
- Revert `src/app/[locale]/(app)/layout.tsx`, `src/components/layout/app-sidebar.tsx`, and `src/components/layout/layout-constants.ts`.
- Remove layout contract doc if full rollback is required.
- Re-run lint/typecheck proofs.

---

## ADR-0019: Credential Lifecycle Hardening + Tracked-File Secret Scan
**Status:** Accepted  
**Decision:**
- Enforce a tracked-file credential signature gate via `npm run security:credentials`.
- Remove hardcoded credential-like values from tracked config/examples and require placeholders or Secret Manager bindings.
- Treat key-restriction and rotation as mandatory operational controls in `agent/RUNBOOK.md`.
**Rationale:**
- External security warning indicates elevated risk from long-lived or unrestricted credentials.
- Preventing new repository exposures and standardizing incident response reduces blast radius immediately.
**Consequences:**
- CI/local proof loops should include `npm run security:credentials` for security-sensitive SSIs.
- Deployers must provision required Secret Manager secrets before App Hosting deploys.
- Operational teams must execute key restriction/rotation tasks out-of-band in GCP.
**Proof requirements:**
- `npm run security:credentials`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
**Rollback approach:**
- Revert changes to `apphosting.yaml`, `.env.local.example`, and script/docs touched by this SSI.
- Re-run build and security gate commands.

---

## ADR-0020: ZEREBROX-CORE Phase 1 (Read-Only AI Brain with Structured Memory)
**Status:** Accepted  
**Decision:**
- Adopt an OpenClaw-inspired modular agent architecture for business operations, but keep Phase 1 strictly read-only.
- Implement a skill registry with deterministic guardrails (`Finance`, `Inventory`, `POS`, `Supplier`) as bounded analyzers, not autonomous executors.
- Build Memory Core v1 as structured persistent memory:
  - event ledger (source of truth),
  - temporal graph projection,
  - behavioral summaries/versioned snapshots.
- AI is trigger-gated and schema-bound:
  - activated only by timer window + trigger policy,
  - output must pass strict structured schema validation,
  - deterministic fallback when confidence/policy checks fail.
- Preserve CALYBRA non-negotiables:
  - tenant isolation,
  - server-authoritative boundaries,
  - full auditability and replayability.
**Rationale:**
- Delivers the “digital business brain” direction while avoiding uncontrolled execution risk.
- Reuses proven agent modularity concepts but aligns to enterprise governance and deterministic finance requirements.
**Consequences:**
- Phase 1 ships insights only (no autonomous writes).
- New domain surfaces require contracts-first implementation and replay tests.
- Trigger policies and memory schemas become first-class versioned artifacts.
**Proof requirements:**
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npx jest --ci --passWithNoTests`
- Deterministic replay tests for rule and AI-decision envelopes (new tests in Phase 1 SSIs)
**Rollback approach:**
- Disable ZEREBROX scheduler/trigger entrypoints.
- Revert Phase 1 skill registry and memory projection surfaces.
- Keep existing CALYBRA workflows unaffected.

---

## ADR-0022: Phase 1 Path Convention Mapping (/core and /contracts Aliases)
**Status:** Accepted
**Decision:**
- Adopt the hardening-plan path language (`/core/*`, `/contracts/*`, `/tests/*`) as specification aliases.
- Implement those modules inside existing CALYBRA server boundaries under `server/logic/brain/core/*`, `server/logic/brain/contracts/*`, and `server/tests/*`.
- Require each task entry using alias paths to include explicit repo path mapping.

**Rationale:**
- The approved 20-step hardening plan uses concise conceptual paths not currently present at repo root.
- Mapping aliases to current server structure avoids destructive refactors while preserving plan clarity and execution traceability.

**Consequences:**
- Future SSI implementation must not create parallel duplicate module trees at repo root unless a new ADR explicitly approves it.
- Docs and release entries must keep alias+repo path pairing to prevent ambiguity.

**Proof requirements:**
- `node scripts/consistency.mjs`

**Rollback approach:**
- Revert ADR-0022 and normalize task language back to repo-native paths only.

---

## ADR-0023: Phase 2 Self-Accountable Intelligence (Deterministic ROI + Self-Restriction)
**Status:** Accepted
**Decision:**
- Phase 2 objective is operational leverage: measurable ROI, deterministic pattern detection, and self-accountable autonomy control.
- Add four deterministic organs:
  1) Improvement Measurement Engine,
  2) Error Detection & Self-Critique,
  3) Autonomy Restriction Controller,
  4) Escalation Governance + Health containment.
- No free-form AI authority: AI can inform, but state-changing trust must pass deterministic engines and guardrails.
- Phase 2 completion requires explicit freeze criteria in `docs/phase2-freeze.md`.

**Rationale:**
- Prevents AI theater by making intelligence performance quantifiable and replay-auditable.
- Ensures system can degrade safely via automatic restriction and escalation before risk compounds.

**Consequences:**
- Every recommendation path needs measurable baseline, delta, and outcome traces.
- Autonomy state becomes a strict machine (`Advisory/Assisted/Restricted/Locked`) tied to risk/accuracy signals.
- Human override reasoning is treated as first-class audit input for recalibration loops.

**Proof requirements:**
- `npm run typecheck`
- `npm run lint`
- `runTests(server/tests/logic/phase2Intelligence.test.ts)`

**Rollback approach:**
- Disable Phase 2 execution paths by routing to advisory-only mode.
- Revert Phase 2 core modules and docs while preserving Phase 1 deterministic memory/replay integrity.

---

## ADR-0024: Phase Ordering Enforcement + Phase 1 Freeze Execution
**Status:** Accepted
**Decision:**
- Resolve canonical roadmap conflict by enforcing strict ordering: Phase 1 must be completed/frozen before any active Phase 2 rollout behavior.
- Complete and freeze all 20 Phase 1 steps with deterministic contracts, append-only event store, replay/snapshot primitives, AI isolation/gating, context/reflection/identity modules, integrity script, and failure simulation suite.
- Treat previously added Phase 2 modules as non-authoritative scaffolding until Phase 1 freeze gates are satisfied.

**Rationale:**
- Product mode requires non-negotiable sequencing (Phase 1 -> Phase 2 -> Phase 3).
- Deterministic memory/replay and isolation guardrails are prerequisite controls for safe intelligence scaling.

**Consequences:**
- Phase 1 artifacts become the canonical substrate for all later intelligence behavior.
- Any Phase 2 operational activation remains blocked until Phase 1 freeze proof pack is green.

**Proof requirements:**
- `npm run typecheck`
- `npm run lint`
- `runTests(server/tests/logic/phase1BrainCore.test.ts)`
- `runTests(server/tests/failure-sim.spec.ts)`
- `node scripts/integrity-check.mjs`
- `node scripts/consistency.mjs`
- `npm run security:credentials`
- `npm run build`

**Rollback approach:**
- Revert Phase 1 module/doc additions and task/release decision updates.
- Re-run consistency and compile gates to ensure rollback integrity.

---

## ADR-0025: SSI-0606 Deterministic Brain Workflow Integration
**Status:** Accepted
**Decision:**
- Activate Phase 2 execution track after confirmed Phase 1 freeze proofs by adding a deterministic workflow integration slice (`brainReplay.workflow`).
- Integration flow must remain read-only to financial truth and follow: deterministic routing -> AI gate evaluation -> explicit chained events -> deterministic replay -> optional snapshot -> context window build.
- Canonical event ordering must use parsed epoch timestamps (not string-lexicographic comparison) to avoid replay chain drift under timestamp format variants.

**Rationale:**
- Connects validated Phase 1 primitives to a real orchestration entrypoint without weakening tenant isolation or authority boundaries.
- Prevents subtle hash-chain regressions caused by mixed ISO timestamp string formats.

**Consequences:**
- `server/workflows` now includes a deterministic brain execution workflow suitable for controlled operational wiring.
- Replay integrity relies on epoch-based sort normalization in both event store and replay engine.

**Proof requirements:**
- `npm run typecheck`
- `npm run lint`
- `runTests(server/tests/workflows/brainReplay.workflow.test.ts)`
- `node scripts/integrity-check.mjs`
- `node scripts/consistency.mjs`

**Rollback approach:**
- Revert `brainReplay.workflow` and associated tests/exports.
- Revert replay/event-store ordering updates if needed.
- Re-run proofs above to validate rollback health.

---

## ADR-0026: SSI-0607..0617 Full Integration (Artifacts + ACL + Preflight)
**Status:** Accepted
**Decision:**
- Implement the full Phase 2 tranche from SSI-0607 through SSI-0617 in one deterministic integration pass.
- `onPeriodFinalized.workflow` is the canonical orchestration hook for brain replay execution and artifact emission.
- Brain artifacts are append-only and tenant-scoped under readmodel storage using deterministic IDs + hashes and versioned replay artifact contracts.
- Runtime memory ACL checks are enforced before artifact read/write operations; denied paths remain auditable and deterministic.
- Preflight gate is standardized through `scripts/phase2_preflight.mjs` and must pass before release logging.

**Rationale:**
- Closes the gap between Phase 1 primitives and live orchestration behavior.
- Preserves non-authoritative AI posture while enabling deterministic operational intelligence evidence.

**Consequences:**
- Workflow emits deterministic telemetry (non-blocking) and artifact trails now required for replay-grade audits.
- Emulator-backed period-finalized tests become mandatory proof for this integration slice.

**Proof requirements:**
- `npm run typecheck`
- `npm run lint`
- `runTests(server/tests/workflows/brainReplay.workflow.test.ts, server/tests/failure-sim.spec.ts, server/tests/logic/phase1BrainCore.test.ts)`
- `npx firebase emulators:exec --only firestore "npm test -- server/tests/workflows/periodFinalized.workflow.test.ts"`
- `node scripts/integrity-check.mjs`
- `node scripts/consistency.mjs`
- `npm run phase2:preflight`

**Rollback approach:**
- Revert workflow hook + artifact persistence + ACL + preflight script additions.
- Re-run proof chain above to confirm restored baseline behavior.

---

## ADR-0027: SSI-0618..0627 Advanced Consolidation Layer
**Status:** Accepted
**Decision:**
- Implement a deterministic advanced consolidation layer for Phase 2 with ten new pure modules (`unified-brain-engine`, `artifact-compactor`, `replay-diff-analyzer`, `policy-registry`, `autonomy-circuit-breaker`, `escalation-sla`, `decision-scorer-v2`, `replay-benchmark`, `preflight-report`, `phase2-closure-evaluator`).
- Maintain strict purity and replay stability for all modules; no server-authoritative financial write paths introduced.
- Add a dedicated validation suite (`phase2Next10.test.ts`) and include outcomes in governance records.

**Rationale:**
- Consolidates Phase 2 into a composable, analyzable architecture while preserving deterministic safety posture.
- Provides explicit closure and preflight evaluators for objective phase readiness decisions.

**Consequences:**
- Brain core exports now include additional deterministic composition and evaluation primitives.
- Phase planning now has a 12-todo execution map directly tied to executable modules and tests.

**Proof requirements:**
- `npm run typecheck`
- `npm run lint`
- `runTests(server/tests/logic/phase2Next10.test.ts, server/tests/logic/phase2Intelligence.test.ts, server/tests/workflows/brainReplay.workflow.test.ts, server/tests/failure-sim.spec.ts)`
- `node scripts/consistency.mjs`
- `npm run phase2:preflight`

**Rollback approach:**
- Revert new consolidation modules/exports and associated tests.
- Re-run proof requirements to confirm baseline restoration.

---

## ADR-0028: SSI-0628..0637 Breakthrough Engineering Layer
**Status:** Accepted
**Decision:**
- Implement ten additional deterministic modules for lineage, determinism auditing, policy simulation, threshold tuning, escalation balancing, compaction verification, performance budget gating, explainability packs, closure scoring, and freeze recommendation.
- Keep all modules pure and deterministic, with no direct persistence or authority-bound writes.
- Validate via dedicated suite `phase2Next10b.test.ts` and include outcomes in standard preflight chain.

**Rationale:**
- Creates a top-tier operational intelligence layer with explicit readiness and freeze-decision mechanisms.
- Strengthens explainability and replay assurance before Phase 2 closure recommendation.

**Consequences:**
- Brain core now exposes full closure-readiness and freeze-candidate primitives.
- Governance relies on expanded module set and tests as canonical baseline for next phase decisions.

**Proof requirements:**
- `npm run typecheck`
- `npm run lint`
- `runTests(server/tests/logic/phase2Next10b.test.ts, server/tests/logic/phase2Next10.test.ts, server/tests/logic/phase2Intelligence.test.ts, server/tests/workflows/brainReplay.workflow.test.ts, server/tests/failure-sim.spec.ts)`
- `node scripts/consistency.mjs`
- `npm run phase2:preflight`

**Rollback approach:**
- Revert 0628..0637 modules and exports.
- Revert added tests and task/release updates.
- Re-run proof requirements to confirm restored baseline.