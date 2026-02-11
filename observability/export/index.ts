/**
 * Export Module Index
 *
 * Industry-standard export formats for observability data
 */

export {
  // Semantic conventions
  SemanticAttributes,

  // Types
  type OTelSpan,
  type OTelSpanKind,
  type OTelAttribute,
  type OTelAnyValue,
  type OTelSpanEvent,
  type OTelStatus,
  type OTelResource,
  type OTelLogRecord,
  type OTelExportBatch,

  // Converters
  spanToOtel,
  logToOtel,
  createExportBatch,
  exportToOtlp,
} from "./otel";
