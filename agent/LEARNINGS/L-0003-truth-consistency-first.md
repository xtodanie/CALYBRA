# L-0003: Truth and Consistency Gates First

## Category
debugging

## Tags
truth, consistency, gates, preflight, debugging

## Trigger
Starting any debugging or feature work.

## Knowledge
Always run truth and consistency checks FIRST before any debugging or implementation:

```bash
node scripts/truth.mjs
node scripts/consistency.mjs
```

Why:
- Detects drift between docs/contracts/seed and actual rules/tests
- Prevents debugging symptoms caused by misalignment
- Ensures you're working from accurate understanding

If these fail:
1. STOP feature/debug work
2. Fix drift first (treat as priority bug)
3. Only then proceed

If scripts don't exist:
- Derive truth only from `firestore.rules`, `storage.rules`, and `tests/**`
- Create SSIs to add the scripts

## Evidence
Documented in `agent/DEBUG_PLAYBOOK.md` section 0.

## Discovered
Bootstrap from project documentation.

## Status
active
