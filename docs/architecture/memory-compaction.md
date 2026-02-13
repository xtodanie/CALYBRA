# Memory Compaction Strategy (Phase 1)

## Goal
Control memory growth while preserving verifiability and replay determinism.

## Approach
- Compaction is summary-only: source events are never altered or deleted.
- Produce periodic summary events with:
  - covered event range (`fromEventId` -> `toEventId`)
  - deterministic aggregate metrics
  - compaction hash over covered references and summary payload
- Compaction output becomes additional append-only events.

## Guardrails
- Compaction cannot remove tenant boundaries.
- Compaction cannot rewrite historical event payloads.
- Compaction must remain reproducible from raw event history.

## Verification
- A compaction integrity check recomputes summary hash from source range.
- Mismatch causes hard failure in integrity gate.
