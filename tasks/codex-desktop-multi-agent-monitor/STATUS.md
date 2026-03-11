# Current slice
Slice 7B. `state_5.sqlite` 손상/스키마 드리프트 non-fatal degrade
- 상태: 완료
- 커밋:
  - `cfacb01 fix(history): state db 손상 degrade 보강`

# Done
- ingest가 `state_5.sqlite` 부재뿐 아니라 손상/non-sqlite 파일, `threads` 테이블 부재, row decode 실패 같은 recoverable read 오류도 `state_db degraded`로 기록하고 live session ingest를 계속 진행하도록 바꿨다.
- monitor DB에 `ingest_source_health` 테이블을 추가해 각 ingest run의 최신 source 상태를 기록하고, History summary가 `missing_sources`와 `degraded_sources`를 분리해 읽도록 연결했다.
- `HistoryHealth`에 `degraded_sources`를 추가해 Rust/TypeScript contract를 확장했고, History warning card가 `state db를 읽지 못해 archived thread 메타데이터 보강이 일부 비활성화되었습니다.` 문구를 표시하도록 반영했다.
- non-sqlite `state_5.sqlite`, `threads` 테이블 부재, 기존 missing file 케이스를 Rust 테스트로 고정했고, HistoryShell/App mock payload도 새 contract에 맞게 갱신했다.

# Decisions made during implementation
- `state_5.sqlite` 관련 오류는 source-level recoverable fault로 한정하고, monitor DB transaction 오류와 live JSONL parse/read 오류는 기존대로 fatal 경로를 유지했다.
- source health는 세부 에러 문자열까지 계약에 넣지 않고 `HistorySourceKey` 기반의 `missing`/`degraded` 상태만 남기도록 제한했다.
- `missing_sources`는 경로 부재만 의미하도록 유지하고, recoverable read 오류는 `degraded_sources`로만 노출하도록 분리했다.
- source health 노출 범위는 이번 slice에서도 History 화면에만 한정하고 Overview/Thread Detail 배너 확장은 후속 slice로 남겼다.

# Verification results
- `pnpm cargo:test -- history_summary ingest_visibility` 통과
- 결과: Rust tests 7건 통과
- `pnpm test -- --run src/features/history/ui/history-shell.test.tsx` 통과
- 결과: Vitest 1 file / 5 tests 통과
- `pnpm typecheck` 통과
- `git diff --check` 통과
- 커밋 시도 결과: 기본 커밋 1회 성공 (`cfacb01`, `--no-verify` 미사용)
- manual closeout review 결과: 최종 diff 기준으로 blocking module boundary/type/test 회귀는 확인하지 못했다
- advisory reviewer(`code-quality-reviewer`, `type-specialist`, `module-structure-gatekeeper`)는 응답을 받지 못해 advisory 미응답으로 처리했다
- `pnpm lint`는 이번 slice focused validation 범위에서 제외했다
- 이유: 이전 slice에서 확인된 범위 밖 기존 포맷 이슈(`src/features/thread-detail/ui/thread-timeline-shell.test.tsx`)가 남아 있어 현재 slice sign-off 신호로 적합하지 않았다

# Known issues / residual risk
- source health warning은 여전히 History 화면에만 붙어 있고 Overview/Thread Detail은 `state_db degraded`를 별도 경고 없이 consume한다.
- `degraded_sources`는 source key만 노출하므로 왜 `state_db`가 degraded였는지의 세부 원인은 UI/API에서 바로 확인할 수 없다.
- History summary는 여전히 최근 7일 archived rollout 전체를 재계산하므로 archived volume이 더 커지면 응답 지연이 다시 병목이 될 수 있다.
- `src/features/history/ui/history-shell.tsx`는 이번 slice 이후에도 큰 view 파일로 남아 있어, 다음 구조 정리 때 health notice/action banner 일부를 분리할 여지가 있다.
- macOS packaging과 archived cold scan 성능 관찰은 여전히 Slice 7 전체 범위에서 남아 있다.

# Next slice
목표
- Slice 7C에서 source health 경고를 Overview/Thread Detail까지 확장해 `missing/degraded` source를 history 외 화면에서도 동일한 문구 체계로 드러낸다.

선행조건
- History 전용 `health` contract를 다른 화면에서도 재사용할지, 별도 `ingest health snapshot` query를 둘지 먼저 결정해야 한다.
- warning banner를 screen별로 복제하지 않도록 공용 notice/view-model 경계를 먼저 정리해야 한다.

먼저 볼 경계
- `src-tauri/src/commands/api/live_overview.rs`
- `src-tauri/src/commands/api/thread_detail.rs`
- `src/features/history/ui/history-shell.tsx`
