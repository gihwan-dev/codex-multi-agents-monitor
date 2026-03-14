# Technical Specification

## Context and evidence

- 캡처 일시: `2026-03-14T12:53:46Z`
- 근거 입력:
  - 사용자 UI audit and redesign brief
  - current repo implementation in `src/app/MonitorApp.tsx`, `src/app/useMonitorAppState.ts`, `src/app/app.css`
  - current navigation and graph files in `src/features/run-list/RunListPane.tsx`, `src/features/run-detail/graph/GraphView.tsx`, `src/features/inspector/InspectorPane.tsx`
  - existing v0.1 product docs in `tasks/codex-multi-agent-monitor-v0-1/*`

## Quality preflight

- verdict: `orchestrated-task`
- 현재 구현은 product baseline을 충족했지만, shell grammar가 이번 redesign 요구와 맞지 않는다.
- 기존 코드에서 가장 큰 구조 압박은 `MonitorApp.tsx`, `useMonitorAppState.ts`, `app.css`의 monolithic growth다.
- split-first: true. redesign 구현은 big-bang restyle이 아니라 shell, navigation, graph, inspector, alternate view를 slice별로 쪼개야 한다.

| Existing file | Current role | Post-change risk | Decision |
| --- | --- | --- | --- |
| `src/app/MonitorApp.tsx` | top chrome, summary, jumps, filters, renderer switch, drawer, shortcuts | compact strip, graph toolbar, drawer policy까지 계속 누적되면 shell monolith 심화 | composition-only shell로 다시 줄이고 chrome block을 분리 |
| `src/app/useMonitorAppState.ts` | run selection, filters, drawer, import/export, live state 전부 담당 | workspace tree state, selected path, drawer policy까지 한 reducer에 섞일 위험 | nav state, graph selection state, drawer/open policy를 분리 가능한 seam으로 설계 |
| `src/shared/domain/selectors.ts` | summary, anomaly, grouping, lane displays | workspace grouping, row graph display, selected path 계산이 뒤엉킬 위험 | nav grouping, graph display, path derivation selector를 분리 |
| `src/app/app.css` | shell + all feature layout styling | density and surface redesign가 giant stylesheet diff로 변질될 위험 | shell layout만 남기고 feature-local or primitive-local CSS 분할 우선 |

## Module impact and boundaries

- navigation boundary
  - left rail root grouping은 status group이 아니라 workspace tree selector로 바뀐다.
  - quick filters는 selector input이고 tree hierarchy 자체를 대체하지 않는다.
- graph boundary
  - primary renderer는 `lane cards`에서 `time gutter + lane columns + row events` 구조로 바뀐다.
  - edge semantics와 selected path emphasis는 renderer 내부 ad-hoc JSX가 아니라 selector/view model에서 결정한다.
- inspector boundary
  - inspector는 tabbed raw viewer보다 causal explainer를 우선한다.
  - `Summary`, `Cause`, `Impact`, `Payload` section은 selection model 공유 위에 올라간다.
- drawer boundary
  - drawer는 secondary detail surface다. open state가 false일 때 layout height를 차지하지 않아야 한다.
- non-goal boundary
  - parser, normalizer, storage, redactor는 이번 refactor의 설계 범위 밖이다.

## Split-first file plan

- `src/App.tsx`: 기존처럼 root composition만 유지한다.
- `src/app/MonitorApp.tsx`: top-level composition과 pane wiring만 유지하고, compact strip/toolbar/shortcut/help는 별도 block 또는 component로 분리한다.
- `src/features/run-list/`: workspace tree, quick filter row, run row를 맡는다.
- `src/features/run-detail/graph/`: row-based graph renderer만 맡는다. time gutter와 row rendering data는 selector layer에서 받는다.
- `src/features/inspector/`: causal summary section과 payload preview를 맡는다.
- `src/shared/domain/`: workspace grouping, selected path, anomaly target, row display model selector를 맡는다.
- `src/shared/ui/`: dense list row, inspector section, toolbar chip, timeline row 등 thin primitives를 맡는다.
- `src/app/app.css` 또는 후속 feature-local CSS: shell grid와 pane sizing만 맡고 feature-specific dense row styling은 해당 feature 가까이 둔다.

## State and selector contract

- active run selection은 workspace tree와 graph/inspector가 동일한 run id를 공유한다.
- selected item state는 `row`, `edge`, `artifact`를 계속 지원하되, view model에는 `selection path`가 추가된다.
- quick filters는 run grouping root가 아니라 derived subset만 바꾼다.
- anomaly jump selector는 compact toolbar chip과 graph scroll target을 동시에 충족해야 한다.
- live/import/raw capability flags는 유지한다. redesign은 surface 위치를 바꾸지만 underlying capability contract는 바꾸지 않는다.

## Performance and degradation

- large-run thresholds는 기존 기준을 재사용한다: lane `> 8`, row `> 120`, repeated edge `> 40`, map node `> 20`.
- row graph에서는 selected path 우선 계산, 나머지 causal highlight는 on-demand 계산으로 유지한다.
- lane collapse와 gap folding은 selected path visibility를 침범하면 안 된다.
- drawer와 inspector는 heavy payload를 lazy-reveal 하되 compact shell reflow를 깨지 않아야 한다.

## Validation and residual risks

- `SLICE-1`/`SLICE-2`는 fixture-backed shell review가 우선이다. real import/live plumbing을 동시에 수정하지 않는다.
- `SLICE-3` 이후에만 기존 normalized selector와 alternate views를 본격 연결한다.
- 가장 큰 residual risk는 design intent보다 giant diff가 먼저 생기는 것이다. 한 slice에서 3개 초과 tracked file, 150 LOC 안팎 초과 diff가 보이면 split/replan이 우선이다.
