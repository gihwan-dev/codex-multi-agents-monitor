# Current slice
Slice 3. Live Overview 병목 랭킹과 필터 구현
- 상태: 완료
- 커밋: `212ae6e` (`feat(overview): 라이브 오버뷰 병목 랭킹과 필터 추가`)

# Done
- `list_live_threads`가 overview 전용 `LiveOverviewThread[]`를 반환하도록 확장됐고, inflight thread row에 `status`, `agent_roles`, `bottleneck_level`, `longest_wait_ms`, `active_tool_*`, mini timeline window anchor가 함께 내려오도록 연결했다.
- Live Overview가 2초 polling, workspace/role/status(=severity) client-side filter, bottleneck top list, row별 wait/tool badge, mini timeline, thread detail 링크를 렌더하도록 placeholder shell을 대체했다.
- overview 집계는 per-thread N+1 query 대신 base live thread 1회 + roles/open waits/open tools/timeline batch query로 재구성했다.
- Rust overview 테스트, overview shell 테스트, overview page polling 테스트를 추가해 slice 3 동작을 고정했다.

# Decisions made during implementation
- `status` filter 의미는 lifecycle이 아니라 bottleneck severity로 유지하되, contract는 additive change로 맞추기 위해 `LiveOverviewThread.status = inflight`를 복원했다.
- mini timeline은 backend가 clip한 10분 window를 `mini_timeline_window_started_at`, `mini_timeline_window_ended_at`로 함께 내려주고 frontend는 그 anchor만 사용해 위치를 계산하도록 고정했다.
- severity 판정은 승인된 slice 규칙대로 `open wait` 우선, `wait`가 없을 때만 `open tool >= 20s`를 warning으로 보는 방식으로 유지했다.
- phase 1에서 same writer를 `fork_context:false`로 시작했고, 중간 checkpoint interrupt 이후 partial diff를 확인한 뒤 동일 writer를 재개해 slice를 마감했다.
- advisory review 중 architecture/type review의 snapshot anchor, additive contract, per-thread fan-out 지적은 커밋 전에 반영했고, code-quality review의 `short wait + long tool` severity 제안은 이번 slice 승인 규칙과 충돌해 채택하지 않았다.

# Verification results
- phase 2-1: `pnpm lint` 통과
- phase 2-2: `pnpm test` 통과
- 결과: Vitest 4 files / 9 tests 통과
- phase 2-3: `pnpm typecheck` 통과
- phase 2-4: `pnpm cargo:test` 통과
- 결과: Rust test 15개 모두 통과
- 경고: `src-tauri/src/ingest/mod.rs`의 `consume_line` dead code warning, `src-tauri/src/sources/mod.rs`의 `archived_sessions_dir` unused warning은 유지됐다.
- advisory `architecture-reviewer`, `type-specialist` finding은 commit 전 보완했고, `code-quality-reviewer` finding은 non-blocking으로 기록했다.
- phase 3 commit: 일반 `git commit`으로 성공했고 `git commit --no-verify` 재시도는 사용하지 않았다.

# Known issues / residual risk
- `LiveOverviewThread`와 TypeScript mirror는 여전히 수동 동기화라서 이후 overview contract가 더 커지면 drift 리스크가 남아 있다.
- workspace/role/severity filter는 여전히 frontend client-side 필터이므로 inflight thread 수가 크게 늘면 polling payload 자체는 커질 수 있다.
- `run_incremental_ingest`는 2초 polling마다 전체 snapshot + live 재구성을 다시 수행하므로, long-running session이 많아지면 SQLite lock/지연 리스크가 남아 있다.
- Thread Detail swimlane, raw expansion, history/deep link, archived JSONL 본문 ingest는 아직 다음 slice 이후 범위다.

# Next slice
목표
- Slice 4에서 메인 thread와 subagent swimlane timeline, wait-to-agent 연결선, marker summary panel을 구현한다.

선행조건
- overview는 `timeline_events`, `wait_spans`, `tool_spans`를 요약 소비하는 상태고, `get_thread_detail`은 이미 정렬된 timeline/span 배열을 반환한다.
- live overview contract와 2초 polling은 고정된 상태이므로 다음 slice는 thread detail 시각화와 interaction에 집중한다.

먼저 볼 경계
- `src/pages/thread-detail/thread-detail-page.tsx`
- `src/features/thread-detail/ui/thread-timeline-shell.tsx`
- `src-tauri/src/commands/api.rs`
