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
- State and data strategy: feature-local React state, page-local orchestration, reducer, or context plus fixture-backed selectors. Do not introduce an external global state or cache layer by default.
- Styling and design-system direction: token source paths are `src/theme/tokens.css`, `src/theme/primitives.css`, and `src/theme/motion.css`. Shared UI primitives live in `src/shared/ui/` as a custom thin layer.
- Component source: build task-specific primitives such as `Panel`, `StatusChip`, `MetricPill`, `LaneHeader`, `EventRow`, `GapChip`, and `InspectorTabs` inside the repo. Do not pull in a heavyweight UI kit for v0.1.
- Screenshot and visual review tooling: `Storybook` is the component review and screenshot baseline, and `Playwright` covers interaction and end-to-end validation.
- Module ownership:
  - `src/app`: bootstrap, providers, shell mount, and global wiring only
  - `src/pages/monitor`: monitor page composition and page-local orchestration
  - `src/widgets/*`: screen-scale blocks such as run tree, graph, inspector, shell, drawer, top bar
  - `src/features/*`: user actions and interaction slices such as archive session, import run, follow live, search focus, workspace identity override
  - `src/entities/*`: core run, session-log, workspace, and trace-event models/selectors
  - `src/shared/*`: token-aware primitives, lib helpers, testing assets, config, and theme layers
  - Legacy paths such as `src/shared/domain`, `src/app/sessionLogLoader`, `src/features/run-list`, `src/features/run-detail`, `src/features/inspector`, `src/features/ingestion`, and `src/features/fixtures` must not be recreated

# Architecture Boundaries

- `src/App.tsx` stays root composition only.
- `src/app/styles/layout.css` is shell layout CSS only and must not absorb widget-specific styling responsibilities.
- Parser, normalizer, storage adapter, and UI selectors must remain in separate modules.
- Graph, waterfall, and map renderers share normalized selectors but do not share renderer implementation files.
- Preview-first masking runs before persistence. Raw payload storage remains opt-in and export excludes raw by default.
- `UX_SPEC.md` owns visual direction, tokens, layout intent, and screen flow. `UX_BEHAVIOR_ACCESSIBILITY.md` owns interaction, accessibility, live semantics, and approval criteria. Bootstrap docs only lock implementation stack and boundaries.

# FSD Boundary Contract

- Target FE layers are `app / pages / widgets / features / entities / shared`.
- `processes` is intentionally not part of the v0.1 plan.
- Import direction is top-down only. Higher layers may import lower layers, but lower layers must never import higher layers.
- Each slice exposes a single public API from its root `index.ts`. Deep imports across slice internals are prohibited.
- Legacy widget and aggregation paths under `src/features/run-list`, `src/features/run-detail`, `src/features/inspector`, `src/features/fixtures`, `src/features/ingestion`, and `src/shared/domain` are removed.
- Shared infrastructure such as the Tauri bridge lives under `src/shared/api`, not under `src/app`.

# Coding Conventions

- Read order before implementation: task `README.md`, `docs/architecture/frontend-fsd.md`, `UX_SPEC.md`, `UX_BEHAVIOR_ACCESSIBILITY.md`, `TECH_SPEC.md`, `IMPLEMENTATION_CONTRACT.md`, then `EXECUTION_PLAN.md`.
- Use split-first file boundaries from `TECH_SPEC.md`; do not append major responsibilities onto starter files.
- Prefer repo-local primitives and plain CSS layers over optional helper libraries until a deferred trigger is met.
- Preserve preview-first masking, explicit raw opt-in, and `wait_reason` visibility requirements in all slices.
- Preserve the FSD boundary contract and do not reintroduce legacy compatibility shims or a `shared/domain` catch-all.
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
- Reintroducing `src/shared/domain` or other deleted compatibility surfaces as permanent catch-all modules
- Optional libraries that bypass locked validation commands or replace the documented source-of-truth docs

# Decision Update Rules

- Change a locked decision only when the task docs or an ADR make the change necessary and the same diff updates this file plus the task implementation contract.
- Deferred items stay deferred until their trigger is actually met during implementation.
- A slice may not auto-approve a deferred library just because it is convenient.
- If visual direction or behavior semantics change, update the UX source-of-truth docs first; do not redefine them here.
- If FE boundary direction changes, update `docs/architecture/frontend-fsd.md` and the task implementation contract in the same change.
- If validation commands change, update root `AGENTS.md` and `CLAUDE.md` managed sections in the same change.

# Prohibited Patterns

- Extending `src/App.tsx` beyond root composition
- Extending `src/app/styles/layout.css` with widget-specific feature styling
- Combining parser, normalizer, storage, and selector code in one file
- Combining graph interaction state and inspector state in the same presentation file
- Mixing live transport code directly into renderer files
- Storing raw payload by default or exposing raw export without explicit opt-in
- Recreating deleted legacy paths such as `src/shared/domain`, `src/app/sessionLogLoader`, `src/features/run-list`, `src/features/run-detail`, or `src/features/inspector`
- Reusing starter `Hello World` UI or metadata as a product source of truth
