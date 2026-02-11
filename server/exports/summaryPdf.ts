/**
 * Summary PDF Export - deterministic PDF generator
 * Pure logic. No IO, no randomness, no time.
 */

import { Result, ok, err } from "../logic/errors/normalizeError";
import { BusinessErrorCode, createBusinessError } from "../logic/errors/businessErrors";
import { CurrencyCode } from "../domain/money";

export interface SummaryPdfInput {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly monthKey: string;
  readonly currency: CurrencyCode;
  readonly revenueCents: number;
  readonly expenseCents: number;
  readonly vatCents: number;
  readonly netVatCents: number;
  readonly unmatchedCount: number;
  readonly mismatchBankTxCount: number;
  readonly mismatchInvoiceCount: number;
  readonly finalAccuracyStatement: string;
  readonly varianceResolvedStatement: string;
  readonly generatedAt: string; // ISO
}

export interface SummaryPdfResult {
  readonly filename: string;
  readonly content: Uint8Array;
}

export function generateSummaryPdf(
  input: SummaryPdfInput
): Result<SummaryPdfResult> {
  if (!input.tenantId || !input.monthKey) {
    return err(
      createBusinessError(BusinessErrorCode.MISSING_REQUIRED_FIELD, {
        message: "tenantId and monthKey are required",
      })
    );
  }

  const lines = [
    "Calybra Month Summary",
    `Tenant: ${input.tenantName}`,
    `Month: ${input.monthKey}`,
    `Currency: ${input.currency}`,
    `Generated: ${input.generatedAt}`,
    "",
    `Revenue: ${formatCents(input.revenueCents)}`,
    `Expenses: ${formatCents(input.expenseCents)}`,
    `VAT Total: ${formatCents(input.vatCents)}`,
    `Net VAT: ${formatCents(input.netVatCents)}`,
    `Unmatched Count: ${input.unmatchedCount}`,
    `Bank Tx Mismatches: ${input.mismatchBankTxCount}`,
    `Invoice Mismatches: ${input.mismatchInvoiceCount}`,
    "",
    input.finalAccuracyStatement,
    input.varianceResolvedStatement,
  ];

  const pdfContent = createSimplePdf(lines);
  const filename = `summary_${input.monthKey}_${input.tenantId}.pdf`;

  return ok({
    filename,
    content: pdfContent,
  });
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const euros = Math.floor(absolute / 100);
  const remainder = (absolute % 100).toString().padStart(2, "0");
  return `${sign}${euros}.${remainder}`;
}

function createSimplePdf(lines: readonly string[]): Uint8Array {
  const header = "%PDF-1.4\n";
  const objects: string[] = [];

  const catalog = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const pages = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";

  const contentStream = buildContentStream(lines);
  const contentLength = Buffer.byteLength(contentStream, "utf8");
  const page = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";
  const contents = `4 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
  const font = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

  objects.push(catalog, pages, page, contents, font);

  let offset = header.length;
  const xrefOffsets = [0];
  for (const obj of objects) {
    xrefOffsets.push(offset);
    offset += obj.length;
  }

  let body = header + objects.join("");
  const xrefStart = body.length;

  const xrefLines = ["xref", `0 ${xrefOffsets.length}`];
  xrefLines.push("0000000000 65535 f ");
  for (let i = 1; i < xrefOffsets.length; i += 1) {
    xrefLines.push(`${xrefOffsets[i].toString().padStart(10, "0")} 00000 n `);
  }

  const trailer = [
    "trailer",
    `<< /Size ${xrefOffsets.length} /Root 1 0 R >>`,
    "startxref",
    `${xrefStart}`,
    "%%EOF\n",
  ];

  body += xrefLines.join("\n") + "\n" + trailer.join("\n");

  return new Uint8Array(Buffer.from(body, "utf8"));
}

function buildContentStream(lines: readonly string[]): string {
  const fontSize = 12;
  const startX = 72;
  const startY = 740;
  const lineHeight = 16;

  const contentLines = [
    "BT",
    `/F1 ${fontSize} Tf`,
    `${startX} ${startY} Td`,
  ];

  for (let i = 0; i < lines.length; i += 1) {
    const line = escapePdfText(lines[i]);
    if (i === 0) {
      contentLines.push(`(${line}) Tj`);
    } else {
      contentLines.push(`0 -${lineHeight} Td`);
      contentLines.push(`(${line}) Tj`);
    }
  }

  contentLines.push("ET");
  return contentLines.join("\n");
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
