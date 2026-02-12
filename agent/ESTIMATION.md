# agent/ESTIMATION.md

## Purpose

Complexity prediction calibration. Track predicted vs actual to improve future estimates.

Bad estimates cause scope creep, missed deadlines, and frustrated users. Calibrated estimates enable planning.

---

## Complexity Scale

| Level | Label | Typical Duration | Characteristics |
|-------|-------|------------------|-----------------|
| 1 | Trivial | <5 min | Single file, obvious change |
| 2 | Simple | 5-15 min | Few files, clear path |
| 3 | Moderate | 15-45 min | Multiple files, some unknowns |
| 4 | Complex | 45-120 min | Many files, significant unknowns |
| 5 | Very Complex | >120 min | Cross-cutting, novel, high uncertainty |

---

## Estimation Factors

### Increases Complexity
- [ ] Multiple files involved
- [ ] Security/rules changes
- [ ] Database schema changes
- [ ] Multiple systems affected
- [ ] Novel technology/approach
- [ ] Missing documentation
- [ ] No existing tests
- [ ] Time pressure

### Decreases Complexity
- [ ] Pattern already known (see PATTERNS.md)
- [ ] Similar task done before
- [ ] Good test coverage exists
- [ ] Clear documentation
- [ ] Isolated change
- [ ] Strong type safety

---

## Estimation Entry Format

```yaml
id: "EST-YYYY-MM-DD-NNNN"
date: "YYYY-MM-DD"
task: "Brief task description"

# Prediction (before starting)
predicted_complexity: [1-5]
predicted_minutes: N
confidence: [low | medium | high]
factors_increasing: ["factor1", "factor2"]
factors_decreasing: ["factor1", "factor2"]
unknowns: ["unknown1", "unknown2"]

# Actual (after completion)
actual_complexity: [1-5]
actual_minutes: N
unknowns_resolved: ["became X", "became Y"]
surprises: ["surprise1", "surprise2"]

# Analysis
accuracy: N% # calculated
notes: "What would improve future estimates?"
```

---

## Accuracy Calculation

```
accuracy = 100 - (abs(predicted - actual) / actual * 100)
```

Capped at 0-100%.

Examples:
- Predicted 30min, actual 30min → 100%
- Predicted 30min, actual 45min → 67%
- Predicted 60min, actual 30min → 0% (overestimate penalty)

---

## Calibration Goals

| Confidence Level | Target Accuracy |
|------------------|-----------------|
| High | >90% |
| Medium | >75% |
| Low | >60% |

If confidence-accuracy correlation is poor, recalibrate confidence assignment.

---

## Current Estimation Log

<!-- Entries below this line -->

### EST-2026-02-12-0001

```yaml
id: "EST-2026-02-12-0001"
date: "2026-02-12"
task: "Implement comprehensive agent self-improvement system"

# Prediction
predicted_complexity: 4
predicted_minutes: 60
confidence: high
factors_increasing: ["many files", "comprehensive scope"]
factors_decreasing: ["clear vision", "parallel file creation"]
unknowns: ["exact integration points"]

# Actual
actual_complexity: 4
actual_minutes: 45
unknowns_resolved: ["integration points clear from existing docs"]
surprises: ["none"]

# Analysis
accuracy: 75%
notes: "Slightly overestimated due to good tooling support"
```

---

## Estimation Heuristics

### By Task Type

| Task Type | Base Complexity | Notes |
|-----------|-----------------|-------|
| Bug fix (known cause) | 2 | Path is clear |
| Bug fix (unknown cause) | 4 | Debug time dominates |
| Feature (small) | 2-3 | Depends on scope |
| Feature (cross-cutting) | 4-5 | Multiple surfaces |
| Refactor (local) | 2 | Isolated impact |
| Refactor (global) | 4-5 | Ripple effects |
| Documentation | 1-2 | Usually straightforward |
| Configuration | 2-3 | Hidden dependencies |
| Security/rules | 4 | High stakes, careful work |

### By Uncertainty

| Unknowns | Complexity Modifier |
|----------|---------------------|
| 0 unknowns | Base |
| 1-2 unknowns | +1 level |
| 3+ unknowns | +2 levels |

---

## Improvement Protocol

After each estimation:

1. Compare predicted vs actual
2. If accuracy <80%:
   - Identify what was missed
   - Update heuristics
   - Add to surprises catalog
3. If accuracy consistently low for a task type:
   - Recalibrate base complexity for that type

---

## Surprises Catalog

Track recurring estimation surprises:

| Surprise | Frequency | Adjustment |
|----------|-----------|------------|
| Emulator setup issues | Medium | +10min for first emulator task of session |
| TypeScript strict mode catches | Low | +5min for TS changes |
| Test updates needed | High | +50% for any code change |
| Documentation drift | Medium | +15min if touching contracts |

---

## Integration

- **METRICS.md**: Uses estimation accuracy for tracking
- **SELF_EVAL.md**: Estimation quality affects efficiency score
- **CONFIDENCE_LOG.md**: Estimation confidence feeds calibration
