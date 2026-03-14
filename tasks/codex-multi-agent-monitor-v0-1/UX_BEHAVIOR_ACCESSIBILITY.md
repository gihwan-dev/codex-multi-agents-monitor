# UX Behavior & Accessibility

## Interaction Model

- row click는 현재 event를 선택하고 inspector를 sync한다.
- node hover는 upstream/downstream causal path를 강조하고 unrelated lane을 dim 처리한다.
- edge click는 `source`, `target`, `edge_type`, `payload preview`, `artifact ref`를 inspector summary에 연다.
- gap chip click는 해당 gap row만 expand/collapse 한다. 전체 timeline zoom으로 바꾸지 않는다.
- left rail 선택과 top breadcrumb selection은 항상 같은 run id를 가리켜야 한다.
- filter state는 run 단위로 유지하고 프로젝트 전환 시 초기화한다.
- inspector pin이 켜져 있으면 event selection이 바뀌어도 inspector width와 open state는 유지한다.
- pane resize는 pointer와 keyboard 양쪽에서 가능해야 한다.

## Keyboard + Focus Contract

- 기본 focus order는 `top bar -> left rail -> anomaly jump bar -> event column -> graph canvas -> inspector -> bottom drawer`다.
- `Tab`은 pane 간 이동, `Arrow`는 list/row 이동, `Enter`는 선택, `Esc`는 drawer/menu/command palette 닫기에 사용한다.
- shortcut contract:
  - `Cmd/Ctrl + K`: command palette
  - `/`: search
  - `F`: filter focus
  - `G`: graph mode
  - `W`: waterfall mode
  - `M`: map mode
  - `I`: inspector toggle
  - `.`: follow live toggle
  - `E`: error-only toggle
  - `?`: shortcuts help
- focus return은 inspector drawer, context menu, command palette를 닫은 뒤 invoking row/node로 정확히 돌아와야 한다.
- focus ring은 canvas 안에서도 사라지지 않아야 하며 node/edge selection과 분리해서 보인다.

## Accessibility Contract

- 상태는 색상만으로 구분하지 않는다. `running=filled circle`, `waiting=hollow circle`, `blocked=hollow circle with slash`, `failed=diamond`, `done=small solid circle`, `tool=rounded square` 규칙을 유지한다.
- text contrast는 최소 4.5:1, non-text contrast는 최소 3:1을 맞춘다.
- pointer hit target은 주요 interactive control 기준 최소 32px를 유지한다.
- reduced motion이 활성화되면 pulse halo와 animated edge draw를 끄고 opacity/shape change만 남긴다.
- hover-only 정보는 없어야 한다. hover에서 보이는 causal highlight와 tooltip 정보는 focus 상태에서도 동일하게 접근 가능해야 한다.
- waiting, blocked, interrupted는 텍스트 상태 라벨과 wait reason이 함께 있어야 하며 색상만으로 의미를 전하지 않는다.

## Live Update Semantics

- imported completed run은 `Follow live`가 기본 off다.
- 현재 세션에서 열린 live watch run은 `Follow live`가 기본 on이다.
- 사용자가 최신 row에서 벗어나 스크롤하거나 과거 event를 선택하면 auto-follow는 즉시 pause되고 상단에 `Following paused` badge를 띄운다.
- watch source가 5초 이상 이벤트를 보내지 않으면 `stale`, 20초 이상 끊기면 `disconnected` badge를 띄운다.
- reconnect 후에는 현재 selection을 유지한 채 새 row를 append 하고, 사용자가 직접 `Resume follow`를 눌렀을 때만 최신 row로 점프한다.
- partial parse failure는 전체 run을 버리지 않고 `error` event row와 inspector fallback copy로 기록한다.
- run이 `running -> done`으로 바뀌면 final artifact, finish reason, last handoff summary를 summary strip에 고정한다.

## State Matrix + Fixture Strategy

- `FIX-001` minimal completed run: 2 lanes, 1 handoff, final artifact 존재
- `FIX-002` waiting chain run: 4 lanes, nested waiting, blocked, interrupted 사례 포함
- `FIX-003` first failure run: mid-run tool failure, error path highlight, retry count 존재
- `FIX-004` dense parallel run: 10+ lanes, 120+ events, repeated transfers, merge edges 포함
- `FIX-005` redacted payload run: previews만 있고 raw는 숨김 상태
- `FIX-006` disconnected live watch run: stale -> disconnected -> reconnect 전환 포함
- state matrix는 `empty`, `loading`, `live-running`, `waiting`, `blocked`, `interrupted`, `failed`, `done`, `cancelled`, `stale`, `disconnected`, `redacted`를 모두 포함한다.
- `SLICE-1`은 `FIX-001`, `FIX-002`의 static screenshots를 기준으로 shell review를 수행한다.
- `SLICE-2`는 `FIX-001` ~ `FIX-006` 전체를 local fixture store로 재현한다.

## Large-run Degradation Rules

- lane 수가 8을 넘으면 inactive done lane은 기본 접힘 후보로 전환한다.
- event row가 120개를 넘으면 virtualized row rendering과 gap folding default-on을 사용한다.
- 동일 source/target 사이 transfer edge가 40개를 넘으면 grouped edge로 묶고 inspector에서 펼친다.
- map mode에서 lane 수가 20을 넘으면 agent cluster grouping을 기본값으로 사용한다.
- hover highlight 계산이 느려지면 direct predecessor/successor만 먼저 강조하고 전체 transitive path는 inspector request 시 계산한다.
- large-run degradation은 정보 손실이 아니라 표현 압축이어야 한다. hidden count와 expand affordance는 항상 남긴다.

## Microcopy + Information Expression Rules

- 상태 copy는 `Live`, `Running`, `Waiting`, `Blocked`, `Interrupted`, `Done`, `Failed`, `Cancelled`, `Stale`, `Disconnected`를 정확히 사용한다.
- gap copy 형식은 `// 18m 24s hidden · 4 lanes idle //`을 따른다.
- duration은 compact human format(`420ms`, `12s`, `4m 18s`)으로 보여주고 absolute timestamp는 hover/focus tooltip에서 노출한다.
- token/cost는 `12.4k tok`, `$0.42`처럼 compact format을 기본으로 하고 raw 정밀값은 inspector에서 노출한다.
- unknown 값은 `n/a`, redacted 값은 `redacted`, missing wait reason은 `reason unavailable`로 표현한다.
- id는 중간 절단(`trace_7f2…91c`)을 기본으로 하고 copy action에서 full id를 제공한다.

## Task-based Approval Criteria

- `AC-001`: 사용자는 home screen에서 anomalous run 하나를 10초 안에 선택할 수 있어야 한다.
- `AC-002`: 사용자는 graph mode에서 30초 체크리스트 6개 질문에 답할 수 있어야 한다.
- `AC-003`: keyboard-only로 mode 전환, event selection, inspector 열기/닫기를 수행할 수 있어야 한다.
- `AC-004`: reduced motion enabled 상태에서도 running/waiting/failed 의미가 shape와 text만으로 유지돼야 한다.
- `AC-005`: `FIX-004` large-run fixture에서 default collapse 후에도 blocked jump와 first error jump가 작동해야 한다.
- `AC-006`: `FIX-006` fixture에서 stale, disconnected, reconnect 전환이 동일 selection context를 유지해야 한다.
