import { CanonicalEventEnvelope, toEventHashMaterial } from "../contracts/event-envelope";
import { stableSha256Hex } from "./hash";

export interface ReplayValidation {
  readonly valid: boolean;
  readonly reason?: string;
}

export interface ReplayResult<TState> {
  readonly state: TState;
  readonly eventsApplied: number;
  readonly validation: ReplayValidation;
  readonly replayHash: string;
}

export type ReplayReducer<TState> = (
  previous: TState,
  event: CanonicalEventEnvelope,
  index: number,
) => TState;

function sortReplayEvents(events: readonly CanonicalEventEnvelope[]): readonly CanonicalEventEnvelope[] {
  return [...events].sort((left, right) => {
    const byTime = Date.parse(left.timestamp) - Date.parse(right.timestamp);
    if (byTime !== 0) {
      return byTime;
    }
    return left.id.localeCompare(right.id);
  });
}

export function validateReplayChain(events: readonly CanonicalEventEnvelope[]): ReplayValidation {
  const ordered = sortReplayEvents(events);
  for (let index = 0; index < ordered.length; index += 1) {
    const event = ordered[index];
    if (!event) continue;

    const expectedHash = stableSha256Hex(toEventHashMaterial(event));
    if (expectedHash !== event.hash) {
      return { valid: false, reason: `hash mismatch: ${event.id}` };
    }

    if (index === 0) {
      if (event.parent_id) {
        return { valid: false, reason: `first event has parent_id: ${event.id}` };
      }
      continue;
    }

    const parent = ordered[index - 1];
    if (!parent || parent.id !== event.parent_id) {
      return { valid: false, reason: `parent mismatch: ${event.id}` };
    }
  }

  return { valid: true };
}

export function replayDeterministic<TState>(params: {
  readonly events: readonly CanonicalEventEnvelope[];
  readonly initialState: TState;
  readonly reducer: ReplayReducer<TState>;
}): ReplayResult<TState> {
  const ordered = sortReplayEvents(params.events);
  const validation = validateReplayChain(ordered);
  if (!validation.valid) {
    return {
      state: params.initialState,
      eventsApplied: 0,
      validation,
      replayHash: stableSha256Hex({ state: params.initialState, eventsApplied: 0 }),
    };
  }

  let state = params.initialState;
  ordered.forEach((event, index) => {
    state = params.reducer(state, event, index);
  });

  return {
    state,
    eventsApplied: ordered.length,
    validation,
    replayHash: stableSha256Hex({ state, eventsApplied: ordered.length }),
  };
}
