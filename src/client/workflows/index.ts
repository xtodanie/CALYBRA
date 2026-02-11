/**
 * Client Workflows - Main exports
 *
 * Action handlers that call Cloud Functions via the orchestration layer.
 */

export {
  executeFileIngestion,
  type FileIngestionInput,
  type FileIngestionResult,
} from "./ingestFile.action";

export {
  executeParseFile,
  type ParseFileInput,
  type ParseFileResult,
} from "./parseFile.action";

export {
  executeRunMatching,
  executeConfirmMatch,
  executeRejectMatch,
  type RunMatchingInput,
  type ConfirmMatchInput,
  type RunMatchingResult,
  type ConfirmMatchResult,
} from "./match.action";

export {
  executeCreateInvoiceFromParse,
  executeCreateInvoiceManual,
  type CreateInvoiceFromParseInput,
  type CreateInvoiceManualInput,
  type CreateInvoiceResult,
} from "./createInvoice.action";

export {
  executeCreateMonthClose,
  executeSubmitForReview,
  executeReturnToDraft,
  executeFinalizeMonth,
  executeComputeAggregates,
  type CreateMonthCloseInput,
  type TransitionMonthCloseInput,
  type CreateMonthCloseResult,
  type TransitionMonthCloseResult,
  type ComputeAggregatesResult,
} from "./monthClose.action";
