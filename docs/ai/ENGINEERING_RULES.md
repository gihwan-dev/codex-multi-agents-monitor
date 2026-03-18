# Project Profile

- Greenfield desktop workbench built on the Tauri starter baseline.
- Product focus is a multi-agent run debugging workbench, not a KPI or analytics dashboard.
- Current repo facts: React 19, Vite 7, TypeScript strict mode, Tauri 2, `pnpm` single-package workspace.
- UX ownership stays in `tasks/codex-multi-agent-monitor-v0-1/UX_SPEC.md` and `tasks/codex-multi-agent-monitor-v0-1/UX_BEHAVIOR_ACCESSIBILITY.md`.

# Locked Decisions

- Runtime and language: `Node >=20.19`, `TypeScript`, strict compile settings.
- Framework and shell: `React 19`, `Vite 7`, `Tauri 2`.
- Package manager: `pnpm` only.
- Validation stack: `Biome`, `Vitest`, `Playwright`, `Storybook`.
- State and data strategy: feature-local React state, reducer, or context plus fixture-backed selectors. Do not introduce an external global state or cache layer by default.
- Styling and design-system direction: token source paths are `src/theme/tokens.css`, `src/theme/primitives.css`, and `src/theme/motion.css`. Shared UI primitives live in `src/shared/ui/` as a custom thin layer.
- Component source: build task-specific primitives such as `Panel`, `StatusChip`, `MetricPill`, `LaneHeader`, `EventRow`, `GapChip`, and `InspectorTabs` inside the repo. Do not pull in a heavyweight UI kit for v0.1.
- Screenshot and visual review tooling: `Storybook` is the component review and screenshot baseline, and `Playwright` covers interaction and end-to-end validation.
- Module ownership:
  - `src/app`: shell composition only
  - `src/features/run-list`: home and run list surfaces
  - `src/features/run-detail/*`: graph, waterfall, map renderers
  - `src/features/inspector`: selection summary and payload tabs
  - `src/features/ingestion`: import/watch adapters, parser, normalizer, redactor
  - `src/features/fixtures`: `FIX-001` to `FIX-006`
  - `src/shared/domain`: types, ids, selectors, status helpers
  - `src/shared/ui`: token-aware primitives
  - `src/theme/*`: tokens, primitives, motion layers

# Architecture Boundaries

- `src/App.tsx` stays root composition only.
- `src/styles.css` is frozen as starter-era global CSS and must not absorb new feature responsibilities.
- Parser, normalizer, storage adapter, and UI selectors must remain in separate modules.
- Graph, waterfall, and map renderers share normalized selectors but do not share renderer implementation files.
- Preview-first masking runs before persistence. Raw payload storage remains opt-in and export excludes raw by default.
- `UX_SPEC.md` owns visual direction, tokens, layout intent, and screen flow. `UX_BEHAVIOR_ACCESSIBILITY.md` owns interaction, accessibility, live semantics, and approval criteria. Bootstrap docs only lock implementation stack and boundaries.

# Coding Conventions

- Read order before implementation: task `README.md`, `UX_SPEC.md`, `UX_BEHAVIOR_ACCESSIBILITY.md`, `TECH_SPEC.md`, `IMPLEMENTATION_CONTRACT.md`, then `EXECUTION_PLAN.md`.
- Use split-first file boundaries from `TECH_SPEC.md`; do not append major responsibilities onto starter files.
- Prefer repo-local primitives and plain CSS layers over optional helper libraries until a deferred trigger is met.
- Preserve preview-first masking, explicit raw opt-in, and `wait_reason` visibility requirements in all slices.
- If a slice needs a new core dependency, update this file and the task implementation contract in the same change.

# Validation Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm storybook:build`
- `pnpm build`

Bootstrap locks these commands as the definition-of-done contract. If a command is missing, the implementation slice must add the script or config before claiming completion.

# Dependency Policy

## Locked now

- Runtime and framework: `Node >=20.19`, `TypeScript`, `React 19`, `Vite 7`, `Tauri 2`
- Package management: `pnpm`
- Validation and screenshot stack: `Biome`, `Vitest`, `Playwright`, `Storybook`
- State and data baseline: React local state, reducer, context, selectors
- Styling baseline: CSS token files under `src/theme/*` and repo-local primitives under `src/shared/ui/`
- Icon library: `lucide-react` (tree-shaking, currentColor support, React 19 optimized) — deferred trigger met: 18 event types require accessibility-safe semantic icons beyond CSS-only shapes

## Deferred

- Graph or layout helper
  - Why deferred: renderer density is documented, but the first implementation should prove whether custom SVG and CSS are sufficient.
  - Trigger: `SLICE-1` or `SLICE-4` cannot keep graph, handoff, and transfer rendering maintainable without a dedicated routing or layout helper.
  - Needed input: actual lane density, edge routing needs, and interaction complexity from the implemented scaffold.
- Virtualization helper
  - Why deferred: degradation thresholds are known, but it is unclear whether custom windowing is enough.
  - Trigger: `FIX-004` large-run review shows unacceptable performance or unreadable gap folding with a local implementation.
  - Needed input: measured row and lane rendering cost on the real fixture set.
- Persistence or store helper
  - Why deferred: `SLICE-1` and `SLICE-2` do not need persisted client state beyond local flow.
  - Trigger: `SLICE-3` import persistence or `SLICE-4` live dataset reuse becomes error-prone with plain modules and React state.
  - Needed input: actual normalization and persistence responsibilities after parser work lands.
- Live transport helper
  - Why deferred: live watch protocol shape is not implemented yet.
  - Trigger: `SLICE-4` reconnect, stale, and stream recovery logic cannot be expressed cleanly with a thin repo-local adapter.
  - Needed input: chosen watch source format and reconnect semantics.
- Animation or motion helper
  - Why deferred: motion scope is intentionally narrow in v0.1.
  - Trigger: minimal motion tokens cannot be maintained with repo-local assets alone.
  - Needed input: concrete motion requirements that exceed the documented token contract.

## Banned/Avoid

- Mixing `npm`, `yarn`, or other package managers with `pnpm`
- Adding a second state or cache layer that overlaps with local React state responsibilities
- Adding a second styling stack such as Tailwind, CSS-in-JS, or another token system alongside `src/theme/*`
- Introducing a heavyweight UI kit for base primitives
- Default raw prompt or tool payload persistence
- Optional libraries that bypass locked validation commands or replace the documented source-of-truth docs

# Decision Update Rules

- Change a locked decision only when the task docs or an ADR make the change necessary and the same diff updates this file plus the task implementation contract.
- Deferred items stay deferred until their trigger is actually met during implementation.
- A slice may not auto-approve a deferred library just because it is convenient.
- If visual direction or behavior semantics change, update the UX source-of-truth docs first; do not redefine them here.
- If validation commands change, update root `AGENTS.md` and `CLAUDE.md` managed sections in the same change.

# Prohibited Patterns

- Extending `src/App.tsx` beyond root composition
- Extending `src/styles.css` with feature-specific layout, state, or token logic
- Combining parser, normalizer, storage, and selector code in one file
- Combining graph interaction state and inspector state in the same presentation file
- Mixing live transport code directly into renderer files
- Storing raw payload by default or exposing raw export without explicit opt-in
- Reusing starter `Hello World` UI or metadata as a product source of truth
