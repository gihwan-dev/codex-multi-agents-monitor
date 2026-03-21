# Execution Plan

## Execution slices

### SLICE-1 - Tailwind v4 foundation and visual bootstrap

- Change boundary: Tailwind v4/Vite setup, root CSS entry, semantic token bridge, Storybook preview foundation
- Expected file count: 3 or fewer repo-tracked files per execution pass
- Validation owner: implementer + Storybook reviewer
- Focused validation plan: foundation stories render, app and Storybook boot, dark baseline token mapping is visible
- Split decision: split-first. Do not combine Vite plugin setup, root CSS entry creation, and Storybook preview refactor in one pass if the file budget exceeds 3.
- Target-file append forbidden trigger: `vite.config.ts`, `.storybook/preview.ts`, or root CSS entry exceeds one new responsibility in the same pass
- Stop / replan conditions:
  - real monitor surface integration sneaks into this slice
  - Tailwind foundation requires keeping `src/theme/primitives.css` as a second long-term styling source

### SLICE-2 - Primitive and composite stories with mock state

- Change boundary: shadcn primitive families, monitor semantic wrappers, Storybook mock fixtures
- Expected file count: 3 or fewer repo-tracked files per primitive family
- Validation owner: implementer + design reviewer
- Focused validation plan: `SCR-001` and `SCR-002` stories cover default, focus, disabled, dark/light, and monitor status states
- Split decision: one primitive family or one monitor composite family per pass
- Target-file append forbidden trigger: a shared primitive file starts accumulating screen-specific logic or more than one unrelated variant axis
- Stop / replan conditions:
  - real app screen migration is attempted before stories are approved
  - a primitive family needs divergent variants for unrelated monitor surfaces

### SLICE-3 - Top chrome and shared controls in the real app

- Change boundary: top bar, shared buttons/toggles/menus/tabs, command/help surfaces
- Expected file count: 3 or fewer repo-tracked files per surface pass
- Validation owner: implementer + app smoke reviewer
- Focused validation plan: keyboard shortcuts survive, top chrome remains readable, no regression in follow-live/export/help affordances
- Split decision: migrate one app chrome surface at a time
- Target-file append forbidden trigger: `MonitorPage.tsx` starts absorbing primitive definitions or temporary compatibility wrappers
- Stop / replan conditions:
  - app behavior changes beyond the surface contract
  - migrated chrome still depends on new legacy selectors

### SLICE-4 - Rail, summary, inspector, and drawer migration

- Change boundary: workspace rail, summary strip, inspector shell, drawer shell
- Expected file count: 3 or fewer repo-tracked files per surface pass
- Validation owner: implementer + fixture reviewer
- Focused validation plan: default, waiting, dense parallel, and import-open fixtures preserve orientation and focus behavior
- Split decision: rail, summary, inspector, drawer are separate passes even if they share primitives
- Target-file append forbidden trigger: a widget file mixes new component composition with old selector rewrites in the same pass
- Stop / replan conditions:
  - drawer or inspector focus return breaks
  - surface migration cannot proceed without redesigning selectors/state logic

### SLICE-5 - Graph-adjacent shell migration and primitive CSS retirement

- Change boundary: graph toolbar/panel wrappers, gap detail shell, removal of primitive-layer presentation CSS
- Expected file count: 3 or fewer repo-tracked files per pass
- Validation owner: implementer + dense-run reviewer
- Focused validation plan: graph readability, gap emphasis, status semantics, and panel hierarchy on dense fixtures
- Split decision: migrate shell/chrome around the graph before touching graph event-row styling
- Target-file append forbidden trigger: `CausalGraphView.tsx` or related files take on unrelated token/theme responsibilities
- Stop / replan conditions:
  - utility conversion materially hurts dense graph readability
  - graph shell still needs `src/theme/primitives.css` after wrapper migration

### SLICE-6 - Widget CSS retirement audit and theme-ready handoff

- Change boundary: leftover widget presentation CSS cleanup, verification closeout, issue `#5` handoff notes
- Expected file count: 3 or fewer repo-tracked files per pass
- Validation owner: implementer + release reviewer
- Focused validation plan: CSS audit, build/storybook smoke, rollback checkpoints, theme-ready documentation handoff
- Split decision: cleanup and handoff are separate passes if verification noise is high
- Target-file append forbidden trigger: verification docs start compensating for unresolved styling debt instead of documenting it
- Stop / replan conditions:
  - more than a minimal Tailwind entry/theme CSS layer remains unexplained
  - issue `#5` assumptions changed during implementation and the docs are no longer aligned

## Verification

- `SLICE-1` and `SLICE-2` forbid real app or integration work. Visual and mock-state verification only.
- `SLICE-3` to `SLICE-6` run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm storybook:build`, and `pnpm build` as the closeout baseline unless an earlier stop/replan trigger fires.
- Dense parallel fixture and import drawer fixture are mandatory manual checks for `SLICE-4` and `SLICE-5`.
- If any slice exceeds the small-slice guardrail, split/replan before execution instead of landing a larger mixed diff.

## Stop / Replan conditions

- repo baseline docs and implementation supplement disagree on the new styling stack
- Storybook stories lag behind real-surface migration
- dark/light token architecture scope expands from `theme-ready` to full productized theme UX without an explicit scope update
- graph readability or keyboard/focus parity regresses on migrated fixtures
- more than one styling source of truth survives past `SLICE-6`
