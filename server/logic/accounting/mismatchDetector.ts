/**
 * Mismatch detector - bank vs ledger
 * Pure logic. No IO, no randomness, no time.
 */

import { CurrencyCode } from "../../domain/money";

export interface BankTxInput {
  readonly txId: string;
  readonly bookingDate: string; // YYYY-MM-DD
  readonly amountCents: number;
  readonly currency: CurrencyCode;
}

export interface InvoiceInput {
  readonly invoiceId: string;
  readonly issueDate: string; // YYYY-MM-DD
  readonly totalGrossCents: number;
  readonly currency: CurrencyCode;
}

export interface MatchInput {
  readonly matchId: string;
  readonly status: "CONFIRMED" | "REJECTED";
  readonly bankTxIds: readonly string[];
  readonly invoiceIds: readonly string[];
}

export interface MismatchSummary {
  readonly bankTxWithoutInvoice: readonly string[];
  readonly invoiceMatchedWithoutBankTx: readonly string[];
  readonly partialPayments: readonly string[];
  readonly overpayments: readonly string[];
}

export function detectMismatches(
  bankTx: readonly BankTxInput[],
  invoices: readonly InvoiceInput[],
  matches: readonly MatchInput[],
  currency: CurrencyCode
): MismatchSummary {
  const confirmedMatches = matches.filter((match) => match.status === "CONFIRMED");
  const matchedBankTxIds = new Set<string>();
  const invoiceMatchedCents = new Map<string, number>();
  const invoiceHasMatchNoBankTx = new Set<string>();

  for (const match of confirmedMatches) {
    if (match.bankTxIds.length === 0) {
      for (const invoiceId of match.invoiceIds) {
        invoiceHasMatchNoBankTx.add(invoiceId);
      }
    }

    for (const txId of match.bankTxIds) {
      matchedBankTxIds.add(txId);
    }

    for (const invoiceId of match.invoiceIds) {
      const invoice = invoices.find((inv) => inv.invoiceId === invoiceId);
      if (!invoice || invoice.currency !== currency) continue;
      let matchedSum = invoiceMatchedCents.get(invoiceId) ?? 0;
      for (const txId of match.bankTxIds) {
        const tx = bankTx.find((item) => item.txId === txId);
        if (!tx || tx.currency !== currency) continue;
        matchedSum += Math.abs(tx.amountCents);
      }
      invoiceMatchedCents.set(invoiceId, matchedSum);
    }
  }

  const bankTxWithoutInvoice = bankTx
    .filter((tx) => tx.currency === currency && !matchedBankTxIds.has(tx.txId))
    .map((tx) => tx.txId)
    .sort();

  const invoiceMatchedWithoutBankTx = invoices
    .filter((inv) => inv.currency === currency && invoiceHasMatchNoBankTx.has(inv.invoiceId))
    .map((inv) => inv.invoiceId)
    .sort();

  const partialPayments: string[] = [];
  const overpayments: string[] = [];

  for (const invoice of invoices) {
    if (invoice.currency !== currency) continue;
    const matchedSum = invoiceMatchedCents.get(invoice.invoiceId) ?? 0;
    if (matchedSum > 0 && matchedSum < invoice.totalGrossCents) {
      partialPayments.push(invoice.invoiceId);
    } else if (matchedSum > invoice.totalGrossCents) {
      overpayments.push(invoice.invoiceId);
    }
  }

  partialPayments.sort();
  overpayments.sort();

  return {
    bankTxWithoutInvoice,
    invoiceMatchedWithoutBankTx,
    partialPayments,
    overpayments,
  };
}
