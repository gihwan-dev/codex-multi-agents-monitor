# Project Profile

- Greenfield desktop workbench built on the Tauri starter baseline.
- Product focus is a multi-agent run debugging workbench, not a KPI or analytics dashboard.
- Current repo facts: React 19, Vite 7, TypeScript strict mode, Tauri 2, `pnpm` single-package workspace.
- UX ownership stays in `tasks/codex-multi-agent-monitor-v0-1/UX_SPEC.md` and `tasks/codex-multi-agent-monitor-v0-1/UX_BEHAVIOR_ACCESSIBILITY.md`.

# Locked Decisions

- Runtime and language: `Node >=20.19`, `TypeScript`, strict compile settings.
- Framework and shell: `React 19`, `Vite 7`, `Tauri 2`.
- Package manager: `pnpm` only.
- Validation stack: `Biome`, `ESLint (metrics-only)`, `Lizard`, `jscpd`, `cargo clippy`, `Vitest`, `Playwright`, `Storybook`.
- State and data strategy: feature-local React state, page-local orchestration, reducer, or context plus fixture-backed selectors. Do not introduce an external global state or cache layer by default.
- Styling and design-system direction: semantic token source paths are `src/theme/tokens.css` and `src/theme/motion.css`. The root styling entry lives in `src/app/styles/index.css` and exposes semantic tokens to Tailwind CSS v4 via `@theme inline`. `src/theme/primitives.css` is a migration bridge and deletion target, not a long-term source of truth.
- Runtime theme contract: global theme state lives under `src/shared/theme/` via a repo-local `ThemeProvider`, persists `system | dark | light` preference under `codex-monitor-theme-preference`, resolves onto document `data-theme` before React mounts, and exposes the user-facing control in the monitor top bar. Do not add a second class-based theme source of truth.
- Component source: shared UI primitives live in `src/shared/ui/primitives/` as shadcn/ui open-code components plus repo-local variants. Monitor-specific wrappers such as `StatusChip`, `MetricPill`, `PanelSection`, and `InspectorTabs` live in `src/shared/ui/monitor/`. Do not introduce a second component kit.
- Screenshot and visual review tooling: `Storybook` is the component review and screenshot baseline, and `Playwright` covers interaction and end-to-end validation.
- Backend architecture direction: the Tauri crate follows `lib.rs -> commands -> application -> domain/infrastructure` with dedicated `state` and `support` modules. `src-tauri/src/lib.rs` is bootstrap-only and must not regain use-case logic.
- Module ownership:
  - `src/app`: bootstrap, providers, shell mount, and global wiring only
  - `src/pages/monitor`: monitor page composition and page-local orchestration
  - `src/widgets/*`: screen-scale blocks such as run tree, graph, inspector, shell, drawer, top bar
  - `src/features/*`: user actions and interaction slices such as archive session, import run, follow live, search focus, workspace identity override
  - `src/entities/*`: core run, session-log, workspace, and trace-event models/selectors plus entity-owned fixture/runtime samples
  - `src/shared/*`: token-aware primitives, lib helpers, generic testing helpers, config, and theme layers
  - Legacy paths such as `src/shared/domain`, `src/app/sessionLogLoader`, `src/features/run-list`, `src/features/run-detail`, `src/features/inspector`, `src/features/ingestion`, and `src/features/fixtures` must not be recreated

# Architecture Boundaries

- `src/App.tsx` stays root composition only.
- `src/app/styles/index.css` is the root styling entry and must stay limited to Tailwind import, theme mapping, and minimal base-layer responsibilities.
- `src/app/styles/layout.css` is shell layout CSS only and must not absorb widget-specific styling responsibilities.
- Parser, normalizer, storage adapter, and UI selectors must remain in separate modules.
- Graph, waterfall, and map renderers share normalized selectors but do not share renderer implementation files.
- `src-tauri/src/lib.rs` stays limited to `mod` wiring, Tauri `manage(...)`, `generate_handler!`, and `run()`.
- Backend command handlers live under `src-tauri/src/commands/` and stay thin adapters: input parsing, `spawn_blocking`, `State` extraction, application dispatch, and response shaping only.
- Backend use-case orchestration lives under `src-tauri/src/application/`; filesystem, SQLite, JSONL, and git/worktree access live under `src-tauri/src/infrastructure/`; serialized DTO and ingest/search policy live under `src-tauri/src/domain/`; Tauri-managed cache state lives under `src-tauri/src/state/`; cross-cutting leaf helpers live under `src-tauri/src/support/`.
- Backend dependency direction is `commands -> application -> domain/infrastructure`, `infrastructure -> domain/support`, `state -> domain`, and `domain/support` must not depend on Tauri or upper layers.
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
- When touching the Tauri backend, also read `docs/architecture/tauri-backend-modular-monolith.md` before editing Rust module boundaries.
- Use split-first file boundaries from `TECH_SPEC.md`; do not append major responsibilities onto starter files.
- Prefer Tailwind utilities, shadcn open-code primitives, and repo-local monitor wrappers over new legacy selector layers.
- DOM test contracts must prefer accessible queries in this order: role, name, label, then text. Use `data-slot` and domain `data-*` metadata only for graph, canvas, tree, and similarly structural surfaces that do not expose a stable semantic role on their own.
- Treat `className` as a styling concern only. Do not add or preserve utility or marker classes as a testing API.
- Preserve preview-first masking, explicit raw opt-in, and `wait_reason` visibility requirements in all slices.
- Preserve the FSD boundary contract and do not reintroduce legacy compatibility shims or a `shared/domain` catch-all.
- If a slice needs a new core dependency, update this file and the task implementation contract in the same change.
- After `SLICE-1`, new UI work must not add widget-local `.css` files or expand `src/theme/primitives.css`.

# Validation Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm storybook:build`
- `pnpm build`

Bootstrap locks these commands as the definition-of-done contract. If a command is missing, the implementation slice must add the script or config before claiming completion.

`pnpm lint` is a hard gate that aggregates `Biome`, `ESLint (metrics-only)`, `Lizard`, `jscpd`, suppression audit, and repo smoke checks. Local runs require `lizard` to be installed via `python3 -m pip install lizard`.

Quantitative gate exemptions stay narrow and explicit: non-product files only (`tests/`, `scripts/`, stories, snapshots, generated output, sample data, temporary build output, Rust test support). Do not add product-code allowlists to force green.

# Dependency Policy

## Locked now

- Runtime and framework: `Node >=20.19`, `TypeScript`, `React 19`, `Vite 7`, `Tauri 2`
- Package management: `pnpm`
- Validation and screenshot stack: `Biome`, `ESLint (metrics-only)`, `Lizard`, `jscpd`, `cargo clippy`, `Vitest`, `Playwright`, `Storybook`
- JS/TS metrics parser: `@typescript-eslint/parser`
- State and data baseline: React local state, reducer, context, selectors
- Styling baseline: Tailwind CSS v4 with `@tailwindcss/vite`, semantic CSS variables under `src/theme/tokens.css`, motion tokens under `src/theme/motion.css`, and shadcn open-code primitives under `src/shared/ui/primitives/`
- Icon library: `lucide-react` (tree-shaking, currentColor support, React 19 optimized) — deferred trigger met: 18 event types require accessibility-safe semantic icons beyond CSS-only shapes
- Design-system runtime helpers: `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`
- shadcn policy: initialize once, add components individually, and never use `add --all --overwrite`

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
- Reintroducing legacy selector growth in `src/theme/primitives.css` or new widget `.css` files after the Tailwind baseline lands
- Reintroducing test-only marker classes or class-selector-based DOM contracts in components or tests
- Introducing a second component kit alongside shadcn open-code primitives
- Default raw prompt or tool payload persistence
- Reintroducing `src/shared/domain` or other deleted compatibility surfaces as permanent catch-all modules
- Adding backend use-case logic directly to `src-tauri/src/lib.rs`
- Letting a `#[tauri::command]` function perform filesystem, SQLite, JSONL, or git/worktree access directly instead of delegating to `application` and `infrastructure`
- Adding backend catch-all files such as `src-tauri/src/common.rs`, `src-tauri/src/utils.rs`, or `src-tauri/src/shared.rs`
- Optional libraries that bypass locked validation commands or replace the documented source-of-truth docs
- Broad lint suppressions (`biome-ignore`, `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `#[allow(...)]`) in product code

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
