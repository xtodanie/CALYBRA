# Observability

## Goals
- Detect tenant isolation breaches quickly.
- Detect unauthorized month close finalizations.
- Detect file asset parse failures and missing files.

## Required Signals
- Functions logs for any server-authoritative writes.
- Firestore audit fields: createdBy, updatedBy.
- Storage access anomalies (tenant path mismatch).

## Baseline Dashboards
- Count of monthCloses finalized per tenant per day.
- Count of match confirmations per tenant per day.
- File asset parse status counts (PENDING, PARSED, FAILED).

## Alerts
- Any write to tenant-owned collections without tenantId.
- Any monthClose status change to FINALIZED without OWNER/ACCOUNTANT role.
- Sudden spike in cross-tenant access denials.

## Runbooks
- Use agent/RUNBOOK.md for mitigation steps and rollback paths.
