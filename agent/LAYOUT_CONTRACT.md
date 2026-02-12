# agent/LAYOUT_CONTRACT.md

## Purpose
Define a single spatial ownership contract for authenticated app routes so sidebar/content layout cannot drift per-page.

## Contract (Non-Negotiable)
- Only `src/app/[locale]/(app)/layout.tsx` controls authenticated app columns.
- Sidebar is in normal layout flow (grid child), not viewport-fixed.
- No page-level sidebar compensation (`ml-*`, `pl-*`, `calc(100% - ...)`) is allowed for app routes.
- Scroll ownership belongs to the content area (`main`), not the whole viewport shell.
- Content centering is owned by app layout (`max-w-7xl mx-auto`) and must not be duplicated as sidebar compensation.

## Width Constants
- Sidebar widths are defined in one place: `src/components/layout/layout-constants.ts`.
- Canonical values:
  - `SIDEBAR_COLLAPSED = 80`
  - `SIDEBAR_EXPANDED = 240`

## Allowed `fixed` Usage
- `position: fixed` is allowed only for overlays that are inherently viewport-based (modal/sheet/tooltip/popover-like surfaces).
- Navigation shells and page layout primitives must remain flow-based.

## Verification Checklist
- DevTools layout shows two grid columns in authenticated app shell.
- No app page references sidebar width classes or calculations.
- No content is hidden behind sidebar.
- No horizontal overflow is introduced by shell layout.
