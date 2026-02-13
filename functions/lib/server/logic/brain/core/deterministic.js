"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableStringify = stableStringify;
exports.sha256Hex = sha256Hex;
exports.deterministicEventId = deterministicEventId;
const node_crypto_1 = __importDefault(require("node:crypto"));
function sortValue(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => sortValue(entry));
    }
    if (!value || typeof value !== "object") {
        return value;
    }
    const record = value;
    const sortedKeys = Object.keys(record).sort((a, b) => a.localeCompare(b));
    const sorted = {};
    for (const key of sortedKeys) {
        sorted[key] = sortValue(record[key]);
    }
    return sorted;
}
function stableStringify(value) {
    return JSON.stringify(sortValue(value));
}
function sha256Hex(value) {
    const normalized = stableStringify(value);
    return node_crypto_1.default.createHash("sha256").update(normalized).digest("hex");
}
function deterministicEventId(params) {
    const raw = `${params.tenantId}:${params.type}:${params.timestamp}:${params.hash}`;
    return `evt:${node_crypto_1.default.createHash("sha256").update(raw).digest("hex").slice(0, 24)}`;
}
//# sourceMappingURL=deterministic.js.map