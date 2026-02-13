"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPerformanceGraph = buildPerformanceGraph;
function buildPerformanceGraph(points) {
    return [...points].sort((a, b) => a.atIso.localeCompare(b.atIso));
}
//# sourceMappingURL=performance-graph.js.map