# R-0001: Typecheck failure in Next.js generated types

## Status: RESOLVED

## Summary
- Command: npm run typecheck
- Result: PASS (after fix)
- Error (before): Type '{ params: { id: string; }; }' does not satisfy the constraint 'PageProps'.
- Location: .next/types/app/[locale]/(app)/month-closes/[id]/page.ts:34

## Root Cause
Next.js 15+ changed `params` and `searchParams` to be Promises. The client component at `src/app/[locale]/(app)/month-closes/[id]/page.tsx` was using the old synchronous typing.

## Fix Applied
1. Changed params type to `Promise<{ id: string }>`
2. Used React's `use()` hook to unwrap the Promise in the client component
3. Updated dependency array to use unwrapped `id` instead of `params.id`

## Files Modified
- `src/app/[locale]/(app)/month-closes/[id]/page.tsx`

## Proof
- `npm run typecheck` -> PASS
- `node scripts/truth.mjs` -> PASS
- `node scripts/consistency.mjs` -> PASS
- `npm run lint` -> PASS (warning: unused formatMoney in exports page)
- `firebase emulators:exec --only firestore "npm test"` -> 565 passed, 4 failed (pre-existing server-only-writes tests unrelated to this fix)

## Notes
- The 4 failing tests in `server-only-writes.test.ts` are pre-existing Firestore rules test issues unrelated to this typecheck fix.
