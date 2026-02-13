"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPreflightReport = buildPreflightReport;
function buildPreflightReport(checks) {
    const failedChecks = checks.filter((check) => !check.passed).map((check) => check.name);
    const passed = failedChecks.length === 0;
    const summary = passed
        ? `PASS (${checks.length} checks)`
        : `FAIL (${failedChecks.length}/${checks.length} failed)`;
    return {
        passed,
        failedChecks,
        summary,
    };
}
//# sourceMappingURL=preflight-report.js.map