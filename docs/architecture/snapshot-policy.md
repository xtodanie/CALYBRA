# Snapshot Policy (Phase 1)

## Objective
Reduce replay latency without changing deterministic final state.

## Policy
- Snapshot interval: every 100 accepted events per tenant.
- Snapshot payload: replay state + source event id + timestamp + state hash.
- Verification: state hash must match deterministic hash of payload at write time.
- Load strategy: select latest snapshot at or before replay target timestamp.
- Retention: keep last 50 snapshots per tenant by default.

## Integrity Requirements
- Snapshot never bypasses hash-chain checks.
- Replay with snapshot and replay without snapshot must produce identical state hash.
- Snapshot records are read-only after creation.
