"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryAppendOnlyEventStore = void 0;
const event_envelope_1 = require("../contracts/event-envelope");
const hash_1 = require("./hash");
function compareEvents(left, right) {
    const leftTime = Date.parse(left.timestamp);
    const rightTime = Date.parse(right.timestamp);
    const byTimestamp = leftTime - rightTime;
    if (byTimestamp !== 0) {
        return byTimestamp;
    }
    return left.id.localeCompare(right.id);
}
class InMemoryAppendOnlyEventStore {
    constructor() {
        this.events = [];
    }
    append(event) {
        const validation = (0, event_envelope_1.validateEventEnvelope)(event);
        if (!validation.valid) {
            throw new Error(`invalid event envelope: ${validation.errors.join("; ")}`);
        }
        if (this.events.some((existing) => existing.id === event.id)) {
            throw new Error(`duplicate event id: ${event.id}`);
        }
        const expectedHash = (0, hash_1.stableSha256Hex)((0, event_envelope_1.toEventHashMaterial)(event));
        if (expectedHash !== event.hash) {
            throw new Error(`invalid event hash for ${event.id}`);
        }
        const previous = this.events[this.events.length - 1];
        if (!previous && event.parent_id) {
            throw new Error("first event cannot declare parent_id");
        }
        if (previous && previous.id !== event.parent_id) {
            throw new Error(`event parent mismatch for ${event.id}`);
        }
        this.events.push(Object.freeze(Object.assign({}, event)));
    }
    appendMany(events) {
        for (const event of events) {
            this.append(event);
        }
    }
    readAll() {
        return [...this.events].sort(compareEvents);
    }
    readByTenant(tenantId) {
        return this.readAll().filter((event) => event.context.tenantId === tenantId);
    }
    getById(eventId) {
        const found = this.events.find((event) => event.id === eventId);
        return found ? Object.assign({}, found) : undefined;
    }
}
exports.InMemoryAppendOnlyEventStore = InMemoryAppendOnlyEventStore;
//# sourceMappingURL=event-store.js.map