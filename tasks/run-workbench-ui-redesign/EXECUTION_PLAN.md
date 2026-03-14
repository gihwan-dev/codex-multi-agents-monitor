# Execution slices

## SLICE-1

- Change boundary: compact top bar, compact summary strip, unified graph toolbar, drawer-hidden shell, border/radius/spacing density reset
- Real API/integration ban: parser, normalizer, live watch, storage, export payload wiring 변경 금지
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: static shell review, 30-second checklist visibility review, graph-first visual hierarchy review
- Split decision: `src/app/MonitorApp.tsx`에 compact strip과 toolbar를 계속 누적하지 말고 shell chrome block을 먼저 분리한다. `src/app/app.css`는 shell grid까지만 두고 feature density 규칙은 분리 시작점으로 잡는다.
- Target-file append ban trigger: `src/app/MonitorApp.tsx` touched lines가 60을 넘거나 `src/app/app.css` touched lines가 80을 넘기면 split/replan before spawn
- Stop / Replan trigger: left rail, graph, inspector 중 어느 하나라도 1280px 기준 primary-secondary hierarchy를 유지하지 못하면 중단하고 레이아웃 문법을 다시 고정한다.

## SLICE-2

- Change boundary: quick filters, workspace tree, dense run rows, workspace expand/collapse, keyboard tree navigation
- Real API/integration ban: completed-run import, live transport, parser/store selector contract 변경 금지
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: `AC-001` workspace selection walkthrough, keyboard tree navigation walkthrough, dense row readability review
- Split decision: workspace grouping selector와 row rendering component를 분리해서 시작한다. `RunListPane`가 grouping logic까지 직접 가지지 않게 한다.
- Target-file append ban trigger: `src/features/run-list/RunListPane.tsx`가 filter reducer나 dataset formatting 책임을 흡수하면 split/replan before spawn
- Stop / Replan trigger: workspace tree semantics가 run row selection과 충돌하거나 quick filter가 tree hierarchy를 깨면 중단한다.

## SLICE-3

- Change boundary: row-based graph, time gutter, sticky lane headers, selected-path emphasis, gap row behavior, anomaly target alignment
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: `AC-002`, `AC-003`, `AC-005` fixture walkthrough, gap folding review, selected-path visual review
- Split decision: row layout data와 selected-path derivation은 selector layer에서 만든다. `GraphView` 안에서 ad-hoc causal 계산을 금지한다.
- Target-file append ban trigger: `src/features/run-detail/graph/GraphView.tsx`에 selection reducer, live follow logic, import logic가 섞이면 split/replan before spawn
- Stop / Replan trigger: graph가 여전히 card board처럼 읽히거나 time order가 ambiguous하면 implementation 진행을 중단한다.

## SLICE-4

- Change boundary: inspector `Summary/Cause/Impact/Payload` layout, upstream/downstream jumps, on-demand drawer, focus return behavior
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: `AC-003`, `AC-004`, `AC-006` walkthrough, focus return review, drawer hidden-by-default review
- Split decision: inspector section rendering과 drawer open policy를 분리한다. selection state와 payload rendering을 같은 block에 뒤섞지 않는다.
- Target-file append ban trigger: `src/features/inspector/InspectorPane.tsx`가 drawer import/raw logic까지 직접 품기 시작하면 split/replan before spawn
- Stop / Replan trigger: drawer가 닫혀 있어도 layout height를 점유하거나 inspector가 causal explanation 대신 metadata table로 남으면 중단한다.

## SLICE-5

- Change boundary: waterfall/map alignment, mode switch preservation, large-run degradation polish, story or screenshot regression coverage
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: `FLOW-005` mode-switch review, `FIX-004` degradation review, storybook or visual regression review
- Split decision: alternate view는 shared selectors를 재사용하되 renderer implementation은 graph와 분리한다. graph refactor 마지막 단계에 waterfall/map를 끼워 넣지 않는다.
- Target-file append ban trigger: alternate view alignment를 이유로 `GraphView` 안에 waterfall/map fallback markup가 섞이면 split/replan before spawn
- Stop / Replan trigger: mode 전환 시 selection path나 live/import context가 깨지면 SLICE-3/4 contract를 다시 열고 재설계한다.

# Verification

- static shell review against `UX_SPEC.md`
- workspace tree keyboard walkthrough
- 30-second checklist walkthrough on `FIX-002` and `FIX-003`
- selected-path and cause/impact walkthrough
- drawer hidden-by-default validation
- large-run degradation review on `FIX-004`
- storybook or visual regression snapshot review
- locked repo validation commands after implementation slices land

# Stop / Replan conditions

- `SLICE-1` visual hierarchy가 승인되지 않으면 이후 slice로 진행하지 않는다.
- `SLICE-2` tree semantics와 quick filter semantics가 고정되지 않으면 `SLICE-3`로 진행하지 않는다.
- `SLICE-3` graph grammar와 selected-path contract가 고정되지 않으면 `SLICE-4`로 진행하지 않는다.
- `SLICE-4` inspector/drawer/focus contract가 고정되지 않으면 `SLICE-5`로 진행하지 않는다.
- 어느 slice든 tracked file 3개 초과 또는 순 diff 150 LOC 안팎 초과가 예상되면 split/replan before spawn으로 되돌린다.
