/**
 * Invoice Data Extraction
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: Extraction produces DATA, not decisions
 * INVARIANT: Confidence scores reflect extraction quality
 */

/**
 * Parsed document structure
 */
export interface ParsedDocument {
  readonly type: "BANK_STATEMENT" | "INVOICE";
  readonly monetaryLines: readonly MonetaryLine[];
  readonly parties: readonly PartyInfo[];
  readonly dates: readonly DateInfo[];
  readonly rawLines: readonly unknown[];
  readonly invoiceData?: ExtractedInvoice;
}

export interface MonetaryLine {
  readonly amount: number;
  readonly date: string;
  readonly description: string;
  readonly reference?: string;
}

export interface PartyInfo {
  readonly name: string;
  readonly role: string;
}

export interface DateInfo {
  readonly date: string;
  readonly type: string;
}

/**
 * Extracted invoice data structure
 */
export interface ExtractedInvoice {
  readonly invoiceNumber: string | null;
  readonly supplierName: string | null;
  readonly issueDate: string | null;
  readonly dueDate: string | null;
  readonly totalGross: number | null;
  readonly totalNet: number | null;
  readonly vatAmount: number | null;
  readonly vatRate: number | null;
  readonly lines: readonly InvoiceLine[];
  readonly confidence: ExtractionConfidence;
}

export interface InvoiceLine {
  readonly amount: number;
  readonly date: string;
  readonly description: string;
  readonly reference?: string;
}

export interface ExtractionConfidence {
  readonly overall: number; // 0-100
  readonly invoiceNumber: number;
  readonly supplierName: number;
  readonly totalGross: number;
  readonly dates: number;
}

/**
 * Extracts invoice data from text content
 *
 * @param text - The extracted text from invoice (OCR or PDF text layer)
 * @returns ExtractedInvoice with confidence scores
 */
export function extractInvoiceData(text: string): ExtractedInvoice {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const invoiceNumber = extractInvoiceNumber(lines);
  const supplierName = extractSupplierName(lines);
  const issueDate = extractDate(lines, ["fecha", "date", "issued", "invoice date"]);
  const dueDate = extractDate(lines, ["vencimiento", "due", "payment due"]);
  const amounts = extractAmounts(lines);
  const vatInfo = extractVatInfo(lines, amounts);

  const confidence = calculateConfidence({
    invoiceNumber,
    supplierName,
    totalGross: amounts.gross,
    issueDate,
  });

  return {
    invoiceNumber: invoiceNumber.value,
    supplierName: supplierName.value,
    issueDate: issueDate.value,
    dueDate: dueDate.value,
    totalGross: amounts.gross,
    totalNet: amounts.net,
    vatAmount: vatInfo.amount,
    vatRate: vatInfo.rate,
    lines: buildMonetaryLines(amounts),
    confidence,
  };
}

// ============================================================================
// EXTRACTION HELPERS
// ============================================================================

interface ExtractionResult<T> {
  value: T | null;
  confidence: number;
}

/**
 * Extracts invoice number using common patterns
 */
function extractInvoiceNumber(lines: string[]): ExtractionResult<string> {
  const patterns = [
    /(?:invoice|factura|inv|no\.?|número|number)[\s:#]*([A-Z0-9\-\/]+)/i,
    /^([A-Z]{2,3}[\-\/]?\d{4,})/,
    /(\d{4,}[\-\/][A-Z0-9]+)/,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return { value: match[1].trim(), confidence: 90 };
      }
    }
  }

  // Try to find any alphanumeric sequence that looks like an invoice number
  for (const line of lines) {
    const match = line.match(/([A-Z]{1,3}\d{5,}|\d{5,}[A-Z]{1,3})/);
    if (match) {
      return { value: match[1], confidence: 60 };
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * Extracts supplier name from first lines (usually header)
 */
function extractSupplierName(lines: string[]): ExtractionResult<string> {
  // Supplier name is typically in the first few lines
  const headerLines = lines.slice(0, 5);

  // Skip common non-supplier patterns
  const skipPatterns = [
    /^(invoice|factura|fecha|date|total|iva|vat|tax)/i,
    /^\d+[\.\-\/]/,
    /^[A-Z]?\d{4,}/,
  ];

  for (const line of headerLines) {
    if (line.length < 3 || line.length > 100) continue;
    if (skipPatterns.some((p) => p.test(line))) continue;

    // Looks like a company name
    if (/^[A-Z][a-zA-Z\s&,\.]+$/.test(line) || /\b(S\.?L\.?|S\.?A\.?|Inc\.?|Ltd\.?|LLC|GmbH)\b/i.test(line)) {
      return { value: line, confidence: 85 };
    }
  }

  // Fallback: first non-numeric line
  for (const line of headerLines) {
    if (!/^\d/.test(line) && line.length >= 5 && line.length <= 60) {
      return { value: line, confidence: 50 };
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * Extracts a date based on keywords
 */
function extractDate(lines: string[], keywords: string[]): ExtractionResult<string> {
  const datePatterns = [
    /(\d{4}[\-\/]\d{2}[\-\/]\d{2})/, // YYYY-MM-DD
    /(\d{2}[\-\/]\d{2}[\-\/]\d{4})/, // DD-MM-YYYY or MM-DD-YYYY
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})/i,
  ];

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    if (keywords.some((k) => lineLower.includes(k))) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          const normalized = normalizeDate(match[1]);
          if (normalized) {
            return { value: normalized, confidence: 90 };
          }
        }
      }
    }
  }

  // Try to find any date
  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        const normalized = normalizeDate(match[1]);
        if (normalized) {
          return { value: normalized, confidence: 60 };
        }
      }
    }
  }

  return { value: null, confidence: 0 };
}

/**
 * Extracts monetary amounts
 */
function extractAmounts(lines: string[]): { gross: number | null; net: number | null } {
  const amounts: number[] = [];

  // Common amount patterns
  const amountPattern = /[\$€£]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/g;

  for (const line of lines) {
    let match;
    while ((match = amountPattern.exec(line)) !== null) {
      const amount = parseAmount(match[1]);
      if (amount !== null && amount > 0) {
        amounts.push(amount);
      }
    }
  }

  if (amounts.length === 0) {
    return { gross: null, net: null };
  }

  // Largest amount is typically the gross total
  amounts.sort((a, b) => b - a);
  const gross = amounts[0];

  // Try to find net (second largest, or infer from VAT)
  const net = amounts.length > 1 ? amounts[1] : null;

  return { gross, net };
}

/**
 * Extracts VAT information
 */
function extractVatInfo(
  lines: string[],
  amounts: { gross: number | null; net: number | null }
): { amount: number | null; rate: number | null } {
  // Look for explicit VAT patterns
  const vatPatterns = [
    /(?:iva|vat|tax|impuesto)[\s:]*(\d+(?:[.,]\d+)?)\s*%/i,
    /(\d+(?:[.,]\d+)?)\s*%\s*(?:iva|vat|tax)/i,
  ];

  let rate: number | null = null;

  for (const line of lines) {
    for (const pattern of vatPatterns) {
      const match = line.match(pattern);
      if (match) {
        rate = parseFloat(match[1].replace(",", "."));
        break;
      }
    }
    if (rate !== null) break;
  }

  // Calculate VAT amount if we have gross and net
  let amount: number | null = null;
  if (amounts.gross !== null && amounts.net !== null) {
    amount = Math.round((amounts.gross - amounts.net) * 100) / 100;
  } else if (rate !== null && amounts.gross !== null) {
    // Derive VAT from gross and rate
    const divisor = 1 + rate / 100;
    const net = amounts.gross / divisor;
    amount = Math.round((amounts.gross - net) * 100) / 100;
  }

  return { amount, rate };
}

/**
 * Normalizes a date string to YYYY-MM-DD
 */
function normalizeDate(dateStr: string): string | null {
  // Try YYYY-MM-DD
  let match = dateStr.match(/^(\d{4})[\-\/](\d{2})[\-\/](\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  // Try DD-MM-YYYY or DD/MM/YYYY
  match = dateStr.match(/^(\d{2})[\-\/](\d{2})[\-\/](\d{4})$/);
  if (match) {
    // Assume DD-MM-YYYY (European format)
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  // Try written date
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  match = dateStr.toLowerCase().match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = months[match[2]];
    return `${match[3]}-${month}-${day}`;
  }

  return null;
}

/**
 * Parses an amount string to number
 */
function parseAmount(amountStr: string): number | null {
  // Handle European format (1.234,56) vs US format (1,234.56)
  let normalized = amountStr.trim();

  // Count separators to determine format
  const dots = (normalized.match(/\./g) || []).length;
  const commas = (normalized.match(/,/g) || []).length;

  if (dots === 1 && commas === 0) {
    // US format or decimal only: 1234.56
    // Keep as is
  } else if (commas === 1 && dots === 0) {
    // European decimal: 1234,56
    normalized = normalized.replace(",", ".");
  } else if (dots > 0 && commas === 1) {
    // European thousands: 1.234,56
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (commas > 0 && dots === 1) {
    // US thousands: 1,234.56
    normalized = normalized.replace(/,/g, "");
  }

  const value = parseFloat(normalized);
  return isNaN(value) ? null : value;
}

/**
 * Calculates overall confidence score
 */
function calculateConfidence(extracted: {
  invoiceNumber: ExtractionResult<string | null>;
  supplierName: ExtractionResult<string | null>;
  totalGross: number | null;
  issueDate: ExtractionResult<string | null>;
}): ExtractionConfidence {
  const invoiceNumberConf = extracted.invoiceNumber.value ? extracted.invoiceNumber.confidence : 0;
  const supplierNameConf = extracted.supplierName.value ? extracted.supplierName.confidence : 0;
  const totalGrossConf = extracted.totalGross !== null ? 85 : 0;
  const datesConf = extracted.issueDate.value ? extracted.issueDate.confidence : 0;

  // Weighted average
  const overall = Math.round(
    (invoiceNumberConf * 0.3 + supplierNameConf * 0.2 + totalGrossConf * 0.35 + datesConf * 0.15)
  );

  return {
    overall,
    invoiceNumber: invoiceNumberConf,
    supplierName: supplierNameConf,
    totalGross: totalGrossConf,
    dates: datesConf,
  };
}

/**
 * Builds monetary lines from extracted amounts
 */
function buildMonetaryLines(amounts: { gross: number | null; net: number | null }): InvoiceLine[] {
  const lines: InvoiceLine[] = [];

  if (amounts.gross !== null) {
    lines.push({
      amount: amounts.gross,
      date: "", // Will be filled by caller
      description: "Total Gross",
    });
  }

  if (amounts.net !== null) {
    lines.push({
      amount: amounts.net,
      date: "",
      description: "Total Net",
    });
  }

  return lines;
}
