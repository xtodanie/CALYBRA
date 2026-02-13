import { Timestamp } from "firebase-admin/firestore";
import {
  approveZerebroxPolicyProposalWorkflow,
  replayZerebroxDeadLetterWorkflow,
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

describe("zerebroxControlPlane.workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("materializes flight recorder snapshot and control-plane run", async () => {
    readBrainArtifactsByMonthMock.mockResolvedValue([
      {
        type: "decision",
        payload: {
          accepted: true,
          replayHash: "ctx-replay-123456789",
        },
      },
      {
        type: "health",
        payload: {
          healthIndex: 0.8,
          eventsApplied: 12,
        },
      },
      {
        type: "gate_audit",
        payload: {
          accepted: true,
        },
      },
    ]);
    readReadmodelItemMock.mockResolvedValue({ activeVersion: "pv-9" });
    readReadmodelSnapshotMock.mockResolvedValue({ timeline: [] });

    const result = await runZerebroxControlPlaneHeartbeatWorkflow({} as never, {
      tenantId: "tenant-a",
      monthKey: "2026-02",
      actorId: "system",
      now: Timestamp.fromDate(new Date("2026-02-13T12:00:00Z")),
      tier: "nightly",
    });

    expect(result.success).toBe(true);
    expect(result.tenantId).toBe("tenant-a");
    expect(writeReadmodelMock).toHaveBeenCalledTimes(2);
    expect(mergeReadmodelDocMock).toHaveBeenCalledTimes(2);
    expect(createEventMock).toHaveBeenCalledTimes(3);
  });

  it("replays quarantined dead-letter payload with tenant-safe validator", async () => {
    readReadmodelItemMock.mockResolvedValue({
      sourceType: "zerebrox.heartbeat",
      reasonCode: "SCHEMA_GATE_INVALID",
      payloadHash: "",
      payload: {
        tenantId: "tenant-a",
        monthKey: "2026-02",
      },
      replayAttempts: 1,
      status: "QUARANTINED",
      createdAtIso: "2026-02-13T12:00:00Z",
    });

    const result = await replayZerebroxDeadLetterWorkflow({} as never, {
      tenantId: "tenant-a",
      quarantineId: "hb:tenant-a:2026-02:1:quarantine",
      actorId: "system",
      now: Timestamp.fromDate(new Date("2026-02-13T13:00:00Z")),
      maxReplayAttempts: 3,
    });

    expect(result.status).toBe("FAILED");
    expect(result.reasonCode).toBe("REPLAY_HASH_MISMATCH");
    expect(mergeReadmodelDocMock).toHaveBeenCalledTimes(1);
    expect(createEventMock).toHaveBeenCalledTimes(1);
  });

  it("stores approved proposal when canary passes", async () => {
    readReadmodelItemMock.mockResolvedValue({ proposalId: "p-1" });

    const result = await approveZerebroxPolicyProposalWorkflow({} as never, {
      tenantId: "tenant-a",
      proposalId: "p-1",
      actorId: "owner-1",
      now: Timestamp.fromDate(new Date("2026-02-13T13:00:00Z")),
      candidatePolicyVersion: "pv-10",
      baselinePolicyVersion: "pv-9",
      regressionPrecisionDelta: 0.01,
      regressionRecallDelta: 0.01,
    });

    expect(result.rolledBack).toBe(false);
    expect(result.activatedVersion).toBe("pv-10");
    expect(writeReadmodelDocMock).toHaveBeenCalledTimes(1);
    expect(mergeReadmodelDocMock).toHaveBeenCalledTimes(1);
  });

  it("rejects proposal when canary triggers rollback", async () => {
    readReadmodelItemMock.mockResolvedValue({ proposalId: "p-2" });

    const result = await approveZerebroxPolicyProposalWorkflow({} as never, {
      tenantId: "tenant-a",
      proposalId: "p-2",
      actorId: "owner-1",
      now: Timestamp.fromDate(new Date("2026-02-13T14:00:00Z")),
      candidatePolicyVersion: "pv-10",
      baselinePolicyVersion: "pv-9",
      regressionPrecisionDelta: -0.08,
      regressionRecallDelta: -0.01,
    });

    expect(result.rolledBack).toBe(true);
    expect(result.activatedVersion).toBe("pv-9");
    expect(mergeReadmodelDocMock).toHaveBeenCalledTimes(1);
    expect(writeReadmodelDocMock).toHaveBeenCalledTimes(0);
  });
});
