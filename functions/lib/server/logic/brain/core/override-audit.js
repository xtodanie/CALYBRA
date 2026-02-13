"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeOverrides = summarizeOverrides;
function summarizeOverrides(events) {
    var _a;
    const byActor = {};
    for (const event of events) {
        byActor[event.actorId] = ((_a = byActor[event.actorId]) !== null && _a !== void 0 ? _a : 0) + 1;
    }
    return { count: events.length, byActor };
}
//# sourceMappingURL=override-audit.js.map