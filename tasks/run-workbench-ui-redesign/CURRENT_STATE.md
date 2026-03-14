# Current State Audit

## Product stance

- 현재 앱은 starter hero를 벗어나 desktop workbench 형태까지는 도달했다.
- 하지만 실제 읽기 경험은 `관측 워크벤치`보다 `카드가 많은 다크 대시보드`에 가깝다.
- 문제의 중심은 미감보다 정보 구조다. 사용자가 어디를 먼저 읽어야 하는지 문법이 약하다.

## Observed issues

- 좌측 탐색이 `workspace -> thread/run` 계층이 아니라 `Running / Waiting / Recent` 상태 그룹과 run card 묶음으로 구성된다.
- 중앙 상단은 `30-second checklist`, `Anomaly jumps`, `Filters`가 각각 큰 panel로 분리돼 그래프보다 chrome이 강하다.
- graph는 time/causality view보다 lane card board처럼 보여 `어떤 순서로 읽는가`가 약하다.
- edge semantics는 detached pill strip로 노출돼 실제 graph와 inspector를 강하게 연결하지 못한다.
- inspector는 selected item metadata를 보여주지만 `cause`, `impact`, `upstream`, `downstream` 문법은 약하다.
- drawer는 닫혀 있어도 workbench 구조 안에서 존재감이 커서 primary canvas 밀도를 해친다.

## Evidence in repo

- `src/shared/domain/selectors.ts`의 `groupRuns()`는 run grouping root를 workspace가 아니라 status로 고정한다.
- `src/features/run-list/RunListPane.tsx`는 dense list row가 아닌 `run-card` UI를 반복한다.
- `src/app/MonitorApp.tsx`는 top bar 다음에 summary, jumps, filters, renderer, drawer를 위에서 아래로 panel stacking 한다.
- `src/features/run-detail/graph/GraphView.tsx`는 lane 단위 article card와 edge pill strip 중심 구조를 사용한다.
- `src/features/inspector/InspectorPane.tsx`는 tabbed metadata/raw viewer가 중심이고 causal summary section은 없다.
- `src/app/app.css`는 border, radius, nested surface, large gaps가 많아 density보다 panel chrome이 먼저 느껴진다.

## Structural pressure

- `src/app/MonitorApp.tsx` 455 LOC: shell chrome, toolbar, drawer, shortcuts, view switching이 한 파일에 모여 있다.
- `src/app/useMonitorAppState.ts` 537 LOC: run selection, filters, drawer, import, export, live watch, shortcuts state가 한 reducer에 모여 있다.
- `src/app/app.css` 433 LOC: top chrome, run list, graph, waterfall, map, inspector, drawer styling이 한 파일에 모여 있다.
- 이 상태에서 append-only redesign을 하면 visual refactor가 아니라 monolith 확대가 된다.

## Preserve

- warm graphite palette와 restrained motion 방향성
- `src/theme/*` token source와 thin primitive layer
- preview-first masking, raw opt-in, export default 정책
- graph/waterfall/map shared dataset mental model
- fixture-backed development and locked validation commands

## Redesign implication

- 이번 작업은 색상/spacing 미세 조정이 아니라 `탐색 구조`, `메인 읽기 흐름`, `선택-상세 연결`, `secondary surface reveal 규칙`을 다시 고정하는 task다.
