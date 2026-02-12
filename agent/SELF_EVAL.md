# agent/SELF_EVAL.md

## Purpose

Post-task reflection system. Every non-trivial task MUST produce a self-evaluation entry.

Self-evaluation is not self-congratulation. It is honest assessment to drive improvement.

---

## Evaluation Triggers

**MUST evaluate** (mandatory):
- Task completion (success or failure)
- Debug cycle >5 minutes
- User correction received
- Multi-step implementation

**SHOULD evaluate** (recommended):
- Novel approach attempted
- Unexpected outcome
- Tool failure encountered

---

## Evaluation Entry Format

```markdown
## EVAL-YYYY-MM-DD-NNNN

### Task Summary
[One-line description of what was attempted]

### Outcome
[SUCCESS | PARTIAL | FAILURE]

### Scores (1-5 scale)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Correctness | X | Did the solution work? |
| Efficiency | X | Was the approach optimal? |
| Completeness | X | Were all requirements met? |
| Communication | X | Was output clear and useful? |
| Tool Usage | X | Were tools used effectively? |

### What Went Well
- [Specific positive outcome 1]
- [Specific positive outcome 2]

### What Could Improve
- [Specific improvement area 1]
- [Specific improvement area 2]

### Learnings Extracted
- [ ] Captured as L-NNNN: [title]
- [ ] Captured as pattern P-NNNN: [title]
- [ ] Captured as failure mode F-NNNN: [title]

### Counterfactual
What would I do differently with hindsight?

### Confidence Calibration
- Pre-task confidence: [X]%
- Actual outcome: [SUCCESS/PARTIAL/FAILURE]
- Calibration note: [Was confidence accurate?]
```

---

## Scoring Rubric

### Correctness (Did it work?)
- **5**: Perfect, no issues found
- **4**: Works with minor imperfections
- **3**: Mostly works, some edge cases fail
- **2**: Partially works, significant issues
- **1**: Does not work

### Efficiency (Was approach optimal?)
- **5**: Optimal path, minimal waste
- **4**: Good path, slight detours
- **3**: Reasonable path, some unnecessary steps
- **2**: Inefficient, many wasted steps
- **1**: Extremely inefficient, major rework

### Completeness (All requirements met?)
- **5**: All requirements fully satisfied
- **4**: Requirements met, minor omissions
- **3**: Core requirements met, some gaps
- **2**: Significant gaps
- **1**: Requirements not met

### Communication (Output clarity?)
- **5**: Crystal clear, perfectly formatted
- **4**: Clear with minor formatting issues
- **3**: Understandable but could be clearer
- **2**: Confusing or poorly organized
- **1**: Unclear or unhelpful

### Tool Usage (Tools effective?)
- **5**: Optimal tool selection and usage
- **4**: Good tool usage, minor inefficiencies
- **3**: Adequate tool usage
- **2**: Poor tool selection or usage
- **1**: Tool failures or wrong tool choices

---

## Aggregation

Weekly aggregation calculates:
- Average scores by dimension
- Success rate (SUCCESS / total)
- Trend direction (improving/declining/stable)

---

## Current Evaluations

<!-- Entries below this line -->

### Bootstrap Entry

```markdown
## EVAL-2026-02-12-0001

### Task Summary
Implemented comprehensive agent self-improvement system.

### Outcome
SUCCESS

### Scores (1-5 scale)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Correctness | 5 | All components created correctly |
| Efficiency | 4 | Many files, parallelized where possible |
| Completeness | 5 | All requested capabilities included |
| Communication | 5 | Clear structure and documentation |
| Tool Usage | 5 | Effective use of create_file and parallel operations |

### What Went Well
- Comprehensive architecture designed upfront
- Consistent formatting across all components
- Integration points clearly defined

### What Could Improve
- Could have created template files for each entry type
- Could have added more bootstrap entries

### Learnings Extracted
- [x] Self-improvement system architecture pattern

### Counterfactual
Would start with SELF_IMPROVEMENT.md architecture doc first (which I did).

### Confidence Calibration
- Pre-task confidence: 90%
- Actual outcome: SUCCESS
- Calibration note: Confidence was accurate
```
