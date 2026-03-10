# Current slice
Slice 5. Agent Drilldown과 raw expansion 구현
- 상태: 완료
- 커밋: `feat(thread-detail): agent drilldown과 raw expansion 추가`

# Done
- Tauri `get_thread_drilldown(threadId, laneId)` command를 실제 구현해 main lane과 agent lane 모두에서 최신 commentary, 최근 tool spans, 관련 wait spans, raw JSONL snippet을 on-demand로 계산하도록 연결했다.
- shared contract에 `ThreadDrilldown`, `RawJsonlSnippet`, `related_wait_spans`를 추가하고, frontend bridge와 thread-detail shell이 lane-centered selection + 별도 drilldown query를 사용하도록 바꿨다.
- Thread Detail 우측 컬럼을 `Marker Summary` + `Agent Drilldown` 2단 구조로 확장했고, lane 선택, 기본 접힘 raw snippet 토글, lane 변경 시 raw expansion reset 동작을 추가했다.
- Rust drilldown 테스트, frontend shell/page/command contract 테스트를 보강해 Slice 5 동작을 고정했다.

# Decisions made during implementation
- drilldown source는 `monitor.db`를 확장하지 않고 `threads/agent_sessions.rollout_path`를 통해 원본 JSONL을 on-demand로 다시 읽는 방식으로 고정했다.
- raw snippet anchor는 `최신 commentary line`, fallback은 `최신 의미 있는 event line`으로 유지했고, snippet window는 anchor 주변 최대 8줄로 제한했다.
- lane selection은 `ThreadTimelineShell` 내부 상태로 관리하고, marker hover는 summary panel만 바꾸며 drilldown lane selection은 변경하지 않도록 유지했다.
- rollout path가 비어 있거나 파일을 읽을 수 없으면 command 전체를 실패시키지 않고 `raw_snippet: null`, commentary/tool 비어 있음으로 degrade 하도록 고정했다.

# Verification results
- `pnpm cargo:test` 통과
- 결과: Rust 18 tests 통과 (`get_thread_drilldown` main/agent/missing-rollout 시나리오 포함)
- `pnpm test` 통과
- 결과: Vitest 8 files / 25 tests 통과
- `pnpm typecheck` 통과
- advisory review: `module-structure-gatekeeper`, `frontend-structure-gatekeeper`, `code-quality-reviewer`, `architecture-reviewer`, `type-specialist`, `test-engineer`를 요청했지만 응답을 받지 못했다. advisory 미응답으로 처리했다.
- commit: 성공 예정 (`feat(thread-detail): agent drilldown과 raw expansion 추가`)

# Known issues / residual risk
- main/live thread가 state snapshot에 없는 경우 `rollout_path`가 비어 raw snippet과 commentary/tool drilldown이 비어 있을 수 있다.
- child lane 상세 이벤트는 여전히 swimlane block으로 확장되지 않고 우측 drilldown 패널에서만 보강된다.
- raw snippet은 원본 JSONL 일부 window만 보여주므로 anchor 밖 문맥은 추가 확장이 필요할 수 있다.
- delegated writer liveness 문제는 해결하지 않았고, 이후 slice에서도 main-thread direct implementation이 필요할 수 있다.

# Next slice
목표
- Slice 6에서 History Summary와 workspace/log deep link를 추가해 최근 7일 role별 duration/timeout/spawn 통계와 진입 경로를 완성한다.

선행조건
- 현재 thread-detail drilldown contract를 유지한 채 history view에서 재사용 가능한 summary/backlink 경계를 따로 잡아야 한다.
- deep link는 frontend가 직접 파일을 읽지 않고 기존 Tauri open command만 사용하도록 유지해야 한다.

먼저 볼 경계
- `src/pages/history/history-page.tsx`
- `src/shared/lib/tauri/commands.ts`
- `src-tauri/src/commands/open.rs`
