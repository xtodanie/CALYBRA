/**
 * Ledger snapshot builder for counterfactual views
 * Pure logic. No IO, no randomness, no time.
 */

import { Event, EventType } from "../../domain/events";
import { CurrencyCode } from "../../domain/money";

export interface BankTxSnapshot {
  readonly txId: string;
  readonly bookingDate?: string;
  readonly amountCents: number;
  readonly currency: CurrencyCode | string;
  readonly descriptionRaw?: string;
}

export interface InvoiceSnapshot {
  readonly invoiceId: string;
  readonly issueDate?: string;
  readonly invoiceNumber?: string;
  readonly supplierNameRaw?: string;
  readonly totalGrossCents: number;
  readonly vatRatePercent: number;
  readonly currency: CurrencyCode | string;
  readonly direction: "SALES" | "EXPENSE";
}

export interface MatchSnapshot {
  readonly matchId: string;
  readonly status: "CONFIRMED" | "REJECTED";
  readonly bankTxIds: readonly string[];
  readonly invoiceIds: readonly string[];
  readonly matchType?: string;
  readonly score?: number;
}

export interface AdjustmentSnapshot {
  readonly adjustmentId?: string;
  readonly category: "REVENUE" | "EXPENSE" | "VAT";
  readonly amountCents: number;
  readonly currency: CurrencyCode | string;
}

export interface LedgerSnapshot {
  readonly bankTx: readonly BankTxSnapshot[];
  readonly invoices: readonly InvoiceSnapshot[];
  readonly matches: readonly MatchSnapshot[];
  readonly adjustments: readonly AdjustmentSnapshot[];
}

export function buildLedgerSnapshot(events: readonly Event[]): LedgerSnapshot {
  const bankTxById = new Map<string, BankTxSnapshot>();
  const invoiceById = new Map<string, InvoiceSnapshot>();
  const matchById = new Map<string, MatchSnapshot>();
  const adjustments: AdjustmentSnapshot[] = [];

  for (const event of events) {
    switch (event.type as EventType) {
      case "BANK_TX_ARRIVED": {
        const payload = event.payload as BankTxSnapshot;
        bankTxById.set(payload.txId, {
          txId: payload.txId,
          bookingDate: payload.bookingDate,
          amountCents: payload.amountCents,
          currency: payload.currency,
          descriptionRaw: payload.descriptionRaw,
        });
        break;
      }
      case "INVOICE_CREATED":
      case "INVOICE_UPDATED": {
        const payload = event.payload as InvoiceSnapshot;
        invoiceById.set(payload.invoiceId, {
          invoiceId: payload.invoiceId,
          issueDate: payload.issueDate,
          invoiceNumber: payload.invoiceNumber,
          supplierNameRaw: payload.supplierNameRaw,
          totalGrossCents: payload.totalGrossCents,
          vatRatePercent: payload.vatRatePercent,
          currency: payload.currency,
          direction: payload.direction ?? "EXPENSE",
        });
        break;
      }
      case "MATCH_RESOLVED": {
        const payload = event.payload as MatchSnapshot;
        matchById.set(payload.matchId, {
          matchId: payload.matchId,
          status: payload.status,
          bankTxIds: payload.bankTxIds,
          invoiceIds: payload.invoiceIds,
          matchType: payload.matchType,
          score: payload.score,
        });
        break;
      }
      case "ADJUSTMENT_POSTED": {
        const payload = event.payload as AdjustmentSnapshot;
        adjustments.push({
          adjustmentId: payload.adjustmentId,
          category: payload.category,
          amountCents: payload.amountCents,
          currency: payload.currency,
        });
        break;
      }
      default:
        break;
    }
  }

  return {
    bankTx: [...bankTxById.values()],
    invoices: [...invoiceById.values()],
    matches: [...matchById.values()],
    adjustments,
  };
}
