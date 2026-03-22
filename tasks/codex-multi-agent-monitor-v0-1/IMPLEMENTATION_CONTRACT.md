# Inputs Read

- `README.md`
- `SPEC_VALIDATION.md`
- `PRD.md`
- `UX_SPEC.md`
- `UX_BEHAVIOR_ACCESSIBILITY.md`
- `docs/architecture/frontend-fsd.md`
- `docs/architecture/tauri-backend-modular-monolith.md`
- `TECH_SPEC.md`
- `EXECUTION_PLAN.md`
- `ACCEPTANCE.feature`
- `ADRs/ADR-001-trace-native-run-model.md`
- `ADRs/ADR-002-graph-first-workbench.md`
- `DESIGN_REFERENCES/manifest.json`
- repo facts from `package.json`, `tsconfig.json`, and `src-tauri/tauri.conf.json`

# Task-Specific Decisions

- This task now has two implementation SSOT layers:
  - repo baseline: `docs/ai/ENGINEERING_RULES.md`
  - task supplement: `IMPLEMENTATION_CONTRACT.md`
- `SLICE-1` and `SLICE-2` implementers must read `UX_SPEC.md` and `UX_BEHAVIOR_ACCESSIBILITY.md` before touching UI files. Bootstrap docs do not replace UX ownership.
- The baseline toolchain is locked to `Biome + Vitest + Playwright + Storybook`. Bootstrap records the contract only; implementation adds missing scripts or config later.
- Feature work starts from a split-first boundary. `src/App.tsx` stays composition-only and `src/app/styles/layout.css` is not a widget feature stylesheet.
- FE target layers are `app / pages / widgets / features / entities / shared`.
- `src/app/` is bootstrap only, `src/pages/monitor/` owns page orchestration, `src/widgets/` owns screen blocks, `src/features/` owns user actions, `src/entities/` owns normalized models plus entity-owned fixture/runtime samples, and `src/shared/` owns primitives, helpers, generic testing utilities, and theme layers.
- `src/shared/domain/` and `src/app/session-log-loader/` are removed legacy paths and must not be recreated.
- Custom thin primitives under `src/shared/ui/` are the only approved component source for v0.1.
- Token and motion files must live under `src/theme/tokens.css`, `src/theme/primitives.css`, and `src/theme/motion.css`.
- Runtime theme state now lives in `src/shared/theme/` with a repo-local `ThemeProvider`. It persists `system | dark | light` under `codex-monitor-theme-preference`, applies resolved `data-theme` to the document before React mount, and exposes the user-facing control from the monitor top bar instead of a separate settings screen.
- `implement-task` must treat `docs/ai/ENGINEERING_RULES.md`, `docs/architecture/frontend-fsd.md`, this file, and the UX docs as required pre-read inputs for every slice.
- Backend refactor work under `src-tauri/src/` now follows `commands / application / domain / infrastructure / state / support`.
- `src-tauri/src/lib.rs` is bootstrap only: `mod` wiring, `manage(...)`, `generate_handler!`, and `run()` only.
- Tauri command handlers belong in `src-tauri/src/commands/` and must stay thin adapters over application services.
- Filesystem, SQLite, JSONL, and git/worktree access belong in `src-tauri/src/infrastructure/`.
- Serialized DTO and ingest/search policy belong in `src-tauri/src/domain/`.
- Tauri-managed mutable cache state belongs in `src-tauri/src/state/`.
- Backend helper aggregation files such as `common.rs`, `utils.rs`, or `shared.rs` are banned.

# Allowed Core Libraries

- Runtime and shell: `React 19`, `React DOM 19`, `Vite 7`, `Tauri 2`
- Language and package management: `TypeScript`, `pnpm`
- Validation baseline: `Biome`, `Vitest`, `Playwright`, `Storybook`
- UI implementation baseline: repo-local CSS layers plus repo-local primitives under `src/shared/ui/`
- State and selectors baseline: feature-local React state, reducer, context, and selector modules

- Icon library: `lucide-react` (deferred trigger met — 18 event types require semantic icons beyond CSS-only shapes)

# Deferred Decisions and Trigger

- Graph or layout helper
  - Trigger: the `SLICE-1` graph scaffold or `SLICE-4` alternate views cannot maintain edge semantics or readability with repo-local rendering.
- Virtualization helper
  - Trigger: `FIX-004` large-run review fails with repo-local row virtualization or gap folding.
- Persistence or store helper
  - Trigger: `SLICE-3` import persistence or `SLICE-4` shared live dataset handling becomes too coupled with local React state.
- Live transport helper
  - Trigger: reconnect, stale, or backpressure logic in `SLICE-4` cannot be expressed cleanly with a thin adapter.
- Animation or motion helper
  - Trigger: minimal motion tokens cannot be maintained with repo-local assets.
  - Icon helper trigger met: `lucide-react` adopted for 18 event-type semantic icons.

When a trigger is met, the implementer must update `docs/ai/ENGINEERING_RULES.md` and this file before adopting the library.

# Validation Overrides

- `SLICE-1`: `boundary contract review`, `architecture doc review`, `import direction smoke check`
- `SLICE-2`: `app-to-pages migration review`, `bootstrap smoke check`, `page-local state walkthrough`
- `SLICE-3`: `widget extraction review`, `storybook smoke check`, `layout density review`
- `SLICE-4`: `entity and loader split review`, `normalization smoke check`, `fixture boundary review`
- Every slice still closes against the repo-level command contract in `docs/ai/ENGINEERING_RULES.md`.
- Backend modular-monolith slices additionally close against `cargo check`, `cargo clippy -- -D warnings`, and `cargo test` in `src-tauri/`.

# Open Risks

- Large-run rendering cost can spike across graph, waterfall, and map simultaneously.
- Source schema drift may omit or reshape `wait_reason`, handoff, transfer, or usage fields.
- Preview-first masking can regress if import or live-watch code stores raw payload too early.
- `shared/domain` and `session-log-loader` naming can leak back in if future slices reintroduce compatibility shims.
- `lib.rs` can regress into a god-file again if future backend work bypasses `commands/application/infrastructure` boundaries.
- The current environment still blocks full Playwright browser navigation, so end-to-end coverage remains limited to built-artifact smoke plus contract assertions.
