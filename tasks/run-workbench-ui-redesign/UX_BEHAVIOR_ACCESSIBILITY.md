# UX Behavior & Accessibility

## Interaction Model

- quick filter click는 left rail tree의 결과를 좁히지만 workspace grouping 자체를 없애지 않는다.
- workspace row click는 expand/collapse만 수행하고, run row click가 실제 active run selection을 바꾼다.
- run row 선택은 top bar, graph, inspector를 모두 같은 run id로 동기화한다.
- anomaly chip click는 해당 row 또는 edge를 선택하고 graph를 적절한 위치로 스크롤한 뒤 inspector를 sync한다.
- row click와 edge click는 모두 `selection path`를 업데이트한다. unrelated lane/row는 dim 처리한다.
- inspector의 upstream/downstream jump는 graph selection을 다시 바꾸는 빠른 이동 control이다.
- bottom drawer는 artifact/log/raw를 명시적으로 열 때만 나타난다. row selection만으로 자동 오픈하지 않는다.
- pane resize, tree navigation, row selection, drawer toggle은 pointer와 keyboard 모두에서 가능해야 한다.

## Keyboard + Focus Contract

- 기본 focus order는 `top bar -> quick filters -> workspace tree -> graph toolbar -> time gutter and graph rows -> inspector -> drawer`다.
- workspace tree에서 `ArrowUp/ArrowDown`은 row 이동, `ArrowRight/ArrowLeft`는 expand/collapse, `Enter`는 run selection에 사용한다.
- graph row 영역에서는 `ArrowUp/ArrowDown`으로 visible row 이동, `Enter`로 selection confirm, `[` / `]`로 upstream/downstream jump를 지원한다.
- shortcut contract:
  - `Cmd/Ctrl + K`: command/search entry
  - `/`: search focus
  - `G`: graph mode
  - `W`: waterfall mode
  - `M`: map mode
  - `I`: inspector toggle
  - `.`: follow live toggle
  - `E`: error/wait emphasis toggle
  - `D`: drawer toggle when drawer-capable context exists
- drawer, palette, overlay를 닫으면 focus는 invoking row 또는 button으로 정확히 돌아와야 한다.
- selected row focus ring과 selected path highlight는 별도로 보여야 한다.

## Accessibility Contract

- workspace tree는 `tree`/`treeitem` semantics를 가져야 하고 expand/collapse state를 보조기술이 읽을 수 있어야 한다.
- 상태는 색상만으로 구분하지 않는다. status dot shape와 텍스트 라벨을 항상 함께 제공한다.
- waiting, blocked, failed, interrupted는 row label과 inspector summary 모두에서 텍스트 상태를 반복해야 한다.
- contrast는 text 4.5:1 이상, non-text 3:1 이상을 유지한다.
- 주요 hit target은 최소 32px를 유지한다. dense mode라도 이 하한은 깨지지 않는다.
- reduced motion이 활성화되면 live pulse와 row reveal animation은 opacity/shape change로 축소한다.
- hover-only 정보는 없어야 한다. row hover에서 드러나는 path, timestamp, edge meaning은 focus 상태에서도 동일하게 접근 가능해야 한다.

## Live Update Semantics

- imported completed run은 `Follow live` 기본 off를 유지한다.
- live watch run은 `Follow live` 기본 on을 유지하되, 사용자가 과거 row를 선택하거나 스크롤하면 즉시 `Following paused` 상태로 전환한다.
- paused 상태에서는 새 row가 append되어도 현재 selection과 scroll anchor를 강제로 바꾸지 않는다.
- stale/disconnected/reconnected badge는 compact header 안에서 읽히되, graph primary 영역을 침범하지 않아야 한다.
- reconnect 후에는 current selection path를 유지하고, 사용자가 명시적으로 resume할 때만 최신 row로 이동한다.
- partial parse failure는 row event와 inspector fallback copy로 기록한다. redesign 때문에 error visibility가 약해지면 안 된다.

## State Matrix + Fixture Strategy

- `FIX-001` minimal completed run: workspace tree 기본 탐색과 compact strip baseline 확인
- `FIX-002` waiting chain run: waiting/blocked/interrupted causal path와 inspector cause/impact 확인
- `FIX-003` first failure run: failure selection, first error jump, downstream 영향 확인
- `FIX-004` dense parallel run: row density, gap folding, lane collapse, selected-path persistence 확인
- `FIX-005` redacted payload run: drawer/raw gating과 redacted fallback copy 확인
- `FIX-006` disconnected live watch run: stale/disconnected/reconnect badge와 follow pause semantics 확인
- state matrix는 `empty`, `loading`, `live-running`, `waiting`, `blocked`, `interrupted`, `failed`, `done`, `cancelled`, `stale`, `disconnected`, `redacted`를 포함한다.
- `SLICE-1`은 `FIX-002`, `FIX-003` 기반 static shell review를 수행한다.
- `SLICE-2`는 `FIX-001` ~ `FIX-006` 전체를 local fixture state로 재현한다.

## Large-run Degradation Rules

- lane 수가 8을 넘으면 inactive done lane은 기본 접힘 후보가 되지만, selected path lane은 항상 강제로 유지한다.
- visible row가 120개를 넘으면 gap row folding과 row virtualization을 켜되 `first error`, `longest wait`, selected row는 접히지 않는다.
- edge density가 높아지면 모든 edge를 동등하게 그리지 않고 selected path, anomaly-linked edge, latest handoff만 우선 강조한다.
- workspace tree item이 많아지면 inactive workspace는 collapsed default를 사용할 수 있지만 quick filter 결과는 숨기지 않는다.
- drawer content는 large-run에서도 기본 닫힘을 유지한다. secondary payload 때문에 primary graph 높이를 줄이지 않는다.
- large-run degradation은 정보 삭제가 아니라 표현 압축이어야 한다. hidden count와 restore affordance는 항상 남긴다.

## Microcopy + Information Expression Rules

- quick filter copy는 `All`, `Live`, `Waiting`, `Failed`를 사용한다.
- inspector section copy는 `Summary`, `Cause`, `Impact`, `Payload`를 사용한다.
- drawer tab copy는 `Artifacts`, `Log`, `Raw`, `Import`를 유지하되 drawer가 닫혀 있을 때는 label만 남기지 않는다.
- gap row copy 형식은 `12m hidden · 4 lanes quiet`를 기본으로 한다.
- duration은 compact human format을 사용하고 absolute timestamp는 tooltip 또는 secondary text로 보인다.
- unknown 값은 `n/a`, redacted 값은 `redacted`, wait reason 없음은 `reason unavailable`로 표현한다.
- workspace/thread/run id는 middle truncation을 기본으로 하고 copy action에서 full id를 제공한다.

## Task-based Approval Criteria

- `AC-001`: 사용자는 workspace tree와 quick filter만으로 10초 안에 anomalous run을 선택할 수 있어야 한다.
- `AC-002`: 사용자는 graph mode에서 compact strip, anomaly chips, row-based graph, inspector만으로 30초 체크리스트에 답할 수 있어야 한다.
- `AC-003`: waiting/blocked/handoff/failure selection 시 graph와 inspector가 같은 causal path를 보여줘야 한다.
- `AC-004`: drawer는 artifact/log/raw를 열 때만 나타나고, 닫혀 있을 때 main graph 높이를 차지하지 않아야 한다.
- `AC-005`: `FIX-004` large-run fixture에서도 selected path, first error, longest wait affordance가 유지돼야 한다.
- `AC-006`: keyboard-only로 workspace tree 탐색, graph row 선택, inspector 이동, drawer open/close를 수행할 수 있어야 한다.
