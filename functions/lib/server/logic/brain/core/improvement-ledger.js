"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeImprovementLedger = summarizeImprovementLedger;
function summarizeImprovementLedger(entries) {
    var _a;
    const grouped = new Map();
    for (const entry of entries) {
        const list = (_a = grouped.get(entry.domain)) !== null && _a !== void 0 ? _a : [];
        list.push(entry);
        grouped.set(entry.domain, list);
    }
    const summaries = [];
    for (const [domain, list] of grouped.entries()) {
        const count = list.length;
        const netImprovementPct = list.reduce((sum, item) => sum + item.netImprovementPct, 0) / count;
        const avgRoi = list.reduce((sum, item) => sum + item.roi, 0) / count;
        const successRatio = list.filter((item) => item.success).length / count;
        summaries.push({
            domain,
            netImprovementPct: Number(netImprovementPct.toFixed(4)),
            avgRoi: Number(avgRoi.toFixed(4)),
            successRatio: Number(successRatio.toFixed(4)),
            count,
        });
    }
    return summaries.sort((a, b) => a.domain.localeCompare(b.domain));
}
//# sourceMappingURL=improvement-ledger.js.map