# Contributing

## Non-Negotiable Rules
- Small diffs only. Split large changes.
- No silent schema changes. Update contracts and migrations.
- Security changes must include Firestore rules tests.
- Proof required for every task.

## Required Proof Commands
Run these before opening a PR:
- node scripts/test.mjs

For emulator-driven work:
- node scripts/emulators.mjs
- node scripts/seed.mjs --reset

## Review Requirements
- Changes to rules, contracts, scripts, migrations, or agent docs require CODEOWNERS review.
- Provide test output in PR description.

## Branch Discipline
- Keep changes scoped to a single purpose.
- Document decisions in agent/DECISIONS.md when behavior changes.
