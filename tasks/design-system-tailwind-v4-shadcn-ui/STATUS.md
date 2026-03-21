# Status

## Current slice

`SLICE-6`

## Done

- Design-task bundle created for GitHub issue `#4`
- `#4 = theme-ready architecture`, `#5 = full theme UX` scope split confirmed and documented
- Repo baseline `docs/ai/ENGINEERING_RULES.md` updated for Tailwind v4 + shadcn open-code migration
- Task supplement `IMPLEMENTATION_CONTRACT.md` created and linked from `task.yaml`
- Tailwind CSS v4 foundation wired into Vite and the root styling entry moved to `src/app/styles/index.css`
- Storybook preview now shares the same root styling entry and supports dark/light theme preview globals
- shadcn open-code primitives were added under `src/shared/ui/primitives`
- Shared UI was split into `src/shared/ui/primitives` and `src/shared/ui/monitor`
- Storybook taxonomy now covers `Foundations/*`, `Primitives/*`, `Monitor Composites/*`, `Screens/*`
- `monitor-chrome`, `workspace-run-tree`, `causal-inspector`, `monitor-drawer`, `prompt-assembly`, `causal-graph` shell surfaces were migrated to Tailwind/shadcn composition
- `src/theme/primitives.css` and widget presentation CSS files were removed
- Legacy shared UI implementation files were removed and replaced with monitor wrapper components
- Integration and unit tests were kept green while preserving selector stability for existing regression coverage

## Decisions made during implementation

- `src/app/styles/index.css`를 root styling entry로 고정했다.
- `src/theme/tokens.css`와 `src/theme/motion.css`는 semantic token source로 유지하고 `src/theme/primitives.css`는 실제로 제거했다.
- Shared UI는 `src/shared/ui/primitives`와 `src/shared/ui/monitor` 경계로 재구성하기로 확정했다.
- shadcn CLI는 bulk overwrite 없이 per-component add 흐름으로만 사용한다.
- Storybook theme preview는 runtime provider 없이 `data-theme` 전환으로 먼저 검증한다.
- 기존 class selector 일부는 스타일이 아니라 test/e2e marker로만 유지했다.

## Verification results

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm storybook:build` passed with foundations/primitives/composites/screens taxonomy in place.
- `pnpm build` passed.

## Known issues / residual risk

- `#5` 범위인 end-user theme toggle, persistence, system sync는 아직 구현되지 않았다.
- 일부 legacy class string은 e2e/jsdom selector stability를 위해 남아 있지만 스타일 ownership은 Tailwind/shadcn 쪽으로 이동했다.
- Storybook build 시 `radix-ui` package metadata warning이 출력되지만 빌드는 성공한다.

## Next slice

`#5 handoff`
