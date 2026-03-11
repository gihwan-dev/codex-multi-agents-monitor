# Current slice
Session-First Canonical Refactor
- 상태: 완료
- 범위:
  - public DTO와 Tauri command surface를 `session-first`로 통일
  - `session_read_model` 기반 조회 경계 추가
  - `rollout_decoder` / snapshot refresh facade 도입
  - Live/Archive 공용 browser 구조와 Summary dashboard 재정렬
  - legacy `thread-*` runtime/test surface 제거, `/threads/:threadId` redirect만 유지

# Done
- [`src/shared/types/contracts.ts`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/shared/types/contracts.ts)와 [`src/shared/lib/tauri/commands.ts`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/shared/lib/tauri/commands.ts)에서 canonical public surface를 `list_sessions`, `get_session_flow`, `get_session_lane_inspector`, `get_summary_dashboard` 4개로 고정했다.
- [`src-tauri/src/commands/api/session_read_model.rs`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src-tauri/src/commands/api/session_read_model.rs), [`src-tauri/src/commands/api/session_flow.rs`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src-tauri/src/commands/api/session_flow.rs), [`src-tauri/src/commands/api/session_lane_inspector.rs`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src-tauri/src/commands/api/session_lane_inspector.rs)로 session-first read model 경계를 분리했다.
- [`src-tauri/src/ingest/mod.rs`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src-tauri/src/ingest/mod.rs), [`src-tauri/src/ingest/orchestrator.rs`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src-tauri/src/ingest/orchestrator.rs), [`src-tauri/src/ingest/rollout_decoder.rs`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src-tauri/src/ingest/rollout_decoder.rs)에서 snapshot refresh facade와 shared rollout decoder를 도입했다.
- [`src/pages/live/live-page.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/pages/live/live-page.tsx), [`src/pages/archive/archive-page.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/pages/archive/archive-page.tsx), [`src/features/session-browser/lib/use-session-browser-page.ts`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/session-browser/lib/use-session-browser-page.ts), [`src/features/session-browser/ui/session-list-card.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/session-browser/ui/session-list-card.tsx)로 Live/Archive 브라우저 조립을 공용화했다.
- [`src/features/session-flow/ui/session-flow-workspace.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/session-flow/ui/session-flow-workspace.tsx), [`src/features/session-flow/ui/session-flow-diagram.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/session-flow/ui/session-flow-diagram.tsx), [`src/features/session-flow/ui/use-session-viewport.ts`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/session-flow/ui/use-session-viewport.ts), [`src/features/session-flow/ui/session-flow-inspector.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/session-flow/ui/session-flow-inspector.tsx)에서 `SessionLaneRef` 기반 flow/inspector 계약으로 전환했다.
- [`src/pages/summary/summary-page.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/pages/summary/summary-page.tsx)에서 summary filter state와 dashboard content를 분리하고 error state를 추가했다.
- legacy runtime/test surface는 `archive_list`, `history_summary`, `live_overview`, `thread_detail` 계열 기준으로 모듈 export와 tracked 파일 모두 제거됐다. `/threads/:threadId` redirect만 호환 경로로 유지한다.

# Decisions made during implementation
- 저장소/SQLite 식별자는 계속 `thread_id`와 `threads`를 유지하고, 외부 contract adapter에서만 `session_id`와 `workspace`로 변환한다.
- `SessionLaneRef`를 public canonical lane identity로 고정하고 raw `lane_id`/`target_lane_id` 문자열을 제거했다.
- Rust↔TS drift 방지는 codegen 대신 `serde + runtime decoder + contract test` 조합으로 유지한다.
- `refresh_monitor_snapshot_if_stale(max_age=2s)`를 조회 command 앞의 단일 snapshot gate로 사용하고, archive/summary는 추가 polling 없이 기존 규칙을 유지한다.
- `/threads/:threadId` redirect는 호환 경로로 유지하되 별도 legacy lookup surface는 만들지 않는다.
- 커밋은 수행하지 않았다. 이번 턴은 구현과 검증, 상태 갱신까지만 마감했다.

# Verification results
- `pnpm typecheck` 통과
- `pnpm cargo:test` 통과
- `pnpm test` 통과
- legacy Rust test 모듈 4개 삭제 후 [`src-tauri/src/commands/api/tests/mod.rs`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src-tauri/src/commands/api/tests/mod.rs) 기준으로 session-first test set만 남겼다.
- [`src/shared/lib/tauri/commands.test.ts`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/shared/lib/tauri/commands.test.ts)에서 invoke 이름/인자뿐 아니라 runtime decode까지 검증했다.
- 커밋: 미수행(사용자 요청 없음)

# Known issues / residual risk
- Rust dead-code warning이 일부 남아 있다: [`src-tauri/src/domain/models.rs`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src-tauri/src/domain/models.rs), [`src-tauri/src/sources/mod.rs`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src-tauri/src/sources/mod.rs), [`src-tauri/src/commands/api/tests/support.rs`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src-tauri/src/commands/api/tests/support.rs).
- large session에서 [`src/features/session-flow/ui/session-flow-diagram.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/session-flow/ui/session-flow-diagram.tsx)의 SVG pan/zoom 사용성은 추가 UX 조정 여지가 있다.
- repo-wide `pnpm lint`, `pnpm tauri:build`는 이번 턴 범위에서 다시 돌리지 않았다.

# Next slice
없음.
- 후속 우선순위 후보:
  - 남은 Rust warning 정리
  - repo-wide lint/tauri build 재확인
  - large-session UX/polish 별도 계획 수립
