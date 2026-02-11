# Security Incident Response

## Trigger Conditions
- Evidence of cross-tenant access
- Unauthorized role escalation
- Unauthorized month close finalization
- File assets accessed across tenants

## Immediate Actions
1) Lock down writes by reverting to last known-good rules (see agent/RELEASE.md).
2) Disable or restrict suspicious service accounts or functions.
3) Snapshot auth logs and Cloud Functions logs.

## Validation Steps
- Reproduce in emulator with same UID and tenantId.
- Confirm users/{uid}.tenantId and role mapping.
- Validate rules for monthCloses and fileAssets restrictions.

## Communication
- Notify internal stakeholders with scope and impact.
- If customer impact: prepare external notice with clear scope.

## Recovery
- Patch rules and add rules tests.
- Execute deploy with scripts/deploy.mjs.
- Document in DECISIONS.md if security posture changes.
