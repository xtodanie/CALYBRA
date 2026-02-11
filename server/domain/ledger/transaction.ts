/**
 * Transaction (BankTx) domain entity
 * Pure type. No IO, no randomness, no time.
 */

import { Amount, amountFromDecimal, CurrencyCode } from "../money";

/**
 * Bank transaction entity - represents a single bank statement line
 */
export interface Transaction {
  readonly id: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly bookingDate: string; // YYYY-MM-DD
  readonly amount: Amount;
  readonly descriptionRaw: string;
  readonly fingerprint: string;
  readonly sourceFileId: string;
  readonly counterpartyRaw?: string;
  readonly referenceRaw?: string;
  readonly counterpartyId?: string;
}

/**
 * Input for creating a Transaction from parsed data
 */
export interface TransactionInput {
  readonly id: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly bookingDate: string;
  readonly amount: number; // Decimal value
  readonly currency: CurrencyCode;
  readonly descriptionRaw: string;
  readonly sourceFileId: string;
  readonly counterpartyRaw?: string;
  readonly referenceRaw?: string;
}

/**
 * Creates a Transaction from input data
 * @throws if input is invalid
 */
export function createTransaction(input: TransactionInput): Transaction {
  assertNonEmpty(input.id, "id");
  assertNonEmpty(input.tenantId, "tenantId");
  assertNonEmpty(input.monthCloseId, "monthCloseId");
  assertValidDate(input.bookingDate);
  assertNonEmpty(input.descriptionRaw, "descriptionRaw");
  assertNonEmpty(input.sourceFileId, "sourceFileId");

  const amount = amountFromDecimal(input.amount, input.currency);
  const fingerprint = computeFingerprint(input);

  return {
    id: input.id,
    tenantId: input.tenantId,
    monthCloseId: input.monthCloseId,
    bookingDate: input.bookingDate,
    amount,
    descriptionRaw: input.descriptionRaw,
    fingerprint,
    sourceFileId: input.sourceFileId,
    counterpartyRaw: input.counterpartyRaw,
    referenceRaw: input.referenceRaw,
  };
}

/**
 * Computes a deterministic fingerprint for duplicate detection
 * Fingerprint = hash of (bookingDate, amount, descriptionRaw)
 */
export function computeFingerprint(input: TransactionInput): string {
  const normalized = [
    input.bookingDate,
    input.amount.toFixed(2),
    normalizeDescription(input.descriptionRaw),
  ].join("|");

  return simpleHash(normalized);
}

/**
 * Checks if a transaction is a credit (positive amount)
 */
export function isCredit(tx: Transaction): boolean {
  return tx.amount.cents > 0;
}

/**
 * Checks if a transaction is a debit (negative amount)
 */
export function isDebit(tx: Transaction): boolean {
  return tx.amount.cents < 0;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function assertNonEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`Transaction ${field} must not be empty`);
  }
}

function assertValidDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  }
}

/**
 * Normalizes description for fingerprinting
 * - Lowercase
 * - Remove extra whitespace
 * - Remove non-alphanumeric except spaces
 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple deterministic hash function (djb2)
 * For fingerprinting only - not cryptographic
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
