# Run Workbench Causal Graph Reset

## Goal

현재 모니터를 `row-based timeline presented as Graph` 상태에서 `causal Graph workbench with secondary Waterfall mode`로 재정렬한다. 핵심은 좌측 rail의 dense workspace tree, 중앙의 selected-path-first graph canvas, 우측 inspector의 causal explanation을 한 계약으로 묶는 것이다.

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
- compared tasks: `tasks/codex-multi-agent-monitor-v0-1`, `tasks/run-workbench-ui-redesign`
- reason: 기존 redesign bundle은 `row-based event graph`를 목표로 닫혔고, 이번 작업은 그 전제를 뒤집어 `true Graph mode + Waterfall demotion`을 별도 task identity로 고정한다.
- chosen task path: `tasks/run-workbench-causal-graph-reset`

## Quality preflight

- verdict: orchestrated-task
- current repo state: 구현은 3-pane shell까지 도달했지만, left rail metadata 노출, timeline-grid graph, sparse Cause/Impact 때문에 제품 목표와 어긋났다.
- structure preflight: `src/app/MonitorApp.tsx`, `src/app/useMonitorAppState.ts`, `src/app/app.css`가 이미 큰 파일이어서 selector/view-model split 없이는 append-only 확장이 위험했다.
- split-first: required. 구현은 `domain selectors -> graph/waterfall split -> rail/inspector reset -> regression verification` 순으로 진행했다.

## Key decisions

- `work_type=refactor`, `delivery_strategy=ui-first`로 유지한다.
- `RunDataset`, parser, normalizer, storage, redaction, export contract는 바꾸지 않는다.
- `graph`는 causal node-edge canvas, `waterfall`은 time-grid timing view, `map`은 tertiary overview로 재정의한다.
- `pathOnly=true`를 기본 포커스로 두고, summary strip과 inspector는 같은 selection path를 설명해야 한다.
- drawer는 artifact/log/raw surface만 담당하고 visualization controls와 같은 계층에 두지 않는다.

## Validation gate status

- gate: blocking
- state: implementation complete, validation cleared
- verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm storybook:build`, `pnpm test:e2e`

## Implementation slices

- `SLICE-1`: dense shell, factual summary strip, separated controls
- `SLICE-2`: workspace tree navigation, path-only focus, local interaction wiring
- `SLICE-3`: selector/view-model split and true Graph renderer
- `SLICE-4`: Waterfall demotion, mode alignment, large-run focus preservation
- `SLICE-5`: causal inspector copy, drawer reveal rules, regression coverage
