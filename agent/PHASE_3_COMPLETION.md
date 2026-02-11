# Phase 3: UX-Driven Orchestration - Completion Report

**Status**: ✅ COMPLETE  
**Date**: 2025-01-XX  
**Architect**: Claude (GitHub Copilot)

---

## Executive Summary

Phase 3 transforms Calybra's business logic pipelines into user-driven flows. The system state is now **observable**, **explainable**, and **interruptible**. Every UX action maps 1:1 to a server workflow, with guards preventing invalid operations before they reach the backend.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Components                            │
│                    (React, shadcn/ui)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ render props / hooks
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      UX Flow Components                          │
│   FileIngestionFlow │ MatchingFlow │ InvoiceFlow │ MonthCloseFlow│
└───────────────────────────┬─────────────────────────────────────┘
                            │ creates intents
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestration Layer                           │
│        Intent System → Guards → ActionExecutor                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ validated calls
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Workflow Actions                              │
│  ingestFile │ parseFile │ match │ createInvoice │ monthClose    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ httpsCallable
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cloud Functions (Firebase)                     │
│                    Server Workflows                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implemented Components

### 1. Orchestration Layer (`/src/client/orchestration/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `intent.ts` | User intent types and factory functions | `UserIntent`, `createUploadFileIntent`, etc. |
| `guards.ts` | Permission and state validation | `guardIntent`, `GuardResult` |
| `actions.ts` | Intent-to-workflow dispatch | `ActionExecutor`, `ActionResult` |
| `index.ts` | Module exports | All of above |

### 2. Event System (`/src/client/events/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `progress.ts` | Workflow progress tracking | `ProgressEmitter`, `WorkflowExecution`, step constants |
| `errors.ts` | Structured error handling | `OrchestrationError`, `createError`, `ERROR_CODES` |
| `explanations.ts` | Human-readable explanations | `explainMonthCloseStatus`, `WORKFLOW_EXPLANATIONS` |
| `index.ts` | Module exports | All of above |

### 3. State Management (`/src/client/state/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `selectors.ts` | Derived state from Firestore | `selectMonthCloseState`, `selectFlowState` |
| `projections.ts` | UI-ready data projections | `projectMatchList`, `projectMonthCloseSummary` |
| `index.ts` | Module exports | All of above |

### 4. Workflow Actions (`/src/client/workflows/`)

| File | Purpose | Cloud Function |
|------|---------|----------------|
| `ingestFile.action.ts` | File upload orchestration | `ingestFile` |
| `parseFile.action.ts` | File parsing orchestration | `parseFile` |
| `match.action.ts` | Matching operations | `runMatching`, `confirmMatch`, `rejectMatch` |
| `createInvoice.action.ts` | Invoice creation | `createInvoiceFromParse`, `createInvoiceManual` |
| `monthClose.action.ts` | Month close lifecycle | `createMonthClose`, `submitForReview`, `finalize` |
| `index.ts` | Module exports | All of above |

### 5. UX Flow Components (`/src/client/ui/flows/`)

| File | Description | Pattern |
|------|-------------|---------|
| `FileIngestionFlow.tsx` | File upload and parsing | Render props + hook |
| `MatchingFlow.tsx` | Match review and confirmation | Render props + hook |
| `InvoiceFlow.tsx` | Invoice creation flow | Render props + hook |
| `MonthCloseFlow.tsx` | Month close lifecycle | Render props + hook |
| `index.ts` | Module exports | - |

---

## Guarantees Provided

### 1. Each Intent → Exactly One Workflow
```typescript
// UI creates intent
const intent = createConfirmMatchIntent(matchId, tenantId, monthCloseId);

// Guards validate
const guardResult = guardIntent(intent, context);
if (!guardResult.allowed) {
  throw new Error(guardResult.reason);
}

// ActionExecutor dispatches to single workflow
const result = await executor.execute(intent);
```

### 2. Invalid Intents Blocked Before Network Call
```typescript
// Finalize blocked if exceptions exist
guardIntent(finalizeIntent, { 
  openExceptionsCount: 5  // > 0
}); // → { allowed: false, reason: "Cannot finalize with open exceptions" }

// Upload blocked on finalized month
guardIntent(uploadIntent, {
  monthCloseStatus: MonthCloseStatus.FINALIZED
}); // → { allowed: false, reason: "Month is finalized - no modifications allowed" }
```

### 3. Progress Events Emitted
```typescript
const emitter = new ProgressEmitter((step, progress, message) => {
  // UI receives: VALIDATING(10%) → UPLOADING(50%) → REGISTERING(80%) → COMPLETE(100%)
  updateProgressBar(progress);
  updateStatusMessage(message);
});
```

### 4. Failures Surface with Recovery Guidance
```typescript
const error = createError("PERMISSION_DENIED");
// → {
//     code: "PERMISSION_DENIED",
//     category: "permission",
//     userMessage: "You don't have permission to perform this action",
//     retryable: false,
//     recoveryGuidance: "Contact your administrator to request access"
//   }
```

### 5. UI Cannot Bypass Orchestration
- UX Flow components only expose controlled action handlers
- Direct Cloud Function calls are not exported from UI-accessible paths
- Intents are immutable (`Object.freeze`)
- Guards run synchronously before any network call

---

## Status Machine Integration

The client orchestration layer respects server-side status machines:

| Entity | Status Machine | Client Guards |
|--------|----------------|---------------|
| MonthClose | DRAFT → IN_REVIEW → FINALIZED | `guardSubmitForReview`, `guardFinalize` |
| Match | PROPOSED → CONFIRMED/REJECTED | `guardConfirmMatch`, `guardRejectMatch` |
| FileAsset | PENDING_UPLOAD → UPLOADED → VERIFIED/REJECTED | `guardUploadFile`, `guardParseFile` |

---

## RBAC Integration

Role-based permissions are checked client-side (fail-fast) and server-side (authoritative):

| Action | Minimum Role | Guard |
|--------|--------------|-------|
| Upload file | ACCOUNTANT | `guardUploadFile` |
| Run matching | ACCOUNTANT | `guardRunMatching` |
| Confirm match | ACCOUNTANT | `guardConfirmMatch` |
| Submit for review | ACCOUNTANT | `guardSubmitForReview` |
| Finalize month | OWNER | `guardFinalizeMonth` |

---

## Test Coverage

Tests located in `/src/client/__tests__/orchestration.test.ts`:

| Category | Tests |
|----------|-------|
| Intent System | Creation, immutability, audit fields |
| Guard System | Permission guards, state guards, invalid intent handling |
| Progress Events | Emission order, step definitions, execution lifecycle |
| Error Handling | Creation, exception wrapping, recovery guidance |
| State Selectors | MonthClose state, flow phase detection |
| Orchestration Isolation | Bypass prevention, 1:1 mapping |

---

## Usage Examples

### File Ingestion Flow
```tsx
<FileIngestionFlow
  functions={functions}
  tenantId={tenantId}
  monthCloseId={monthCloseId}
  monthCloseStatus={status}
>
  {({ state, canUpload, uploadFile, parseFile }) => (
    <div>
      <ProgressBar value={state.progress} />
      <p>{state.explanation}</p>
      
      {canUpload && (
        <FileDropzone onDrop={uploadFile} />
      )}
      
      {state.pendingParse && (
        <Button onClick={() => parseFile(state.pendingParse!.fileId)}>
          Parse File
        </Button>
      )}
    </div>
  )}
</FileIngestionFlow>
```

### Hook API (Simpler)
```tsx
function MyComponent() {
  const { uploadFile, parseFile, isUploading, state } = useFileIngestionFlow(
    functions, tenantId, monthCloseId, status
  );

  return (
    <UploadButton 
      onClick={() => uploadFile(file)} 
      disabled={isUploading}
    />
  );
}
```

---

## Known Limitations

1. **Offline Support**: Not implemented. All operations require network.
2. **Optimistic Updates**: Not implemented. UI waits for server confirmation.
3. **Concurrent Edits**: Not handled. Last write wins on server.
4. **WebSocket Progress**: Events are local simulation, not server-pushed.

---

## Migration Path

Existing UI components should migrate to use UX Flows:

| Old Pattern | New Pattern |
|-------------|-------------|
| Direct `httpsCallable` | Use workflow action functions |
| Manual permission checks | Use `guardIntent()` |
| Ad-hoc error handling | Use `OrchestrationError` structure |
| Imperative state updates | Use Flow render props |

---

## Files Created

```
src/client/
├── orchestration/
│   ├── intent.ts
│   ├── guards.ts
│   ├── actions.ts
│   └── index.ts
├── events/
│   ├── progress.ts
│   ├── errors.ts
│   ├── explanations.ts
│   └── index.ts
├── state/
│   ├── selectors.ts
│   ├── projections.ts
│   └── index.ts
├── workflows/
│   ├── ingestFile.action.ts
│   ├── parseFile.action.ts
│   ├── match.action.ts
│   ├── createInvoice.action.ts
│   ├── monthClose.action.ts
│   └── index.ts
├── ui/
│   └── flows/
│       ├── FileIngestionFlow.tsx
│       ├── MatchingFlow.tsx
│       ├── InvoiceFlow.tsx
│       ├── MonthCloseFlow.tsx
│       └── index.ts
└── __tests__/
    └── orchestration.test.ts
```

**Total Files Created**: 21

---

## Definition of Done Checklist

- [x] Every UX action routes through intent → guard → workflow
- [x] Invalid operations fail fast with actionable errors
- [x] Progress is observable via ProgressEmitter
- [x] Explanations are human-readable
- [x] State is derivable via selectors
- [x] UI projections are computed, not stored
- [x] Tests prove guarantees
- [x] PHASE_3_COMPLETION.md documents deliverables

---

## Next Phase

Phase 4 should focus on:
1. Connecting UX Flows to actual page components
2. Implementing real-time Firestore listeners
3. Adding retry/rollback UI for failed operations
4. Performance optimization (memoization, virtualization)
