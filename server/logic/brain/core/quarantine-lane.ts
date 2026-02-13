import { stableSha256Hex } from "./hash";

export type QuarantineStatus = "QUARANTINED" | "REPLAYED" | "FAILED";

export interface QuarantineEnvelope {
  readonly quarantineId: string;
  readonly tenantId: string;
  readonly sourceType: string;
  readonly reasonCode: string;
  readonly payloadHash: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAtIso: string;
  readonly replayAttempts: number;
  readonly status: QuarantineStatus;
}

export interface DeadLetterReplayOutcome {
  readonly status: QuarantineStatus;
  readonly replayAttempts: number;
  readonly reasonCode: "REPLAY_OK" | "REPLAY_HASH_MISMATCH" | "REPLAY_VALIDATION_FAILED";
}

export function createQuarantineEnvelope(input: {
  readonly quarantineId: string;
  readonly tenantId: string;
  readonly sourceType: string;
  readonly reasonCode: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAtIso: string;
}): QuarantineEnvelope {
  return {
    quarantineId: input.quarantineId,
    tenantId: input.tenantId,
    sourceType: input.sourceType,
    reasonCode: input.reasonCode,
    payloadHash: stableSha256Hex(input.payload),
    payload: { ...input.payload },
    createdAtIso: input.createdAtIso,
    replayAttempts: 0,
    status: "QUARANTINED",
  };
}

export function replayQuarantinedEnvelope(input: {
  readonly envelope: QuarantineEnvelope;
  readonly maxReplayAttempts: number;
  readonly validator: (payload: Readonly<Record<string, unknown>>) => boolean;
}): DeadLetterReplayOutcome {
  if (stableSha256Hex(input.envelope.payload) !== input.envelope.payloadHash) {
    return {
      status: "FAILED",
      replayAttempts: input.envelope.replayAttempts,
      reasonCode: "REPLAY_HASH_MISMATCH",
    };
  }

  const nextAttempts = input.envelope.replayAttempts + 1;
  const valid = input.validator(input.envelope.payload);
  if (valid) {
    return {
      status: "REPLAYED",
      replayAttempts: nextAttempts,
      reasonCode: "REPLAY_OK",
    };
  }

  return {
    status: nextAttempts >= input.maxReplayAttempts ? "FAILED" : "QUARANTINED",
    replayAttempts: nextAttempts,
    reasonCode: "REPLAY_VALIDATION_FAILED",
  };
}
