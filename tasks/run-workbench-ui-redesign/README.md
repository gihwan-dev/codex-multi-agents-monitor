# Run Workbench UI Redesign

## Goal

기존 구현된 모니터를 `status-grouped card dashboard`에서 `workspace-grouped observability workbench`로 재설계한다. 핵심은 왼쪽 탐색 구조, 중앙 그래프 문법, 우측 inspector의 인과 연결을 다시 정의해 30초 이해 과업을 실제로 성립시키는 것이다.

## Document map

- Current audit: `CURRENT_STATE.md`
- Target state: `TARGET_STATE.md`
- UX Structure: `UX_SPEC.md`
- UX Behavior: `UX_BEHAVIOR_ACCESSIBILITY.md`
- Design References: `DESIGN_REFERENCES/`
- Architecture: `TECH_SPEC.md`
- Execution: `EXECUTION_PLAN.md`
- Validation: `SPEC_VALIDATION.md`
- Acceptance: `ACCEPTANCE.feature`
- Repo baseline rules: `../../docs/ai/ENGINEERING_RULES.md`

## Task continuity

- decision: create-new
- compared tasks: `tasks/codex-multi-agent-monitor-v0-1`
- reason: 기존 task는 greenfield v0.1 제품 설계와 import/live/normalization까지 포함한 product-wide feature bundle이다. 이번 요청은 이미 구현된 shell의 정보 구조, 그래프 문법, inspector 연결을 다시 설계하는 post-implementation UI refactor로서 goal, success criteria, major boundaries가 다르다.
- chosen task path: `tasks/run-workbench-ui-redesign`
- bootstrap supplement normalized: continuity 비교에서 기존 bundle의 `IMPLEMENTATION_CONTRACT.md`와 `source_of_truth.implementation` pointer는 identity 차이로 취급하지 않았다.

## Quality preflight

- verdict: orchestrated-task
- current repo state: 현재 구현은 starter를 넘어서 3-pane shell을 갖췄지만, left rail은 workspace tree가 아니라 status group + run card 구조이고, main canvas는 summary/jump/filter를 각각 큰 panel로 쌓아 graph보다 chrome이 강하다.
- structure preflight: `src/app/MonitorApp.tsx` 455 LOC, `src/app/useMonitorAppState.ts` 537 LOC, `src/app/app.css` 433 LOC다. append-only 방식으로 레이아웃을 다시 고치면 shell, state, graph, inspector 책임이 더 섞인다.
- split-first: required. 구현 단계에서는 `app chrome`, `workspace tree`, `graph timeline`, `inspector`, `alternate views`를 slice별로 분리한다.
- bootstrap: repo baseline implementation rules는 이미 존재하므로 greenfield bootstrap blocker는 없다.

## Key decisions

- `work_type=refactor`, `delivery_strategy=ui-first`로 고정한다.
- 기존 warm graphite tone, thin primitive layer, preview-first masking, graph/waterfall/map dataset은 재사용한다.
- left rail은 `status group + card`를 버리고 `quick filters + workspace tree + dense run row`로 바꾼다.
- summary, anomaly jumps, filters는 큰 box 세 개가 아니라 `compact summary strip + unified graph toolbar`로 압축한다.
- primary graph는 `lane card board`가 아니라 `row-based event graph`로 바꾸고, `time gutter`, `sticky lane headers`, `selected-path emphasis`, `gap rows`를 명시한다.
- inspector는 metadata table이 아니라 `Summary / Cause / Impact / Payload` 중심으로 재구성하고, bottom drawer는 기본 숨김으로 유지한다.

## Validation gate status

- gate: blocking
- state: redesign planning bundle complete, ready for `implement-task`
- ux docs: complete
- reference pack: complete
- bootstrap: no additional repo bootstrap blocker remains

## Implementation slices

- `SLICE-1`: top chrome, compact strip, graph toolbar, drawer-hidden shell, spacing/border density 조정
- `SLICE-2`: workspace tree navigation, quick filters, dense run rows, keyboard tree movement
- `SLICE-3`: row-based graph, time gutter, selected-path emphasis, gap rows, anomaly targeting
- `SLICE-4`: inspector cause/impact, upstream/downstream jumps, on-demand drawer wiring
- `SLICE-5`: waterfall/map alignment, large-run degradation verification, regression stories
