/**
 * Ledger CSV Export - deterministic CSV generator
 * Pure logic. No IO, no randomness, no time.
 */

import { Result, ok, err } from "../logic/errors/normalizeError";
import { BusinessErrorCode, createBusinessError } from "../logic/errors/businessErrors";
import { CurrencyCode } from "../domain/money";

export interface LedgerBankTx {
  readonly txId: string;
  readonly bookingDate: string; // YYYY-MM-DD
  readonly amountCents: number;
  readonly currency: CurrencyCode;
  readonly descriptionRaw?: string;
}

export interface LedgerInvoice {
  readonly invoiceId: string;
  readonly issueDate: string; // YYYY-MM-DD
  readonly invoiceNumber: string;
  readonly supplierNameRaw: string;
  readonly totalGrossCents: number;
  readonly currency: CurrencyCode;
}

export interface LedgerMatch {
  readonly matchId: string;
  readonly status: "CONFIRMED" | "REJECTED";
  readonly bankTxIds: readonly string[];
  readonly invoiceIds: readonly string[];
}

export interface LedgerCsvInput {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly currency: CurrencyCode;
  readonly bankTx: readonly LedgerBankTx[];
  readonly invoices: readonly LedgerInvoice[];
  readonly matches: readonly LedgerMatch[];
  readonly generatedAt: string; // ISO
}

export interface LedgerCsvResult {
  readonly filename: string;
  readonly csvContent: string;
  readonly rowCount: number;
}

export function generateLedgerCsv(
  input: LedgerCsvInput
): Result<LedgerCsvResult> {
  if (!input.tenantId || !input.monthKey) {
    return err(
      createBusinessError(BusinessErrorCode.MISSING_REQUIRED_FIELD, {
        message: "tenantId and monthKey are required",
      })
    );
  }

  const confirmedMatches = input.matches.filter(
    (match) => match.status === "CONFIRMED"
  );
  const bankTxToInvoices = buildBankTxMatchIndex(confirmedMatches);
  const invoiceToBankTx = buildInvoiceMatchIndex(confirmedMatches);

  const bankRows = [...input.bankTx]
    .filter((tx) => tx.currency === input.currency)
    .sort((a, b) => {
      const dateCompare = a.bookingDate.localeCompare(b.bookingDate);
      if (dateCompare !== 0) return dateCompare;
      return a.txId.localeCompare(b.txId);
    })
    .map((tx) => ({
      recordType: "BANK_TX",
      recordId: tx.txId,
      date: tx.bookingDate,
      description: tx.descriptionRaw ?? "",
      amountCents: tx.amountCents,
      currency: tx.currency,
      matchedIds: (bankTxToInvoices.get(tx.txId) ?? []).join("|"),
    }));

  const invoiceRows = [...input.invoices]
    .filter((inv) => inv.currency === input.currency)
    .sort((a, b) => {
      const dateCompare = a.issueDate.localeCompare(b.issueDate);
      if (dateCompare !== 0) return dateCompare;
      return a.invoiceId.localeCompare(b.invoiceId);
    })
    .map((inv) => ({
      recordType: "INVOICE",
      recordId: inv.invoiceId,
      date: inv.issueDate,
      description: `${inv.supplierNameRaw} ${inv.invoiceNumber}`.trim(),
      amountCents: inv.totalGrossCents,
      currency: inv.currency,
      matchedIds: (invoiceToBankTx.get(inv.invoiceId) ?? []).join("|"),
    }));

  const rows = [...bankRows, ...invoiceRows];

  if (rows.length === 0) {
    return err(
      createBusinessError(BusinessErrorCode.NO_DATA_TO_EXPORT, {
        message: "No ledger rows available for export",
      })
    );
  }

  const header = [
    "recordType",
    "recordId",
    "date",
    "description",
    "amountCents",
    "currency",
    "matchedIds",
  ];

  const csvLines = [header.map(escapeCsv).join(",")];
  for (const row of rows) {
    csvLines.push(
      [
        row.recordType,
        row.recordId,
        row.date,
        row.description,
        row.amountCents.toString(),
        row.currency,
        row.matchedIds,
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  const filename = `ledger_${input.monthKey}_${input.tenantId}.csv`;

  return ok({
    filename,
    csvContent: csvLines.join("\n"),
    rowCount: rows.length,
  });
}

function buildBankTxMatchIndex(
  matches: readonly LedgerMatch[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const match of matches) {
    for (const txId of match.bankTxIds) {
      const current = map.get(txId) ?? [];
      map.set(txId, [...current, ...match.invoiceIds].sort());
    }
  }
  return map;
}

function buildInvoiceMatchIndex(
  matches: readonly LedgerMatch[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const match of matches) {
    for (const invoiceId of match.invoiceIds) {
      const current = map.get(invoiceId) ?? [];
      map.set(invoiceId, [...current, ...match.bankTxIds].sort());
    }
  }
  return map;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes("\"") ) {
    return `"${value.replace(/\"/g, '""')}"`;
  }
  return value;
}
