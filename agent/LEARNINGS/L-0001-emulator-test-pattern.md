# L-0001: Firebase Emulator Test Execution Pattern

## Category
testing

## Tags
firebase, emulator, jest, firestore, test-execution

## Trigger
Running tests that interact with Firestore or Storage rules.

## Knowledge
Always execute tests via `firebase emulators:exec` rather than running `npm test` directly:

```bash
# Correct - emulator wraps test execution
firebase emulators:exec --only firestore "npm test"

# For storage tests
firebase emulators:exec --only storage "npm test"

# For both
firebase emulators:exec --only firestore,storage "npm test"
```

Why:
- Ensures emulator is started and stopped cleanly
- Sets correct environment variables (FIRESTORE_EMULATOR_HOST, etc.)
- Prevents "host/port must be specified" errors
- Ensures test isolation across runs

Common failure mode:
- Running `npm test` directly → tests fail with emulator not found
- Running emulator in background then tests → port conflicts or stale state

## Evidence
Documented in `agent/DEBUG_PLAYBOOK.md` section 1.1

## Discovered
Bootstrap from project documentation.

## Status
active
