# agent/RUNBOOK.md

## Purpose

This runbook defines the canonical developer workflow for Calybra.

This is an execution document. If a command here does not work, fix the runbook immediately.

---

## Non-Negotiable Operating Rules

1) **Truth first**  
   Every work session starts with the Truth Lock (`scripts/truth.mjs` + `scripts/consistency.mjs`). If it fails, do not proceed.

2) **Default deny mindset**  
   Any change touching rules, auth, tenancy, roles, or statuses must preserve invariants in `agent/SECURITY_MODEL.md`.

3) **Deterministic builds and tests**  
   - Do not skip lint/typecheck/tests.
   - Do not merge or deploy with emulator tests failing.

4) **No secrets in repo**  
   Only `NEXT_PUBLIC_*` are public. Everything else is local-only or managed by Firebase/Secret Manager.

5) **One command == one source of truth**  
   Use the runbook commands over ad-hoc alternates. If your team uses wrappers, they must call the same underlying commands.

6) **Emulators for proof**  
   Security proofs (rules tests) must run against emulators, not production.

7) **Version discipline**  
   Node and package manager versions must match repo config (`.nvmrc`, `package.json#engines`, or CI). If mismatched, you will get non-reproducible failures.

---

## Repo Structure (Expected)

Minimum expected paths:

- `agent/` (runbooks, contracts, decisions, regressions)
- `contracts/` (domain contracts, status machines)
- `seed/` (deterministic seed inputs)
- `scripts/` (truth lock, consistency, emulators, seed)
- `src/` (Next.js app code)
- `tests/` (unit + emulator-driven proofs)
- `firestore.rules`
- `storage.rules`
- `firebase.json` / `.firebaserc`

If your repo differs, update this runbook and the scripts accordingly.

---

## Environment Variables (Never in Repo)

### Next.js local

File: `.env.local` (ignored by git)

Allowed to be public (**ONLY** `NEXT_PUBLIC_*`):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Rules:

- Never put private keys, service accounts, or admin credentials in `.env.local`.
- Never use production secrets locally.
- If a variable is required for local dev, it must be documented here.

### Functions local

File: `functions/.env` (ignored by git)

Rules:

- Treat everything here as secret.
- Use emulators + local stubs over real third-party credentials.

### Production config

Use Firebase runtime config, Secret Manager, or environment variables depending on your Firebase setup.

- Do not store production secrets in the repo.
- Do not commit `.env*` files.
- Any new prod secret requires a change note in `agent/DECISIONS.md`.

---

## One-Time Setup (New Machine)

### 0) Prereqs

- Node.js version per repo (`.nvmrc` or `package.json#engines`)
- npm (or repo-mandated package manager)

Verify:

```bash
node --version
npm --version
```

### 1) Install dependencies

From repo root:

```bash
npm install
```

If subpackages exist:

```bash
npm --prefix functions install
npm --prefix calybra-database install
```

### 2) Ensure Firebase CLI is available

Install globally and keep stable:

```bash
firebase --version
```

If not available:

```bash
npm i -g firebase-tools
firebase --version
```

Policy: use `firebase ...` directly (standardized). Avoid alternates.

### 3) Select Firebase project

```bash
firebase projects:list
firebase use
```

If `.firebaserc` pins aliases, use those aliases.

### 4) First emulator verification

Run:

```bash
firebase emulators:start
```

Confirm emulator UI is reachable and services start cleanly.

---

## Daily Workflow (Canonical)

### Step 0: Truth Lock (Always First)

Run:

```bash
node scripts/truth.mjs
node scripts/consistency.mjs
```

**If scripts are missing**  
This is a repo integrity issue. Fix by adding the scripts or removing the runbook dependency and updating this runbook immediately.

**If scripts exist but fail**  
Do not proceed. Typical causes:

- drift between rules/tests and docs/contracts/seed/schemas
- missing required fields in seed data
- renamed collections/paths not reflected everywhere

Fix the drift, then rerun Truth Lock until clean.

### Step 1: Start emulators

Option A:

```bash
firebase emulators:start
```

Option B (if scripts exist):

```bash
node scripts/emulators.mjs
```

Rules:

- Use `--only` when debugging a specific area.
- Keep emulator ports stable via `firebase.json` to avoid flaky tooling.

### Step 2: Start Next.js dev server

```bash
npm run dev
```

Rule: if Next.js depends on emulators, ensure your app points to emulator hosts (typically configured in code or `.env.local`).

### Step 3: Zero-Drift Local Run (Non-Interactive)

Run the single orchestrator command:

```bash
npm run local:e2e
```

This command:

- Cleans repo-local build artifacts
- Installs dependencies (root + subpackages)
- Runs truth lock
- Boots emulators and Next.js
- Runs workflow contract tests and emulator-backed invariant tests
- Tears everything down
- Writes logs to `artifacts/step3/local_e2e.log`

If this command fails, Step 3 fails.

---

## Deterministic Seeding (If Seed Script Exists)

If you have `scripts/seed.mjs` and `/seed/*.json`:

```bash
firebase emulators:exec --only firestore "node scripts/seed.mjs --reset"
```

Rules:

- Seeding must be deterministic and idempotent.
- `--reset` must fully clear emulator state before applying seed.
- Seed must never require production credentials.
- Seed must conform to Firestore rules expectations (e.g., required `tenantId`).

If seeding fails:

- Fix seed inputs (`seed/`) or the seed script.
- Do not “manual click” data into the emulator and call it done.

---

## Testing (Canonical Proof Loop)

Baseline proof set (minimum for any change). Run in this exact order:

```bash
npm run lint
npm run typecheck
firebase emulators:exec --only firestore "npm test"
```

If you have storage rules tests:

```bash
firebase emulators:exec --only storage "npm test"
```

If you have invariants tests separated:

```bash
firebase emulators:exec --only firestore "npm test -- tests/invariants"
```

Rules:

- Emulator test commands must be runnable from a clean checkout.
- Tests must include negative assertions (deny cases), not only allow cases.
- Any rules change requires emulator test updates in the same PR.

### Subpackage builds (run when relevant)

Functions:

```bash
npm --prefix functions run build
```

Calybra database:

```bash
npm --prefix calybra-database run build
```

Rule: if you touched a package, its build must pass.

---

## Deploy (Safe Order)

Before deploy, you MUST run the baseline proof set:

```bash
npm run lint
npm run typecheck
firebase emulators:exec --only firestore "npm test"
```

Then deploy in this order:

```bash
firebase deploy --only firestore:rules,storage
firebase deploy --only firestore:indexes
firebase deploy --only functions
npm run build
firebase deploy --only hosting
```

Rules:

- Never deploy rules without proofs passing.
- Rules deploys are small and reviewable.
- If hosting depends on functions/rules changes, keep the deploy sequence.

---

## Rollback Procedures

Rollback Firestore rules:

```bash
git revert <bad-sha>
firebase deploy --only firestore:rules
firebase emulators:exec --only firestore "npm test"
```

Rollback Storage rules:

```bash
git revert <bad-sha>
firebase deploy --only storage
```

Rollback Functions:

```bash
git revert <bad-sha>
firebase deploy --only functions
```

Rollback Hosting:

```bash
git revert <bad-sha>
npm run build
firebase deploy --only hosting
```

Rules:

- Rollback must be fast and minimal.
- After rollback, rerun proofs and record a regression entry.

---

## Emergency Protocol (P0)

Trigger conditions:

- suspected cross-tenant access
- suspected privilege escalation
- rules allow unintended write/read
- finalized/immutable state can be mutated
- storage path isolation failure

Immediate response:

1) Stop feature work.
2) Roll back rules to last known-good.
3) Run proofs.
4) Create a regression entry in `agent/REGRESSIONS/`.
5) Record incident notes in ops docs (if present).

Proofs:

```bash
npm run lint
npm run typecheck
firebase emulators:exec --only firestore "npm test"
```

---

## Operational Notes

### Common failure modes

- **Everything renders as code in Markdown**: you forgot to close a fenced code block (missing closing ```).
- **Emulators fail to start**: port conflicts or malformed `firebase.json`.
- **Rules tests flaky**: using random IDs, relying on wall clock time, or using external services.
- **Typecheck differs locally vs CI**: Node/npm mismatch.

### Required updates when changing security surface

If you change any of the following:

- canonical path model
- role strings
- authority boundaries
- status vocabulary/transitions

You must also update:

- `agent/SECURITY_MODEL.md`
- `agent/TRUTH_SNAPSHOT.md` (if present)
- `agent/DECISIONS.md` (ADR entry)
- rules + tests + seed/contracts/schemas consistency (Truth Lock must pass)

