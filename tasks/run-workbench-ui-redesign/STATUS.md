# Current slice
Completed: `SLICE-1` to `SLICE-5`.

# Done
- `MonitorApp` shell을 compact top bar, summary strip, unified graph toolbar, hidden-by-default drawer 구조로 재배치했다.
- rail을 `workspace -> thread -> run` dense tree UI로 교체하고 quick filter/search/import entry를 한 곳으로 정리했다.
- graph primary view를 lane-card board 대신 row-based timeline renderer로 교체했다.
- inspector primary UI를 `Summary`, `Cause`, `Impact`, `Payload` section 기반 causal inspector로 교체했다.
- Storybook variants와 Playwright e2e를 추가해 drawer hidden-by-default, mode switch preservation, large-run degradation evidence를 남겼다.

# Decisions made during implementation
- ingestion/schema/storage contract 변경 없이 새 UI는 composition layer와 새 renderer 컴포넌트로 도입했다.
- persisted overwrite가 불안정했던 기존 파일은 대규모 재작성 대신 새 컴포넌트 파일을 만들고 `MonitorApp`에서 교체 연결했다.
- legacy selector/state shape는 유지하되, 사용자에게 보이는 shell/rail/graph/inspector contract를 먼저 리디자인 완료했다.

# Verification results
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm storybook:build`
- `pnpm test:e2e`

# Known issues / residual risk
- `useMonitorAppState`와 selector layer는 내부적으로 legacy state shape를 아직 유지한다. strict contract cleanup까지 요구되면 후속 refactor가 필요하다.
- 기존 `RunListPane`, `GraphView`, `InspectorPane` 파일은 레포에 남아 있지만 현재 `MonitorApp`의 active composition path에서는 사용하지 않는다.

# Next slice
None. Closeout complete.
