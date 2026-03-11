# Current slice
Slice 5. Architecture wording과 잔여 expectation 정리
- 상태: 완료
- 커밋:
  - `73bb02f fix(thread-detail): archived 가시성 계약 추가`
  - `1b433b6 fix(live-overview): unarchived root를 live 기준으로 전환`
  - `07d239a fix(thread-detail): 미아카이브 thread polling 유지`
  - `b4f1b84 fix(overview): live copy를 현재 대화 기준으로 정렬`
  - `9d4ea0c docs(architecture): live semantics 문서 동기화`

# Done
- `ThreadDetail.thread.archived` contract를 Rust/TypeScript shared boundary에 추가하고, detail API가 `threads.archived`를 source-of-truth로 직렬화하도록 고정했다.
- Live Overview backend query와 파생 집계가 `status = 'inflight'` 대신 `archived = 0` root thread 집합을 live membership으로 사용하도록 전환했다.
- Thread Detail page와 drilldown polling이 `status`가 아니라 `!thread.archived` 기준으로 움직이도록 바꿔 completed-but-unarchived thread도 archive 전까지 자동 갱신되게 했다.
- Overview header/empty/filter-empty copy와 architecture 문서 wording을 현재 대화 semantics에 맞춰 정렬했다.
- 기존 STATUS 문서가 이전 Slice 7 기준선에 머물러 있었고 실행 중 삭제 상태가 되었기 때문에, 이번 실행 종료 시점의 사실 기준으로 `STATUS.md`를 재생성했다.

# Decisions made during implementation
- live visibility rule은 끝까지 `archived = 0`으로 유지하고, `status`는 execution state 의미만 유지했다.
- shared contract 확장은 `MonitorThread`/`ThreadDetail.thread`의 `archived: boolean`에 한정했고, `LiveOverviewThread`에는 별도 `archived` field를 추가하지 않았다.
- Thread Detail/drilldown polling rule은 page query와 shell query 모두 `!thread.archived`로 맞췄다.
- Slice 4 wording은 기본 표현을 `현재 대화 thread`로 두고, empty state에서만 보조 설명으로 archive semantics를 풀어썼다.
- advisory reviewer(`architecture-reviewer`, `type-specialist`, `code-quality-reviewer`, `module-structure-gatekeeper`, `test-engineer`, `frontend-structure-gatekeeper`)는 응답을 받지 못해 advisory 미응답으로 처리했다.

# Verification results
- Slice 1:
  - `pnpm cargo:test -- thread_detail ingest_visibility` 통과
  - `pnpm typecheck` 통과
- Slice 2:
  - `pnpm cargo:test -- live_overview ingest_visibility` 통과
  - `rg -n "status = 'inflight'" src-tauri/src/commands/api/live_overview.rs` 미매치 확인
- Slice 3:
  - `pnpm test -- --run src/pages/thread-detail/thread-detail-page.test.tsx` 통과
  - `pnpm test -- --run src/features/thread-detail/ui/thread-timeline-shell.test.tsx` 통과
  - `pnpm typecheck` 통과
  - 초안 검증에서 shell test timeout이 있었지만 fake-timer flush helper 보강 후 동일 명령 재통과
- Slice 4:
  - `pnpm test -- --run src/features/overview/ui/live-overview-shell.test.tsx` 통과
  - `rg -n "inflight thread|inflight thread timeline shell" src/features/overview/ui` 미매치 확인
- Slice 5:
  - `rg -n "inflight summary|inflight thread|read inflight summary" docs src/features/overview src-tauri/src/commands/api/live_overview.rs` 미매치 확인
  - manual diff review 완료
- Final closeout:
  - `pnpm cargo:test -- thread_detail live_overview ingest_visibility` 통과
  - `pnpm test -- --run src/pages/thread-detail/thread-detail-page.test.tsx` 통과
  - `pnpm test -- --run src/features/thread-detail/ui/thread-timeline-shell.test.tsx` 통과
  - `pnpm test -- --run src/features/overview/ui/live-overview-shell.test.tsx` 통과
  - `pnpm typecheck` 통과

# Known issues / residual risk
- 실제 로컬 데이터에서 completed-but-unarchived root volume이 더 커지면 overview noise를 줄이기 위한 secondary filter/section 전략이 후속 bugfix로 필요할 수 있다.
- 이번 체인은 focused validation만 수행했고 `pnpm lint`, `pnpm test` 전체, `pnpm tauri:build`는 돌리지 않았다.
- `STATUS.md`는 manager-facing 메타 산출물로만 재생성했고, slice code commit들과는 분리돼 있다.

# Next slice
없음. 현재 live visibility bugfix chain 완료. 이후 수동 acceptance 실패 또는 overview noise 발견 시 새 bugfix plan 필요.
