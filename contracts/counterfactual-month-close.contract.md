# Counterfactual Month Close Contract Spec

## Assumptions (Explicit)
- Tenant timezone is the canonical timezone for date boundaries and cutoffs.
- Month key is derived from `occurredAt` in tenant timezone as `YYYY-MM`.
- `occurredAt` and `recordedAt` are stored as ISO timestamps where the date portion reflects tenant timezone.
- All money values use integer minor units (cents) and banker's rounding when converting from decimals.
- VAT rates are expressed as percentages (0-100) and stored as numbers.
- Only CONFIRMED matches affect reconciliation totals.

## Money and Rounding
- Monetary fields use `amountCents: number` (integer, safe 53-bit).
- Conversions from decimals use banker's rounding (round half to even).
- Percentages (VAT and variance metrics) are rounded to the nearest integer using banker's rounding.

## Event Model (Authoritative)
All authoritative events are stored under:
- `tenants/{tenantId}/events/{eventId}`

Job records for idempotency are stored under:
- `jobs/{jobId}` (top-level, server-only)

### Base Event
```ts
export interface EventBase {
  readonly id: string;
  readonly tenantId: string;
  readonly type: EventType;
  readonly occurredAt: string; // ISO timestamp, authoritative business time
  readonly recordedAt: string; // ISO timestamp, ingestion time
  readonly monthKey: string; // YYYY-MM, derived from occurredAt in tenant timezone
  readonly deterministicId: string; // Idempotency key
  readonly schemaVersion: 1;
}
```

### Event Types
```ts
export type EventType =
  | "BANK_TX_ARRIVED"
  | "INVOICE_CREATED"
  | "INVOICE_UPDATED"
  | "MATCH_RESOLVED"
  | "ADJUSTMENT_POSTED";
```

### Payload Schemas
```ts
export interface BankTxArrivedPayload {
  readonly txId: string;
  readonly bookingDate: string; // YYYY-MM-DD
  readonly amountCents: number; // signed
  readonly currency: "EUR" | "USD" | "GBP" | string;
  readonly descriptionRaw: string;
  readonly counterpartyRaw?: string;
  readonly referenceRaw?: string;
  readonly sourceFileId?: string;
}

export interface InvoiceCreatedPayload {
  readonly invoiceId: string;
  readonly issueDate: string; // YYYY-MM-DD
  readonly invoiceNumber: string;
  readonly supplierNameRaw: string;
  readonly totalGrossCents: number;
  readonly vatRatePercent: number; // 0-100
  readonly currency: "EUR" | "USD" | "GBP" | string;
  readonly direction?: "SALES" | "EXPENSE"; // default EXPENSE
}

export interface InvoiceUpdatedPayload {
  readonly invoiceId: string;
  readonly issueDate: string; // YYYY-MM-DD
  readonly invoiceNumber: string;
  readonly supplierNameRaw: string;
  readonly totalGrossCents: number;
  readonly vatRatePercent: number; // 0-100
  readonly currency: "EUR" | "USD" | "GBP" | string;
  readonly direction?: "SALES" | "EXPENSE"; // default EXPENSE
}

export interface MatchResolvedPayload {
  readonly matchId: string;
  readonly status: "CONFIRMED" | "REJECTED";
  readonly bankTxIds: readonly string[];
  readonly invoiceIds: readonly string[];
  readonly matchType: "EXACT" | "FUZZY" | "GROUPED" | "PARTIAL" | "FEE" | "MANUAL";
  readonly score: number; // 0-100
}

export interface AdjustmentPostedPayload {
  readonly adjustmentId: string;
  readonly category: "REVENUE" | "EXPENSE" | "VAT";
  readonly amountCents: number; // signed
  readonly currency: "EUR" | "USD" | "GBP" | string;
  readonly reason: string;
  readonly relatedId?: string;
}

export type EventPayload =
  | BankTxArrivedPayload
  | InvoiceCreatedPayload
  | InvoiceUpdatedPayload
  | MatchResolvedPayload
  | AdjustmentPostedPayload;

export type Event = EventBase & { readonly payload: EventPayload };
```

## Definitions

### Unmatched
- Unmatched bank transaction: a bank tx with no CONFIRMED match referencing its `txId`.
- Unmatched invoice: an invoice not fully paid.

### Invoice Paid
- Paid if total matched bank tx absolute amounts >= invoice `totalGrossCents`.
- Partial if total matched bank tx absolute amounts is > 0 and < `totalGrossCents`.
- Overpaid if total matched bank tx absolute amounts > `totalGrossCents`.

### Matching Rules (Deterministic)
- Only CONFIRMED matches contribute to paid/unpaid and reconciliation totals.
- If multiple CONFIRMED matches reference the same invoice, amounts are summed.
- Ordering for deterministic processing:
  1) `occurredAt` ascending
  2) `deterministicId` ascending

### Data Arrival After Day X
- An event is considered to arrive after Day X if:
  - `recordedAt` > end of period + X days (tenant timezone, end-of-day inclusive).
- Day X is computed relative to period end date.

## Counterfactual Month Close

### Cutoff Definition
- For a period ending at `periodEnd` (YYYY-MM-DD in tenant timezone), define cutoff day N as:
  - cutoffDate = periodEnd + N days at 23:59:59.999 (tenant timezone)
- Counterfactual computation includes events with `occurredAt` <= cutoffDate.

### As-Of List
- Default: [5, 10, 20]
- `Final` is represented by including all events with no cutoff.

### Timeline Entry Fields
- `asOfDate`: YYYY-MM-DD (cutoff date)
- `revenueCents`: sum of positive bank tx amounts + adjustments in category REVENUE
- `expenseCents`: absolute sum of negative bank tx amounts + adjustments in category EXPENSE
- `vatCents`: VAT total derived from invoices + adjustments in category VAT
- `unmatchedBankCount`
- `unmatchedInvoiceCount`
- `unmatchedTotalCount`: unmatchedBankCount + unmatchedInvoiceCount

## Constrained Insights
Only these statements are permitted:
- "Final accuracy was reached on Day X."
- "Y% of variance resolved in the last Z days."

### Final Accuracy Reached on Day X
- Determine the smallest Day X where all timeline numeric fields equal the Final entry (exact match in cents and counts).
- If no earlier day matches, Day X is the maximum day in the configured as-of list.

### Variance Resolved in Last Z Days
- Variance at a checkpoint is the sum of absolute differences vs Final for:
  - revenueCents, expenseCents, vatCents, unmatchedTotalCount
- Total variance reduction = variance at earliest checkpoint - variance at Final (0).
- Last interval variance reduction = variance at previous checkpoint - variance at Final.
- Y = round(100 * lastIntervalReduction / totalReduction).
- Z = days between previous checkpoint and Final cutoff.
- If totalReduction is 0, Y = 100 and Z = 0.

## Close Friction Index
Derived from the counterfactual timeline and authoritative events.

### Metrics
- lateArrivalPercent:
  - 100 * (count of events with recordedAt after Day X) / (total events in period)
- adjustmentAfterClosePercent:
  - 100 * (count of ADJUSTMENT_POSTED events with occurredAt after period end) / (total ADJUSTMENT_POSTED in period)
- reconciliationHalfLifeDays:
  - Earliest day where variance <= 10% of initial variance.
  - If initial variance is 0, half-life = 0.

### Score
- `closeFrictionScore = clamp(0, 100, 100 - round((lateArrivalPercent * 0.5) + (adjustmentAfterClosePercent * 0.3) + (reconciliationHalfLifeDays * 2)))`

## VAT Summary (Period)
- VAT buckets: 21%, 10%, 4%, 0% (extensible).
- VAT totals computed from invoice gross amounts using VAT extraction.
- Output fields per bucket: `baseCents`, `vatCents`, `grossCents`.

## Mismatch Detector
- bank tx with no matching invoice: bank tx unmatched (as defined above).
- invoice marked paid but no bank tx: invoice fully paid by matches but no linked bank tx (should not happen; flagged if match references only invoices).
- partial payments: matched sum > 0 and < totalGrossCents.
- overpayments: matched sum > totalGrossCents.

## Exports
- Ordering rules:
  - bank tx sorted by bookingDate then txId
  - invoices sorted by issueDate then invoiceId
  - events sorted by occurredAt then deterministicId
- CSV: UTF-8, dot decimal separator.
- PDF: 1-2 pages, summary only, no charts.

## Read Model Storage Paths
Derived (non-authoritative, rebuildable):
- tenants/{tenantId}/readmodels/monthCloseTimeline/{monthKey}/snapshot
- tenants/{tenantId}/readmodels/closeFriction/{monthKey}/snapshot
- tenants/{tenantId}/readmodels/vatSummary/{monthKey}/snapshot
- tenants/{tenantId}/readmodels/mismatchSummary/{monthKey}/snapshot
- tenants/{tenantId}/readmodels/auditorReplay/{monthKey}/{asOfDateKey}

## Export Storage Paths
- tenants/{tenantId}/exports/{monthKey}/artifacts/ledgerCsv
- tenants/{tenantId}/exports/{monthKey}/artifacts/summaryPdf
