# agent/METRICS.md

## Purpose

Quantitative performance tracking. Numbers don't lie; intuition does.

This document captures measurable data about agent performance to enable data-driven improvement.

---

## Metric Categories

### 1. Task Metrics
- Tasks attempted
- Tasks completed successfully
- Tasks failed
- Tasks requiring rework
- Average task duration

### 2. Tool Metrics
- Tool invocations by type
- Tool success rate by type
- Tool chains (common sequences)
- Failed tool calls

### 3. Accuracy Metrics
- Estimation accuracy (predicted vs actual time)
- Confidence calibration score
- First-attempt success rate
- Rework frequency

### 4. Efficiency Metrics
- Lines of code per task
- Tool calls per task
- Context switches per task
- Debug cycles per task

### 5. Quality Metrics
- User corrections received
- Regressions introduced
- Test pass rate after changes
- Proof command pass rate

---

## Data Schema

### Task Entry
```yaml
task_id: "T-YYYY-MM-DD-NNNN"
date: "YYYY-MM-DD"
type: "[feature|bugfix|refactor|docs|debug|config]"
complexity_predicted: "[trivial|simple|moderate|complex|very_complex]"
complexity_actual: "[trivial|simple|moderate|complex|very_complex]"
duration_predicted_minutes: N
duration_actual_minutes: N
outcome: "[success|partial|failure]"
tools_used: ["tool1", "tool2"]
tool_calls: N
rework_required: [true|false]
user_corrections: N
tests_affected: N
proof_result: "[pass|fail|skipped]"
```

### Aggregation Entry
```yaml
period: "YYYY-WNN" # or "YYYY-MM"
tasks_total: N
tasks_success: N
tasks_failure: N
success_rate: N%
avg_duration_minutes: N
estimation_accuracy: N% # (1 - |predicted-actual|/actual)
confidence_calibration: N% # Brier score or similar
tool_efficiency: N # tasks / tool_calls
first_attempt_rate: N%
```

---

## Current Metrics

### Period: 2026-W07 (Feb 10-16)

#### Task Log

| ID | Date | Type | Outcome | Duration | Tools | Corrections |
|----|------|------|---------|----------|-------|-------------|
| T-2026-02-12-0001 | 2026-02-12 | feature | success | 8m | create_file, replace_string, run_in_terminal, manage_todo_list | 0 |

#### Aggregates

```yaml
period: "2026-W07"
tasks_total: 1
tasks_success: 1
tasks_failure: 0
success_rate: 100%
avg_duration_minutes: 8
estimation_accuracy: 90%
confidence_calibration: --
tool_efficiency: 0.07
first_attempt_rate: 100%
```

---

## Tracking Commands

To update metrics after a task:

1. Add entry to Task Log table
2. Recalculate aggregates
3. Note any anomalies

---

## Visualization (Manual)

### Success Rate Trend
```
W05: ████████░░ 80%
W06: █████████░ 90%
W07: ██████████ 100%
```

### Complexity Distribution
```
Trivial:  ██░░░░░░░░ 20%
Simple:   ████░░░░░░ 40%
Moderate: ███░░░░░░░ 30%
Complex:  █░░░░░░░░░ 10%
V.Complex:░░░░░░░░░░ 0%
```

---

## Alerts

Define thresholds that trigger review:

| Metric | Warning | Critical |
|--------|---------|----------|
| Success Rate | <80% | <60% |
| Estimation Accuracy | <70% | <50% |
| Rework Frequency | >20% | >40% |
| User Corrections/Task | >1 | >3 |

---

## Analysis Queries

### Which task types have lowest success rate?
Group by `type`, calculate `success_rate`, sort ascending.

### Which tools fail most often?
Count tool failures by tool type, sort descending.

### Is estimation improving?
Compare `estimation_accuracy` across periods.

### Where is time spent?
Sum `duration_actual_minutes` by `type`.

---

## Integration

- **SELF_EVAL.md**: Qualitative companion to these quantitative metrics
- **ESTIMATION.md**: Uses duration data for calibration
- **TOOL_PRIORS.md**: Uses tool success data for optimization
- **CONFIDENCE_LOG.md**: Feeds calibration calculations
