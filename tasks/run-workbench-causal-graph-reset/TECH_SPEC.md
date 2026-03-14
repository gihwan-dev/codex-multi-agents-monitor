# Technical Specification

## Context and evidence

- 사용자 피드백은 현재 Graph가 사실상 Waterfall이며, 제품 목표가 blocker-chain 이해라는 점을 분명히 했다.
- 구현 근거는 `src/app/MonitorApp.tsx`, `src/app/useMonitorAppState.ts`, `src/shared/domain/selectors.ts`, `src/features/run-list/WorkspaceRunTree.tsx`, `src/features/run-detail/graph/CausalGraphView.tsx`, `src/features/run-detail/waterfall/WaterfallView.tsx`, `src/features/inspector/CausalInspectorPane.tsx`다.

## Quality preflight

- verdict: `orchestrated-task`
- split-first: true
- 구현 경계는 shell, selector/view-model, graph, waterfall, inspector, tests로 분리했다.

## Module impact and boundaries

- selector boundary
  - `buildWorkspaceTreeModel`, `buildSummaryFacts`, `buildSelectionPath`, `buildGraphCanvasModel`, `buildWaterfallModel`, `buildInspectorCausalSummary`를 추가해 UI 계산을 selector로 이동했다.
- renderer boundary
  - Graph는 `CausalGraphView`, Waterfall은 `WaterfallView`로 분리하고 공유 데이터셋 위에 다른 view-model을 사용한다.
- inspector boundary
  - inspector는 raw viewer가 아니라 derived causal summary를 읽는다. raw/log/artifacts는 drawer에서 연다.
- state boundary
  - `pathOnlyByRunId`를 추가해 graph, summary, waterfall, inspector가 동일 포커스를 공유한다.

## Performance and degradation

- selected path는 depth-limited traversal로 계산해 dense run에서 transitive explosion을 막는다.
- large-run에서는 `pathOnly` 기본값과 lane visibility 규칙으로 graph 읽기 부담을 줄인다.
- Waterfall은 same selection context를 유지하지만 timing inspection 전용으로 남긴다.

## Validation and residual risks

- fixture-driven tests가 selector 계약과 mode switching을 방어한다.
- residual risk: dense fixture에서 transitive path depth는 heuristic이므로 실제 데이터셋에 따라 tuning 여지가 있다.
