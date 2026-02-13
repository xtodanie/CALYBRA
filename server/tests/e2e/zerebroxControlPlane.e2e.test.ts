import { Timestamp } from "firebase-admin/firestore";
import {
  approveZerebroxPolicyProposalWorkflow,
  runZerebroxControlPlaneHeartbeatWorkflow,
} from "../../../server/workflows/zerebroxControlPlane.workflow";

jest.mock("../../../server/persistence/read", () => ({
  readBrainArtifactsByMonth: jest.fn(),
  readReadmodelItem: jest.fn(),
  readReadmodelSnapshot: jest.fn(),
}));

jest.mock("../../../server/persistence/write", () => ({
  createEvent: jest.fn(),
  mergeReadmodelDoc: jest.fn(),
  writeReadmodel: jest.fn(),
  writeReadmodelDoc: jest.fn(),
}));

import {
  readBrainArtifactsByMonth,
  readReadmodelItem,
  readReadmodelSnapshot,
} from "../../../server/persistence/read";
import {
  createEvent,
  mergeReadmodelDoc,
  writeReadmodel,
  writeReadmodelDoc,
} from "../../../server/persistence/write";

const readBrainArtifactsByMonthMock = readBrainArtifactsByMonth as jest.Mock;
const readReadmodelItemMock = readReadmodelItem as jest.Mock;
const readReadmodelSnapshotMock = readReadmodelSnapshot as jest.Mock;
const createEventMock = createEvent as jest.Mock;
const mergeReadmodelDocMock = mergeReadmodelDoc as jest.Mock;
const writeReadmodelMock = writeReadmodel as jest.Mock;
const writeReadmodelDocMock = writeReadmodelDoc as jest.Mock;

describe("zerebrox control-plane e2e orchestration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates proposal in propose gate and persists event trilogy", async () => {
    readBrainArtifactsByMonthMock.mockResolvedValue([
      {
        type: "decision",
        payload: {
          accepted: false,
          replayHash: "ctx-propose-123456",
        },
      },
      {
        type: "health",
        payload: {
          healthIndex: 0.5,
          eventsApplied: 300,
        },
      },
      {
        type: "gate_audit",
        payload: {
          accepted: false,
        },
      },
    ]);

    readReadmodelItemMock
      .mockResolvedValueOnce({ activeVersion: "pv-9" })
      .mockResolvedValueOnce({ mode: "Observe" });
    readReadmodelSnapshotMock.mockResolvedValue({ timeline: [] });

    const result = await runZerebroxControlPlaneHeartbeatWorkflow({} as never, {
      tenantId: "tenant-a",
      monthKey: "2026-02",
      actorId: "system",
      now: Timestamp.fromDate(new Date("2026-02-14T12:00:00Z")),
      tier: "nightly",
    });

    expect(result.success).toBe(true);
    expect(result.adaptationGate).toBe("propose");
    expect(createEventMock).toHaveBeenCalledTimes(3);
    expect(writeReadmodelDocMock).toHaveBeenCalledTimes(1);

    const eventTypes = createEventMock.mock.calls.map((call) => call[2]?.type);
    expect(eventTypes).toEqual([
      "zerebrox.decision",
      "zerebrox.truth_link",
      "zerebrox.feedback",
    ]);
  });

  it("appends timeline across replay runs and keeps deterministic event ids for same clock tick", async () => {
    const now = Timestamp.fromDate(new Date("2026-02-14T13:00:00Z"));
    const previousEntry = {
      decisionId: "decision:2026-02:ctx-old-aaaaaa",
      contextHash: "ctx-old-aaaaaa",
      policyVersion: "pv-8",
      projection: {
        supplierCostDrift: 0.1,
        supplierReliabilityScore: 0.9,
        exceptionFrequencyTrend: 0.0,
        paymentLagDistribution: { p50: 2, p90: 4, max: 7 },
        bankReconciliationStabilityScore: 0.95,
      },
      deterministicAction: "HOLD_POLICY",
      aiAction: "RULE_ONLY_FALLBACK",
      whyFired: "baseline",
      changedFromPrevious: [],
    };

    readBrainArtifactsByMonthMock.mockResolvedValue([
      { type: "decision", payload: { accepted: true, replayHash: "ctx-replay-abcdef123456" } },
      { type: "health", payload: { healthIndex: 0.8, eventsApplied: 12 } },
      { type: "gate_audit", payload: { accepted: true } },
    ]);

    readReadmodelItemMock
      .mockResolvedValueOnce({ activeVersion: "pv-9" })
      .mockResolvedValueOnce({ mode: "Observe" })
      .mockResolvedValueOnce({ activeVersion: "pv-9" })
      .mockResolvedValueOnce({ mode: "Observe" });

    readReadmodelSnapshotMock
      .mockResolvedValueOnce({ timeline: [previousEntry] })
      .mockResolvedValueOnce({ timeline: [previousEntry] });

    await runZerebroxControlPlaneHeartbeatWorkflow({} as never, {
      tenantId: "tenant-a",
      monthKey: "2026-02",
      actorId: "system",
      now,
      tier: "nightly",
    });

    await runZerebroxControlPlaneHeartbeatWorkflow({} as never, {
      tenantId: "tenant-a",
      monthKey: "2026-02",
      actorId: "system",
      now,
      tier: "nightly",
    });

    expect(writeReadmodelMock).toHaveBeenCalledTimes(2);

    const firstDecisionEvent = createEventMock.mock.calls[0]?.[2];
    const secondDecisionEvent = createEventMock.mock.calls[3]?.[2];
    expect(firstDecisionEvent?.id).toBe(secondDecisionEvent?.id);
    expect(firstDecisionEvent?.deterministicId).toBe(secondDecisionEvent?.deterministicId);

    const firstTimeline = writeReadmodelMock.mock.calls[0]?.[4]?.timeline;
    const secondTimeline = writeReadmodelMock.mock.calls[1]?.[4]?.timeline;
    expect(Array.isArray(firstTimeline)).toBe(true);
    expect(Array.isArray(secondTimeline)).toBe(true);
    expect(firstTimeline.length).toBe(2);
    expect(secondTimeline.length).toBe(2);
  });

  it("approves and rejects policy proposals based on canary thresholds", async () => {
    readReadmodelItemMock.mockResolvedValue({ proposalId: "proposal-1" });

    const approved = await approveZerebroxPolicyProposalWorkflow({} as never, {
      tenantId: "tenant-a",
      proposalId: "proposal-1",
      actorId: "owner-a",
      now: Timestamp.fromDate(new Date("2026-02-14T14:00:00Z")),
      candidatePolicyVersion: "pv-10",
      baselinePolicyVersion: "pv-9",
      regressionPrecisionDelta: 0.01,
      regressionRecallDelta: 0.01,
    });

    const rejected = await approveZerebroxPolicyProposalWorkflow({} as never, {
      tenantId: "tenant-a",
      proposalId: "proposal-1",
      actorId: "owner-a",
      now: Timestamp.fromDate(new Date("2026-02-14T14:05:00Z")),
      candidatePolicyVersion: "pv-11",
      baselinePolicyVersion: "pv-10",
      regressionPrecisionDelta: -0.07,
      regressionRecallDelta: -0.01,
    });

    expect(approved.rolledBack).toBe(false);
    expect(approved.activatedVersion).toBe("pv-10");
    expect(rejected.rolledBack).toBe(true);
    expect(rejected.activatedVersion).toBe("pv-10");
    expect(writeReadmodelDocMock).toHaveBeenCalledTimes(1);
    expect(mergeReadmodelDocMock).toHaveBeenCalledTimes(2);
  });
});
