"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactArtifactsByWindow = compactArtifactsByWindow;
const hash_1 = require("./hash");
function compactArtifactsByWindow(artifacts, minWindowSize) {
    if (artifacts.length < minWindowSize || minWindowSize <= 1) {
        return [];
    }
    const ordered = [...artifacts].sort((a, b) => {
        const t = Date.parse(a.generatedAt) - Date.parse(b.generatedAt);
        if (t !== 0)
            return t;
        return a.artifactId.localeCompare(b.artifactId);
    });
    const chunks = [];
    for (let index = 0; index < ordered.length; index += minWindowSize) {
        const chunk = ordered.slice(index, index + minWindowSize);
        if (chunk.length === minWindowSize) {
            chunks.push(chunk);
        }
    }
    return chunks.map((chunk) => {
        const first = chunk[0];
        const last = chunk[chunk.length - 1];
        const hash = (0, hash_1.stableSha256Hex)({
            tenantId: first.tenantId,
            monthKey: first.monthKey,
            fromArtifactId: first.artifactId,
            toArtifactId: last.artifactId,
            artifactHashes: chunk.map((item) => item.hash),
        });
        return {
            summaryId: `cmp:${hash.slice(0, 24)}`,
            tenantId: first.tenantId,
            monthKey: first.monthKey,
            fromArtifactId: first.artifactId,
            toArtifactId: last.artifactId,
            artifactCount: chunk.length,
            hash,
        };
    });
}
//# sourceMappingURL=artifact-compactor.js.map