/**
 * Logging Module - Structured logging
 *
 * Exports:
 * - LogEntry types and schema
 * - Logger implementation
 * - BufferedLogger for batch export
 */

export {
  // Log Schema Types
  type LogLevel,
  type LogResult,
  type LogActor,
  type LogError,
  type BaseLogEntry,
  type LogEntry,
  LOG_LEVEL_VALUES,
  // Log Schema Functions
  createLogEntry,
  isValidLogEntry,
  checkForForbiddenPatterns,
} from "./logSchema";

export {
  // Logger Types
  type LoggerConfig,
  type LogSink,
  // Logger Class
  Logger,
  BufferedLogger,
  // Logger Factory Functions
  createLogger,
  createNullLogger,
  createBufferedLogger,
} from "./logger";
