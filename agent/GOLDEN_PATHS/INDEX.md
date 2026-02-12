# Golden Paths Index

Manual E2E verification checklists for core Calybra workflows.

## Purpose

Golden Paths are **manual verification scripts** that prove the system works end-to-end before production deployment. Each path tests a critical user journey.

## Paths

| ID | Path | Purpose |
|----|------|---------|
| GP-01 | [Onboarding](GP-01-Onboarding.md) | User signup → tenant creation |
| GP-02 | [Upload & Ingestion](GP-02-Upload-Ingestion.md) | File upload → parsing → document creation |
| GP-03 | [Match Workflow](GP-03-Match-Workflow.md) | Auto-match → confirm/reject |
| GP-04 | [Month Close](GP-04-MonthClose-Finalize.md) | DRAFT → IN_REVIEW → FINALIZED |
| GP-05 | [Exception Resolution](GP-05-Exception-Resolution.md) | Exception → resolved |

## When to Run

- **Before Production Deploy**: All 5 paths must pass
- **After Major Changes**: Run affected paths
- **Weekly**: Run full suite on staging

## How to Record Results

```markdown
## GP-XX Run Results
- **Date**: YYYY-MM-DD
- **Environment**: Local / Staging / Production
- **Tester**: [name]
- **Result**: PASS / FAIL
- **Notes**: [any observations]
```

## Failure Protocol

If any step fails:
1. Document exact failure in the path file
2. Check `agent/DEBUG_PLAYBOOK.md` for known issues
3. If new issue, create entry in `agent/REGRESSIONS/`
4. Do NOT proceed with deploy until resolved

## Latest Run Results

### Run Date: 2026-02-12
- **Environment**: Local (Windows, Firebase emulators)
- **Tester**: Copilot (automated evidence + operational checks)

| GP | Result | Evidence | Notes |
|----|--------|----------|-------|
| GP-01 | BLOCKED (manual) | Auth emulator reachable on `127.0.0.1:9099`; app reachable on `127.0.0.1:9002` | Manual signup + Firestore visual verification not executed in this run. |
| GP-02 | BLOCKED (manual) | Invariants and workflow suites pass under emulator baseline | Manual file upload UI and generated document inspection not executed in this run. |
| GP-03 | PARTIAL PASS | `firebase emulators:exec --only firestore "npm test"` → 570 passed | Backend security/transition invariants green; manual confirm/reject UI walkthrough pending. |
| GP-04 | PARTIAL PASS | `npx firebase emulators:exec "node scripts/step4_readmodel_audit.mjs" --project demo-calybra` → 7 PASS, 0 FAIL | FINALIZED/readmodel behavior proven; manual UI lifecycle walkthrough pending. |
| GP-05 | PARTIAL PASS | `firebase emulators:exec --only firestore "npm test"` → 570 passed | Exception-related rule/invariant coverage green; manual resolve flow in UI pending. |

**Gate Status**
- Golden Paths are **NOT FULLY CLOSED** until GP-01 and GP-02 are executed manually and GP-03..GP-05 UI walkthroughs are completed and recorded as PASS.
