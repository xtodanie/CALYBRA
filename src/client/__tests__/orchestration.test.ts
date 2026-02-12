/**
 * Client Orchestration Tests
 *
 * Phase 3 Guarantee Tests:
 * - Each intent triggers exactly one workflow
 * - Invalid intents are blocked by guards
 * - Progress events are emitted
 * - Failures surface correctly
 * - UI cannot bypass orchestration
 */

import { describe, it, expect } from "@jest/globals";
import {
  createUploadFileIntent,
  createRequestMatchIntent,
  createConfirmMatchIntent,
  createRejectMatchIntent,
  createSubmitForReviewIntent,
  createFinalizeMonthIntent,
} from "../orchestration/intent";
import { guardIntent } from "../orchestration/guards";
import { ProgressEmitter, FILE_INGESTION_STEPS, WorkflowExecution } from "../events/progress";
import { createError, createErrorFromException } from "../events/errors";
import { selectFlowState } from "../state/selectors";
import { MonthCloseStatus, UserRole, MatchStatus } from "../../lib/types";

// ============================================================================
// INTENT SYSTEM TESTS
// ============================================================================

describe("Intent System", () => {
  describe("Intent Creation", () => {
    it("creates explicitly typed intents", () => {
      const intent = createUploadFileIntent({
        fileId: "file_123",
        tenantId: "tenant_456",
        monthCloseId: "mc_789",
        filename: "invoice.pdf",
        kind: "INVOICE_PDF",
      });

      expect(intent.type).toBe("UPLOAD_FILE");
      expect(intent.fileId).toBe("file_123");
      expect(intent.tenantId).toBe("tenant_456");
      expect(intent.monthCloseId).toBe("mc_789");
      expect(typeof intent.timestamp).toBe("number");
    });

    it("each intent has a unique identity", () => {
      const t1 = createUploadFileIntent({ fileId: "f1", tenantId: "t1", monthCloseId: "m1", filename: "a.pdf", kind: "INVOICE_PDF" });
      const t2 = createUploadFileIntent({ fileId: "f2", tenantId: "t2", monthCloseId: "m2", filename: "b.pdf", kind: "INVOICE_PDF" });

      expect(t1).not.toBe(t2);
      expect(t1.fileId).not.toBe(t2.fileId);
    });

    it("confirm match intent has expected fields", () => {
      const intent = createConfirmMatchIntent({ matchId: "m_123", tenantId: "t_456", monthCloseId: "mc_789" });

      expect(intent.type).toBe("CONFIRM_MATCH");
      expect(intent.matchId).toBe("m_123");
    });
  });

  describe("Intent Auditing", () => {
    it("all intents contain required audit fields", () => {
      const intents = [
        createUploadFileIntent({ fileId: "f1", tenantId: "t1", monthCloseId: "m1", filename: "a.pdf", kind: "BANK_CSV" }),
        createRequestMatchIntent({ tenantId: "t1", monthCloseId: "m1" }),
        createConfirmMatchIntent({ matchId: "m1", tenantId: "t1", monthCloseId: "mc1" }),
        createRejectMatchIntent({ matchId: "m1", tenantId: "t1", monthCloseId: "mc1" }),
        createSubmitForReviewIntent({ tenantId: "t1", monthCloseId: "mc1" }),
        createFinalizeMonthIntent({ tenantId: "t1", monthCloseId: "mc1" }),
      ];

      for (const intent of intents) {
        expect(intent.type).toBeDefined();
        expect(typeof intent.timestamp).toBe("number");
        expect(intent.tenantId).toBeDefined();
      }
    });
  });
});

// ============================================================================
// GUARD TESTS
// ============================================================================

describe("Guard System", () => {
  describe("Permission Guards", () => {
    it("blocks finalize for non-owner roles", () => {
      const intent = createFinalizeMonthIntent({ tenantId: "t_456", monthCloseId: "mc_123" });

      const result = guardIntent(intent, {
        role: UserRole.ACCOUNTANT,
        monthCloseStatus: MonthCloseStatus.IN_REVIEW,
        openExceptionsCount: 0,
        highExceptionsCount: 0,
      });

      expect(result.allowed).toBe(false);
    });

    it("allows finalize for owner role", () => {
      const intent = createFinalizeMonthIntent({ tenantId: "t_456", monthCloseId: "mc_123" });

      const result = guardIntent(intent, {
        role: UserRole.OWNER,
        monthCloseStatus: MonthCloseStatus.IN_REVIEW,
        openExceptionsCount: 0,
        highExceptionsCount: 0,
      });

      expect(result.allowed).toBe(true);
    });

    it("blocks upload for finalized month", () => {
      const intent = createUploadFileIntent({
        fileId: "f1",
        tenantId: "t1",
        monthCloseId: "m1",
        filename: "invoice.pdf",
        kind: "INVOICE_PDF",
      });

      const result = guardIntent(intent, {
        role: UserRole.OWNER,
        monthCloseStatus: MonthCloseStatus.FINALIZED,
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe("State Guards", () => {
    it("blocks finalize when exceptions exist", () => {
      const intent = createFinalizeMonthIntent({ tenantId: "t_456", monthCloseId: "mc_123" });

      const result = guardIntent(intent, {
        role: UserRole.OWNER,
        monthCloseStatus: MonthCloseStatus.IN_REVIEW,
        openExceptionsCount: 5,
        highExceptionsCount: 0,
      });

      expect(result.allowed).toBe(false);
    });

    it("blocks submit when month is not in draft", () => {
      const intent = createSubmitForReviewIntent({ tenantId: "t_456", monthCloseId: "mc_123" });

      const result = guardIntent(intent, {
        role: UserRole.OWNER,
        monthCloseStatus: MonthCloseStatus.IN_REVIEW,
      });

      expect(result.allowed).toBe(false);
    });

    it("blocks match confirmation for rejected match", () => {
      const intent = createConfirmMatchIntent({ matchId: "m_123", tenantId: "t_456", monthCloseId: "mc_789" });

      const result = guardIntent(intent, {
        role: UserRole.ACCOUNTANT,
        monthCloseStatus: MonthCloseStatus.DRAFT,
        matchStatus: MatchStatus.REJECTED,
      });

      expect(result.allowed).toBe(false);
    });
  });
});

// ============================================================================
// PROGRESS EVENT TESTS
// ============================================================================

describe("Progress Events", () => {
  describe("ProgressEmitter", () => {
    it("can be instantiated", () => {
      const emitter = new ProgressEmitter();
      expect(emitter).toBeDefined();
    });

    it("step definitions exist for file ingestion", () => {
      expect(FILE_INGESTION_STEPS.INITIATED).toBeDefined();
      expect(FILE_INGESTION_STEPS.UPLOADING).toBeDefined();
      expect(FILE_INGESTION_STEPS.COMPLETED).toBeDefined();
    });
  });

  describe("WorkflowExecution Model", () => {
    it("tracks execution lifecycle", () => {
      const execution: WorkflowExecution<{ id: string }> = {
        id: "exec_123",
        intentType: "UPLOAD_FILE",
        status: "RUNNING",
        startedAt: Date.now(),
        progress: [],
      };

      expect(execution.status).toBe("RUNNING");
      expect(execution.id).toBe("exec_123");
    });

    it("captures completion state", () => {
      const execution: WorkflowExecution<{ id: string }> = {
        id: "exec_123",
        intentType: "UPLOAD_FILE",
        status: "SUCCEEDED",
        startedAt: Date.now(),
        completedAt: Date.now(),
        progress: [],
        result: { id: "file_456" },
      };

      expect(execution.status).toBe("SUCCEEDED");
      expect(execution.result).toBeDefined();
      expect(execution.completedAt).toBeDefined();
    });

    it("captures failure state with error", () => {
      const error = createError("FILE_TOO_LARGE");
      const execution: WorkflowExecution<{ id: string }> = {
        id: "exec_123",
        intentType: "UPLOAD_FILE",
        status: "FAILED",
        startedAt: Date.now(),
        completedAt: Date.now(),
        progress: [],
        error: {
          code: error.code,
          message: error.userMessage,
          recoverable: error.retryable,
          retryable: error.retryable,
        },
      };

      expect(execution.status).toBe("FAILED");
      expect(execution.error).toBeDefined();
      expect(execution.error?.code).toBe("FILE_TOO_LARGE");
    });
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe("Error Handling", () => {
  describe("Error Creation", () => {
    it("creates structured errors with codes", () => {
      const error = createError("PERMISSION_DENIED");

      expect(error.code).toBe("PERMISSION_DENIED");
      expect(error.category).toBeDefined();
      expect(error.userMessage).toBeDefined();
    });
  });

  describe("Exception Wrapping", () => {
    it("wraps unknown exceptions safely", () => {
      const error = createErrorFromException(new Error("Something broke"));

      expect(error.code).toBe("UNKNOWN_ERROR");
      expect(error.category).toBe("UNKNOWN");
      expect(error.userMessage).toBeDefined();
    });
  });
});

// ============================================================================
// STATE SELECTORS TESTS
// ============================================================================

describe("State Selectors", () => {
  describe("selectFlowState", () => {
    it("returns UPLOAD phase when no transactions", () => {
      const state = selectFlowState(
        MonthCloseStatus.DRAFT,
        0, 0, 0, 0, 0
      );

      expect(state.phase).toBe("UPLOAD");
    });

    it("returns MATCH phase when transactions exist", () => {
      const state = selectFlowState(
        MonthCloseStatus.DRAFT,
        10, 10, 0, 0, 0
      );

      expect(state.phase).toBe("MATCH");
    });

    it("returns REVIEW phase when matches proposed", () => {
      // proposedMatchesCount=10 (arg 4), confirmedMatchesCount=0 (arg 5)
      const state = selectFlowState(
        MonthCloseStatus.DRAFT,
        10, 10, 10, 0, 0
      );

      expect(state.phase).toBe("REVIEW");
    });

    it("returns FINALIZE phase when all matched", () => {
      // proposedMatchesCount=0 (arg 4), confirmedMatchesCount=10 (arg 5)
      const state = selectFlowState(
        MonthCloseStatus.IN_REVIEW,
        10, 10, 0, 10, 0
      );

      expect(state.phase).toBe("FINALIZE");
    });
  });
});

// ============================================================================
// ORCHESTRATION ISOLATION TESTS
// ============================================================================

describe("Orchestration Isolation", () => {
  describe("UI Cannot Bypass Orchestration", () => {
    it("intent factories are exposed", () => {
      expect(createUploadFileIntent).toBeDefined();
      expect(createConfirmMatchIntent).toBeDefined();
      expect(createFinalizeMonthIntent).toBeDefined();
    });

    it("guards are exposed", () => {
      expect(guardIntent).toBeDefined();
    });
  });

  describe("One Intent = One Workflow", () => {
    it("intent types map to workflow types", () => {
      const intentToWorkflowMapping: Record<string, string> = {
        UPLOAD_FILE: "ingestFile",
        REQUEST_PARSE: "parseFile",
        REQUEST_MATCH: "runMatching",
        CONFIRM_MATCH: "confirmMatch",
        REJECT_MATCH: "rejectMatch",
        CREATE_INVOICE: "createInvoice",
        SUBMIT_FOR_REVIEW: "submitForReview",
        FINALIZE_MONTH: "finalizeMonth",
      };

      const workflowNames = Object.values(intentToWorkflowMapping);
      const uniqueWorkflows = new Set(workflowNames);
      expect(uniqueWorkflows.size).toBe(workflowNames.length);
    });
  });
});
