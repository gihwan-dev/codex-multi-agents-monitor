# UX Specification

## Goal/Audience/Platform

- Goal: `REQ-001`부터 `REQ-006`까지를 만족하도록 run workbench를 true Graph mode 중심으로 재정렬한다.
- Audience: 멀티에이전트 orchestration의 blocker chain, handoff, failure, artifact 흐름을 빠르게 읽어야 하는 엔지니어, 제품 오너, 리뷰어.
- Platform: Tauri desktop app 우선. 기본 타깃은 1280px 이상, 1024px까지 정보 구조 유지.

## 30-Second Understanding Checklist

- 사용자는 지금 어느 workspace / thread / run을 보고 있는지 left rail과 top bar만 보고 답할 수 있어야 한다.
- 사용자는 현재 blocker agent가 누구인지 summary strip과 selected Graph node만 보고 답할 수 있어야 한다.
- 사용자는 affected agents 수와 last handoff를 summary strip과 Graph edge만 보고 답할 수 있어야 한다.
- 사용자는 longest gap과 first failure를 raw payload 없이 찾을 수 있어야 한다.
- 사용자는 선택한 항목의 upstream / downstream impact를 inspector에서 바로 말할 수 있어야 한다.
- 사용자는 precise timing이 필요할 때만 Waterfall로 이동하면 된다는 것을 UI만 보고 이해할 수 있어야 한다.

## Visual Direction + Anti-goals

- Direction: warm graphite, low-noise desktop workbench, dense row grammar, selected-path emphasis.
- Direction: GitKraken-like graph grammar를 primary, Langfuse timeline density를 Waterfall secondary로 사용한다.
- Anti-goal: Graph라는 이름으로 time-grid table을 기본으로 보여주는 것.
- Anti-goal: metadata-heavy explorer row, panel wall, empty box inspector.

## Reference Pack (adopt/avoid)

- Adopt: `DESIGN_REFERENCES/curated/gitkraken-graph-grammar-adopt.md`
- Adopt: `DESIGN_REFERENCES/curated/langfuse-timeline-density-adopt.md`
- Avoid: `DESIGN_REFERENCES/curated/current-waterfall-shell-avoid.md`

## Glossary + Object Model

- `Workspace`: 프로젝트/레포 문맥
- `Thread`: workspace 아래의 작업 문맥
- `Run`: 실행 1회
- `Graph lane`: agent column
- `Graph step`: 의미 있는 event row
- `Selection path`: 기본 강조 대상 causal chain
- `Waterfall`: precise timing inspection surface

## Layout/App-shell Contract

- left rail은 quick filter + workspace tree + dense run rows를 가진다.
- summary strip은 fact-only surface이고 visualization controls와 섞이지 않는다.
- graph toolbar는 `Visualization`과 `Drawer` cluster를 분리한다.
- primary detail canvas는 `Graph`, secondary detail canvas는 `Waterfall`, tertiary는 `Map`이다.
- inspector는 `Summary / Why blocked / Upstream dependency / Downstream impact / Payload`만 보여준다.
- drawer는 닫혀 있을 때 높이를 차지하지 않는다.

## Token + Primitive Contract

- token source는 계속 `src/theme/tokens.css`, `src/theme/primitives.css`, `src/theme/motion.css`.
- repo-local primitive layer만 사용한다.
- dense row와 graph node는 subtle border, low-noise surface, IBM Plex Sans/Mono 방향을 유지한다.

## Screen + Flow Coverage

- `SCR-001` Workspace Tree Home: quick filter -> workspace expand -> run row select
- `SCR-002` Run Detail Graph: summary strip -> anomaly jump -> Graph path -> inspector
- `SCR-003` Waterfall / Map / Drawer: mode switch or explicit drawer action으로 secondary detail 접근
- `FLOW-001` anomalous run 찾기
- `FLOW-002` blocker chain 해석
- `FLOW-003` Graph와 Waterfall 간 같은 selection 유지
- `FLOW-004` artifact/log/raw drawer 열기

## Implementation Prompt/Handoff

- `SLICE-1`은 dense chrome, factual summary strip, toolbar separation을 구현한다.
- `SLICE-2`는 tree interaction, keyboard/focus, path-only toggle, compact inspector를 구현한다.
- `SLICE-3`은 selection path, summary facts, Graph canvas, inspector causal summary selector를 구현한다.
- `SLICE-4`는 Waterfall demotion과 mode alignment를 닫는다.
- `SLICE-5`는 regression verification과 closeout을 담당한다.
