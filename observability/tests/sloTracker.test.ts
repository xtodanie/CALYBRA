/**
 * SLO Tracker Tests
 */

import { SloTracker } from "../index";

describe("SLO Tracker", () => {
  it("records violations against budgets", () => {
    const tracker = new SloTracker({ maxViolations: 2 });
    tracker.registerBudget({ name: "parse", maxDurationMs: 100 });

    tracker.record("parse", 50, { traceId: "tr_1" });
    tracker.record("parse", 150, { traceId: "tr_2" });

    const stats = tracker.getStats("parse");
    expect(stats?.count).toBe(2);
    expect(stats?.violations).toBe(1);
    expect(tracker.getViolations().length).toBe(1);
  });

  it("caps stored violations", () => {
    const tracker = new SloTracker({ maxViolations: 2 });
    tracker.registerBudget({ name: "sync", maxDurationMs: 10 });

    tracker.record("sync", 20);
    tracker.record("sync", 30);
    tracker.record("sync", 40);

    expect(tracker.getViolations().length).toBe(2);
  });
});
