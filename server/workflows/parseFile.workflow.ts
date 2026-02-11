/**
 * Parse File Workflow
 * Orchestration layer. Calls logic + persistence + state machine.
 *
 * STEP 2 — Parsing
 * - Read file content
 * - Extract structured facts (amounts, dates, counterparties)
 * - Store parsed data
 * - Update file parseStatus
 *
 * INVARIANT: Parsing produces DATA, not decisions
 * INVARIANT: NO matching, NO writing invoices, NO aggregation
 * INVARIANT: Parsing is purely repeatable and deterministic
 */

import { Firestore } from "firebase-admin/firestore";
import { WriteContext, updateFileAsset, createBankTxBatch, CreateBankTxInput } from "../persistence/write";
import { readFileAsset, findBankTxByFingerprint } from "../persistence/read";
import { parseFile, FileType } from "../logic/parsing/parseFile";
import { BankTxLine } from "../logic/parsing/extractBankTx";
import { assertFileAssetNotTerminal, assertParseTransition, ParseStatus, FileAssetStatus } from "../state/statusMachine";

/**
 * Input for file parsing workflow
 */
export interface ParseFileInput {
  readonly tenantId: string;
  readonly fileId: string;
  readonly fileContent: string; // Raw file content or pre-extracted text
}

/**
 * Result of file parsing
 */
export interface ParseFileResult {
  readonly success: true;
  readonly fileId: string;
  readonly parseStatus: string;
  readonly linesExtracted: number;
  readonly duplicatesSkipped: number;
}

/**
 * Error from file parsing
 */
export interface ParseFileError {
  readonly success: false;
  readonly code: string;
  readonly message: string;
}

export type ParseFileOutcome = ParseFileResult | ParseFileError;

/**
 * Parses a file and stores extracted data
 *
 * @param db - Firestore instance
 * @param ctx - Write context with actor and timestamp
 * @param input - Parse input with file content
 * @returns ParseFileOutcome
 */
export async function parseFileWorkflow(
  db: Firestore,
  ctx: WriteContext,
  input: ParseFileInput
): Promise<ParseFileOutcome> {
  // Validate input
  if (!input.tenantId || !input.fileId) {
    return { success: false, code: "INVALID_INPUT", message: "tenantId and fileId are required" };
  }

  // Read file metadata
  const file = await readFileAsset(db, input.tenantId, input.fileId);
  if (!file) {
    return { success: false, code: "NOT_FOUND", message: `File ${input.fileId} not found` };
  }

  // Validate file state
  try {
    assertFileAssetNotTerminal(file.status as FileAssetStatus);
  } catch (err) {
    return {
      success: false,
      code: "INVALID_STATE",
      message: err instanceof Error ? err.message : "File is in terminal state",
    };
  }

  // Validate parse status transition
  const currentParseStatus = (file.parseStatus || "PENDING") as ParseStatus;
  try {
    assertParseTransition(currentParseStatus, "PARSED");
  } catch {
    // If can't transition to PARSED, might need retry from FAILED
    if (currentParseStatus !== "PENDING" && currentParseStatus !== "FAILED") {
      return {
        success: false,
        code: "INVALID_STATE",
        message: `Cannot parse file in parseStatus: ${currentParseStatus}`,
      };
    }
  }

  // Determine file type from kind
  const fileType = mapKindToFileType(file.kind);
  if (!fileType) {
    // Mark as failed
    await updateFileAsset(db, ctx, input.tenantId, input.fileId, {
      parseStatus: "FAILED",
      parseError: `Unsupported file kind: ${file.kind}`,
    });

    return {
      success: false,
      code: "UNSUPPORTED_TYPE",
      message: `Unsupported file kind: ${file.kind}`,
    };
  }

  // Parse the file
  const parseResult = parseFile(fileType, input.fileContent);

  if (!parseResult.success) {
    // Mark as failed
    await updateFileAsset(db, ctx, input.tenantId, input.fileId, {
      parseStatus: "FAILED",
      parseError: parseResult.error,
    });

    return {
      success: false,
      code: parseResult.errorCode,
      message: parseResult.error,
    };
  }

  // Store extracted data based on file type
  let linesExtracted = 0;
  let duplicatesSkipped = 0;

  if (fileType === "BANK_CSV") {
    const result = await storeBankTransactions(
      db,
      ctx,
      input.tenantId,
      file.monthCloseId,
      input.fileId,
      parseResult.document.rawLines as BankTxLine[]
    );
    linesExtracted = result.inserted;
    duplicatesSkipped = result.duplicates;
  }

  // Note: Invoice parsing stores data differently (typically creates single invoice)
  // For PDF invoices, we extract data but don't persist here - that's invoiceCreate workflow

  // Mark as parsed
  await updateFileAsset(db, ctx, input.tenantId, input.fileId, {
    parseStatus: "PARSED",
    parseError: null,
    parsedAt: ctx.now,
    parsedBy: ctx.actorId,
  });

  return {
    success: true,
    fileId: input.fileId,
    parseStatus: "PARSED",
    linesExtracted,
    duplicatesSkipped,
  };
}

/**
 * Stores extracted bank transactions
 */
async function storeBankTransactions(
  db: Firestore,
  ctx: WriteContext,
  tenantId: string,
  monthCloseId: string,
  sourceFileId: string,
  lines: BankTxLine[]
): Promise<{ inserted: number; duplicates: number }> {
  const toInsert: CreateBankTxInput[] = [];
  let duplicates = 0;

  for (const line of lines) {
    // Generate fingerprint for duplicate detection
    const fingerprint = generateFingerprint(line);

    // Check for existing transaction with same fingerprint
    const existing = await findBankTxByFingerprint(db, tenantId, monthCloseId, fingerprint);
    if (existing) {
      duplicates++;
      continue;
    }

    toInsert.push({
      id: generateTransactionId(sourceFileId, line.rowIndex),
      tenantId,
      monthCloseId,
      bookingDate: line.bookingDate,
      amount: line.amount,
      descriptionRaw: line.description,
      fingerprint,
      sourceFileId,
      counterpartyRaw: line.counterparty ?? undefined,
      referenceRaw: line.reference ?? undefined,
    });
  }

  if (toInsert.length > 0) {
    await createBankTxBatch(db, ctx, toInsert);
  }

  return { inserted: toInsert.length, duplicates };
}

/**
 * Maps file kind to parseable file type
 */
function mapKindToFileType(kind: string): FileType | null {
  switch (kind) {
    case "BANK_CSV":
      return "BANK_CSV";
    case "INVOICE_PDF":
      return "INVOICE_PDF";
    default:
      return null;
  }
}

/**
 * Generates a deterministic fingerprint for duplicate detection
 */
function generateFingerprint(line: BankTxLine): string {
  const data = [
    line.bookingDate,
    line.amount.toFixed(2),
    normalizeDescription(line.description),
  ].join("|");

  return simpleHash(data);
}

/**
 * Generates a deterministic transaction ID
 */
function generateTransactionId(fileId: string, rowIndex: number): string {
  return `${fileId}_${rowIndex.toString().padStart(6, "0")}`;
}

/**
 * Normalizes description for fingerprinting
 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple hash function (djb2)
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
