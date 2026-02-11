/**
 * Event domain - authoritative business events
 * Pure types and helpers. No IO, no randomness, no time.
 */

import { CurrencyCode } from "./money";

export const EVENT_TYPES = [
  "BANK_TX_ARRIVED",
  "INVOICE_CREATED",
  "INVOICE_UPDATED",
  "MATCH_RESOLVED",
  "ADJUSTMENT_POSTED",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface EventBase {
  readonly id: string;
  readonly tenantId: string;
  readonly type: EventType;
  readonly occurredAt: string; // ISO timestamp (date portion in tenant timezone)
  readonly recordedAt: string; // ISO timestamp (date portion in tenant timezone)
  readonly monthKey: string; // YYYY-MM
  readonly deterministicId: string; // Idempotency key
  readonly schemaVersion: 1;
}

export interface BankTxArrivedPayload {
  readonly txId: string;
  readonly bookingDate: string; // YYYY-MM-DD
  readonly amountCents: number; // signed
  readonly currency: CurrencyCode | string;
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
  readonly currency: CurrencyCode | string;
  readonly direction?: "SALES" | "EXPENSE"; // default EXPENSE when omitted
}

export interface InvoiceUpdatedPayload {
  readonly invoiceId: string;
  readonly issueDate: string; // YYYY-MM-DD
  readonly invoiceNumber: string;
  readonly supplierNameRaw: string;
  readonly totalGrossCents: number;
  readonly vatRatePercent: number; // 0-100
  readonly currency: CurrencyCode | string;
  readonly direction?: "SALES" | "EXPENSE"; // default EXPENSE when omitted
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
  readonly currency: CurrencyCode | string;
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

export function compareEvents(a: Event, b: Event): number {
  const occurredCompare = a.occurredAt.localeCompare(b.occurredAt);
  if (occurredCompare !== 0) return occurredCompare;
  return a.deterministicId.localeCompare(b.deterministicId);
}

export function sortEvents(events: readonly Event[]): Event[] {
  return [...events].sort(compareEvents);
}

export function dateKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const base = new Date(Date.UTC(year, month - 1, day));
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}
