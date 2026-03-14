# Current slice
Sequence-lane graph redesign completed.

# Done
- Locked command surface is wired in `package.json`: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm storybook:build`, `pnpm build`.
- Actual tooling bootstrap completed for `@biomejs/biome`, `vitest`, `jsdom`, and `@playwright/test`, and the resulting dependency graph is recorded in `pnpm-lock.yaml`.
- Actual Storybook bootstrap completed for `storybook`, `@storybook/react-vite`, and `@storybook/addon-a11y`, and `pnpm storybook:build` now runs the real CLI path.
- Starter hero was replaced with a graph-first 3-pane workbench: left rail, summary strip, anomaly jump bar, graph/waterfall/map modes, inspector, bottom drawer, filters, and resize handles.
- Shared trace domain, fixture matrix, completed-run import, preview-first masking, export default, and live-watch mock semantics are implemented under split-first module boundaries.
- Follow-live defaults are now run-scoped, imported runs stay opt-in, filters persist per trace, raw tabs are gated by dataset capability, `peakParallelism` uses real overlap, and the completed-run parser rejects invalid array/enum/shape inputs.
- Starter package and Tauri metadata were renamed from `Hello World` / `helloworld` to `Codex Multi-Agent Monitor`.
- Graph mode now renders as a fixed-lane sequence timeline with DOM cards, SVG lifelines, cross-lane route bundling, sticky lane headers, and live-follow pause on manual scroll.
- Graph scene selectors are split from pixel layout concerns: semantic `GraphSceneModel` is produced in `src/shared/domain`, and layout snapshotting stays inside the graph renderer.

# Decisions made during implementation
- `src/App.tsx` stays composition-only and feature styling moved into `src/theme/*` plus `src/app/app.css`.
- `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and `pnpm storybook:build` now execute the real locked tools.
- `FIX-001` ~ `FIX-006` drive the home list, graph shell, waiting/error states, import parser, redaction flow, and live reconnect simulation from one normalized dataset contract.
- Graph routes no longer rely on selector-side `LANE_WIDTH` / `STEP_HEIGHT` assumptions; the renderer owns lane width, row height, anchor, and route geometry through one shared layout snapshot.

# Verification results
- Passed: `pnpm lint`
- Passed: `pnpm typecheck`
- Passed: `pnpm test`
- Passed: `pnpm test:e2e`
- Passed: `pnpm storybook:build`
- Passed: `pnpm build`

# Known issues / residual risk
- `pnpm test:e2e` runs through the real Playwright test runner, but the current environment blocks Chromium launch (`bootstrap_check_in ... Permission denied (1100)`), so the smoke stays at built-artifact validation instead of full browser navigation.
- Storybook build passed for the new graph stories, but this slice did not capture image snapshots, so visual review still depends on manual story inspection when pixel polish matters.

# Next slice
Optional follow-up: grouped-edge inspector drilldown and browser-permission-aware graph screenshot regression coverage.
