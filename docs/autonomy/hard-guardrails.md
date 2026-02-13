# Hard Guardrails (Phase 2)

## Immutable Policy
The following actions are never allowed in autonomous mode:
- Bank account changes
- Supplier contract changes
- Pricing changes above configured maximum delta
- Staff reduction actions

## Enforcement
- Guardrails are evaluated pre-action and during simulation.
- Violations force autonomy state to `Restricted` or `Locked`.
- Violations emit escalation events and are always auditable.

## Determinism
Guardrail outcomes must be reproducible from replay with identical input state.
