/**
 * Client Orchestration - Main exports
 *
 * This module provides the orchestration layer for mapping user intents
 * to workflow executions with guards, progress tracking, and error handling.
 */

// Intent system
export {
  type UserIntent,
  type UploadFileIntent,
  type RequestParseIntent,
  type RequestMatchIntent,
  type ConfirmMatchIntent,
  type RejectMatchIntent,
  type CreateInvoiceIntent,
  type SubmitForReviewIntent,
  type FinalizeMonthIntent,
  createUploadFileIntent,
  createRequestParseIntent,
  createRequestMatchIntent,
  createConfirmMatchIntent,
  createRejectMatchIntent,
  createSubmitForReviewIntent,
  createFinalizeMonthIntent,
} from "./intent";

// Guards
export { guardIntent, type GuardResult } from "./guards";
