# agent/SELF_IMPROVEMENT.md

## Purpose

This document defines the **Agent Self-Improvement System** — a comprehensive framework enabling agents to measure, learn, adapt, and optimize their performance over time.

Self-improvement is not optional. Stagnant agents repeat mistakes; adaptive agents compound knowledge.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SELF-IMPROVEMENT SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   OBSERVE   │───▶│   MEASURE   │───▶│   ANALYZE   │───▶│    ADAPT    │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│        │                  │                  │                  │          │
│        ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ SELF_EVAL   │    │  METRICS    │    │  PATTERNS   │    │ TOOL_PRIORS │  │
│  │ CONFIDENCE  │    │ ESTIMATION  │    │FAILURE_MODE │    │   SKILLS    │  │
│  │ FEEDBACK    │    │             │    │DEPENDENCY   │    │             │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Registry

| Component | File | Purpose | Update Frequency |
|-----------|------|---------|------------------|
| Self-Evaluation | `SELF_EVAL.md` | Post-task reflection and scoring | After every task |
| Metrics | `METRICS.md` | Quantitative performance tracking | After every task |
| Feedback Log | `FEEDBACK_LOG.md` | User correction capture | On correction |
| Patterns | `PATTERNS.md` | Reusable solution catalog | On pattern discovery |
| Estimation | `ESTIMATION.md` | Complexity prediction calibration | After every task |
| Tool Priors | `TOOL_PRIORS.md` | Tool selection optimization | After tool usage |
| Dependency Map | `DEPENDENCY_MAP.md` | System impact relationships | On discovery |
| Confidence Log | `CONFIDENCE_LOG.md` | Certainty calibration | After predictions |
| Skills | `SKILLS.md` | Capability certification | On achievement |
| Failure Modes | `FAILURE_MODES.md` | Failure class taxonomy | On failure |

---

## Improvement Loop (OMAR Cycle)

### 1. OBSERVE
Capture raw data about task execution:
- What was attempted
- What tools were used
- What outcomes occurred
- How long it took
- What user said

### 2. MEASURE
Quantify observations:
- Success/failure rates by task type
- Time-to-completion distributions
- Tool effectiveness scores
- Confidence calibration scores
- Estimation accuracy ratios

### 3. ANALYZE
Extract patterns and insights:
- What predicts success?
- What predicts failure?
- Which tools work best where?
- Where are confidence blind spots?
- What dependencies exist?

### 4. ADAPT
Modify behavior based on analysis:
- Update tool selection priors
- Adjust time estimates
- Add prevention patterns
- Certify new skills
- Calibrate confidence

---

## Data Flow

```
Task Start
    │
    ├──▶ Read: TOOL_PRIORS (select optimal tools)
    ├──▶ Read: ESTIMATION (predict complexity)
    ├──▶ Read: PATTERNS (apply known solutions)
    ├──▶ Read: DEPENDENCY_MAP (predict impact)
    │
Task Execution
    │
    ├──▶ Log: Confidence predictions → CONFIDENCE_LOG
    ├──▶ Log: Tool usage → TOOL_PRIORS
    │
Task Completion
    │
    ├──▶ Write: SELF_EVAL (reflection)
    ├──▶ Write: METRICS (quantitative data)
    ├──▶ Write: ESTIMATION (actual vs predicted)
    │
    ├──▶ If failure → FAILURE_MODES
    ├──▶ If pattern → PATTERNS
    ├──▶ If correction → FEEDBACK_LOG
    ├──▶ If milestone → SKILLS
    ├──▶ If dependency → DEPENDENCY_MAP
```

---

## Integration Points

### With AGENT_ROUTING.md
- Pre-task: Consult TOOL_PRIORS, ESTIMATION, PATTERNS
- Post-task: Update SELF_EVAL, METRICS

### With MEMORY.md
- LEARNINGS/ captures procedural knowledge
- Self-improvement captures meta-knowledge (about agent performance)

### With REGRESSIONS/
- FAILURE_MODES extracts patterns from regressions
- Regressions are instances; failure modes are classes

### With DEBUG_PLAYBOOK.md
- Debug cycles feed ESTIMATION
- Failure analysis feeds FAILURE_MODES

---

## Non-Negotiable Rules

1. **Measure everything measurable** — Intuition without data is guessing
2. **Reflect after every non-trivial task** — SELF_EVAL is mandatory
3. **Close the loop** — Measurements without adaptation are vanity metrics
4. **Honesty over comfort** — Log failures accurately; calibrate confidence honestly
5. **Compound knowledge** — Today's pattern is tomorrow's reflex

---

## Bootstrap Protocol

When initializing a fresh agent context:

1. Read SKILLS.md to understand certified capabilities
2. Read TOOL_PRIORS.md to select optimal tools
3. Read PATTERNS.md for applicable solutions
4. Read FAILURE_MODES.md to avoid known pitfalls
5. Read ESTIMATION.md for complexity baselines

---

## Maintenance Cadence

| Cadence | Action |
|---------|--------|
| Per Task | SELF_EVAL, METRICS, CONFIDENCE_LOG |
| Per Discovery | PATTERNS, DEPENDENCY_MAP, FAILURE_MODES |
| Per Milestone | SKILLS |
| Weekly | Aggregate METRICS, prune stale PATTERNS |
| Monthly | Recalibrate ESTIMATION, update TOOL_PRIORS weights |

---

## Success Metrics for Self-Improvement System

The system itself should be measured:

- **Estimation accuracy**: Is predicted/actual ratio improving?
- **Confidence calibration**: Do 80% confidence predictions succeed 80% of time?
- **Pattern reuse**: Are patterns being applied (not just stored)?
- **Failure prevention**: Are failure modes actually preventing repeat failures?
- **Skill progression**: Are new capabilities being certified?

---

## Version

This document follows semantic versioning for agent systems:
- **v1.0.0** — Initial comprehensive self-improvement system
