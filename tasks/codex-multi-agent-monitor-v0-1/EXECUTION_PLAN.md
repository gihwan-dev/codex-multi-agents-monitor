# Execution slices

## Bootstrap preflight

- Before product slices, lock the command surface in `package.json` for `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm storybook:build`, `pnpm build`.
- Preferred path is real package installation for `Biome`, `Vitest`, `Playwright`, and `Storybook`.
- If registry access is unavailable, keep the same command surface with local fallback scripts and document the gap in `STATUS.md`. Replace fallback scripts with package-backed tooling once registry access returns.

## SLICE-1

- Change boundary: static desktop shell, left rail, run detail chrome, summary strip, anomaly jump bar, graph lane scaffold, inspector shell
- Real API/integration ban: import parser, live watch transport, backend bridge, persistent store wiring은 금지한다.
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: 30-second checklist review, visual shell snapshot review, layout density review
- Split decision: 시작 전에 `src/App.tsx`는 root composition only로 유지하고 `app shell`, `run detail`, `inspector`를 별도 파일로 분리한다. `styles.css` append 확장은 금지하고 token/layer 파일로 분리한다.
- Target-file append ban trigger: `src/App.tsx` 또는 `src/styles.css`가 25 touched lines를 넘기거나 새 책임을 흡수하려 하면 즉시 split/replan before spawn
- Stop / Replan trigger: `UX_SPEC.md`의 checklist, layout, token, screen-flow 계약 또는 `UX_BEHAVIOR_ACCESSIBILITY.md`의 interaction, accessibility, microcopy 계약이 미승인

## SLICE-2

- Change boundary: local fixture store, selection sync, filter persistence, gap fold/unfold, keyboard/focus, loading/empty/error/wait/live mock states
- Real API/integration ban: completed-run import, live transport, backend adapter, OTLP/custom stream wiring은 금지한다.
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: keyboard walkthrough, state matrix walkthrough, fixture-based interaction smoke check
- Split decision: graph interaction state와 inspector state를 같은 파일에 혼합하지 않는다. fixture data, selection state, UI presenters를 나눠서 시작한다.
- Target-file append ban trigger: graph canvas 파일 하나에 interaction reducer와 presentation JSX가 같이 누적되면 split/replan before spawn
- Stop / Replan trigger: keyboard/focus, live semantics, state matrix/fixture, degradation, task-based approval criteria 미정

## SLICE-3

- Change boundary: completed-run import flow, parser, normalizer, derived metrics, preview masking default, artifact reference extraction
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: parser unit test, normalization smoke check, masking contract review
- Split decision: parser, normalizer, storage adapter를 한 파일에 묶지 않는다. raw-to-normalized transform과 UI selectors를 분리한다.
- Target-file append ban trigger: import path가 UI component 파일까지 침범하거나 normalized schema와 storage adapter가 결합되면 split/replan before spawn
- Stop / Replan trigger: schema drift, missing wait_reason normalization, redaction contract mismatch

## SLICE-4

- Change boundary: live watch tail, stale/reconnect semantics, shared dataset subscription, waterfall mode, map mode
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: live update walkthrough, stale/reconnect simulation, large-run degradation fixture review
- Split decision: live watch transport와 alternate view renderers를 분리한다. graph/waterfall/map는 shared selectors를 쓰되 renderer 파일은 분리한다.
- Target-file append ban trigger: live transport 코드가 graph renderer에 직접 섞이거나 alternate view가 graph component 안으로 중첩되면 split/replan before spawn
- Stop / Replan trigger: dataset synchronization mismatch, stale badge semantics 충돌, large-run degradation 규칙 미충족

# Verification

- 30-second checklist review
- visual shell snapshot review
- keyboard-only walkthrough
- fixture-based interaction smoke check
- parser unit test
- normalization smoke check
- masking contract review
- live update and reconnect simulation
- large-run degradation fixture review

# Stop / Replan conditions

- `$bootstrap-project-rules`가 완료되지 않으면 `SLICE-1`에 진입하지 않는다.
- `SLICE-1` shell 계약이 승인되지 않으면 `SLICE-2`로 진행하지 않는다.
- `SLICE-2` behavior/a11y/live 계약이 승인되지 않으면 `SLICE-3`로 진행하지 않는다.
- `SLICE-3` normalized schema와 masking contract가 고정되지 않으면 `SLICE-4`로 진행하지 않는다.
- 어느 slice든 예상 변경 파일 3개 초과 또는 순 diff 150 LOC 내외를 넘기면 split/replan before spawn으로 되돌린다.
