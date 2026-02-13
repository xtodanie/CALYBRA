"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReplayChain = validateReplayChain;
exports.replayDeterministic = replayDeterministic;
const event_envelope_1 = require("../contracts/event-envelope");
const hash_1 = require("./hash");
function sortReplayEvents(events) {
    return [...events].sort((left, right) => {
        const byTime = Date.parse(left.timestamp) - Date.parse(right.timestamp);
        if (byTime !== 0) {
            return byTime;
        }
        return left.id.localeCompare(right.id);
    });
}
function validateReplayChain(events) {
    const ordered = sortReplayEvents(events);
    for (let index = 0; index < ordered.length; index += 1) {
        const event = ordered[index];
        if (!event)
            continue;
        const expectedHash = (0, hash_1.stableSha256Hex)((0, event_envelope_1.toEventHashMaterial)(event));
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
function replayDeterministic(params) {
    const ordered = sortReplayEvents(params.events);
    const validation = validateReplayChain(ordered);
    if (!validation.valid) {
        return {
            state: params.initialState,
            eventsApplied: 0,
            validation,
            replayHash: (0, hash_1.stableSha256Hex)({ state: params.initialState, eventsApplied: 0 }),
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
        replayHash: (0, hash_1.stableSha256Hex)({ state, eventsApplied: ordered.length }),
    };
}
//# sourceMappingURL=replay.js.map