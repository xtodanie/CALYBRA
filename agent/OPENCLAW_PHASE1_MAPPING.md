# agent/OPENCLAW_PHASE1_MAPPING.md

## Purpose
Translate concrete OpenClaw implementation patterns into CALYBRA ZEREBROX-CORE Phase 1 implementation slices without importing OpenClaw assumptions that violate CALYBRA security boundaries.

This document is evidence-backed architecture mapping, not direct code migration.

---

## Scope Boundary
- Phase 1 remains read-only against financial truth.
- Tenant isolation and server-authoritative writes remain unchanged.
- OpenClaw is used as pattern evidence for orchestration, memory, gating, and auditability primitives.

---

## Evidence-to-Mapping Matrix

### 1) Memory Layering + Privacy Scoping
**OpenClaw evidence**
- Daily + long-term split (`memory/YYYY-MM-DD.md`, `MEMORY.md`) and explicit guidance to avoid secret persistence.
- Long-term memory loaded only in private/main context, not shared/group contexts.
- Memory indexing supports source scoping (`memory` vs `sessions`) and provider/model fingerprint invalidation.

**CALYBRA mapping**
- `Memory Core v1` stores:
  - append-only event ledger,
  - curated behavioral summaries,
  - tenant-scoped temporal projections.
- Add context class boundary:
  - private analyst context can load curated summaries,
  - shared/ops channels cannot load sensitive long-term summaries.
- Add embedding/index fingerprint to force deterministic reindex when model/config changes.

**Phase 1 SSI targets**
- SSI-0504 (memory core), SSI-0505 (replay fidelity).

---

### 2) Plugin/Skill Registry with Explicit Enablement
**OpenClaw evidence**
- Plugin manifests require `configSchema`.
- Runtime loading enforces enable/disable state, allow/deny policy, and diagnostics.
- Skills can be shipped by plugins and are gated by plugin enablement and config predicates.

**CALYBRA mapping**
- ZEREBROX skills must register with:
  - schema version,
  - deterministic precheck,
  - tenant context contract,
  - explicit feature flag.
- No skill execution when schema validation or tenant context check fails.
- Skill registry emits structured diagnostics (load failure, config mismatch, policy deny).

**Phase 1 SSI targets**
- SSI-0500 (contracts + registry), SSI-0503 (activation gate).

---

### 3) Triggered Automation: Heartbeat + Scheduler Separation
**OpenClaw evidence**
- Heartbeat runner and cron scheduler are separate concerns.
- Heartbeat supports active-hour windows, deterministic interval parsing, and explicit skipped reasons.
- Scheduler reliability includes retry/backoff and stall-prevention logic.

**CALYBRA mapping**
- Keep timer-driven rule evaluation in a dedicated heartbeat lane.
- Manual or EOD jobs can enqueue into a separate scheduler lane without bypassing rule gate.
- Every skipped or deferred execution must emit an auditable reason code.

**Phase 1 SSI targets**
- SSI-0502 (rule heartbeat + trigger router), SSI-0506 (hardening).

---

### 4) Policy-First Inbound Gating
**OpenClaw evidence**
- DM access defaults to pairing/allowlist controls across channels.
- Explicit open-mode requires explicit wildcard allowlist.
- Access control is resolved before processing inbound content.

**CALYBRA mapping**
- Trigger ingress policy evaluates before AI activation:
  - source allowlist,
  - tenant entitlement,
  - rule severity threshold,
  - operating window.
- “Open trigger mode” requires explicit policy opt-in, never default.

**Phase 1 SSI targets**
- SSI-0502 (trigger router), SSI-0503 (activation policy).

---

### 5) Structured Output Validation + Deterministic Fallback
**OpenClaw evidence**
- Runtime uses JSON schema validation (AJV/TypeBox/Zod) for protocol and plugin payloads.
- Invalid outputs are rejected and surfaced through typed errors.

**CALYBRA mapping**
- AI output accepted only if it conforms to `DecisionEnvelope` schema.
- Any validation failure, low-confidence result, or policy miss routes to deterministic rule-only envelope.
- Free-form model output never writes to decision channel.

**Phase 1 SSI targets**
- SSI-0503 (AI activation core), SSI-0505 (replay explainability).

---

### 6) Auditability and Replay Artifacts
**OpenClaw evidence**
- Structured logs, protocol schemas, and event-typed payload validation are first-class.
- Execution approvals and policy decisions leave persisted metadata for later inspection.

**CALYBRA mapping**
- Every trigger and decision emits:
  - `ruleIds`,
  - `policyPath`,
  - `evidenceRefs`,
  - `contextHash`,
  - `modelVersion` (when AI used).
- Replay API reproduces deterministic envelope for same context hash and rule set version.

**Phase 1 SSI targets**
- SSI-0505 (audit + replay), SSI-0506 (release hardening proofs).

---

## CALYBRA Guardrails (Do Not Import from OpenClaw)
- No direct import of OpenClaw channel/DM policy surface; CALYBRA uses trigger ingress policy only.
- No workspace Markdown memory as canonical financial truth; CALYBRA memory is derived operational metadata.
- No plugin code execution without tenant-aware guard + schema check + explicit enablement.
- No bypass of existing Firestore/Storage rule boundaries.

---

## Implementation Handshake (Phase 1)
1. Implement schema contracts and skill registry gate (SSI-0500).
2. Add deterministic trigger scheduling with explicit skip/defer reasons (SSI-0502).
3. Enforce structured AI envelopes with deterministic fallback (SSI-0503).
4. Materialize tenant-scoped memory + replayable audit chain (SSI-0504/0505).
5. Execute full hardening proofs before Phase 1 release candidate (SSI-0506).

This mapping is the authoritative bridge between OpenClaw evidence and CALYBRA implementation slices.
