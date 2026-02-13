"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalJson = canonicalJson;
exports.stableSha256Hex = stableSha256Hex;
const node_crypto_1 = __importDefault(require("node:crypto"));
function normalize(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => normalize(entry));
    }
    if (!value || typeof value !== "object") {
        return value;
    }
    const record = value;
    const orderedKeys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    const normalizedRecord = {};
    for (const key of orderedKeys) {
        normalizedRecord[key] = normalize(record[key]);
    }
    return normalizedRecord;
}
function canonicalJson(value) {
    return JSON.stringify(normalize(value));
}
function stableSha256Hex(value) {
    return node_crypto_1.default.createHash("sha256").update(canonicalJson(value)).digest("hex");
}
//# sourceMappingURL=hash.js.map