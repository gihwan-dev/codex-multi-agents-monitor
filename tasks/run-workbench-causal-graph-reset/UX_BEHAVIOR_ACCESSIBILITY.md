# UX Behavior & Accessibility

## Interaction Model

- workspace row는 expand/collapse, run row는 actual selection 변경을 담당한다.
- anomaly jump, Graph node, Waterfall row, inspector jump는 모두 같은 selection state를 갱신한다.
- `Path only`는 Graph와 Waterfall의 visible context를 동시에 좁힌다.
- drawer는 artifact/log/raw/import를 명시적으로 열 때만 나타난다.

## Keyboard + Focus Contract

- `/` search focus
- `G`, `W`, `M` mode switch
- `P` path-only toggle
- `I` inspector toggle
- `.` follow live toggle
- `E` error-only toggle
- compact inspector는 keyboard로 닫았다가 다시 열어도 같은 selection을 유지한다.

## Accessibility Contract

- 상태는 색상만이 아니라 `StatusChip` shape와 텍스트로 구분한다.
- Graph edge SVG는 title을 가진다.
- dense row와 jump button hit target은 최소 32px를 유지한다.
- hover-only 정보 없이 focus로도 같은 jump affordance를 사용할 수 있어야 한다.

## Live Update Semantics

- imported run은 follow-live 기본 off, live run은 기본 on을 유지한다.
- 과거 event를 선택하면 `Following paused`를 유지한다.
- reconnect나 stale badge는 top chrome에 compact하게 노출되고 Graph primary reading을 침범하지 않는다.

## State Matrix + Fixture Strategy

- `FIX-001` minimal completed run
- `FIX-002` waiting chain run
- `FIX-003` first failure run
- `FIX-004` dense parallel run
- `FIX-005` redacted payload run
- `FIX-006` disconnected live watch run
- dense run에서는 selected path readability가 first-class다.

## Large-run Degradation Rules

- selection path는 depth-limited traversal로 계산한다.
- `pathOnly` 기본 on으로 dense run의 transitive noise를 줄인다.
- selected event와 inspector focus는 mode switch에서 유지한다.

## Microcopy + Information Expression Rules

- summary strip label은 `Blocked by`, `Affected`, `Last handoff`, `Longest gap`, `First failure`, `Path only`.
- inspector label은 `Summary`, `Why blocked`, `Upstream dependency`, `Downstream impact`, `Payload`.
- Waterfall은 timing-focused mode라는 의미를 copy와 hierarchy로 유지한다.

## Task-based Approval Criteria

- `AC-001` workspace tree로 anomalous run을 빠르게 찾을 수 있어야 한다.
- `AC-002` Graph mode에서 30초 체크리스트를 수행할 수 있어야 한다.
- `AC-003` Graph/Waterfall/inspector selection context가 일치해야 한다.
- `AC-004` drawer는 explicit action 전까지 숨겨져 있어야 한다.
- `AC-005` dense fixture에서 selected path가 readable해야 한다.
- `AC-006` keyboard-only flow가 유지돼야 한다.
