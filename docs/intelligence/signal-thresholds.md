# Signal Thresholds (Phase 2)

## Purpose
Deterministic threshold policy for signal lifecycle control (soft, hard, escalation).

## Levels
- Soft alert: confidence >= 0.45 and < 0.65
- Hard alert: confidence >= 0.65 and < 0.85
- Escalation trigger: confidence >= 0.85 OR (confidence >= 0.55 AND compositeRisk >= 0.7)

## Rules
- Thresholding is deterministic and replay-derived.
- No manual exception can suppress persisted hard alerts.
- Dampening is applied before threshold classification.

## Inputs
- Evidence count
- Time weight
- Drift magnitude
- Historical stability
- Dampening penalties

## Outputs
- `soft`
- `hard`
- `escalate`
