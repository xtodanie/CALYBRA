# Incident Playbook

## Scope
Incidents that impact tenant isolation, RBAC, month close finalization, file verification, or matching integrity.

## Immediate Triage
1) Declare incident and assign incident lead.
2) Identify affected tenants and time window.
3) Freeze risky writes if tenant isolation or RBAC is impacted.
4) Snapshot evidence: logs, rule versions, recent deploys.

## Containment
- If rules regression: rollback to last known-good rules using agent/RELEASE.md.
- If function regression: disable offending functions and rollback via agent/RUNBOOK.md.
- If data integrity issue: pause matching/month-close transitions.

## Investigation Checklist
- Confirm users/{uid}.tenantId for affected users.
- Validate Firestore rules evaluation with emulator reproductions.
- Compare deployed rules with expected rules in repo.
- Verify any recent schema or status transition changes.

## Recovery
- Apply minimal fix.
- Re-run rules tests and affected workflows in emulator.
- Deploy fixes following agent/RELEASE.md.

## Post-Incident
- Create postmortem using ops/POSTMORTEM_TEMPLATE.md.
- Add a DECISIONS.md entry if controls or processes change.
