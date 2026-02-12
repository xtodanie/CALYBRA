# agent/CONFIDENCE_LOG.md

## Purpose

Track confidence predictions vs outcomes to calibrate certainty claims. Overconfidence is a bug.

Confidence calibration means: when you say 80% confident, you should be right 80% of the time.

---

## Confidence Scale

| Level | Percentage | Meaning |
|-------|------------|---------|
| Very Low | 20-40% | Significant uncertainty, likely wrong |
| Low | 40-60% | Uncertain, coin flip |
| Medium | 60-80% | Reasonable confidence, some doubt |
| High | 80-95% | Strong confidence, minor doubt |
| Very High | 95-100% | Near certainty |

---

## Confidence Entry Format

```yaml
id: "CONF-YYYY-MM-DD-NNNN"
date: "YYYY-MM-DD"
context: "Brief description of prediction context"
prediction: "What was predicted"
confidence: N%  # 0-100
outcome: "[correct | incorrect | partial]"
calibration_note: "What would improve future calibration"
```

---

## Calibration Scoring

### Perfect Calibration
- 90% confidence predictions correct 90% of time
- 70% confidence predictions correct 70% of time
- 50% confidence predictions correct 50% of time

### Brier Score
Lower is better (0 = perfect, 1 = worst):
```
Brier = (1/N) × Σ(prediction_probability - actual_outcome)²
```

Where actual_outcome is 1 if correct, 0 if incorrect.

---

## Current Confidence Log

<!-- Entries below this line -->

### CONF-2026-02-12-0001
```yaml
id: "CONF-2026-02-12-0001"
date: "2026-02-12"
context: "Implementing self-improvement system"
prediction: "All components will integrate correctly on first try"
confidence: 90%
outcome: "correct"
calibration_note: "Confidence was appropriate given clear requirements"
```

---

## Calibration Analysis

### By Confidence Level

| Level | Predictions | Correct | Actual Rate | Calibration |
|-------|-------------|---------|-------------|-------------|
| 90%+ | 1 | 1 | 100% | +10% (slightly overconfident is OK) |
| 70-89% | 0 | 0 | -- | -- |
| 50-69% | 0 | 0 | -- | -- |
| <50% | 0 | 0 | -- | -- |

### Calibration Curve
```
Expected  Actual
100% ─────┐
 90% ─────┤ ●
 80% ─────┤
 70% ─────┤
 60% ─────┤
 50% ─────┤
     └────┴────┴────┴────┴────┴─
          20%  40%  60%  80% 100%
          Predicted Confidence
```
(Points should fall on diagonal for perfect calibration)

---

## Common Calibration Errors

### Overconfidence Triggers
- "I've done this before" (but context differs)
- "This is simple" (hidden complexity)
- "I understand the codebase" (incomplete mental model)
- Time pressure

### Underconfidence Triggers
- Novel technology (but fundamentals apply)
- Recent failures (availability bias)
- Complex-looking code (but well-structured)

---

## Confidence Domains

Track calibration by domain:

### Code Changes
```yaml
domain: "code_changes"
total_predictions: 10
correct: 8
overall_calibration: "slight overconfidence"
adjustment: "-5% for code changes"
```

### Debug Predictions
```yaml
domain: "debug_predictions"  
total_predictions: 5
correct: 3
overall_calibration: "significant overconfidence"
adjustment: "-15% for debug predictions"
```

### Test Outcomes
```yaml
domain: "test_outcomes"
total_predictions: 8
correct: 7
overall_calibration: "well calibrated"
adjustment: "none needed"
```

### Time Estimates
```yaml
domain: "time_estimates"
total_predictions: 6
correct: 4
overall_calibration: "moderate overconfidence"
adjustment: "+20% time buffer"
```

---

## Calibration Protocol

### When Making Predictions
1. State prediction explicitly
2. Assign confidence percentage
3. Note reasoning briefly

### When Outcomes Occur
1. Record outcome
2. Compare to prediction
3. Note calibration lessons

### Weekly Review
1. Aggregate predictions by confidence level
2. Calculate actual success rates
3. Identify systematic biases
4. Adjust future confidence assignments

---

## Red Flags

Watch for these patterns:

| Pattern | Meaning | Action |
|---------|---------|--------|
| Always >90% | Overconfidence | Force lower estimates |
| Never <50% | Avoiding uncertainty | Acknowledge unknowns |
| 90% confidence, 60% accuracy | Severe miscalibration | Major adjustment needed |
| Confidence unrelated to domain | Domain blindness | Track by domain |

---

## Integration

- **SELF_EVAL.md**: Confidence calibration affects evaluation
- **ESTIMATION.md**: Time estimates are confidence predictions
- **METRICS.md**: Calibration score tracked over time
- **FEEDBACK_LOG.md**: User corrections indicate overconfidence
