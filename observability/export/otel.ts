/**
 * OpenTelemetry Export - Industry-standard telemetry format
 *
 * INVARIANT: Export format is compatible with OTEL collectors
 * INVARIANT: Exports never block or fail business logic
 * INVARIANT: All semantic conventions follow OTEL standards
 *
 * This enables integration with: Datadog, Honeycomb, Jaeger, Zipkin,
 * New Relic, Grafana Tempo, AWS X-Ray, Azure Monitor, etc.
 */

import { Span, SpanEvent } from "../tracing/tracer";
import { TraceContext } from "../context/traceContext";
import { LogEntry } from "../logging/logSchema";

// ============================================================================
// OTEL SEMANTIC CONVENTIONS
// ============================================================================

/**
 * Standard attribute names following OTEL semantic conventions
 * https://opentelemetry.io/docs/specs/semconv/
 */
export const SemanticAttributes = {
  // Service
  SERVICE_NAME: "service.name",
  SERVICE_VERSION: "service.version",
  SERVICE_INSTANCE_ID: "service.instance.id",

  // HTTP
  HTTP_METHOD: "http.method",
  HTTP_URL: "http.url",
  HTTP_STATUS_CODE: "http.status_code",
  HTTP_ROUTE: "http.route",

  // Database
  DB_SYSTEM: "db.system",
  DB_NAME: "db.name",
  DB_OPERATION: "db.operation",
  DB_STATEMENT: "db.statement",

  // Messaging
  MESSAGING_SYSTEM: "messaging.system",
  MESSAGING_OPERATION: "messaging.operation",
  MESSAGING_DESTINATION: "messaging.destination.name",

  // User/Tenant (custom for multi-tenant SaaS)
  ENDUSER_ID: "enduser.id",
  TENANT_ID: "tenant.id",
  USER_ROLE: "user.role",

  // Error
  EXCEPTION_TYPE: "exception.type",
  EXCEPTION_MESSAGE: "exception.message",
  EXCEPTION_STACKTRACE: "exception.stacktrace",

  // Workflow (custom for Calybra)
  WORKFLOW_TYPE: "calybra.workflow.type",
  WORKFLOW_EXECUTION_ID: "calybra.workflow.execution_id",
  ENTITY_ID: "calybra.entity.id",
  ENTITY_TYPE: "calybra.entity.type",
  TRANSITION_FROM: "calybra.transition.from",
  TRANSITION_TO: "calybra.transition.to",
} as const;

// ============================================================================
// OTEL SPAN FORMAT
// https://opentelemetry.io/docs/specs/otel/trace/api/
// ============================================================================

/**
 * OpenTelemetry-compatible span format
 */
export interface OTelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: OTelSpanKind;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OTelAttribute[];
  events: OTelSpanEvent[];
  status: OTelStatus;
  resource: OTelResource;
}

export type OTelSpanKind = 0 | 1 | 2 | 3 | 4 | 5; // UNSPECIFIED, INTERNAL, SERVER, CLIENT, PRODUCER, CONSUMER

export interface OTelAttribute {
  key: string;
  value: OTelAnyValue;
}

export interface OTelAnyValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OTelAnyValue[] };
}

export interface OTelSpanEvent {
  name: string;
  timeUnixNano: string;
  attributes: OTelAttribute[];
}

export interface OTelStatus {
  code: 0 | 1 | 2; // UNSET, OK, ERROR
  message?: string;
}

export interface OTelResource {
  attributes: OTelAttribute[];
}

// ============================================================================
// OTEL LOG FORMAT
// https://opentelemetry.io/docs/specs/otel/logs/
// ============================================================================

export interface OTelLogRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: OTelAnyValue;
  attributes: OTelAttribute[];
  traceId?: string;
  spanId?: string;
  resource: OTelResource;
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

const NANO_MULTIPLIER = BigInt(1_000_000);

/**
 * Converts milliseconds to nanoseconds string
 */
function msToNanos(ms: number): string {
  return (BigInt(ms) * NANO_MULTIPLIER).toString();
}

/**
 * Converts span kind to OTEL format
 */
function toOtelSpanKind(kind: string): OTelSpanKind {
  const map: Record<string, OTelSpanKind> = {
    INTERNAL: 1,
    SERVER: 2,
    CLIENT: 3,
    PRODUCER: 4,
    CONSUMER: 5,
  };
  return map[kind] ?? 0;
}

/**
 * Converts log level to OTEL severity number
 */
function toOtelSeverity(level: string): number {
  const map: Record<string, number> = {
    DEBUG: 5,
    INFO: 9,
    WARN: 13,
    ERROR: 17,
  };
  return map[level] ?? 9;
}

/**
 * Converts a value to OTEL attribute value
 */
function toOtelValue(value: unknown): OTelAnyValue {
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { intValue: value.toString() }
      : { doubleValue: value };
  }
  if (typeof value === "boolean") {
    return { boolValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toOtelValue) } };
  }
  return { stringValue: String(value) };
}

/**
 * Creates OTEL resource for Calybra
 */
function createResource(context?: { tenantId?: string }): OTelResource {
  const attrs: OTelAttribute[] = [
    { key: SemanticAttributes.SERVICE_NAME, value: { stringValue: "calybra" } },
    { key: SemanticAttributes.SERVICE_VERSION, value: { stringValue: "1.0.0" } },
  ];

  if (context?.tenantId) {
    attrs.push({
      key: SemanticAttributes.TENANT_ID,
      value: { stringValue: context.tenantId },
    });
  }

  return { attributes: attrs };
}

// ============================================================================
// EXPORTERS
// ============================================================================

/**
 * Converts internal span to OTEL format
 */
export function spanToOtel(span: Span, traceContext?: TraceContext): OTelSpan {
  const attributes: OTelAttribute[] = [];

  // Add span attributes
  for (const [key, value] of Object.entries(span.attributes)) {
    attributes.push({ key, value: toOtelValue(value) });
  }

  // Add standard attributes
  if (traceContext?.tenantId) {
    attributes.push({
      key: SemanticAttributes.TENANT_ID,
      value: { stringValue: traceContext.tenantId },
    });
  }

  // Convert events
  const events: OTelSpanEvent[] = span.events.map((e: SpanEvent) => ({
    name: e.name,
    timeUnixNano: msToNanos(e.timestamp),
    attributes: e.attributes
      ? Object.entries(e.attributes).map(([k, v]) => ({
          key: k,
          value: toOtelValue(v),
        }))
      : [],
  }));

  return {
    traceId: span.traceId.replace(/^tr_/, "").padEnd(32, "0"),
    spanId: span.spanId.replace(/^sp_/, "").padEnd(16, "0"),
    parentSpanId: span.parentSpanId?.replace(/^sp_/, "").padEnd(16, "0"),
    name: span.operation,
    kind: toOtelSpanKind(span.kind),
    startTimeUnixNano: msToNanos(span.startTime),
    endTimeUnixNano: msToNanos(span.endTime),
    attributes,
    events,
    status: {
      code: span.status === "OK" ? 1 : span.status === "ERROR" ? 2 : 0,
      message: span.statusMessage,
    },
    resource: createResource({ tenantId: traceContext?.tenantId }),
  };
}

/**
 * Converts log entry to OTEL format
 */
export function logToOtel(log: LogEntry): OTelLogRecord {
  const attributes: OTelAttribute[] = [
    { key: "component", value: { stringValue: log.component } },
    { key: "operation", value: { stringValue: log.operation } },
    { key: "result", value: { stringValue: log.result } },
  ];

  if (log.tenantId) {
    attributes.push({
      key: SemanticAttributes.TENANT_ID,
      value: { stringValue: log.tenantId },
    });
  }

  if (log.workflowExecutionId) {
    attributes.push({
      key: SemanticAttributes.WORKFLOW_EXECUTION_ID,
      value: { stringValue: log.workflowExecutionId },
    });
  }

  if (log.durationMs !== undefined) {
    attributes.push({
      key: "duration_ms",
      value: { intValue: log.durationMs.toString() },
    });
  }

  if (log.error) {
    attributes.push(
      { key: SemanticAttributes.EXCEPTION_TYPE, value: { stringValue: log.error.type } },
      { key: SemanticAttributes.EXCEPTION_MESSAGE, value: { stringValue: log.error.message } }
    );
    if (log.error.stack) {
      attributes.push({
        key: SemanticAttributes.EXCEPTION_STACKTRACE,
        value: { stringValue: log.error.stack },
      });
    }
  }

  return {
    timeUnixNano: msToNanos(new Date(log.timestamp).getTime()),
    severityNumber: toOtelSeverity(log.level),
    severityText: log.level,
    body: { stringValue: log.message },
    attributes,
    traceId: log.traceId?.replace(/^tr_/, "").padEnd(32, "0"),
    resource: createResource({ tenantId: log.tenantId }),
  };
}

// ============================================================================
// BATCH EXPORT
// ============================================================================

export interface OTelExportBatch {
  resourceSpans: Array<{
    resource: OTelResource;
    scopeSpans: Array<{
      scope: { name: string; version: string };
      spans: OTelSpan[];
    }>;
  }>;
  resourceLogs?: Array<{
    resource: OTelResource;
    scopeLogs: Array<{
      scope: { name: string; version: string };
      logRecords: OTelLogRecord[];
    }>;
  }>;
}

/**
 * Creates an OTEL export batch from spans and logs
 */
export function createExportBatch(
  spans: Span[],
  logs: LogEntry[] = [],
  traceContext?: TraceContext
): OTelExportBatch {
  const resource = createResource({ tenantId: traceContext?.tenantId });
  const scope = { name: "calybra-observability", version: "1.0.0" };

  const batch: OTelExportBatch = {
    resourceSpans: [
      {
        resource,
        scopeSpans: [
          {
            scope,
            spans: spans.map((s) => spanToOtel(s, traceContext)),
          },
        ],
      },
    ],
  };

  if (logs.length > 0) {
    batch.resourceLogs = [
      {
        resource,
        scopeLogs: [
          {
            scope,
            logRecords: logs.map(logToOtel),
          },
        ],
      },
    ];
  }

  return batch;
}

/**
 * Exports batch to OTLP HTTP endpoint
 * INVARIANT: Never throws, never blocks
 */
export async function exportToOtlp(
  batch: OTelExportBatch,
  endpoint: string,
  headers?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof fetch !== "function") {
      return { success: false, error: "fetch unavailable" };
    }
    const response = await fetch(`${endpoint}/v1/traces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    // Never throw - observability must not affect business logic
    return { success: false, error: String(error) };
  }
}
