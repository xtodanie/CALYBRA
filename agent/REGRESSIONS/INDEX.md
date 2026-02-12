# Regression Index

All regressions discovered during development. Each entry documents root cause, fix, and prevention.

## Active Regressions

None currently.

## Resolved Regressions

| ID | Title | Discovered | Resolved | Impact |
|----|-------|-----------|----------|--------|
| R-0001 | [Next.js 15 PageProps type constraint](R-0001-typecheck-next-types.md) | 2026-02-12 | 2026-02-12 | Build blocker |
| R-0002 | [Server-only-writes tests missing monthCloseId](R-0002-server-only-writes-tests.md) | 2026-02-12 | 2026-02-12 | Test failures |

## Template

See `R-0001-typecheck-next-types.md` for the regression entry format.

## Process

When a regression is discovered:
1. Create `R-NNNN-short-name.md` in this folder
2. Add entry to this INDEX.md
3. Document: symptom, root cause, fix, prevention
4. Link from the relevant RELEASE.md entry
