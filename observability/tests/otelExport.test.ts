/**
 * OTEL Export Tests
 */

import {
  createTraceContext,
  startSpan,
  spanToOtel,
  createLogEntry,
  logToOtel,
} from "../index";

describe("OTEL Export", () => {
  it("converts spans to OTEL format", () => {
    const trace = createTraceContext({
      entryPoint: "HTTP_REQUEST",
      tenantId: "tenant-1",
    });

    const spanBuilder = startSpan("test_operation", trace, "CONSUMER");
    spanBuilder.setAttribute("component", "test");
    spanBuilder.addEvent("event_one", { ok: true });
    const span = spanBuilder.end();

    const otel = spanToOtel(span, trace);

    expect(otel.kind).toBe(5);
    expect(otel.traceId.length).toBe(32);
    expect(otel.spanId.length).toBe(16);
    expect(otel.attributes.some((a) => a.key === "tenant.id")).toBe(true);
  });

  it("converts logs to OTEL format", () => {
    const trace = createTraceContext({
      entryPoint: "HTTP_REQUEST",
      tenantId: "tenant-1",
    });

    const log = createLogEntry({
      level: "INFO",
      component: "test",
      operation: "op",
      result: "SUCCESS",
      message: "ok",
      traceContext: trace,
    });

    const otelLog = logToOtel(log);

    expect(otelLog.severityNumber).toBe(9);
    expect(otelLog.body.stringValue).toBe("ok");
    expect(otelLog.attributes.some((a) => a.key === "tenant.id")).toBe(true);
    expect(otelLog.traceId?.length).toBe(32);
  });
});
