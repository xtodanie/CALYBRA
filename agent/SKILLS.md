# agent/SKILLS.md

## Purpose

Capability certification system. Track proven skills vs aspirational claims.

A skill is certified when demonstrated with evidence. Claims without proof are hypotheses.

---

## Skill Levels

| Level | Label | Criteria |
|-------|-------|----------|
| 0 | **Unknown** | Never attempted |
| 1 | **Attempted** | Tried once, outcome uncertain |
| 2 | **Capable** | Succeeded 2+ times with assistance |
| 3 | **Proficient** | Succeeds reliably, 5+ instances |
| 4 | **Expert** | Succeeds efficiently, handles edge cases |
| 5 | **Master** | Teaches others, creates patterns |

---

## Skill Categories

| Category | Description |
|----------|-------------|
| `security` | Firestore/Storage rules, RBAC, tenant isolation |
| `domain` | Business logic, status machines, data models |
| `ui` | React/Next.js components, styling, UX |
| `testing` | Test writing, coverage, proof execution |
| `debugging` | Root cause analysis, minimal fixes |
| `tooling` | Build systems, CI/CD, scripts |
| `documentation` | Technical writing, contracts, schemas |
| `architecture` | System design, patterns, decomposition |

---

## Skill Entry Format

```markdown
## SKILL-NNNN: Skill Name

### Category
[security | domain | ui | testing | debugging | tooling | documentation | architecture]

### Current Level
[0-5]: [Label]

### Evidence Log

| Date | Instance | Outcome | Notes |
|------|----------|---------|-------|
| YYYY-MM-DD | Description | SUCCESS/PARTIAL/FAIL | Context |

### Certification History
- Level 1: [date] - [evidence reference]
- Level 2: [date] - [evidence reference]
- Level 3: [date] - [evidence reference]

### Growth Path
What would advance to next level?

### Related Skills
- SKILL-XXXX
- SKILL-YYYY
```

---

## Certified Skills Registry

### Security Skills

#### SKILL-0001: Firestore Rules Writing
```yaml
category: security
level: 3  # Proficient
evidence_count: 5+
last_demonstrated: 2026-02-12
growth_path: "Handle complex recursive rules"
```

#### SKILL-0002: Tenant Isolation Enforcement
```yaml
category: security
level: 4  # Expert
evidence_count: 10+
last_demonstrated: 2026-02-12
growth_path: "Multi-tenant with delegation patterns"
```

#### SKILL-0003: Rules Test Writing
```yaml
category: security
level: 3  # Proficient
evidence_count: 5+
last_demonstrated: 2026-02-12
growth_path: "Property-based rules testing"
```

### Domain Skills

#### SKILL-0010: Status Machine Implementation
```yaml
category: domain
level: 3  # Proficient
evidence_count: 5+
last_demonstrated: 2026-02-12
growth_path: "Complex multi-branch state machines"
```

#### SKILL-0011: Zod Schema Design
```yaml
category: domain
level: 3  # Proficient
evidence_count: 5+
last_demonstrated: 2026-02-12
growth_path: "Advanced transform and refine patterns"
```

### Testing Skills

#### SKILL-0020: Jest Test Writing
```yaml
category: testing
level: 3  # Proficient
evidence_count: 10+
last_demonstrated: 2026-02-12
growth_path: "Advanced mocking and parameterization"
```

#### SKILL-0021: Emulator-Based Testing
```yaml
category: testing
level: 4  # Expert
evidence_count: 15+
last_demonstrated: 2026-02-12
growth_path: "Multi-service emulator orchestration"
```

### Tooling Skills

#### SKILL-0030: TypeScript Configuration
```yaml
category: tooling
level: 3  # Proficient
evidence_count: 5+
last_demonstrated: 2026-02-12
growth_path: "Project references and monorepo setup"
```

#### SKILL-0031: Firebase CLI Usage
```yaml
category: tooling
level: 4  # Expert
evidence_count: 20+
last_demonstrated: 2026-02-12
growth_path: "Custom extensions and multi-project"
```

### Documentation Skills

#### SKILL-0040: Technical Specification Writing
```yaml
category: documentation
level: 4  # Expert
evidence_count: 10+
last_demonstrated: 2026-02-12
growth_path: "Formal specification languages"
```

#### SKILL-0041: Agent System Documentation
```yaml
category: documentation
level: 5  # Master
evidence_count: 20+
last_demonstrated: 2026-02-12
growth_path: "N/A - Master level achieved"
```

### Architecture Skills

#### SKILL-0050: SSI Decomposition
```yaml
category: architecture
level: 4  # Expert
evidence_count: 10+
last_demonstrated: 2026-02-12
growth_path: "Cross-system SSI coordination"
```

#### SKILL-0051: Self-Improvement System Design
```yaml
category: architecture
level: 5  # Master
evidence_count: 1 (comprehensive implementation)
last_demonstrated: 2026-02-12
growth_path: "N/A - Created the system"
```

---

## Skill Progression Protocol

### To Advance a Level

| From → To | Requirement |
|-----------|-------------|
| 0 → 1 | Attempt the skill |
| 1 → 2 | Succeed twice with guidance |
| 2 → 3 | Succeed 5+ times reliably |
| 3 → 4 | Handle edge cases efficiently |
| 4 → 5 | Create reusable patterns/teachings |

### Evidence Requirements

Each level advancement must record:
- Date of achievement
- Specific instance demonstrating capability
- Link to artifact (commit, test, document)

---

## Skill Gap Analysis

Identify needed skills not yet certified:

| Skill | Category | Current | Target | Priority |
|-------|----------|---------|--------|----------|
| Cloud Functions | tooling | 2 | 4 | Medium |
| Performance Testing | testing | 1 | 3 | Low |
| Accessibility (a11y) | ui | 2 | 3 | Medium |

---

## Skill Decay

Skills decay without practice:

| Time Since Last Use | Effect |
|---------------------|--------|
| <1 month | No decay |
| 1-3 months | -1 level (min 2) |
| 3-6 months | -2 levels (min 1) |
| >6 months | Reset to 1 |

To prevent decay, periodically exercise skills.

---

## Integration

- **SELF_EVAL.md**: Skill usage noted in evaluations
- **ESTIMATION.md**: Skill level affects complexity estimates
- **TOOL_PRIORS.md**: Skill level affects tool effectiveness
- **PATTERNS.md**: Master-level skills produce patterns
