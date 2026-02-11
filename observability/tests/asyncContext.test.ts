/**
 * Async Context Tests
 */

import {
  runInContextAsync,
  getCurrentTrace,
  getCurrentWorkflow,
  withBaggage,
  getBaggage,
  forkWorkflow,
} from "../index";

describe("Async Context", () => {
  it("propagates context across async boundaries", async () => {
    expect(getCurrentTrace()).toBeUndefined();

    await runInContextAsync(
      {
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
        workflowType: "FILE_PARSE",
        workflowInitiator: "USER",
        entityIds: ["entity-1"],
      },
      async () => {
        expect(getCurrentTrace()?.tenantId).toBe("tenant-1");
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(getCurrentWorkflow()?.workflowType).toBe("FILE_PARSE");
      }
    );

    expect(getCurrentTrace()).toBeUndefined();
  });

  it("merges baggage without leaking", async () => {
    await runInContextAsync(
      {
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
      },
      async () => {
        expect(getBaggage("requestId")).toBeUndefined();

        withBaggage({ requestId: "req-123" }, () => {
          expect(getBaggage("requestId")).toBe("req-123");
        });

        expect(getBaggage("requestId")).toBeUndefined();
      }
    );
  });

  it("forks workflow within existing trace", async () => {
    await runInContextAsync(
      {
        entryPoint: "HTTP_REQUEST",
        tenantId: "tenant-1",
        workflowType: "FILE_UPLOAD",
      },
      async () => {
        const original = getCurrentWorkflow();
        expect(original?.workflowType).toBe("FILE_UPLOAD");

        await forkWorkflow("FILE_PARSE", ["entity-2"], async () => {
          const forked = getCurrentWorkflow();
          expect(forked?.workflowType).toBe("FILE_PARSE");
          expect(forked?.workflowExecutionId).not.toBe(
            original?.workflowExecutionId
          );
        });

        const restored = getCurrentWorkflow();
        expect(restored?.workflowExecutionId).toBe(
          original?.workflowExecutionId
        );
      }
    );
  });
});
