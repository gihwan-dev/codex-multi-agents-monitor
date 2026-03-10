# Current slice
Slice 4. Thread Detail swimlane timeline 구현
- 상태: 완료
- 커밋: 예정 (`feat(thread-detail): 스레드 상세 타임라인 스윔레인 구현`)

# Done
- thread detail 전용 view-model을 추가해 global window, main lane, child lane session window, wait/tool block, commentary/spawn/final marker, wait-to-child connector를 한 곳에서 계산하도록 정리했다.
- thread detail 화면이 skeleton 대신 실제 swimlane timeline을 렌더하고, marker summary panel에서 hover 미리보기 + click 고정 interaction을 제공하도록 바뀌었다.
- `ThreadDetailPage`가 inflight thread에서만 2초 polling을 유지하도록 바뀌었고, thread-detail view-model/shell/page 테스트를 추가해 slice 4 동작을 고정했다.

# Decisions made during implementation
- Slice 4의 구현 정책은 그대로 유지했다: main lane id=`thread_id`, child lane id=`agent.session_id`, child lane은 `started_at~updated_at` session window 기반, marker interaction은 hover 미리보기 + click 고정, inflight detail만 2초 polling.
- marker summary panel의 active 우선순위는 `hovered marker > selected marker > latest marker`로 고정했다.
- view-model은 backend contract를 늘리지 않고 frontend 내부 타입으로만 추가했고, child session과 매칭되지 않는 wait는 connector를 그리지 않도록 유지했다.
- delegated writer 경로가 반복적으로 final/checkpoint를 반환하지 못해, 이번 slice는 thread-detail 모듈 경계 안에서 main thread가 직접 구현을 마감했다.

# Verification results
- phase 1: delegated `worker`를 두 차례 재시도했지만 checkpoint/final 미반환으로 진행이 멈춰 직접 구현으로 전환했다.
- phase 2-1: `pnpm test` 통과
- 결과: Vitest 8 files / 23 tests 통과
- phase 2-2: `pnpm typecheck` 통과
- advisory review: `module-structure-gatekeeper`, `frontend-structure-gatekeeper`, `code-quality-reviewer`를 요청했지만 응답은 받지 못했다. advisory 미응답으로 처리했다.
- phase 3 commit: 대기 중

# Known issues / residual risk
- child lane은 여전히 subagent 상세 메시지 타임라인이 아니라 session lifetime window만 시각화한다.
- marker summary는 요약 텍스트와 시간 메타데이터까지만 보여주고 raw expansion은 아직 없다.
- delegated writer liveness 문제가 남아 있어 이후 implement-task slice에서도 같은 현상이 반복될 수 있다.
- raw expansion, agent drilldown, history/deep link, archived JSONL 본문 ingest는 여전히 후속 slice 범위다.

# Next slice
목표
- Slice 5에서 agent drilldown과 raw expansion을 추가해, 요약 우선 상태를 유지한 채 필요할 때만 원문 snippet을 확장해서 볼 수 있게 한다.

선행조건
- slice 4에서 추가한 view-model을 재사용해 selected agent 기준 tool/wait 영향과 marker summary를 drilldown 패널로 확장할 수 있어야 한다.
- raw JSONL snippet은 기본 접힘 상태를 유지하고, thread detail timeline과 selection state를 공유할지 먼저 정해야 한다.

먼저 볼 경계
- `src/features/thread-detail/ui/thread-timeline-shell.tsx`
- `src/features/thread-detail/ui/thread-swimlane-panel.tsx`
- `src-tauri/src/commands/api/thread_detail.rs`
