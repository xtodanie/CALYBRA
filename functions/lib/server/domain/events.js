"use strict";
/**
 * Event domain - authoritative business events
 * Pure types and helpers. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_TYPES = void 0;
exports.compareEvents = compareEvents;
exports.sortEvents = sortEvents;
exports.dateKeyFromIso = dateKeyFromIso;
exports.addDaysToDateKey = addDaysToDateKey;
exports.compareDateKeys = compareDateKeys;
exports.EVENT_TYPES = [
    "BANK_TX_ARRIVED",
    "INVOICE_CREATED",
    "INVOICE_UPDATED",
    "MATCH_RESOLVED",
    "ADJUSTMENT_POSTED",
];
function compareEvents(a, b) {
    const occurredCompare = a.occurredAt.localeCompare(b.occurredAt);
    if (occurredCompare !== 0)
        return occurredCompare;
    return a.deterministicId.localeCompare(b.deterministicId);
}
function sortEvents(events) {
    return [...events].sort(compareEvents);
}
function dateKeyFromIso(iso) {
    return iso.slice(0, 10);
}
function addDaysToDateKey(dateKey, days) {
    const [yearStr, monthStr, dayStr] = dateKey.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const base = new Date(Date.UTC(year, month - 1, day));
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    return next.toISOString().slice(0, 10);
}
function compareDateKeys(a, b) {
    return a.localeCompare(b);
}
//# sourceMappingURL=events.js.map