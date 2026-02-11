# Migration 0001 - Initial Schema

## Summary
Baseline schema for Calybra multi-tenant invoice management and bank verification.

## Collections
- tenants
- users
- invoices
- bankTx
- matches
- monthCloses
- fileAssets

## Invariants
- Every tenant-owned document includes tenantId.
- users/{uid}.tenantId is the source of truth for tenant isolation.
- Server-authoritative writes for users, tenants, invoices, bankTx, matches, and fileAssets updates.
- monthCloses are client-creatable but FINALIZED is immutable.
- fileAssets must start in status PENDING_UPLOAD and parseStatus PENDING.

## Backfill
- None (baseline).

## Rollback
- Not applicable (baseline).
