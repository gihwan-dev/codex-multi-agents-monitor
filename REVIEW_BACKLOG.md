# Review Backlog

이전 리뷰에서 발견된 이슈 추적. 새 iteration마다 갱신한다.

## Major

(없음)

## Minor

(없음)

## New UI/UX Issues (이번 세션)

- [x] **UX-39**: EvalExperimentListRow + EvalCaseListPanel CaseRow 버튼에 `focus-visible:ring-[3px] focus-visible:ring-ring/50` 추가 (이번 세션)
- [x] **UX-40**: EvalExperimentListRow + EvalCaseListPanel CaseRow 버튼에 `aria-pressed={selected}` 추가 (이번 세션)
- [x] **UX-41**: ScoreBadge 하드코딩 Tailwind 팔레트(rose/emerald/sky/amber) → 시맨틱 CSS 변수(--color-success/active/waiting/failed) 교체 (이번 세션)
- [x] **UX-42-b**: TextViewerModal CopyButton `text-green-500` → `text-[var(--color-success)]` 교체 (이번 세션)

## Code Quality (Backend)

- [ ] **I3**: `ArchivedIndexCache`의 populate-then-read TOCTOU — clear() 직후 stale 인덱스 populate 가능
  - 파일: `src-tauri/src/state/archive_cache.rs:16`, `src-tauri/src/commands/sessions.rs:111`
  - 수정: populate_if_empty에 generation counter 또는 clear 후 빌드 스킵 로직

- [ ] **I8**: `build_archived_index` 시 동일 workspace_path에 대한 identity 결과 미캐시
  - 파일: `src-tauri/src/application/archived_sessions.rs:193`
  - 수정: workspace_path별 identity resolve 결과를 HashMap으로 캐시

- [ ] **N2**: `column_exists` PRAGMA table_name 문자열 보간 — 현재 리터럴만 사용하지만 미래 안전성 부족
  - 파일: `src-tauri/src/infrastructure/state_sqlite.rs:188`
  - 수정: debug_assert로 ASCII 식별자 검증 추가

- [ ] **N3**: `EXPERIMENT_MUTATION_LOCKS` HashMap 영구 증가, 삭제된 experiment의 lock이 pruning 안 됨
  - 파일: `src-tauri/src/infrastructure/eval_storage.rs:21-77`
  - 수정: delete_experiment_detail 후 registry에서 entry 제거

- [ ] **N8**: `stable_hash` 함수가 score_storage.rs와 session_scoring.rs에 중복
  - 파일: `src-tauri/src/infrastructure/score_storage.rs:129`, `src-tauri/src/application/session_scoring.rs:304`
  - 수정: support/ 모듈로 추출

- [ ] **N9**: `path.exists()` TOCTOU — load/delete/list에서 exists() 후 파일 연산
  - 파일: `src-tauri/src/infrastructure/eval_storage.rs:45,63,91`, `score_storage.rs:53`
  - 수정: 직접 open/read_dir 후 NotFound 매칭으로 변경

- [ ] **N10**: 테스트에서 `set_var`가 TEST_ENV_MUTEX 밖에서 호출됨
  - 파일: `src-tauri/src/application/archived_sessions.rs:515`, `infrastructure/filesystem.rs:288`
  - 수정: RecentSessionTestContext 사용 또는 mutex 선점

- [ ] **C-2-be**: `current_time_ms` 함수가 eval_service.rs와 eval_grader.rs에 중복
  - 파일: `src-tauri/src/application/eval_service.rs:962`, `eval_grader.rs:273`
  - 수정: N8과 함께 support/ 모듈로 추출

- [ ] **CON-1-be**: `resolve_existing_live_session_identity`에서 `origin_path.exists()` check-then-act race
  - 파일: `src-tauri/src/application/workspace_identity.rs:225`
  - 수정: N9와 동일 패턴 — 직접 연산 후 NotFound 매칭

- [ ] **N-1-be**: `scan_skill_activity` limit 파라미터가 invocation이 아닌 file 수 제한 — 이름과 동작 불일치
  - 파일: `src-tauri/src/application/skill_activity.rs:108-116`
  - 수정: file_limit으로 이름 변경 또는 invocations vec에서 cap

- [ ] **N-2-be**: `collect_session_files`에서 archived_sessions 디렉토리 에러 시 전체 스캔 중단
  - 파일: `src-tauri/src/application/skill_activity.rs:15-25`
  - 수정: unwrap_or_default() 또는 NotFound 허용

- [ ] **PERF-7-be**: `collapse_whitespace` 함수가 Vec<&str> 할당 후 join — 인덱스 빌드 시 entry당 임시 Vec 생성
  - 파일: `src-tauri/src/support/text_recent_index.rs:183-184`
  - 수정: iterator 기반 단일 패스 또는 in-place 처리로 변경

- [ ] **SEC-4**: `load_archived_session_snapshot_from_disk`가 canonical_path 대신 original path로 파일 오픈 — 검증 우회 가능
  - 파일: `src-tauri/src/application/archived_sessions.rs:56-83`
  - 수정: prefix 검증 통과한 canonical_path로 파일 오픈

- [ ] **PERF-4-be**: `load_snapshot_subagents` 폴백 시 sessions_root 전체 JSONL 무제한 스캔
  - 파일: `src-tauri/src/application/session_relationships.rs:33-43`
  - 수정: 최대 파일 수 상한(500) 추가 또는 hint-only 경로 강제

- [ ] **PERF-5-be**: `load_archived_session_index` 동시 요청 시 index 이중 빌드
  - 파일: `src-tauri/src/commands/sessions.rs:111-127`
  - 수정: OnceCell/Mutex lazy-init 패턴으로 중복 빌드 방지

- [ ] **CON-3-be**: `LiveSessionSubscriptionRegistry::stop`에서 handle 제거 후 cancel flag 설정 — 1회 추가 이벤트 가능
  - 파일: `src-tauri/src/state/live_session_subscriptions.rs:39-53`
  - 수정: lock 보유 중에 flag 설정, 또는 제거 전 flag 설정

- [ ] **ERR-1-be**: `load_recent_session_index`, `scan_skill_activity` 커맨드가 모든 에러를 빈 결과로 삼킴
  - 파일: `src-tauri/src/commands/sessions.rs:13-21,99-109`
  - 수정: `Result<Vec<_>, String>` 반환으로 변경 (프론트엔드 에러 표시 연동 필요)

- [ ] **ERR-2-be**: `load_archived/recent_session_snapshot` 커맨드가 IO 에러를 None으로 삼킴
  - 파일: `src-tauri/src/commands/sessions.rs:24-31,82-91`
  - 수정: `Result<Option<_>, String>` 반환으로 변경

## Code Quality (Frontend)

- [ ] **RC-4**: `useGraphSelectionRevealNavigation` + `useGraphFollowLiveScroll` options 객체를 dependency로 사용 — 매 렌더마다 effect 재실행
  - 파일: `src/widgets/causal-graph/ui/useGraphSelectionRevealNavigation.ts:38-41`, `useGraphFollowLiveScroll.ts:33-35`
  - 수정: options bag 대신 개별 primitive/ref 의존성으로 분해, 또는 caller 측 memoization

- [ ] **T-2**: session-log loaders에서 외부 JSON을 as 캐스트로 무검증 사용
  - 파일: `src/entities/session-log/api/loaders.ts:57`
  - 수정: 런타임 스키마 검증 또는 safe parser 적용

- [ ] **FE-4**: `castValidatedValue<T>` 이름이 실제 동작과 불일치 — bare `as T` 캐스트
  - 파일: `src/features/import-run/completedRunPayloadShapeValidation.ts:213`
  - 수정: unsafeCast 등으로 이름 변경 또는 tagged type 적용

- [ ] **FE-6**: `useWorkspaceIdentityOverrides` unhandled promise rejection
  - 파일: `src/features/workspace-identity/model/useWorkspaceIdentityOverrides.ts:13`
  - 수정: .catch 추가 (best-effort이므로 무시)

- [ ] **FE-11**: `subscribeRecentSessionLive` listenTauri↔invokeTauri 사이 dispose 체크 누락
  - 파일: `src/entities/session-log/api/liveTransport.ts:98-112`
  - 수정: 두 await 사이에 disposed 체크 추가

- [ ] **FE-12**: `loadExperimentListResult` onSuccess가 isActive() 체크 전에 호출 — 취소 후 stale 상태 업데이트
  - 파일: `src/pages/eval/model/evalExperimentDataHelpers.ts:53,77`
  - 수정: onSuccess를 isActive() 가드 안으로 이동

- [ ] **FE-13**: `persistSessionScore`에서 loadProfileRevisions await 후 cancellation guard 누락
  - 파일: `src/features/session-scoring/model/sessionScoreDetailsHelpers.ts:123-125`
  - 수정: active flag 또는 AbortController 스레딩

- [ ] **FE-15**: `void requestKey` dead code가 미구현 stale-load guard를 은폐
  - 파일: `src/pages/eval/model/useEvalExperimentData.ts:57`, `evalExperimentDataHelpers.ts:111`
  - 수정: requestKey 파라미터 제거 또는 실제 비교 구현

- [ ] **FE-17**: SkillStatusBadge가 shared에서 entities/skill 임포트 — FSD 하향 의존 위반
  - 파일: `src/shared/ui/monitor/SkillStatusBadge.constants.ts:1`, `SkillStatusBadge.tsx:1`
  - 수정: 타입을 shared로 이동 또는 컴포넌트를 entities/skill/ui로 이동

- [ ] **FE-18**: SkillActivityToolbar `Number(v) as ScanRangeValue` — NaN 통과 가능
  - 파일: `src/pages/skill-activity/ui/SkillActivityToolbar.tsx:56`
  - 수정: SCAN_RANGE_OPTIONS 값과 비교 검증 추가

- [ ] **FE-19**: EvalCaseListPanel `detail.runs.filter()` O(cases × runs) per render
  - 파일: `src/pages/eval/ui/EvalCaseListPanel.tsx:76`
  - 수정: Map<caseId, number> 사전 계산

- [ ] **FE-56**: `useGraphScrollTopState` `scheduleScrollTopUpdate` 함수가 매 렌더 재생성 — effect 체인 불필요 재실행
  - 파일: `src/widgets/causal-graph/ui/useGraphScrollTopState.ts:16-27`
  - 수정: useCallback 래핑 (refs만 사용하므로 deps 불필요)

- [ ] **FE-57**: `beginResizeDrag` pointer 리스너가 unmount 시 정리되지 않음
  - 파일: `src/widgets/monitor-chrome/ui/resizeHandleDrag.ts:33-51`
  - 수정: cleanup 함수 반환 → 소비 컴포넌트 useEffect cleanup에서 호출

- [ ] **FE-58**: `resolveActiveSessionFilePath` O(n) entries scan이 매 state 변경마다 실행
  - 파일: `src/pages/monitor/model/monitorViewSelection.ts:22-25`
  - 수정: traceId → filePath 역방향 Map 유지

- [ ] **FE-59**: `buildGraphSceneEdgeBundleMap` eventsById Map이 매 scene derivation마다 재생성
  - 파일: `src/entities/run/lib/graphSceneEdgeBundles.ts:129`
  - 수정: dataset 인제스트 시 1회 계산 후 캐시, 또는 call site memoization

- [ ] **FE-60**: `closeDrawer` requestAnimationFrame cleanup 누락
  - 파일: `src/pages/monitor/ui/useMonitorPageView.ts:86-90`
  - 수정: frameId 추적 → effect cleanup에서 cancelAnimationFrame

## Accessibility

- [ ] **A11Y-1**: `CardTitle`이 `<div>`로 렌더링 — heading 계층 없음, 스크린리더 heading 탐색 불가
  - 파일: `src/shared/ui/primitives/card-title.tsx:5-11`
  - 수정: `as` prop 또는 기본 `<h3>` 렌더링으로 변경

- [ ] **A11Y-2**: `MonitorDrawer` 닫을 때 focus가 호출 원점으로 복귀하지 않음
  - 파일: `src/widgets/monitor-drawer/ui/MonitorDrawer.tsx`
  - 수정: onCloseAutoFocus 핸들러 추가 → trigger ref로 focus 복귀

- [ ] **A11Y-3**: `CausalGraphCanvas`에 role/aria-label 없음 — 스크린리더에서 그래프 용도 불명
  - 파일: `src/widgets/causal-graph/ui/CausalGraphCanvas.tsx:32-83`
  - 수정: role="img" 또는 role="figure" + aria-label="Agent causal graph" 추가

## Architecture

- [ ] **ARCH-6**: `live_sessions.rs` application 레이어에 `tauri::Window<R>` 타입 침투 — 테스트 시 Tauri 런타임 필요
  - 파일: `src-tauri/src/application/live_sessions.rs:17`
  - 수정: emit 클로저를 주입받는 방식으로 리팩터링

## New UI/UX Issues

- [x] **UX-36**: SessionScoreEditorDialog hardcoded dark-only `bg-[rgb(14_18_28)]` → `--gradient-dialog-surface` 토큰 사용 (이번 세션)

- [ ] **UX-37**: 59개 파일에서 `border-white/N`, `bg-white/[X]`, `bg-black/N` 패턴 사용 — light theme에서 보이지 않는 경계/배경
  - 범위: eval, widget, shared 전반
  - 수정: 별도 테마 세션에서 `border-[color:var(--color-chrome-border)]` 등으로 일괄 변환

- [ ] **UX-38**: `button.tsx:8` `transition-all` without `motion-reduce:transition-none` — 다른 프리미티브와 인라인 일관성 위반
  - 파일: `src/shared/ui/primitives/button.tsx:8`
  - 수정: `transition-all` 뒤에 `motion-reduce:transition-none` 추가 (기능적으로는 motion.css 글로벌 룰이 커버하므로 low priority)

## New Code Quality Issues

### Frontend

- [ ] **FE-27**: `useWorkspaceIdentityOverrides` datasets 배열 참조 변경마다 IPC 재실행 — repoPaths 기반 의존성으로 변경 필요
  - 파일: `src/features/workspace-identity/model/useWorkspaceIdentityOverrides.ts:10`
  - 수정: datasets에서 repoPaths 문자열을 추출해 useEffect 의존성으로 사용

- [ ] **FE-32**: `normalizerHelpers.ts` 하드코딩된 기본 모델명 "gpt-5" — 존재하지 않는 모델
  - 파일: `src/features/import-run/normalizerHelpers.ts:144`
  - 수정: "unknown" 또는 빈 문자열로 변경

- [ ] **FE-35**: `buildDatasetFromSessionLogAsync` Worker가 요청 취소 시 terminate 안 됨 — 대형 JSONL에서 CPU 낭비
  - 파일: `src/entities/session-log/model/datasetBuilderAsync.ts:12-33`
  - 수정: cancel/AbortSignal 파라미터 추가하여 Worker.terminate() 호출

- [ ] **FE-41**: `promptAssembly.ts` layerType을 `as PromptLayerType` 무검증 캐스트 — 미지 타입 통과 가능
  - 파일: `src/entities/session-log/model/promptAssembly.ts:26`
  - 수정: 유효값 검증 후 fallback

- [ ] **FE-42**: `useMonitorDrawerPresence`/`workspaceTreeMotion` — `mounted`가 deps에 포함되어 close 애니메이션 중 불필요한 effect 재실행
  - 파일: `src/widgets/monitor-drawer/ui/useMonitorDrawerPresence.ts:58`, `src/widgets/workspace-run-tree/ui/workspaceTreeMotion.ts:55`
  - 수정: useRef로 mounted 읽기, deps에서 제거

- [ ] **FE-52**: `workspaceIdentityResolver` 모듈 싱글턴 캐시가 영구 — workspace 이름 변경 시 stale
  - 파일: `src/features/workspace-identity/lib/workspaceIdentityResolver.ts:59`
  - 수정: TTL 또는 dataset-version 기반 무효화

- [ ] **FE-53**: `monitorStateReducer` unsafe double cast가 monitorActionHandlers의 exhaustiveness 검사를 무효화
  - 파일: `src/pages/monitor/model/state/reducer.ts:8-11`
  - 수정: `as (currentState, currentAction) => MonitorState` 캐스트 제거, `action as never` 패턴 또는 타입 안전한 dispatch

### Backend

- [ ] **SEC-1**: `load_archived_session_snapshot_from_disk` 심볼릭 링크 우회 가능 — canonicalize 전 symlink 검사 누락
  - 파일: `src-tauri/src/application/archived_sessions.rs:64-83`
  - 수정: `fs::symlink_metadata`로 링크 여부 먼저 확인

- [ ] **PERF-1-be**: `list_experiments` 전체 ExperimentDetail deserialization → ExperimentSummary만 필요
  - 파일: `src-tauri/src/infrastructure/eval_storage.rs:44-59`
  - 수정: 경량 파서 또는 별도 summary 저장

- [ ] **PERF-2-be**: `build_codex_archived_index_entries` 개별 score record 파일 I/O — O(n) 파일 읽기
  - 파일: `src-tauri/src/application/archived_sessions.rs:162-175`
  - 수정: load_all_session_score_records()로 일괄 로드 후 Map 조회

- [ ] **PERF-3-be**: `load_profile_revisions` 매 호출마다 전체 score record 파일 로드+역직렬화
  - 파일: `src-tauri/src/application/session_scoring.rs:67-73`
  - 수정: 캐시 또는 경량 인덱스 도입

- [ ] **COR-4-be**: `resolve_claude_recent_snapshot_selection` 같은 파일 이중 파싱
  - 파일: `src-tauri/src/application/recent_sessions.rs:443-461`
  - 수정: 첫 파싱 결과(workspace_path)를 Selection variant에 포함

- [ ] **COR-3-be**: `current_time_ms`가 시스템 시계 오류 시 0 반환 — 1970년 타임스탬프 무경고 삽입
  - 파일: `src-tauri/src/application/eval_service.rs:965`, `eval_grader.rs:276`
  - 수정: eprintln 경고 추가

- [ ] **COR-6-be**: `parse_section_header` `[[...]]` TOML array-of-tables 구문 잘못 파싱
  - 파일: `src-tauri/src/infrastructure/codex_config.rs:84-86`
  - 수정: 이중 대괄호 검사 추가

- [ ] **N-6-be**: `scan_skill_invocations_in_file`에서 mid-read I/O 에러 시 무경고 중단
  - 파일: `src-tauri/src/application/skill_activity.rs:99`
  - 수정: map_while(Result::ok) → match + eprintln + break

- [ ] **N-7-be**: `build_subagent_meta` parent_thread_id 누락 시 빈 문자열 → orphan subagent 무경고
  - 파일: `src-tauri/src/infrastructure/session_jsonl.rs:362-390`
  - 수정: Option<String>으로 변경 또는 빈 값 시 None 반환

### Architecture

- [ ] **ARCH-2**: `widgets/monitor-drawer` → `widgets/prompt-assembly` cross-slice import — FSD 위반
  - 파일: `src/widgets/monitor-drawer/ui/MonitorDrawerContextTab.tsx:1`
  - 수정: PromptAssemblyView를 pages/monitor에서 render prop으로 전달

## Motion-Reduce Consistency

(이번 세션에서 전수 점검 완료 — 잔여 위반 없음)

## Infra

- [x] **INFRA-1**: biome.json에 `.worktrees` 무시 규칙 추가 (worktree 병렬 작업 시 nested root config 충돌 방지)

## Test Gaps

- [ ] **T1**: Monitor/Eval 뷰 전환 시 keyboard listener 비활성화 테스트
- [ ] **T3**: Eval concurrent mutation test (backend)
- [ ] **T4**: cross-case run_id 거부 test (backend)

## Resolved

- [x] **UX-39**: EvalExperimentListRow + CaseRow focus-visible ring 추가 (이번 세션)
- [x] **UX-40**: EvalExperimentListRow + CaseRow aria-pressed 추가 (이번 세션)
- [x] **UX-41**: ScoreBadge 하드코딩 팔레트 → 시맨틱 CSS 변수 교체 (이번 세션)
- [x] **UX-42-b**: TextViewerModal CopyButton text-green-500 → --color-success 토큰 교체 (이번 세션)
- [x] **COR-9-be**: `path_is_allowed` str::starts_with → Path::starts_with 세그먼트 비교 (이번 세션)
- [x] **ERR-3-be**: `record_event` best-effort 패턴 — audit 실패가 트랜잭션에 영향 주지 않음 (이번 세션)
- [x] **FE-55**: `finishSessionScoreLoad` active 가드 제거 — 취소 후 stuck loading 해소 (이번 세션)
- [x] **ARCH-3**: `MonitorTopBarShell` monitor-chrome/index.ts export 추가 + internal bypass 제거 (이번 세션)
- [x] **ARCH-4**: `StatusGlyphMark` shared/ui/monitor/index.ts export 추가 + internal bypass 제거 (이번 세션)
- [x] **ARCH-5**: `SkillStatusBadge.constants` shared/ui/monitor/index.ts export 추가 + internal bypass 제거 (이번 세션)
- [x] **UX-42**: `EvalRunPicker` disabled prop + `EvalCompareControls` case 미선택 시 picker 비활성화 (이번 세션)
- [x] **SEC-3-be**: `is_main_claude_session_path` symlink 가드 추가 (이번 세션)
- [x] **COR-7-be**: `load_all_session_score_records` best-effort 패턴 — corrupt 파일 로깅 후 건너뛰기 (이번 세션)
- [x] **COR-8-be**: `ClaudeUsageMetrics` 누적 토큰 추적 — last/total 구분 (이번 세션)
- [x] **CON-2-be**: live session cancel flag Acquire/Release ordering (이번 세션)
- [x] **FE-54**: CopyButton setTimeout cleanup on unmount (이번 세션)
- [x] **LINT-1**: `summarySelectors.ts` 파일 길이 초과 + `collectAnomalyCandidates` 인지 복잡도 → anomalyJumps.ts 분리 (이번 세션)
- [x] **UX-36**: SessionScoreEditorDialog dark-only bg → gradient-dialog-surface 토큰 (이번 세션)
- [x] **SEC-2**: symlink .jsonl 파일 스캔 우회 차단 — `!path.is_symlink()` 가드 추가 (이번 세션)
- [x] **COR-1**: `build_profile_revision_summary` expect 패닉 → Option ��환 (이번 세션)
- [x] **COR-2**: `load_all_experiment_details` 단일 파일 오류 시 전체 중단 → 로깅 후 건너뛰기 (이번 세션)
- [x] **FE-38**: `collectAnomalyCandidates` O(n log n)×2 → O(n) 단일 순회 (이번 세션)
- [x] **FE-39**: `findLastHandoff` 렌더당 2회 호출 → 1회로 통합 (이번 세션)
- [x] **M1**: Monitor 뷰 전환 시 keyboard listener + live IPC 활성 (이번 세션 — isActive prop threading)
- [x] **M2**: Archived score 저장 후 캐시 stale — badge 갱신 안 됨 (commit 6a2d78d)
- [x] **M3**: Eval mutation 동시성 — lock 없이 데이터 유실 가능 (commit ad638c2)
- [x] **M4**: run_id가 case_id에 종속 안 됨 — cross-case overwrite 가능 (commit 182310d)
- [x] **M5**: repoPath 검증 없음 — 임의 Git repo HEAD 읽기 가능 (commit bdd469f)
- [x] **M6**: guidance_preview 마스킹 없음 — 비밀값 노출 가능 (commit e5713e7)
- [x] **m1**: Subagent 탐색 full scan 비효율 (commit fe19cac)
- [x] **m2**: Claude recent index filter-before-limit 순서 오류 (commit f35d522)
- [x] **P-1**: deriveMonitorViewState 매 렌더 재계산 (이번 세션 — useMemo)
- [x] **P-2**: createMonitorActions 매 렌더 재생성 (이번 세션 — useMemo)
- [x] **RC-3**: eval selectExperiment/selectCase cancelled 후 호출 가능 (이번 세션 — isActive guard)
- [x] **I2**: parse_archived_index_entry updated_at = started_at (이번 세션 — last_timestamp 추적)
- [x] **I4**: collect_fallback_files 무제한 순회 (이번 세션 — depth limit + symlink skip)
- [x] **N5a**: EvalExperimentListRow aria-label 누락 (이번 세션)
- [x] **N5b**: EvalCaseListPanel CaseRow aria-label 누락 (이번 세션)
- [x] **N5c**: CausalInspectorJumpButton aria-label 누락 (이번 세션)
- [x] **N5d**: SkillActivityTopBar back button aria-label 누락 (이번 세션)
- [x] **N5e**: SkillActivityToolbar Select aria-labels 누락 (이번 세션)
- [x] **U1**: Inspector에서 sessionReview가 Summary 위에 렌더링 (이전 세션)
- [x] **U2**: 왼쪽 rail에 status-first 그룹 없음 — UX_SPEC 재검토 결과 현 구현이 올바름 (anti-goal)
- [x] **U3**: Primary run tree에 loading/empty/no-matches 상태 UI 없음 (이전 세션)
- [x] **U4**: F shortcut이 새 filter UI에 연결 안 됨 (이전 세션)
- [x] **U5**: Eval compare에서 같은 run 중복 선택 허용 (이전 세션)
- [x] **U6**: Compare view 2열 breakpoint가 2xl (이전 세션)
- [x] **U7**: Score save dialog에 error slot 없음 (이전 세션)
- [x] **u1**: Provider badge가 CC/CX 2글자만 — aria-label 없음 (이전 세션)
- [x] **u3**: Score editor에 helper text/inline validation 없음 (이전 세션)
- [x] **u4**: Eval 화면 copy에 내부 구현 용어 노출 (이전 세션)
- [x] **u5**: 접힘 animation 중 focusable content가 aria-hidden만 — inert 필요 (이전 세션)
- [x] **u6**: Reduced-motion scope가 .monitor-shell 안에만 (이전 세션)
- [x] **u7**: EvalScoreBar에서 0점이 4% bar로 과장됨 (이전 세션)
- [x] **T2**: Archived score 저장 후 badge 갱신 integration test (commit 6a2d78d)
- [x] **I1**: eval_storage.rs path traversal — experiment_id 파일명 삽입 취약점 (이전 세션)
- [x] **I9**: live_session_subscriptions.rs expect 패닉 → unwrap_or_else (이전 세션)
- [x] **C-1/C-2**: unhandled promise rejection in useRecentMonitorRequests (이전 세션)
- [x] **RC-2**: useSkillActivityPageView unhandled rejection + 영구 loading (이전 세션)
- [x] **C-6**: sessionScoreEditorState 빈 문자열 score=0 처리 (이전 세션)
- [x] Phase 1: scrollIntoView jsdom guard + live follow scroll behavior fix (이전 세션)
- [x] **P2-a11y**: workspace-run-tree 6개 파일 motion-reduce + focus-visible 추가 (이전 세션)
- [x] **P2-dialog**: dialog close 버튼 focus → focus-visible 변경 (이전 세션)
- [x] **P2-edge**: InteractiveGraphRouteAnchor Enter 키 지원 추가 (이전 세션)
- [x] **P2-chevron**: MonitorContextLaneSummarySection ChevronDown motion-reduce 추가 (이전 세션)
- [x] **P2-eval-loading**: EvalExperimentListPanel, EvalCaseListPanel 로딩 skeleton 추가 (이전 세션)
- [x] **P2-score**: EvalScoreBar role="img" → native meter + aria attributes (이전 세션)
- [x] **P3-catch**: useRecentMonitorRequests, useArchiveMonitorRequests catch에서 loading 해제 dispatch (이전 세션)
- [x] **P3-kbnav**: monitorKeyboardSelectionNavigation selection.kind === "event" 가드 추가 (이전 세션)
- [x] **P3-runid**: recentRequestState nextActiveRunId를 빈 문자열로 고정 (이전 세션)
- [x] **P3-perf**: buildEdgeMaps O(n²)→O(n) push, buildLaneEventMaps O(L×E)→O(E), Math.max spread→reduce (이전 세션)
- [x] **N1-be**: eval_grader/eval_service `as u8` → `.min(100) as u8` 안전 캐스트 (이전 세션)
- [x] **N4-be**: session_scoring records[0] → .first().expect() 안전 인덱싱 (이전 세션)
- [x] **N4-ui**: Dialog close 버튼 hit target 16px→32px 확대 (이전 세션)
- [x] **N5-ui**: SelectItem focus: → focus-visible: 일관성 수정 (이전 세션)
- [x] **FE-7**: throwSessionScoreSaveFailure re-throw 제거 → setError만 호출 (이전 세션)
- [x] **N6-ui**: PromptLayerToggle ChevronRight motion-reduce:transition-none 추가 (이전 세션)
- [x] **N7-ui**: MonitorShortcutsDialog 구현된 단축키 전체 표시 (이전 세션)
- [x] **N8-ui**: TextViewerModal clipboard.writeText .catch 추가 (이전 세션)
- [x] **N9-ui**: EvalRunArtifactSection, EvalRunStepSection "Showing X of Y" 절단 표시 (이전 세션)
- [x] **N10-ui**: DatasetMonitorTopBarHeading 절단 텍스트에 title 속성 추가 (이전 세션)
- [x] **N1**: Resize handle hit target 14px→32px (이전 세션 — layout.css --resize-handle-hit-width)
- [x] **N2-ui**: Button xs/icon-xs hit target 24px→32px (이전 세션 — h-8/size-8)
- [x] **N3-ui**: Checkbox hit target 16px→32px (이전 세션 — after pseudo-element)
- [x] **N11-ui**: 6개 위젯 truncate 텍스트에 title 속성 추가 (이전 세션)
- [x] **N12-ui**: Dialog/Select zoom 애니메이션 motion-reduce:animate-none (이전 세션)
- [x] **N13-ui**: PromptLayerPreview, EvalCaseListPanel 절단 텍스트에 title 속성 추가 (이전 세션)
- [x] **N14-a11y**: ArchiveSectionToggle 동적 aria-label 추가 (이전 세션)
- [x] **N15-a11y**: MonitorContextLaneSummarySection toggle 동적 aria-label 추가 (이전 세션)
- [x] **P2-overlay-motion**: DialogOverlay motion-reduce:animate-none 추가 (이전 세션)
- [x] **P2-close-motion**: Dialog close 버튼 motion-reduce:transition-none 추가 (이전 세션)
- [x] **P2-scroll-a11y**: SelectScrollUpButton/DownButton aria-label 추가 (이전 세션)
- [x] **P2-run-title**: WorkspaceRunItem truncated run summary에 title 속성 추가 (이전 세션)
- [x] **S-1-be**: resolve_repository_head_sha reference path traversal 검증 추가 (이전 세션)
- [x] **P-1-be**: append_audit_event resolve_storage_root() 중복 호출 제거 (이전 세션)
- [x] **FE-16**: contextObservability Math.max spread→reduce 교체 (이전 세션)
- [x] **FE-14**: throwSessionScoreSaveFailure dead code 제거 (이전 세션)
- [x] **N16-a11y**: SkillActivityToolbar 검색 Input에 aria-label="Search skills" 추가 (이전 세션)
- [x] **N17-title**: GraphEventCardContent line-clamp-2 적용된 title/summary에 title 속성 추가 (이전 세션)
- [x] **U-20**: EvalRunArtifactSection line-clamp-3 artifact.preview에 title 속성 추가 (이전 세션)
- [x] **U-21**: EvalRunStepSection line-clamp-3 step.outputPreview에 title 속성 추가 (이전 세션)
- [x] **U-22**: PromptLayerContent line-clamp-4 displayText에 title 속성 추가 (이전 세션)
- [x] **U-23**: WorkspaceGroupButton motion-reduce:transition-none + focus-visible ring 추가 (이전 세션)
- [x] **FE-20**: sidebarTreeAssembly Math.max spread → reduce 교체 (이전 세션)
- [x] **U-24**: ArchivedSessionGroup truncated session title에 title 속성 추가 (이전 세션)
- [x] **U-25**: WorkspaceGroupButton dynamic aria-label 추가 (이전 세션)
- [x] **U-26**: ArchivedWorkspaceGroupSection toggle dynamic aria-label 추가 (이전 세션)
- [x] **U-27**: WorkspaceGroup collapsed body에 inert 속성 추가 (이전 세션)
- [x] **U-28**: MonitorDrawer closed state에 inert 속성 추가 (이전 세션)
- [x] **U-29**: EvalExperimentListPanel/EvalCaseListPanel error state 표시 추가 (이전 세션)
- [x] **MR-primitives**: scroll-area, tabs-trigger, select-trigger, badge, input, textarea에 motion-reduce:transition-none 추가 (이전 세션)
- [x] **MR-eval**: EvalCaseListPanel CaseRow, EvalExperimentListRow, EvalRunPicker에 motion-reduce:transition-none 추가 (이전 세션)
- [x] **MR-widgets**: MonitorContextLaneSummarySection, ResizeHandle, CausalInspectorJumpButton, PromptLayerToggle에 motion-reduce:transition-none 추가 (이전 세션)
- [x] **UX-30**: StatusChipGlyph + GraphStatusDot AC-004 shape 규칙 적용 — running=filled, waiting=hollow, blocked=slashed, failed=diamond, done=small (이번 세션)
- [x] **UX-31**: EvalRunPicker placeholder option disabled 추가 (이번 세션)
- [x] **UX-32**: EvalRunGradeSection badge truncate + title 추가 (이번 세션)
- [x] **UX-33**: SkillActivityToolbar scanLoading 시 모든 Input/Select disabled (이번 세션)
- [x] **UX-34**: SkillActivityLegend summary focus-visible ring 추가 (이번 세션)
- [x] **UX-35**: LoadingProgress role="progressbar" + aria-label 추가 (이번 세션)
- [x] **FE-22**: findLastHandoff O(E×H) → Map pre-computation O(E+H) (이번 세션)
- [x] **FE-24**: Worker onmessageerror 핸들러 추가 — 메모리 누수 방지 (이번 세션)
- [x] **COR-1-be**: read_tail_buffer UTF-8 경계 안전 처리 — from_utf8_lossy (이번 세션)
- [x] **ARCH-1-be**: validate_head_reference Component::Normal 강화 + null byte 거부 (이번 세션)
- [x] **COR-5-be**: load_recent_session_index 에러 로깅 — unwrap_or_default → match + eprintln (이번 세션)
