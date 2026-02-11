# Threat Model

## Assets
- Tenant data (invoices, bankTx, matches, monthCloses, fileAssets)
- Authentication tokens and user role assignments
- File assets stored in tenant-scoped paths

## Trust Boundaries
- Client -> Firestore rules
- Client -> Storage rules
- Functions -> Firestore (server-authoritative)

## Key Threats
- Cross-tenant data access via missing tenantId checks
- Role escalation via forged user documents
- Unauthorized month close finalization
- Malicious file uploads with spoofed metadata

## Controls
- Default deny rules in Firestore and Storage
- Server-authoritative writes for sensitive collections
- Rules tests for tenant isolation and immutability
- Strict file asset schema and status transitions

## Residual Risk
- Misconfigured rules during deployments
- Incomplete rules tests for new collections

## Mitigations
- Enforce scripts/test.mjs before deploy
- Require CODEOWNERS review for rules and contracts
- Use ops/INCIDENT_PLAYBOOK.md for rapid containment
