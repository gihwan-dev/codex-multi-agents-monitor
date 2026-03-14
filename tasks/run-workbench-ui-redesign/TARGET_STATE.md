# Target State

## Goal

구현된 모니터를 `workspace-grouped observability workbench`로 재정렬해, 사용자가 왼쪽에서 적절한 run을 고르고 중앙에서 시간과 인과를 읽고 오른쪽에서 원인과 영향을 해부하는 흐름을 자연스럽게 따르게 만든다.

## Requirements

- `REQ-001` 좌측 패널은 status group root가 아니라 `quick filters + workspace tree + dense run rows`를 기본 탐색 구조로 제공해야 한다.
- `REQ-002` 중앙 상단은 큰 panel 세 개 대신 `compact summary strip + unified graph toolbar`로 압축돼야 하며, graph가 항상 시각적 1순위여야 한다.
- `REQ-003` primary graph는 `row-based event graph`여야 하며 `time gutter`, `sticky lane headers`, `explicit edge semantics`, `gap rows`, `selected-path emphasis`를 제공해야 한다.
- `REQ-004` inspector는 선택 항목의 `Summary`, `Cause`, `Impact`, `Payload`를 보여줘야 하고, bottom drawer는 artifact/log/raw를 열 때만 나타나야 한다.
- `REQ-005` redesign은 기존 fixture/live/import semantics, keyboard access, large-run degradation, graph/waterfall/map mode switching을 유지해야 한다.

## Success checks

- 사용자는 workspace tree와 quick filter만으로 10초 안에 이상한 run을 고를 수 있어야 한다.
- 사용자는 raw payload나 alternate mode 없이도 compact strip, row graph, inspector만으로 30초 체크리스트에 답할 수 있어야 한다.
- waiting, blocked, failed, handoff 관련 선택은 graph와 inspector 모두에서 같은 causal path로 강조돼야 한다.
- drawer가 닫혀 있을 때는 workbench 높이를 차지하지 않아야 하며, graph가 기본적으로 가장 큰 surface여야 한다.

## Non-goals

- 새 data schema, ingestion pipeline, storage contract를 다시 설계하지 않는다.
- 새로운 heavy UI kit, second state layer, second styling stack을 도입하지 않는다.
- KPI dashboard, cross-run analytics, full diff viewer를 이번 task 범위에 넣지 않는다.
- 모든 view를 동시에 크게 보여주는 multi-panel wall을 목표로 하지 않는다.

## Reuse + delta

- Reuse: existing dataset model, warm graphite token family, custom thin primitives, 3-pane desktop shell mental model.
- Delta: left rail IA를 workspace tree로 교체하고, main chrome을 compact strip로 압축하며, graph grammar를 lane cards에서 row timeline으로 바꾸고, inspector를 causal explainer로 승격한다.
