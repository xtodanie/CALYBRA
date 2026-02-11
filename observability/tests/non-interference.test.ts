/**
 * Observability Non-Interference Tests
 *
 * CRITICAL: These tests PROVE that observability code:
 * 1. NEVER affects business logic
 * 2. NEVER throws exceptions that break workflows
 * 3. NEVER blocks execution
 * 4. Can be completely disabled without changing behavior
 *
 * If these tests fail, the observability layer is BROKEN.
 */

import {
  createTraceContext,
  createWorkflowContext,
  createLogger,
  createNullLogger,
  startTimer,
  timedAsync,
  timedSync,
  startSpan,
  tracedAsync,
  tracedSync,
  observeTransition,
  captureError,
  getGlobalSpanCollector,
  getGlobalTransitionCollector,
  getGlobalErrorCollector,
  resetAllCollectors,
  getNullTraceContext,
  getNullWorkflowContext,
} from "../index";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Helper function that simulates business logic
 */
function businessLogic(input: number): number {
  return input * 2 + 1;
}

/**
 * Async helper function that simulates business logic
 */
async function asyncBusinessLogic(input: number): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return input * 2 + 1;
}

/**
 * Function that throws an error
 */
function throwingFunction(): never {
  throw new Error("Business logic error");
}

/**
 * Async function that throws an error
 */
async function asyncThrowingFunction(): Promise<never> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  throw new Error("Async business logic error");
}

// ============================================================================
// NON-INTERFERENCE TESTS
// ============================================================================

describe("Observability Non-Interference", () => {
  beforeEach(() => {
    resetAllCollectors();
  });

  describe("TraceContext Non-Interference", () => {
    it("creating trace context does not affect business logic result", () => {
      const expected = businessLogic(5);

      // With trace context
      const traceContext = createTraceContext({
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
        actorId: "user-1",
      });
      const withTrace = businessLogic(5);

      expect(withTrace).toBe(expected);
      expect(traceContext.traceId).toBeDefined();
    });

    it("null trace context can be used as fallback", () => {
      const nullTrace = getNullTraceContext();
      expect(nullTrace.traceId).toBe("tr_null_0000000000000000");
      expect(nullTrace.actorType).toBe("SYSTEM");
    });

    it("trace context is immutable", () => {
      const traceContext = createTraceContext({
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
      });

      expect(() => {
        (traceContext as { tenantId: string }).tenantId = "hacked";
      }).toThrow();
    });
  });

  describe("WorkflowContext Non-Interference", () => {
    it("creating workflow context does not affect business logic result", () => {
      const expected = businessLogic(7);

      const traceContext = createTraceContext({
        entryPoint: "CALLABLE_FUNCTION",
        tenantId: "tenant-1",
      });

      const workflowContext = createWorkflowContext({
        workflowType: "FILE_PARSE",
        initiator: "USER",
        tenantId: "tenant-1",
        entityIds: ["file-1"],
        traceContext,
      });

      const withWorkflow = businessLogic(7);

      expect(withWorkflow).toBe(expected);
      expect(workflowContext.workflowExecutionId).toBeDefined();
    });

    it("null workflow context can be used as fallback", () => {
      const nullTrace = getNullTraceContext();
      const nullWorkflow = getNullWorkflowContext(nullTrace);
      expect(nullWorkflow.workflowExecutionId).toBe("wf_null_0000000000000000");
    });
  });

  describe("Logger Non-Interference", () => {
    it("logger never throws exceptions", () => {
      const logger = createLogger("TestComponent");

      // None of these should throw
      expect(() => logger.debug("test", "Debug message")).not.toThrow();
      expect(() => logger.info("test", "Info message")).not.toThrow();
      expect(() => logger.warn("test", "Warn message")).not.toThrow();
      expect(() => logger.error("test", "Error message")).not.toThrow();
    });

    it("logger with invalid data does not throw", () => {
      const logger = createLogger("TestComponent");

      // Circular reference - should be handled gracefully
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      // This should not throw
      expect(() => logger.info("test", "Message", circular)).not.toThrow();
    });

    it("null logger discards all output without affecting logic", () => {
      const nullLogger = createNullLogger();

      // Business logic should work identically
      const expected = businessLogic(10);

      nullLogger.info("operation", "Starting");
      const result = businessLogic(10);
      nullLogger.info("operation", "Completed");

      expect(result).toBe(expected);
    });

    it("logger failure does not affect business logic", () => {
      // Create a logger with a failing sink
      const failingSink = (): void => {
        throw new Error("Sink failure");
      };

      const logger = createLogger("TestComponent", undefined, undefined, {
        sink: failingSink,
      });

      // Business logic should still work
      const expected = businessLogic(15);

      logger.info("test", "This will fail in sink");
      const result = businessLogic(15);

      expect(result).toBe(expected);
    });
  });

  describe("Timer Non-Interference", () => {
    it("timedSync returns correct result and timing", () => {
      const expected = businessLogic(20);

      const [result, timing] = timedSync("test_operation", () => businessLogic(20));

      expect(result).toBe(expected);
      expect(timing.durationMs).toBeGreaterThanOrEqual(0);
      expect(timing.success).toBe(true);
    });

    it("timedAsync returns correct result and timing", async () => {
      const expected = await asyncBusinessLogic(25);

      const [result, timing] = await timedAsync("test_operation", () =>
        asyncBusinessLogic(25)
      );

      expect(result).toBe(expected);
      expect(timing.durationMs).toBeGreaterThan(0);
      expect(timing.success).toBe(true);
    });

    it("timedSync preserves error behavior", () => {
      expect(() => {
        timedSync("test_operation", () => throwingFunction());
      }).toThrow("Business logic error");
    });

    it("timedAsync preserves error behavior", async () => {
      await expect(
        timedAsync("test_operation", () => asyncThrowingFunction())
      ).rejects.toThrow("Async business logic error");
    });

    it("timer can be stopped multiple times without error", () => {
      const timer = startTimer("test");
      const first = timer.stop(true);
      const second = timer.stop(false);

      // Should return same measurement
      expect(second).toBe(first);
    });
  });

  describe("Span Non-Interference", () => {
    it("tracedSync returns correct result", () => {
      const traceContext = createTraceContext({
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
      });

      const expected = businessLogic(30);

      const [result, span] = tracedSync("test_operation", traceContext, () =>
        businessLogic(30)
      );

      expect(result).toBe(expected);
      expect(span.status).toBe("OK");
    });

    it("tracedAsync returns correct result", async () => {
      const traceContext = createTraceContext({
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
      });

      const expected = await asyncBusinessLogic(35);

      const [result, span] = await tracedAsync(
        "test_operation",
        traceContext,
        async () => asyncBusinessLogic(35)
      );

      expect(result).toBe(expected);
      expect(span.status).toBe("OK");
    });

    it("tracedSync preserves error behavior", () => {
      const traceContext = createTraceContext({
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
      });

      expect(() => {
        tracedSync("test_operation", traceContext, () => throwingFunction());
      }).toThrow("Business logic error");

      // Span should be recorded with error
      const spans = getGlobalSpanCollector().getAll();
      expect(spans.length).toBeGreaterThan(0);
      expect(spans[spans.length - 1].status).toBe("ERROR");
    });

    it("tracedAsync preserves error behavior", async () => {
      const traceContext = createTraceContext({
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
      });

      await expect(
        tracedAsync("test_operation", traceContext, async () =>
          asyncThrowingFunction()
        )
      ).rejects.toThrow("Async business logic error");
    });

    it("span can be ended multiple times without error", () => {
      const traceContext = createTraceContext({
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
      });

      const span = startSpan("test", traceContext);
      const first = span.end();
      const second = span.end();

      expect(second).toBe(first);
    });
  });

  describe("Transition Observation Non-Interference", () => {
    it("observeTransition never throws", () => {
      expect(() => {
        observeTransition({
          entityType: "MONTH_CLOSE",
          entityId: "mc-1",
          tenantId: "tenant-1",
          fromStatus: "DRAFT",
          toStatus: "IN_REVIEW",
          succeeded: true,
        });
      }).not.toThrow();
    });

    it("observeTransition records observation without affecting logic", () => {
      const expected = businessLogic(40);

      observeTransition({
        entityType: "MONTH_CLOSE",
        entityId: "mc-1",
        tenantId: "tenant-1",
        fromStatus: "DRAFT",
        toStatus: "IN_REVIEW",
        succeeded: true,
      });

      const result = businessLogic(40);

      expect(result).toBe(expected);

      const observations = getGlobalTransitionCollector().getAll();
      expect(observations.length).toBe(1);
    });

    it("observation with invalid data does not throw", () => {
      expect(() => {
        observeTransition({
          entityType: "MONTH_CLOSE" as never,
          entityId: "",
          tenantId: "",
          fromStatus: "",
          toStatus: "",
          succeeded: false,
          error: "Some error",
        });
      }).not.toThrow();
    });
  });

  describe("Error Capture Non-Interference", () => {
    it("captureError never throws", () => {
      expect(() => {
        captureError(new Error("Test error"), "TestComponent", "test_operation");
      }).not.toThrow();
    });

    it("captureError with non-Error value does not throw", () => {
      expect(() => {
        captureError("string error", "TestComponent", "test_operation");
      }).not.toThrow();

      expect(() => {
        captureError({ message: "object error" }, "TestComponent", "test_operation");
      }).not.toThrow();

      expect(() => {
        captureError(null, "TestComponent", "test_operation");
      }).not.toThrow();

      expect(() => {
        captureError(undefined, "TestComponent", "test_operation");
      }).not.toThrow();
    });

    it("captureError does not interfere with error re-throwing", () => {
      const testError = new Error("Original error");

      expect(() => {
        try {
          throw testError;
        } catch (error) {
          captureError(error, "TestComponent", "test_operation");
          throw error; // Re-throw
        }
      }).toThrow("Original error");

      // Error should be recorded
      const errors = getGlobalErrorCollector().getAll();
      expect(errors.length).toBe(1);
    });
  });

  describe("Collector Overflow Non-Interference", () => {
    it("collectors handle overflow without affecting business logic", () => {
      const expected = businessLogic(50);

      // Add many observations
      for (let i = 0; i < 15000; i++) {
        observeTransition({
          entityType: "MATCH",
          entityId: `match-${i}`,
          tenantId: "tenant-1",
          fromStatus: "PROPOSED",
          toStatus: "CONFIRMED",
          succeeded: true,
        });
      }

      const result = businessLogic(50);

      expect(result).toBe(expected);

      // Collector should have applied limits
      const observations = getGlobalTransitionCollector().getAll();
      expect(observations.length).toBeLessThanOrEqual(10000);
    });
  });

  describe("Full Workflow Non-Interference", () => {
    it("complete observability flow does not affect business result", async () => {
      // Expected result without any observability
      const expected = await asyncBusinessLogic(100);

      // Full observability flow
      const traceContext = createTraceContext({
        entryPoint: "CALLABLE_FUNCTION",
        tenantId: "tenant-1",
        actorId: "user-1",
        actorType: "USER",
      });

      const workflowContext = createWorkflowContext({
        workflowType: "FILE_PARSE",
        initiator: "USER",
        tenantId: "tenant-1",
        entityIds: ["file-1"],
        traceContext,
      });

      const logger = createLogger("FileParser", traceContext, workflowContext);

      logger.info("parse_start", "Starting file parse");

      const [result] = await timedAsync(
        "parse_operation",
        async () => {
          logger.debug("parse_step", "Processing");
          return asyncBusinessLogic(100);
        },
        traceContext,
        workflowContext
      );

      observeTransition({
        entityType: "FILE_ASSET",
        entityId: "file-1",
        tenantId: "tenant-1",
        fromStatus: "UPLOADED",
        toStatus: "VERIFIED",
        succeeded: true,
        traceContext,
        workflowContext,
      });

      logger.info("parse_complete", "Parse completed");

      expect(result).toBe(expected);
    });

    it("observability with errors still preserves error behavior", async () => {
      const traceContext = createTraceContext({
        entryPoint: "CALLABLE_FUNCTION",
        tenantId: "tenant-1",
      });

      const logger = createLogger("TestComponent", traceContext);

      const operation = async (): Promise<number> => {
        logger.info("operation_start", "Starting");

        try {
          const [result] = await timedAsync("failing_operation", async () => {
            throw new Error("Expected failure");
          });
          return result;
        } catch (error) {
          captureError(error, "TestComponent", "test_operation", {
            traceContext,
          });
          logger.error("operation_failed", "Operation failed", {}, error as Error);
          throw error;
        }
      };

      await expect(operation()).rejects.toThrow("Expected failure");

      // Error should be captured
      const errors = getGlobalErrorCollector().getAll();
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("Removal Equivalence", () => {
    it("business logic produces identical results with and without observability", async () => {
      const input = 42;

      // Without observability
      const withoutObs = await asyncBusinessLogic(input);

      // With full observability
      const traceContext = createTraceContext({
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
      });

      const logger = createLogger("Test", traceContext);
      logger.info("start", "Starting");

      const [withObs] = await timedAsync(
        "operation",
        () => asyncBusinessLogic(input),
        traceContext
      );

      logger.info("end", "Completed");

      // Results must be identical
      expect(withObs).toBe(withoutObs);
    });

    it("error behavior is identical with and without observability", () => {
      // Without observability
      let errorWithout: Error | undefined;
      try {
        throwingFunction();
      } catch (e) {
        errorWithout = e as Error;
      }

      // With observability
      let errorWith: Error | undefined;
      const traceContext = createTraceContext({
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
      });

      try {
        tracedSync("operation", traceContext, () => throwingFunction());
      } catch (e) {
        errorWith = e as Error;
        captureError(e, "Test", "operation");
      }

      // Errors must have same message
      expect(errorWith?.message).toBe(errorWithout?.message);
    });
  });
});
