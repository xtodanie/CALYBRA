# Observability & Telemetry Schema

## Purpose

This document defines the schema for all telemetry data produced by the Calybra observability layer. This is the contract for:

- Structured logging
- Metrics and timing
- Distributed tracing
- Status transition observation
- Error telemetry

---

## Fundamental Invariants

1. **Observability is a Shadow**: It watches reality but never alters it.
2. **Non-Blocking**: Telemetry failures NEVER affect business logic.
3. **Read-Only**: No writes that influence business state.
4. **Immutable**: All telemetry records are frozen after creation.
5. **Traceable**: All records include trace context for correlation.

---

## Trace Context Schema

Every operation has a TraceContext that propagates through all layers.

```typescript
interface TraceContext {
  traceId: string;          // Format: tr_{timestamp}_{random} e.g. "tr_lz5f3k_a1b2c3d4e5f6"
  parentSpanId?: string;    // Format: sp_{random} e.g. "sp_a1b2c3d4e5f6"
  createdAt: number;        // Unix timestamp in milliseconds
  entryPoint: TraceEntryPoint;
  tenantId?: string;
  actorId?: string;
  actorType: ActorType;
}

type TraceEntryPoint = 
  | "HTTP_REQUEST"
  | "CALLABLE_FUNCTION"
  | "BACKGROUND_JOB"
  | "TRIGGER"
  | "SCHEDULED"
  | "UNKNOWN";

type ActorType = "USER" | "SERVER" | "SYSTEM";
```

### Propagation Headers

```
x-trace-id: tr_lz5f3k_a1b2c3d4e5f6
x-span-id: sp_a1b2c3d4e5f6
x-tenant-id: tenant-xyz
x-actor-id: user-123
```

---

## Workflow Context Schema

Business workflows have their own context that can span multiple requests.

```typescript
interface WorkflowContext {
  workflowExecutionId: string;  // Format: wf_{type}_{timestamp}_{random}
  workflowType: WorkflowType;
  initiator: WorkflowInitiator;
  tenantId: string;
  entityIds: readonly string[];
  startTime: number;            // Unix timestamp in milliseconds
  endTime?: number;             // Set when workflow completes
  traceContext: TraceContext;
  metadata?: Record<string, unknown>;
}

type WorkflowType =
  | "FILE_UPLOAD"
  | "FILE_PARSE"
  | "MATCHING"
  | "MATCH_CONFIRM"
  | "MATCH_REJECT"
  | "INVOICE_CREATE"
  | "MONTH_CLOSE_TRANSITION"
  | "MONTH_CLOSE_FINALIZE"
  | "BATCH_RECONCILIATION"
  | "UNKNOWN";

type WorkflowInitiator = "USER" | "SERVER" | "SCHEDULED";
```

---

## Structured Log Entry Schema

All logs MUST conform to this schema. Free-form text logs are forbidden.

```typescript
interface LogEntry {
  // Required fields (MANDATORY on every log)
  level: LogLevel;
  timestamp: string;            // ISO 8601 format
  traceId: string;
  actor: LogActor;
  component: string;
  operation: string;
  result: LogResult;
  message: string;

  // Optional fields
  workflowExecutionId?: string;
  tenantId?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
  error?: LogError;
  tags?: readonly string[];
}

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
type LogResult = "SUCCESS" | "FAILURE" | "PARTIAL" | "SKIPPED";

interface LogActor {
  type: "USER" | "SERVER" | "SYSTEM";
  id?: string;
}

interface LogError {
  type: string;
  message: string;
  code?: string;
  stack?: string;   // Sanitized, no secrets
}
```

### Example Log Entry

```json
{
  "level": "INFO",
  "timestamp": "2026-02-11T10:30:00.000Z",
  "traceId": "tr_lz5f3k_a1b2c3d4e5f6",
  "workflowExecutionId": "wf_fileparse_lz5f3m_b2c3d4e5f6g7",
  "tenantId": "tenant-acme",
  "actor": {
    "type": "USER",
    "id": "user-123"
  },
  "component": "FileParser",
  "operation": "parse_bank_csv",
  "result": "SUCCESS",
  "durationMs": 1250,
  "message": "Parsed bank CSV successfully",
  "data": {
    "fileId": "file-xyz",
    "linesExtracted": 150,
    "duplicatesSkipped": 3
  }
}
```

---

## Timing Measurement Schema

```typescript
interface TimingMeasurement {
  id: string;                   // Format: tm_{timestamp}_{counter}
  operation: string;
  durationMs: number;
  startTime: number;
  endTime: number;
  traceId?: string;
  workflowExecutionId?: string;
  labels?: Record<string, string>;
  success: boolean;
}
```

### Timing Statistics

```typescript
interface TimingStats {
  operation: string;
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  successRate: number;
}
```

---

## Span Schema (Distributed Tracing)

```typescript
interface Span {
  spanId: string;               // Format: sp_{random}
  parentSpanId?: string;
  traceId: string;
  operation: string;
  kind: SpanKind;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: SpanStatus;
  statusMessage?: string;       // Only if status is ERROR
  attributes: Record<string, string | number | boolean>;
  events: readonly SpanEvent[];
}

type SpanKind = "INTERNAL" | "SERVER" | "CLIENT" | "PRODUCER" | "CONSUMER";
type SpanStatus = "OK" | "ERROR" | "UNSET";

interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}
```

### Example Span

```json
{
  "spanId": "sp_a1b2c3d4e5f6",
  "parentSpanId": "sp_z9y8x7w6v5u4",
  "traceId": "tr_lz5f3k_a1b2c3d4e5f6",
  "operation": "parse_file",
  "kind": "INTERNAL",
  "startTime": 1707645000000,
  "endTime": 1707645001250,
  "durationMs": 1250,
  "status": "OK",
  "attributes": {
    "file.id": "file-xyz",
    "file.type": "BANK_CSV",
    "file.size": 102400
  },
  "events": [
    {
      "name": "content_read",
      "timestamp": 1707645000500
    },
    {
      "name": "data_extracted",
      "timestamp": 1707645001000
    }
  ]
}
```

---

## Transition Observation Schema

Status transitions are observed (never enforced) by the telemetry layer.

```typescript
interface TransitionObservation {
  observationId: string;        // Format: obs_{timestamp}_{counter}
  entityType: ObservedEntityType;
  entityId: string;
  tenantId: string;
  fromStatus: string;
  toStatus: string;
  actor: TransitionActor;
  timestamp: number;
  traceId?: string;
  workflowExecutionId?: string;
  succeeded: boolean;
  error?: string;               // Only if succeeded is false
  metadata?: Record<string, unknown>;
}

type ObservedEntityType =
  | "MONTH_CLOSE"
  | "FILE_ASSET"
  | "MATCH"
  | "PARSE_STATUS";

interface TransitionActor {
  type: "USER" | "SERVER" | "SYSTEM";
  id?: string;
}
```

### Example Transition Observation

```json
{
  "observationId": "obs_1707645000000_1",
  "entityType": "MONTH_CLOSE",
  "entityId": "mc-2024-01",
  "tenantId": "tenant-acme",
  "fromStatus": "DRAFT",
  "toStatus": "IN_REVIEW",
  "actor": {
    "type": "USER",
    "id": "user-123"
  },
  "timestamp": 1707645000000,
  "traceId": "tr_lz5f3k_a1b2c3d4e5f6",
  "workflowExecutionId": "wf_monthclosetransition_lz5f3n_c3d4e5f6g7h8",
  "succeeded": true
}
```

---

## Error Record Schema

```typescript
interface ErrorRecord {
  errorId: string;              // Format: err_{timestamp}_{counter}
  errorType: string;
  message: string;
  code?: string;
  stack?: string;               // Sanitized
  component: string;
  operation: string;
  entityId?: string;
  entityType?: string;
  tenantId?: string;
  traceId?: string;
  workflowExecutionId?: string;
  timestamp: number;
  recoverable: boolean;
  retryable: boolean;
  context?: Record<string, unknown>;
}

type ErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
```

### Example Error Record

```json
{
  "errorId": "err_1707645000000_1",
  "errorType": "StateError",
  "message": "Illegal MonthClose transition: 'FINALIZED' -> 'DRAFT'",
  "code": "INVALID_STATUS_TRANSITION",
  "component": "MonthCloseWorkflow",
  "operation": "transition_month_close",
  "entityId": "mc-2024-01",
  "entityType": "MonthClose",
  "tenantId": "tenant-acme",
  "traceId": "tr_lz5f3k_a1b2c3d4e5f6",
  "timestamp": 1707645000000,
  "recoverable": false,
  "retryable": false
}
```

---

## Counter Schema

```typescript
interface CounterValue {
  name: string;
  value: number;
  labels: Record<string, string>;
  lastUpdated: number;
}

interface CounterEvent {
  name: string;
  delta: number;
  labels: Record<string, string>;
  timestamp: number;
  traceId?: string;
}
```

### Standard Counter Names

```typescript
const COUNTER_NAMES = {
  WORKFLOW_STARTED: "workflow_started",
  WORKFLOW_COMPLETED: "workflow_completed",
  WORKFLOW_FAILED: "workflow_failed",
  TRANSITION_ATTEMPTED: "transition_attempted",
  TRANSITION_SUCCEEDED: "transition_succeeded",
  TRANSITION_FAILED: "transition_failed",
  ERROR_OCCURRED: "error_occurred",
  ERROR_RECOVERED: "error_recovered",
  REQUEST_RECEIVED: "request_received",
  REQUEST_COMPLETED: "request_completed",
  ENTITY_CREATED: "entity_created",
  ENTITY_UPDATED: "entity_updated",
  ENTITY_DELETED: "entity_deleted",
};
```

---

## Forbidden Patterns

The following MUST NEVER appear in any telemetry data:

- Passwords
- API keys or secrets
- Tokens (except `tokenId` references)
- Credentials
- Private keys
- Social security numbers
- Credit card numbers
- Any PII not explicitly required

---

## Example Complete Workflow Trace

Here's what a complete file parsing workflow looks like in telemetry:

```
TRACE: tr_lz5f3k_a1b2c3d4e5f6
WORKFLOW: wf_fileparse_lz5f3m_b2c3d4e5f6g7

├─ SPAN: sp_root_123456 [parse_file_workflow] 2500ms OK
│  ├─ LOG: INFO parse_start "Starting file parse"
│  │
│  ├─ SPAN: sp_read_234567 [read_file_content] 200ms OK
│  │  └─ LOG: DEBUG content_read "File content read" {size: 102400}
│  │
│  ├─ SPAN: sp_extract_345678 [extract_data] 1800ms OK
│  │  ├─ LOG: DEBUG parsing "Parsing bank CSV"
│  │  └─ LOG: INFO extracted "Data extracted" {lines: 150}
│  │
│  ├─ SPAN: sp_save_456789 [save_results] 450ms OK
│  │  └─ TRANSITION: FILE_ASSET UPLOADED → VERIFIED ✓
│  │
│  └─ LOG: INFO parse_complete "Parse completed successfully" {durationMs: 2500}

COUNTERS:
  workflow_started{workflowType=FILE_PARSE}: +1
  workflow_completed{workflowType=FILE_PARSE}: +1
  transition_succeeded{entityType=FILE_ASSET,fromStatus=UPLOADED,toStatus=VERIFIED}: +1

TIMING:
  parse_file_workflow: 2500ms
  read_file_content: 200ms
  extract_data: 1800ms
  save_results: 450ms
```

---

## Integration Points

### Minimal Integration Example

```typescript
import {
  createTraceContext,
  createWorkflowContext,
  createLogger,
  timedAsync,
  observeTransition,
  captureError,
} from "../observability";

async function parseFileWithObservability(
  tenantId: string,
  fileId: string,
  userId: string
): Promise<ParseResult> {
  // Create observability context
  const traceContext = createTraceContext({
    entryPoint: "CALLABLE_FUNCTION",
    tenantId,
    actorId: userId,
    actorType: "USER",
  });

  const workflowContext = createWorkflowContext({
    workflowType: "FILE_PARSE",
    initiator: "USER",
    tenantId,
    entityIds: [fileId],
    traceContext,
  });

  const logger = createLogger("FileParser", traceContext, workflowContext);

  logger.info("parse_start", "Starting file parse", { fileId });

  try {
    // Time the operation
    const [result, timing] = await timedAsync(
      "parse_file",
      () => actualParseLogic(fileId),
      traceContext,
      workflowContext
    );

    // Observe the transition
    observeTransition({
      entityType: "FILE_ASSET",
      entityId: fileId,
      tenantId,
      fromStatus: "UPLOADED",
      toStatus: "VERIFIED",
      succeeded: true,
      traceContext,
      workflowContext,
    });

    logger.timed("parse_complete", "Parse completed", timing.durationMs, {
      linesExtracted: result.lines,
    });

    return result;
  } catch (error) {
    // Capture the error
    captureError(error, "FileParser", "parse_file", {
      traceContext,
      workflowContext,
      entityId: fileId,
      entityType: "FileAsset",
    });

    logger.error("parse_failed", "Parse failed", { fileId }, error as Error);

    throw error; // Re-throw - observability doesn't change behavior
  }
}
```

---

## Dashboard Read Models

For debug dashboards, use these read models:

### Active Workflows

```typescript
interface ActiveWorkflowView {
  workflowExecutionId: string;
  workflowType: string;
  tenantId: string;
  startTime: number;
  elapsedMs: number;
  currentStep?: string;
  entityIds: string[];
}
```

### Failed Workflows

```typescript
interface FailedWorkflowView {
  workflowExecutionId: string;
  workflowType: string;
  tenantId: string;
  failedAt: number;
  error: {
    code?: string;
    message: string;
  };
  entityIds: string[];
}
```

### Entity Timeline

```typescript
interface EntityTimelineView {
  entityType: string;
  entityId: string;
  tenantId: string;
  statusHistory: Array<{
    status: string;
    enteredAt: number;
    exitedAt?: number;
    actor: string;
  }>;
}
```

---

## Version

Schema Version: 1.0.0
Last Updated: 2026-02-11
