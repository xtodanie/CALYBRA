# Escalation Trigger Matrix (Phase 2)

## Trigger Conditions
- Financial deviation > 20% => `escalation_critical`
- Financial deviation > 12% => `escalation_required`
- Reconciliation instability > 0.6 => `escalation_required`
- Pattern conflict present => `escalation_required`
- Confidence < 0.4 and risk > 0.7 => `escalation_critical`
- Financial deviation > 7% or risk > 0.5 => `escalation_recommended`

## Operational Rule
Escalation is structured control transfer, never ad-hoc messaging.

## Determinism
Escalation level must be replay-stable for identical context inputs.
