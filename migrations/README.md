# Migrations

## Rules
- Every schema change requires a migration entry.
- Do not change Firestore rules or document shapes without updating contracts and migration docs.
- Migrations must be reversible or have an explicit rollback plan.
- Backfills must be idempotent and safe for re-run.

## Process
1) Add a migration file (YYYYMMDD or incremented id).
2) Describe the change, affected collections, and invariants.
3) Define backfill steps and rollback steps.
4) Update agent/DECISIONS.md if behavior or enforcement changes.

## Backfill Standards
- Use server-authoritative code paths only.
- Track progress with checkpoints and logs.
- Never cross tenant boundaries during backfill.
