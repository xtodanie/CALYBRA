# Memory Access Control Policy (Phase 1)

## Scope Model
- Tenant boundary is mandatory on every memory read/write/reflection action.
- Access tuple: `(tenantId, actorRole, action, namespace)`.

## Allowed Actions
- `read`: allowed for `owner`, `admin`, `auditor`, `controller` in-tenant only.
- `append-event`: allowed for server-authoritative services only.
- `append-reflection`: allowed for deterministic reflection service only.
- `snapshot-write`: allowed for server-authoritative replay service only.

## Explicit Denials
- Cross-tenant memory access for all actors.
- Client-authoritative writes to event or snapshot memory.
- Direct AI model writes to memory or financial truth.

## Audit Requirements
- Every access decision logs actor, tenant, namespace, action, decision, and timestamp.
- Denials are retained as explicit audit entries.
