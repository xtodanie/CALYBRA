# 0002 Counterfactual Month Close + EU Read Models

## Summary
Introduce event-sourced period control, counterfactual read models, and deterministic exports.

## Affected Collections
- tenants/{tenantId}/events
- tenants/{tenantId}/periods
- tenants/{tenantId}/readmodels
- tenants/{tenantId}/exports
- jobs (top-level)

## Schema Changes
- New event documents with typed payloads and deterministicId.
- New period documents with status, closeConfig, periodLockHash.
- New readmodel documents (timeline, close friction, VAT summary, mismatch summary, auditor replay).
- New export artifacts (ledger CSV, summary PDF).
- New job records for idempotency.

## Backfill Plan
1) Create period docs for finalized months with closeConfig default [5, 10, 20].
2) Backfill events from existing bankTx/invoices/matches where possible.
3) Run rebuild readmodels workflow for each finalized period.

## Rollback Plan
- Delete events, periods, readmodels, exports, and job docs for the period.
- Revert firestore.rules and contracts updates.
- Re-run truth lock and emulator tests.
