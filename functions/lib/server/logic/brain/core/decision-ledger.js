"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeDecisionLedger = summarizeDecisionLedger;
function summarizeDecisionLedger(entries) {
    const count = Math.max(1, entries.length);
    const successCount = entries.filter((entry) => entry.success).length;
    const falsePositiveCount = entries.filter((entry) => !entry.success).length;
    const avgRoi = entries.reduce((sum, entry) => sum + entry.roi, 0) / count;
    const aiEntries = entries.filter((entry) => entry.aiSuggested);
    const aiSuccess = aiEntries.filter((entry) => entry.success).length;
    const overrideCount = entries.filter((entry) => entry.overridden).length;
    return {
        successRate: Number((successCount / count).toFixed(4)),
        falsePositiveRate: Number((falsePositiveCount / count).toFixed(4)),
        avgRoi: Number(avgRoi.toFixed(4)),
        aiSuggestionAccuracy: Number((aiEntries.length === 0 ? 0 : aiSuccess / aiEntries.length).toFixed(4)),
        humanOverrideFrequency: Number((overrideCount / count).toFixed(4)),
    };
}
//# sourceMappingURL=decision-ledger.js.map