# Review Backlog

이전 리뷰에서 발견된 이슈 추적. 새 iteration마다 갱신한다.

## Major

(없음)

## Minor

(없음)

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

## Code Quality (Frontend)

- [ ] **RC-4**: `useGraphSelectionRevealNavigation` options 객체를 dependency로 사용 — Biome exhaustive deps 규칙과 충돌하여 decomposition 불가; shouldSkipSelectionReveal 가드로 실질 성능 영향 최소화
  - 파일: `src/widgets/causal-graph/ui/useGraphSelectionRevealNavigation.ts:38-41`
  - 수정: Biome 규칙 개선 대기 또는 caller 측 options memoization 검토

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

## New UI/UX Issues

(없음)

## New Code Quality Issues

(없음)

## Test Gaps

- [ ] **T1**: Monitor/Eval 뷰 전환 시 keyboard listener 비활성화 테스트
- [ ] **T3**: Eval concurrent mutation test (backend)
- [ ] **T4**: cross-case run_id 거부 test (backend)

## Resolved

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
- [x] **P2-a11y**: workspace-run-tree 6개 파일 motion-reduce + focus-visible 추가 (이번 세션)
- [x] **P2-dialog**: dialog close 버튼 focus → focus-visible 변경 (이번 세션)
- [x] **P2-edge**: InteractiveGraphRouteAnchor Enter 키 지원 추가 (이번 세션)
- [x] **P2-chevron**: MonitorContextLaneSummarySection ChevronDown motion-reduce 추가 (이번 세션)
- [x] **P2-eval-loading**: EvalExperimentListPanel, EvalCaseListPanel 로딩 skeleton 추가 (이번 세션)
- [x] **P2-score**: EvalScoreBar role="img" → native meter + aria attributes (이번 세션)
- [x] **P3-catch**: useRecentMonitorRequests, useArchiveMonitorRequests catch에서 loading 해제 dispatch (이번 세션)
- [x] **P3-kbnav**: monitorKeyboardSelectionNavigation selection.kind === "event" 가드 추가 (이번 세션)
- [x] **P3-runid**: recentRequestState nextActiveRunId를 빈 문자열로 고정 (이번 세션)
- [x] **P3-perf**: buildEdgeMaps O(n²)→O(n) push, buildLaneEventMaps O(L×E)→O(E), Math.max spread→reduce (이번 세션)
- [x] **N1-be**: eval_grader/eval_service `as u8` → `.min(100) as u8` 안전 캐스트 (이번 세션)
- [x] **N4-be**: session_scoring records[0] → .first().expect() 안전 인덱싱 (이번 세션)
- [x] **N4-ui**: Dialog close 버튼 hit target 16px→32px 확대 (이번 세션)
- [x] **N5-ui**: SelectItem focus: → focus-visible: 일관성 수정 (이번 세션)
- [x] **FE-7**: throwSessionScoreSaveFailure re-throw 제거 → setError만 호출 (이번 세션)
- [x] **N6-ui**: PromptLayerToggle ChevronRight motion-reduce:transition-none 추가 (이번 세션)
- [x] **N7-ui**: MonitorShortcutsDialog 구현된 단축키 전체 표시 (이번 세션)
- [x] **N8-ui**: TextViewerModal clipboard.writeText .catch 추가 (이번 세션)
- [x] **N9-ui**: EvalRunArtifactSection, EvalRunStepSection "Showing X of Y" 절단 표시 (이번 세션)
- [x] **N10-ui**: DatasetMonitorTopBarHeading 절단 텍스트에 title 속성 추가 (이번 세션)
- [x] **N1**: Resize handle hit target 14px→32px (이번 세션 — layout.css --resize-handle-hit-width)
- [x] **N2-ui**: Button xs/icon-xs hit target 24px→32px (이번 세션 — h-8/size-8)
- [x] **N3-ui**: Checkbox hit target 16px→32px (이번 세션 — after pseudo-element)
- [x] **N11-ui**: 6개 위젯 truncate 텍스트에 title 속성 추가 (이번 세션)
- [x] **N12-ui**: Dialog/Select zoom 애니메이션 motion-reduce:animate-none (이전 세션)
- [x] **N13-ui**: PromptLayerPreview, EvalCaseListPanel 절단 텍스트에 title 속성 추가 (이번 세션)
