# L-0002: Next.js 15+ Async Params Pattern

## Category
ui

## Tags
nextjs, params, async, react, typescript

## Trigger
TypeScript errors about `params` not satisfying `PageProps` constraint in Next.js 15+.

## Knowledge
Next.js 15+ changed `params` and `searchParams` to be Promises. Fix pattern:

```typescript
// OLD (Next.js 14 and below)
export default function Page({ params }: { params: { id: string } }) {
  const id = params.id;
  // ...
}

// NEW (Next.js 15+)
import { use } from 'react';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // ...
}
```

Key points:
- Use React's `use()` hook to unwrap the Promise
- Update type signature to `Promise<...>`
- Use unwrapped values in dependency arrays
- This is a breaking change in Next.js 15

## Evidence
Fixed in R-0001-typecheck-next-types regression.

## Discovered
2024 - Typecheck failure investigation.

## Status
active
