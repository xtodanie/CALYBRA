# CALYBRA Quick Start Guide

This is a condensed version of the setup instructions. For full documentation, see the [main README](../README.md).

## Fastest Way to Run

### Just the UI (no backend)

```bash
npm install
npm run dev
```

Open http://localhost:9002

### With Full Backend (Firestore, Auth, Functions)

**Terminal 1:**
```bash
npm install
npx firebase emulators:start
```

**Terminal 2:**
```bash
npm run dev
```

- Application: http://localhost:9002
- Emulator UI: http://127.0.0.1:4001

## Quick Commands Reference

| What | Command |
|------|---------|
| Install dependencies | `npm install` |
| Start dev server | `npm run dev` |
| Start Firebase emulators | `npx firebase emulators:start` |
| Run tests | `npm test` |
| Build for production | `npm run build` |
| Type checking | `npm run typecheck` |
| Linting | `npm run lint` |

## Need Help?

- **Detailed setup:** See [README.md](../README.md)
- **Technical specs:** See [CONTRACTS.MD](../CONTRACTS.MD)
- **Architecture:** See [docs/](.)

## Common Issues

**Port 9002 in use?**
```bash
# Kill the process or change port in package.json
```

**Emulator port conflicts?**
```bash
# Stop all emulators
npx firebase emulators:stop
# Or press Ctrl+C in the emulator terminal
```

**Tests not running?**
```bash
# Make sure emulators are running first
npx firebase emulators:start  # in one terminal
npm test                       # in another terminal
```
