/**
 * Bank Transaction Extraction
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: Extraction is deterministic
 * INVARIANT: Same input always produces same output
 */

/**
 * Extracted bank transaction line
 */
export interface BankTxLine {
  readonly rowIndex: number;
  readonly bookingDate: string; // YYYY-MM-DD
  readonly amount: number;
  readonly description: string;
  readonly counterparty: string | null;
  readonly reference: string | null;
}

/**
 * Column mapping for CSV parsing
 */
export interface ColumnMapping {
  readonly date: number;
  readonly amount: number;
  readonly description: number;
  readonly counterparty?: number;
  readonly reference?: number;
}

/**
 * Known bank CSV formats
 */
export const KNOWN_FORMATS: Record<string, ColumnMapping> = {
  // Generic format: Date, Description, Amount
  GENERIC: { date: 0, description: 1, amount: 2 },

  // BBVA Spain format
  BBVA_ES: { date: 0, description: 2, amount: 3, counterparty: 4 },

  // Santander format
  SANTANDER: { date: 0, description: 1, amount: 2, reference: 3 },

  // Deutsche Bank format
  DEUTSCHE: { date: 0, counterparty: 1, description: 2, amount: 3 },
} as const;

/**
 * Extracts bank transactions from CSV content
 *
 * @param content - Raw CSV content
 * @returns Array of extracted transaction lines
 */
export function extractBankTransactions(content: string): BankTxLine[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must have at least a header and one data row");
  }

  // Detect delimiter
  const delimiter = detectDelimiter(lines[0]);

  // Parse header and detect format
  const header = parseRow(lines[0], delimiter);
  const mapping = detectColumnMapping(header);

  // Parse data rows
  const transactions: BankTxLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i], delimiter);

    if (row.length < 3) {
      continue; // Skip malformed rows
    }

    try {
      const tx = extractTransaction(row, mapping, i);
      if (tx) {
        transactions.push(tx);
      }
    } catch {
      // Skip invalid rows
      continue;
    }
  }

  return transactions;
}

/**
 * Detects CSV delimiter from header row
 */
function detectDelimiter(header: string): string {
  const delimiters = [",", ";", "\t", "|"];
  let maxCount = 0;
  let detected = ",";

  for (const d of delimiters) {
    const count = (header.match(new RegExp(`\\${d}`, "g")) || []).length;
    if (count > maxCount) {
      maxCount = count;
      detected = d;
    }
  }

  return detected;
}

/**
 * Parses a CSV row respecting quotes
 */
function parseRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Detects column mapping from header
 */
function detectColumnMapping(header: string[]): ColumnMapping {
  const normalized = header.map((h) => h.toLowerCase().trim());

  // Find date column
  const datePatterns = ["date", "fecha", "datum", "booking", "value"];
  const dateCol = findColumnIndex(normalized, datePatterns);

  // Find amount column
  const amountPatterns = ["amount", "importe", "betrag", "monto", "valor", "debit", "credit"];
  const amountCol = findColumnIndex(normalized, amountPatterns);

  // Find description column
  const descPatterns = ["description", "concepto", "beschreibung", "detail", "narrative"];
  const descCol = findColumnIndex(normalized, descPatterns);

  // Find counterparty column (optional)
  const counterpartyPatterns = ["counterparty", "beneficiary", "ordenante", "empfänger", "payee"];
  const counterpartyCol = findColumnIndex(normalized, counterpartyPatterns);

  // Find reference column (optional)
  const refPatterns = ["reference", "referencia", "referenz", "ref"];
  const refCol = findColumnIndex(normalized, refPatterns);

  // Validate required columns
  if (dateCol === -1) {
    throw new Error("Cannot detect date column in CSV header");
  }
  if (amountCol === -1) {
    throw new Error("Cannot detect amount column in CSV header");
  }
  if (descCol === -1) {
    throw new Error("Cannot detect description column in CSV header");
  }

  const mapping: ColumnMapping = {
    date: dateCol,
    amount: amountCol,
    description: descCol,
  };

  if (counterpartyCol !== -1) {
    (mapping as { counterparty: number }).counterparty = counterpartyCol;
  }
  if (refCol !== -1) {
    (mapping as { reference: number }).reference = refCol;
  }

  return mapping;
}

/**
 * Finds column index matching any of the patterns
 */
function findColumnIndex(headers: string[], patterns: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    for (const pattern of patterns) {
      if (header.includes(pattern)) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Extracts a single transaction from a row
 */
function extractTransaction(
  row: string[],
  mapping: ColumnMapping,
  rowIndex: number
): BankTxLine | null {
  const dateStr = row[mapping.date];
  const amountStr = row[mapping.amount];
  const description = row[mapping.description];

  if (!dateStr || !amountStr || !description) {
    return null;
  }

  const bookingDate = parseDate(dateStr);
  const amount = parseAmount(amountStr);

  if (!bookingDate || amount === null) {
    return null;
  }

  return {
    rowIndex,
    bookingDate,
    amount,
    description: description.trim(),
    counterparty: mapping.counterparty !== undefined ? (row[mapping.counterparty]?.trim() || null) : null,
    reference: mapping.reference !== undefined ? (row[mapping.reference]?.trim() || null) : null,
  };
}

/**
 * Parses date string to YYYY-MM-DD
 */
function parseDate(dateStr: string): string | null {
  const str = dateStr.trim();

  // YYYY-MM-DD
  let match = str.match(/^(\d{4})[\-\/](\d{2})[\-\/](\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  match = str.match(/^(\d{2})[\-\/](\d{2})[\-\/](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  // DD.MM.YYYY (German format)
  match = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return null;
}

/**
 * Parses amount string to number
 */
function parseAmount(amountStr: string): number | null {
  let str = amountStr.trim();

  // Remove currency symbols
  str = str.replace(/[\$€£¥]/g, "");

  // Handle negative indicators
  const isNegative = str.includes("-") || str.includes("(") || str.toLowerCase().includes("dr");
  str = str.replace(/[\-\(\)]/g, "").replace(/dr/gi, "").trim();

  // Handle European vs US format
  const dots = (str.match(/\./g) || []).length;
  const commas = (str.match(/,/g) || []).length;

  if (dots === 1 && commas === 0) {
    // US decimal: 1234.56
  } else if (commas === 1 && dots === 0) {
    // European decimal: 1234,56
    str = str.replace(",", ".");
  } else if (dots > 0 && commas === 1) {
    // European thousands: 1.234,56
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (commas > 0 && dots === 1) {
    // US thousands: 1,234.56
    str = str.replace(/,/g, "");
  } else if (commas > 0 && dots === 0) {
    // Multiple commas = thousands separators
    str = str.replace(/,/g, "");
  }

  const value = parseFloat(str);
  if (isNaN(value)) {
    return null;
  }

  return isNegative ? -Math.abs(value) : value;
}
