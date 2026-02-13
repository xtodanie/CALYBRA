# Memory Taxonomy (Phase 1)

## Structural Memory
- Purpose: deterministic canonical shape of business entities.
- Retention: long-lived, version-addressable snapshots.
- Mutability: append-only versions.

## Event Memory
- Purpose: immutable operation/event chronology.
- Retention: indefinite in Phase 1.
- Mutability: append-only event envelopes with hash-chain.

## Behavioral Memory
- Purpose: summarize trend signals and operator/system behavior.
- Retention: rolling horizon plus periodic snapshots.
- Mutability: append-only summaries by interval.

## Reflection Memory
- Purpose: explicit self-critique and anomaly commentary.
- Retention: indefinite with compaction by summary rollups.
- Mutability: append-only reflection events only.

## Cross-Cutting Constraints
- All memory is tenant-scoped.
- No memory object can directly mutate financial source-of-truth entities.
- Replay from events + snapshots must converge to same deterministic state.
