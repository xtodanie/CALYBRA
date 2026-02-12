# agent/DEPENDENCY_MAP.md

## Purpose

Track which files and systems affect which others. Predict blast radius before making changes.

Dependencies are hidden risks. Mapping them prevents surprise breakages.

---

## Dependency Types

| Type | Description | Notation |
|------|-------------|----------|
| `imports` | Code import/require | `→` |
| `extends` | Class/interface inheritance | `⇒` |
| `uses` | Runtime usage without import | `⤳` |
| `generates` | Build-time generation | `⊳` |
| `enforces` | Security/validation enforcement | `⊢` |
| `documents` | Documentation relationship | `📖` |
| `tests` | Test coverage relationship | `✓` |

---

## Critical Dependencies

### Security Layer
```
firestore.rules
    ⊢ tenants/{tenantId}/**           # Tenant isolation
    ⊢ users/{uid}                      # User profile auth
    ✓ tests/invariants/*.test.ts       # Invariant tests
    📖 agent/SECURITY_MODEL.md         # Documentation
    📖 contracts/firestore.schema.md   # Schema contract

storage.rules
    ⊢ tenants/{tenantId}/files/**     # File access control
    ✓ tests/invariants/storage*.ts    # Storage tests
    📖 agent/SECURITY_MODEL.md        # Documentation
```

### Domain Layer
```
src/domain/schemas/*.schema.ts
    → src/lib/types.ts                 # Type definitions
    ⊢ firestore.rules                  # Rules use same status values
    📖 contracts/status-machines.md    # Status machine spec
    ✓ tests/**/*.test.ts               # Domain tests

src/lib/types.ts
    ← src/domain/schemas/*.ts          # Imported by schemas
    ← src/app/**/*.tsx                 # Imported by UI
    ← functions/src/**/*.ts            # Imported by functions
```

### Truth Layer
```
scripts/truth.mjs
    → firebase.json                    # Reads config
    → firestore.rules                  # Verifies existence
    → storage.rules                    # Verifies existence
    → contracts/*.md                   # Verifies contracts
    ⊳ agent/TRUTH_SNAPSHOT.md         # Generates snapshot

scripts/consistency.mjs
    → firestore.rules                  # Checks consistency
    → src/lib/types.ts                 # Checks types
    → src/domain/schemas/*.ts          # Checks schemas
    → contracts/*.md                   # Checks contracts
```

---

## Change Impact Matrix

What needs checking when you change:

| If You Change | Also Check |
|---------------|------------|
| `firestore.rules` | `tests/invariants/*`, `contracts/firestore.schema.md`, `scripts/consistency.mjs` |
| `storage.rules` | Storage tests, `agent/SECURITY_MODEL.md` |
| `src/lib/types.ts` | All consuming files, `src/domain/schemas/*`, consistency script |
| `src/domain/schemas/*.ts` | UI components, functions, rules consistency |
| `contracts/*.md` | Truth script, consistency script, related code |
| `firebase.json` | Emulator tests, deployment, truth script |
| `seed/*.json` | E2E tests, `scripts/e2e_*.mjs` |
| `functions/src/**` | Function tests, deployed behavior |
| `src/app/**` | UI behavior, may need visual verification |

---

## Graph Representation

### Core Data Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Firestore  │────▶│    Rules    │
│   (Next.js) │     │   (Data)    │     │  (Security) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Schemas   │────▶│   Types     │◀────│  Contracts  │
│  (Zod etc)  │     │ (TypeScript)│     │ (Markdown)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Tests     │
                    │ (Invariants)│
                    └─────────────┘
```

### Agent Document Dependencies
```
┌─────────────────────┐
│   AGENT_ROUTING.md  │
└──────────┬──────────┘
           │
     ┌─────┴─────┬─────────────┬──────────────┐
     ▼           ▼             ▼              ▼
┌─────────┐ ┌─────────┐ ┌───────────┐ ┌────────────┐
│PREFLIGHT│ │EVIDENCE │ │  MEMORY   │ │ SELF_IMPRO │
│   .md   │ │FORMAT.md│ │   .md     │ │  VEMENT.md │
└─────────┘ └─────────┘ └─────┬─────┘ └─────┬──────┘
                              │             │
                    ┌─────────┴───┐   ┌─────┴─────┐
                    ▼             ▼   ▼           ▼
              ┌─────────┐   ┌─────────────┐ ┌──────────┐
              │LEARNINGS│   │  PATTERNS   │ │ METRICS  │
              │   /     │   │     .md     │ │   .md    │
              └─────────┘   └─────────────┘ └──────────┘
```

---

## Dependency Entry Format

```markdown
## DEP-NNNN: [Source] → [Target]

### Type
[imports | extends | uses | generates | enforces | documents | tests]

### Direction
[source] depends on [target]
-OR-
[source] is depended upon by [target]

### Strength
[strong | medium | weak]
- Strong: Change in target likely breaks source
- Medium: Change may require source update
- Weak: Change unlikely to affect source

### Discovery Context
How was this dependency discovered?

### Verification
How to verify this dependency still holds?
```

---

## Dependency Discovery Protocol

When discovering a new dependency:

1. Identify source and target
2. Classify type and strength
3. Add to appropriate section
4. Update Change Impact Matrix if significant

---

## Blast Radius Estimation

Before making a change:

1. Find the file/system in this map
2. Trace all outgoing dependencies
3. Trace all incoming dependencies
4. Estimate affected surface area
5. Plan verification for each affected area

---

## Stale Dependency Detection

Dependencies can become stale. Check for:

- Imports that no longer exist
- Tests that no longer run
- Documentation that no longer matches
- Enforcements that no longer apply

Run periodic audits using:
```bash
# Check for dead imports
npm run lint # with unused import rules

# Check for stale tests
npm test -- --listTests

# Check documentation alignment
node scripts/consistency.mjs
```

---

## Integration

- **ESTIMATION.md**: Dependencies affect complexity
- **PATTERNS.md**: Dependency patterns (e.g., layered architecture)
- **FAILURE_MODES.md**: Dependency failures are a failure class
