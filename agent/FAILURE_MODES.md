# agent/FAILURE_MODES.md

## Purpose

Failure class taxonomy. Regressions are instances; failure modes are patterns.

Understanding failure modes prevents entire classes of bugs, not just individual instances.

---

## Failure Mode Categories

| Category | Code | Description |
|----------|------|-------------|
| Security | SEC | Authentication, authorization, data leakage |
| Data Integrity | DAT | Corruption, inconsistency, loss |
| Logic | LOG | Incorrect behavior, wrong output |
| Performance | PER | Slow, resource exhaustion, timeouts |
| Integration | INT | Service communication, API mismatch |
| Configuration | CFG | Environment, settings, deployment |
| Tooling | TLG | Build, test, CI/CD failures |
| Human | HUM | Miscommunication, misunderstanding |

---

## Failure Mode Entry Format

```markdown
## F-NNNN: Failure Mode Name

### Category
[SEC | DAT | LOG | PER | INT | CFG | TLG | HUM]

### Severity
[Critical | High | Medium | Low]

### Description
What characterizes this failure mode?

### Symptoms
How does this failure manifest?
- Symptom 1
- Symptom 2

### Root Causes
What typically causes this failure?
- Cause 1
- Cause 2

### Prevention
How to prevent this failure?
- Prevention 1
- Prevention 2

### Detection
How to detect this failure early?
- Detection 1
- Detection 2

### Recovery
How to recover from this failure?
- Recovery 1
- Recovery 2

### Instances
Related regression entries:
- R-NNNN: [title]

### Related Patterns
Prevention patterns:
- P-NNNN: [title]
```

---

## Failure Mode Registry

### Security Failures

#### F-0001: Tenant Isolation Breach
```markdown
### Category
SEC

### Severity
Critical

### Description
User can access data belonging to a different tenant.

### Symptoms
- Cross-tenant data in query results
- User sees other tenant's documents
- Rules tests pass but production has leakage

### Root Causes
- Missing tenantId check in rules
- Query doesn't filter by tenant
- Join/reference bypasses tenant scope
- Admin context used incorrectly

### Prevention
- Tenant-scoped paths (tenants/{tenantId}/...)
- invariant tests for cross-tenant denial
- No "request.auth.uid == resource.data.userId" without tenantId
- Code review for tenant scope

### Detection
- Cross-tenant test cases in invariants
- Query audit for tenant filter
- Production monitoring for cross-tenant access

### Recovery
- Immediate rules hotfix
- Audit access logs
- Notify affected tenants
- Post-mortem

### Instances
None (prevention working)

### Related Patterns
- P-0001: Proof-First Change
```

#### F-0002: Privilege Escalation
```markdown
### Category
SEC

### Severity
Critical

### Description
User gains permissions they shouldn't have (e.g., role change).

### Symptoms
- User performing admin actions without role
- Role field modified by client
- Server-only fields changed

### Root Causes
- Client can write role field
- Missing server-only validation
- Rules don't check role immutability

### Prevention
- Server-authoritative role assignment
- Rules deny client role writes
- immutable field lists in schemas

### Detection
- Invariant tests for role modification denial
- Audit logs for role changes

### Recovery
- Revert unauthorized roles
- Revoke sessions
- Audit actions taken with elevated privileges

### Instances
None (prevention working)

### Related Patterns
- P-0001: Proof-First Change
```

### Data Integrity Failures

#### F-0010: Status Machine Violation
```markdown
### Category
DAT

### Severity
High

### Description
Document transitions to invalid status or skips required states.

### Symptoms
- Document in unexpected status
- Business logic assumes status that doesn't exist
- UI shows invalid state options

### Root Causes
- Missing status transition validation in rules
- Client bypasses status checks
- Edge case in transition logic

### Prevention
- Rules enforce valid transitions
- Schema enforces status enum
- Integration tests for all transitions

### Detection
- Consistency scripts check status values
- Query for documents in invalid states

### Recovery
- Manual status correction
- Audit affected documents
- Backfill missing state data

### Instances
None (prevention working)

### Related Patterns
- P-0004: Truth-Before-Action
```

#### F-0011: Orphaned References
```markdown
### Category
DAT

### Severity
Medium

### Description
Reference points to document that doesn't exist.

### Symptoms
- Null/undefined when dereferencing
- UI shows "not found" or crashes
- Queries return incomplete data

### Root Causes
- Deletion without cascade
- Race condition in creation
- Manual data manipulation

### Prevention
- Cascade delete or soft delete
- Transaction for related creates
- Reference validation

### Detection
- Integrity scripts check references
- Error monitoring for dereference failures

### Recovery
- Remove orphaned references
- Restore referenced documents
- Backfill missing data

### Instances
None (architecture prevents)

### Related Patterns
None specified
```

### Configuration Failures

#### F-0020: Emulator Port Conflict
```markdown
### Category
CFG

### Severity
Low

### Description
Emulator fails to start due to port already in use.

### Symptoms
- "Port XXXX already in use"
- Emulator startup hangs
- Tests can't connect

### Root Causes
- Previous emulator still running
- Other service using port
- Zombie process

### Prevention
- Kill emulators before starting
- Use unique ports per project
- Check port availability

### Detection
- Startup error message
- Connection timeout in tests

### Recovery
- Kill process on port
- Change port in firebase.json
- Restart machine if needed

### Instances
Common occurrence

### Related Patterns
- P-0004: Truth-Before-Action (checks for issues first)
```

### Tooling Failures

#### F-0030: TypeScript Version Mismatch
```markdown
### Category
TLG

### Severity
Medium

### Description
TypeScript compiler behaves differently than expected due to version differences.

### Symptoms
- Types that work locally fail in CI
- New features not recognized
- Different error messages

### Root Causes
- npm vs npx version difference
- Global vs local install
- lockfile drift

### Prevention
- Pin TypeScript version exactly
- Use npx for consistent version
- Check versions in CI

### Detection
- Run `npx tsc --version` in CI
- Version mismatch in error messages

### Recovery
- Align versions
- Regenerate lockfile
- Clear caches

### Instances
- R-0001: Typecheck failure (related)

### Related Patterns
None specified
```

#### F-0031: Next.js Breaking API Change
```markdown
### Category
TLG

### Severity
Medium

### Description
Next.js upgrade changes API signature causing build/runtime failures.

### Symptoms
- Build errors after upgrade
- Type errors in page components
- Runtime behavior change

### Root Causes
- Major version upgrade
- Breaking change in patch (rare)
- Documentation not updated

### Prevention
- Read release notes before upgrade
- Test in isolation
- Pin version until ready

### Detection
- Build failure
- Typecheck failure
- Runtime errors

### Recovery
- Revert upgrade
- Apply migration guide
- Update code to new API

### Instances
- R-0001: Next.js 15 async params change

### Related Patterns
- L-0002: Next.js async params pattern
```

---

## Failure Mode Analysis Protocol

When a new failure occurs:

1. **Classify**: Which category?
2. **Generalize**: Is this an instance of existing mode or new mode?
3. **If existing**: Add to Instances list
4. **If new**: Create F-NNNN entry
5. **Analyze**: Root causes and contributing factors
6. **Prevent**: Add prevention measures
7. **Detect**: Add detection mechanisms

---

## Failure Mode Metrics

Track over time:

| Metric | Current | Target |
|--------|---------|--------|
| Total failure modes cataloged | 7 | -- |
| Modes with prevention | 7 | 100% |
| Modes with detection | 7 | 100% |
| Recent instances (30 days) | 0 | 0 |
| Repeat failures (same mode, 90 days) | 0 | 0 |

---

## Integration

- **REGRESSIONS/**: Regressions are instances of failure modes
- **PATTERNS.md**: Each failure mode should have prevention pattern
- **LEARNINGS/**: Learnings capture how to avoid failures
- **ESTIMATION.md**: Failure-prone areas increase complexity
