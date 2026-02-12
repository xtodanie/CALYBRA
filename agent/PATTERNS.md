# agent/PATTERNS.md

## Purpose

Catalog of reusable solutions indexed by problem type. Don't reinvent; recognize and apply.

Patterns are proven solutions. They reduce cognitive load and increase consistency.

---

## Pattern Categories

| Category | Description |
|----------|-------------|
| `arch` | Architectural patterns |
| `code` | Code implementation patterns |
| `debug` | Debugging patterns |
| `test` | Testing patterns |
| `tool` | Tool usage patterns |
| `comm` | Communication patterns |
| `proc` | Process patterns |

---

## Pattern Entry Format

```markdown
## P-NNNN: Pattern Name

### Category
[arch | code | debug | test | tool | comm | proc]

### Problem
What situation does this pattern address?

### Context
When should this pattern be applied?
- Preconditions
- Indicators

### Solution
The pattern itself — step-by-step or structural.

### Consequences
- Benefits
- Trade-offs
- Risks

### Examples
Concrete instances where this pattern was applied.

### Related Patterns
- P-XXXX (complementary)
- P-YYYY (alternative)

### Evidence
How was this pattern validated?

### Status
[active | experimental | deprecated]
```

---

## Pattern Index

| ID | Name | Category | Status |
|----|------|----------|--------|
| P-0001 | Proof-First Change | proc | active |
| P-0002 | Minimal Diff Fix | debug | active |
| P-0003 | Parallel Read | tool | active |
| P-0004 | Truth-Before-Action | proc | active |
| P-0005 | SSI Decomposition | arch | active |

---

## Pattern Entries

### P-0001: Proof-First Change

#### Category
proc

#### Problem
Changes that break things, discovered too late.

#### Context
- Any code modification
- Any rules change
- Any configuration change

#### Solution
1. Identify applicable proof commands BEFORE coding
2. Run proof commands to establish baseline
3. Make minimal change
4. Run proof commands again
5. Only proceed if proofs pass

#### Consequences
- **Benefits**: Catches breaks immediately, prevents regressions
- **Trade-offs**: Slightly slower individual changes
- **Risks**: None

#### Examples
- Firebase rules changes: Run emulator tests before and after
- TypeScript changes: Run typecheck before and after

#### Related Patterns
- P-0002 Minimal Diff Fix
- P-0004 Truth-Before-Action

#### Evidence
Core project practice documented in AGENT_ROUTING.md

#### Status
active

---

### P-0002: Minimal Diff Fix

#### Category
debug

#### Problem
Debug fixes that introduce new bugs or are hard to review.

#### Context
- Fixing a bug
- Addressing a failing test
- Resolving a regression

#### Solution
1. Identify exact failure (reproduce deterministically)
2. Locate minimal code responsible
3. Change ONLY what is necessary
4. Avoid "while I'm here" additions
5. One logical change per diff

#### Consequences
- **Benefits**: Easy to review, easy to revert, clear causation
- **Trade-offs**: May require multiple PRs for related changes
- **Risks**: None

#### Examples
- Typecheck fix: Change only the offending type, not surrounding code
- Rules fix: Change only the failing rule, not unrelated rules

#### Related Patterns
- P-0001 Proof-First Change

#### Evidence
Core project practice documented in DEBUG_PLAYBOOK.md

#### Status
active

---

### P-0003: Parallel Read

#### Category
tool

#### Problem
Sequential reads slow down context gathering.

#### Context
- Need to read multiple independent files
- Gathering context for a task
- Understanding a codebase area

#### Solution
1. Identify all files needed
2. Invoke multiple read_file calls in single batch
3. Process results together

#### Consequences
- **Benefits**: Faster context gathering
- **Trade-offs**: None
- **Risks**: May read files that turn out to be unnecessary

#### Examples
- Reading AGENT_ROUTING.md, ARCHITECTURE.md, DECISIONS.md together

#### Related Patterns
- None

#### Evidence
Tool efficiency best practice

#### Status
active

---

### P-0004: Truth-Before-Action

#### Category
proc

#### Problem
Acting on outdated or incorrect understanding of repo state.

#### Context
- Starting any new task
- After context switches
- Before planning changes

#### Solution
1. Run `node scripts/truth.mjs`
2. Run `node scripts/consistency.mjs`
3. If either fails, STOP and fix drift
4. Only then proceed with task

#### Consequences
- **Benefits**: Ensures accurate understanding, prevents drift-caused bugs
- **Trade-offs**: Small time investment upfront
- **Risks**: None

#### Examples
- Starting debug session: Run truth scripts first
- Implementing feature: Run truth scripts first

#### Related Patterns
- P-0001 Proof-First Change

#### Evidence
Core project practice documented in PREFLIGHT.md

#### Status
active

---

### P-0005: SSI Decomposition

#### Category
arch

#### Problem
Large changes that are hard to review, test, and roll back.

#### Context
- Multi-surface changes
- Complex features
- Changes spanning >2 files or concerns

#### Solution
1. Define Smallest Shippable Increment (SSI)
2. Each SSI must be independently valuable
3. Each SSI must be independently testable
4. Route each SSI through appropriate agent
5. Execute in order: security → data → implementation → proofs

#### Consequences
- **Benefits**: Incremental progress, easy rollback, clear responsibility
- **Trade-offs**: More planning overhead
- **Risks**: Over-decomposition can fragment logic

#### Examples
- Feature with UI + rules: SSI-1 = rules + tests, SSI-2 = UI wiring

#### Related Patterns
- P-0001 Proof-First Change

#### Evidence
Core project practice documented in AGENT_ROUTING.md

#### Status
active

---

## Pattern Discovery Protocol

When you solve a problem that:
- Took significant effort
- Could recur
- Has generalizable structure

Then:
1. Extract the pattern
2. Name it clearly
3. Document using the format above
4. Add to index

---

## Pattern Application Protocol

Before solving a problem:
1. Check PATTERNS.md for applicable patterns
2. Apply matching pattern(s)
3. Note any pattern gaps or improvements

---

## Integration

- **LEARNINGS/**: Learnings are instances; patterns are generalizations
- **FAILURE_MODES.md**: Failure modes have corresponding prevention patterns
- **SELF_EVAL.md**: Pattern application noted in evaluation
