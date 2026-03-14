<!-- bootstrap-project-rules:start -->
# Repo Rules

- Read first: `docs/ai/ENGINEERING_RULES.md`, `tasks/codex-multi-agent-monitor-v0-1/README.md`, `tasks/codex-multi-agent-monitor-v0-1/UX_SPEC.md`, `tasks/codex-multi-agent-monitor-v0-1/UX_BEHAVIOR_ACCESSIBILITY.md`, `tasks/codex-multi-agent-monitor-v0-1/IMPLEMENTATION_CONTRACT.md`, `tasks/codex-multi-agent-monitor-v0-1/EXECUTION_PLAN.md`
- Exact commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm storybook:build`, `pnpm build`
- Architecture map: `src/app`, `src/features/run-list`, `src/features/run-detail/*`, `src/features/inspector`, `src/features/ingestion`, `src/features/fixtures`, `src/shared/domain`, `src/shared/ui`, `src/theme/*`
- Do: keep `src/App.tsx` composition-only, move tokens and motion into `src/theme/*`, use custom thin UI primitives, preserve preview-first masking, keep parser, normalizer, storage, and selectors separated
- Don't: extend `src/styles.css` for feature work, add a heavy UI kit, add a second state or cache layer, store raw payload by default, mix package managers, bypass the locked validation commands
- Known quirks: repo still has starter `Hello World` metadata and placeholder UI, and that polish is deferred until the shell and trace workflow stabilize
<!-- bootstrap-project-rules:end -->
