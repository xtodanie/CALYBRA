# Seed Data

These JSON files are intended for local emulator seeding only.
Tenant-scoped collections are written under tenants/{tenantId}/...

## Usage
- Start emulators: node scripts/emulators.mjs
- Seed data: node scripts/seed.mjs --reset

## Files
- tenants.json
- users.json
- invoices.json
- bankTx.json
- matches.json
- monthCloses.json
- fileAssets.json
