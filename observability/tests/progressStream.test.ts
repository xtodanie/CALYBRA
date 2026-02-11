/**
 * Progress Stream Tests
 */

import {
  ProgressStream,
  emitWorkflowStart,
  emitDebugInfo,
  createTraceContext,
} from "../index";

describe("Progress Stream", () => {
  it("delivers events to matching subscribers", () => {
    const stream = new ProgressStream({ bufferSize: 10 });
    const trace = createTraceContext({
      entryPoint: "HTTP_REQUEST",
      tenantId: "tenant-1",
    });

    const onStart = jest.fn();

    stream.subscribe(onStart, { types: ["workflow:start"] });

    emitWorkflowStart(stream, "MATCHING", { input: true }, trace);
    emitDebugInfo(stream, "debug", "hello", trace);

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("isolates subscriber failures", () => {
    const stream = new ProgressStream({ bufferSize: 10 });
    const trace = createTraceContext({
      entryPoint: "HTTP_REQUEST",
      tenantId: "tenant-1",
    });

    const bad = jest.fn(() => {
      throw new Error("boom");
    });
    const good = jest.fn();

    stream.subscribe(bad);
    stream.subscribe(good);

    emitWorkflowStart(stream, "MATCHING", { input: true }, trace);

    expect(good).toHaveBeenCalledTimes(1);
  });
});
