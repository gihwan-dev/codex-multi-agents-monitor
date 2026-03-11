# Current slice
Slice 10. Summary 페이지를 filter-driven dashboard로 전환한다
- 상태: 완료
- 커밋:
  - `1763ca2 docs(architecture): session naming baseline 고정`
  - `8437f36 feat(ingest): user_message를 session item에 편입`
  - `9dfd606 feat(session-flow): session flow public contract 추가`
  - `9526cca feat(archive): archived session list API 추가`
  - `7eb762b feat(summary): summary dashboard API 추가`
  - `5d1edb0 feat(app-shell): live archive summary IA skeleton 추가`
  - `13bbd5a feat(session-flow): SVG sequence diagram workspace 추가`
  - `c85165e feat(live): session browser로 live 페이지 전환`
  - `6520410 feat(archive): archived chat browser 추가`
  - `88ed3be feat(summary): filter-driven summary 페이지 추가`
  - `f2f13aa chore(closeout): lint-safe UI 정리`

# Done
- `README.md`, `docs/architecture.md`, `src/shared/types/contracts.ts`에서 user-facing hierarchy를 `Workspace > Chat(Session) > Agent Session > Item(Event)`로 고정했다.
- ingest가 `user_message`를 title/latest summary 보강에만 쓰지 않고 `timeline_events.kind = "user_message"`로도 기록하도록 확장했다.
- `get_session_flow`, `list_archived_sessions(filters)`, `get_summary_dashboard(filters)` public/shared contract를 추가하고 frontend Tauri wrapper까지 연결했다.
- app shell이 `Live / Archive / Summary` IA로 전환되고 `/`, `/live`, `/archive`, `/summary`, legacy `/threads/:threadId` routing compatibility가 정리됐다.
- SVG 기반 `SessionFlowDiagram`과 inspector/workspace가 추가되어 `user_message/commentary/tool_call/wait/spawn/final_answer` 흐름을 session workspace 안에서 볼 수 있게 됐다.
- live page가 workspace sidebar + root session list + embedded flow workspace 구조를 실제로 사용하도록 전환됐다.
- archive page가 archived session list와 reusable flow workspace를 결합한 archived chat browser로 전환됐다.
- summary page가 workspace/session/date filter bar, KPI 카드, workspace distribution, role mix, session compare view를 갖춘 filter-driven dashboard로 전환됐다.
- closeout 단계에서 session-flow/summary 관련 UI를 Biome 기준으로 다시 정리해 새 lint 이슈를 제거했다.

# Decisions made during implementation
- storage identifier는 계속 `thread_id`를 유지하고, DB schema/legacy command rename은 하지 않기로 고정했다.
- MVP workspace key는 계속 `cwd`를 사용하고, 별도 workspace entity는 후속 slice에서 도입하지 않기로 유지했다.
- canonical message/event kind 세트는 `user_message`, `commentary`, `final`, `spawn`, `wait`, `tool` 기준을 유지하고, `task_complete`는 final fallback marker source로만 취급한다.
- flow payload는 기존 storage identifier `thread_id`를 그대로 운반하고, 새 route/UI에서만 `sessionId` 의미로 감싼다.
- wait item의 `target_lane_id`는 `child_session_id`를 그대로 사용하고, spawn item은 현재 데이터 모델상 안정적으로 child lane을 특정할 수 없어 `target_lane_id = null`로 유지한다.
- summary dashboard는 raw rollout parsing 없이 DB-derived metric만 사용하도록 범위를 축소했고, KPI는 `session_count / active / completed / average_duration / workspace_count`로 고정했다.
- raw snippet은 새 flow payload에 넣지 않고, live/archive workspace inspector가 기존 `get_thread_drilldown` surface를 통해 lane별로 불러오도록 유지한다.
- archive browser는 KPI/retrospective 성격의 summary UI를 넣지 않고 session list + flow workspace에만 집중한다.
- full `pnpm lint` 실패 원인은 최종 시점 기준 기존 레포의 formatter/import 정렬 이슈([`src/features/history/ui/history-shell.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/history/ui/history-shell.tsx), [`src/features/overview/ui/live-overview-shell.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/overview/ui/live-overview-shell.tsx), [`src/features/overview/ui/live-overview-shell.test.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/overview/ui/live-overview-shell.test.tsx), [`src/features/thread-detail/ui/thread-timeline-shell.test.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/features/thread-detail/ui/thread-timeline-shell.test.tsx), [`src/pages/thread-detail/thread-detail-page.test.tsx`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/pages/thread-detail/thread-detail-page.test.tsx), [`src/shared/lib/tauri/commands.ts`](/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/shared/lib/tauri/commands.ts))로 한정됐다.

# Verification results
- Slice 1:
  - `pnpm typecheck` 통과
  - `rg -n "Thread Detail|Overview|History|thread_id|ThreadDetail|MonitorThread" docs README.md src/shared/types/contracts.ts` 실행 후 compatibility naming만 남았음을 수동 확인
  - 커밋: 기본 `git commit -m "docs(architecture): session naming baseline 고정"` 1회 통과
- Slice 2:
  - `pnpm cargo:test -- thread_detail ingest` 통과
  - `rg -n "user_message|commentary|final|spawn|wait|tool" src-tauri/src/ingest/mod.rs` 확인 완료
  - 커밋: 기본 `git commit -m "feat(ingest): user_message를 session item에 편입"` 1회 통과
- Slice 3:
  - `pnpm cargo:test -- session_flow thread_detail` 통과
  - `pnpm typecheck` 통과
  - 커밋: 기본 `git commit -m "feat(session-flow): session flow public contract 추가"` 1회 통과
- Slice 4:
  - `pnpm cargo:test -- archive_list history_summary` 통과
  - `pnpm typecheck` 통과
  - 커밋: 기본 `git commit -m "feat(archive): archived session list API 추가"` 1회 통과
- Slice 5:
  - `pnpm cargo:test -- summary_dashboard history_summary` 통과
  - `pnpm typecheck` 통과
  - 커밋: 기본 `git commit -m "feat(summary): summary dashboard API 추가"` 1회 통과
- Slice 6:
  - `pnpm test -- --run src/app/App.test.tsx` 통과
  - `pnpm typecheck` 통과
  - 커밋: 기본 `git commit -m "feat(app-shell): live archive summary IA skeleton 추가"` 1회 통과
- Slice 7:
  - `pnpm test -- --run src/features/session-flow/ui/session-flow-diagram.test.tsx` 통과
  - `pnpm typecheck` 통과
  - 커밋: 기본 `git commit -m "feat(session-flow): SVG sequence diagram workspace 추가"` 1회 통과
- Slice 8:
  - `pnpm test -- --run src/pages/live/live-page.test.tsx` 통과
  - `pnpm typecheck` 통과
  - 커밋: 기본 `git commit -m "feat(live): session browser로 live 페이지 전환"` 1회 통과
- Slice 9:
  - `pnpm test -- --run src/pages/archive/archive-page.test.tsx` 통과
  - `pnpm typecheck` 통과
  - 커밋: 기본 `git commit -m "feat(archive): archived chat browser 추가"` 1회 통과
- Slice 10:
  - `pnpm test -- --run src/pages/summary/summary-page.test.tsx` 통과
  - `pnpm typecheck` 통과
  - 커밋: 기본 `git commit -m "feat(summary): filter-driven summary 페이지 추가"` 1회 통과
- Final closeout:
  - `pnpm test` 통과
  - `pnpm cargo:test` 통과
  - `pnpm tauri:build` 통과
  - `pnpm lint` 실패
  - lint 실패는 기존 레포의 formatter/import 정렬 이슈 6건으로 한정되며, 이번 구현 범위 파일에 대한 `pnpm exec biome check ...`는 통과
  - closeout cleanup 커밋: 기본 `git commit -m "chore(closeout): lint-safe UI 정리"` 1회 통과

# Known issues / residual risk
- `pnpm lint`는 여전히 레포 기존 파일 6건 때문에 실패한다. 이번 plan 구현 파일 기준 lint는 통과했지만 repo-wide green은 아니다.
- Rust `src-tauri/src/domain/mod.rs`에는 `SessionFlowColumn`, `SessionFlowItem`, `SessionFlowItemKind`, `SessionLane` re-export unused warning이 남는다.
- session flow diagram의 pan/zoom은 기본 `viewBox` 조작이라 대규모 세션에서 사용성 튜닝이 더 필요할 수 있다.
- live session A에서 B로 전환될 때 embedded workspace가 새 session 기준으로 즉시 갱신되는 주 동선은 전용 회귀 테스트가 아직 없다.

# Next slice
없음. 10-slice plan 구현 완료. 이후 진행은 repo-wide lint debt 정리 또는 UX polish 별도 plan으로 분리한다.
