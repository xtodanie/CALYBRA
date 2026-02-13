export interface PreflightCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly details: string;
}

export interface PreflightReport {
  readonly passed: boolean;
  readonly failedChecks: readonly string[];
  readonly summary: string;
}

export function buildPreflightReport(checks: readonly PreflightCheck[]): PreflightReport {
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
