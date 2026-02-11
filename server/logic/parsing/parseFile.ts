/**
 * File Parsing - Main entry point
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: Parsing produces DATA, not decisions
 * INVARIANT: Parsing is purely repeatable and deterministic
 */

import { ParsedDocument } from "./extractInvoiceData";
import { extractBankTransactions, BankTxLine } from "./extractBankTx";
import { extractInvoiceData } from "./extractInvoiceData";

/**
 * File types that can be parsed
 */
export const FILE_TYPES = ["BANK_CSV", "INVOICE_PDF"] as const;
export type FileType = (typeof FILE_TYPES)[number];

/**
 * Result of parsing a file
 */
export type ParseResult =
  | ParseSuccess
  | ParseFailure;

export interface ParseSuccess {
  readonly success: true;
  readonly fileType: FileType;
  readonly document: ParsedDocument;
}

export interface ParseFailure {
  readonly success: false;
  readonly fileType: FileType;
  readonly error: string;
  readonly errorCode: ParseErrorCode;
}

/**
 * Error codes for parse failures
 */
export const PARSE_ERROR_CODES = [
  "INVALID_FORMAT",
  "EMPTY_FILE",
  "ENCODING_ERROR",
  "MISSING_REQUIRED_COLUMNS",
  "MALFORMED_DATA",
  "UNSUPPORTED_FILE_TYPE",
] as const;
export type ParseErrorCode = (typeof PARSE_ERROR_CODES)[number];

/**
 * Parses a file based on its type
 *
 * @param fileType - The type of file to parse
 * @param content - The raw file content as string
 * @returns ParseResult with extracted data or error
 */
export function parseFile(fileType: FileType, content: string): ParseResult {
  if (!content || content.trim().length === 0) {
    return {
      success: false,
      fileType,
      error: "File is empty",
      errorCode: "EMPTY_FILE",
    };
  }

  switch (fileType) {
    case "BANK_CSV":
      return parseBankCsv(content);

    case "INVOICE_PDF":
      // For PDF, content would be pre-extracted text
      return parseInvoiceText(content);

    default:
      return {
        success: false,
        fileType,
        error: `Unsupported file type: ${fileType}`,
        errorCode: "UNSUPPORTED_FILE_TYPE",
      };
  }
}

/**
 * Parses a bank CSV file
 */
function parseBankCsv(content: string): ParseResult {
  try {
    const transactions = extractBankTransactions(content);

    if (transactions.length === 0) {
      return {
        success: false,
        fileType: "BANK_CSV",
        error: "No valid transactions found in file",
        errorCode: "MALFORMED_DATA",
      };
    }

    return {
      success: true,
      fileType: "BANK_CSV",
      document: {
        type: "BANK_STATEMENT",
        monetaryLines: transactions.map((tx) => ({
          amount: tx.amount,
          date: tx.bookingDate,
          description: tx.description,
          reference: tx.reference ?? undefined,
        })),
        parties: extractPartiesFromTransactions(transactions),
        dates: extractDatesFromTransactions(transactions),
        rawLines: transactions,
      },
    };
  } catch (err) {
    return {
      success: false,
      fileType: "BANK_CSV",
      error: err instanceof Error ? err.message : "Unknown parsing error",
      errorCode: "MALFORMED_DATA",
    };
  }
}

/**
 * Parses invoice text (from OCR or PDF extraction)
 */
function parseInvoiceText(content: string): ParseResult {
  try {
    const invoiceData = extractInvoiceData(content);

    if (!invoiceData.invoiceNumber || !invoiceData.totalGross) {
      return {
        success: false,
        fileType: "INVOICE_PDF",
        error: "Could not extract required invoice fields",
        errorCode: "MALFORMED_DATA",
      };
    }

    return {
      success: true,
      fileType: "INVOICE_PDF",
      document: {
        type: "INVOICE",
        monetaryLines: invoiceData.lines,
        parties: invoiceData.supplierName ? [{ name: invoiceData.supplierName, role: "SUPPLIER" }] : [],
        dates: invoiceData.issueDate ? [{ date: invoiceData.issueDate, type: "ISSUE" }] : [],
        rawLines: [],
        invoiceData,
      },
    };
  } catch (err) {
    return {
      success: false,
      fileType: "INVOICE_PDF",
      error: err instanceof Error ? err.message : "Unknown parsing error",
      errorCode: "MALFORMED_DATA",
    };
  }
}

/**
 * Extracts unique party names from transactions
 */
function extractPartiesFromTransactions(
  transactions: BankTxLine[]
): Array<{ name: string; role: string }> {
  const seen = new Set<string>();
  const parties: Array<{ name: string; role: string }> = [];

  for (const tx of transactions) {
    if (tx.counterparty && !seen.has(tx.counterparty)) {
      seen.add(tx.counterparty);
      parties.push({ name: tx.counterparty, role: "COUNTERPARTY" });
    }
  }

  return parties;
}

/**
 * Extracts unique dates from transactions
 */
function extractDatesFromTransactions(
  transactions: BankTxLine[]
): Array<{ date: string; type: string }> {
  const seen = new Set<string>();
  const dates: Array<{ date: string; type: string }> = [];

  for (const tx of transactions) {
    if (!seen.has(tx.bookingDate)) {
      seen.add(tx.bookingDate);
      dates.push({ date: tx.bookingDate, type: "BOOKING" });
    }
  }

  return dates.sort((a, b) => a.date.localeCompare(b.date));
}
