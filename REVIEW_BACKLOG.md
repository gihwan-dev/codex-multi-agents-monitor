# Review Backlog

이전 리뷰에서 발견된 이슈 추적. 새 iteration마다 갱신한다.

## Major

- [ ] **M1**: Monitor 뷰 전환 시 언마운트 안 됨 — 다른 뷰에서도 keyboard listener + live IPC 활성
  - 파일: `src/App.tsx`, `src/pages/monitor/lib/useMonitorKeyboardShortcuts.ts`, `src/pages/monitor/model/useMonitorBootstrap.ts`
  - 수정: currentView !== "monitor"일 때 keyboard/live subscription effect 비활성화

## Minor

(없음)

## Code Quality (Backend)

- [ ] **I2**: `parse_archived_index_entry`가 `updated_at`을 항상 `started_at`으로 설정
  - 파일: `src-tauri/src/infrastructure/session_jsonl.rs:251`
  - 수정: archived index scan 시 마지막 타임스탬프 추적하여 updated_at 반영

- [ ] **I3**: `ArchivedIndexCache`의 populate-then-read TOCTOU — clear() 직후 stale 인덱스 populate 가능
  - 파일: `src-tauri/src/state/archive_cache.rs:16`, `src-tauri/src/commands/sessions.rs:111`
  - 수정: populate_if_empty에 generation counter 또는 clear 후 빌드 스킵 로직

- [ ] **I4**: `collect_fallback_files`가 세션 루트 전체를 무제한 순회 (O(n) fallback)
  - 파일: `src-tauri/src/application/session_relationships.rs:139`
  - 수정: fallback scan에 depth/count 제한 추가

- [ ] **I8**: `build_archived_index` 시 동일 workspace_path에 대한 identity 결과 미캐시
  - 파일: `src-tauri/src/application/archived_sessions.rs:193`
  - 수정: workspace_path별 identity resolve 결과를 HashMap으로 캐시

## Code Quality (Frontend)

- [ ] **P-1**: `deriveMonitorViewState`가 매 렌더마다 전체 재계산 — useMemo 없음
  - 파일: `src/pages/monitor/model/useMonitorPageState.ts:12`
  - 수정: useMemo로 감싸기 (state 변화 시에만 재계산)

- [ ] **P-2**: `createMonitorActions`가 매 렌더마다 새 함수 객체 생성
  - 파일: `src/pages/monitor/model/useMonitorPageState.ts:43-53`
  - 수정: useMemo 또는 useCallback으로 안정 참조 유지

- [ ] **RC-3**: eval 페이지 `selectExperiment`/`selectCase`가 cancelled 후에도 호출 가능
  - 파일: `src/pages/eval/model/evalExperimentDataHelpers.ts:44-54,74`
  - 수정: .then() 내 cancelled 체크 확장

- [ ] **RC-4**: `useGraphSelectionRevealNavigation` options 객체를 dependency로 사용 — effect 과다 실행
  - 파일: `src/widgets/causal-graph/ui/useGraphSelectionRevealNavigation.ts:38-41`
  - 수정: options를 개별 primitive dependency로 분해

- [ ] **T-2**: session-log loaders에서 외부 JSON을 as 캐스트로 무검증 사용
  - 파일: `src/entities/session-log/api/loaders.ts:57`
  - 수정: 런타임 스키마 검증 또는 safe parser 적용

## New UI/UX Issues

- [ ] **N1**: Resize handle hit target 14px — UX_SPEC 최소 32px 위반
  - 파일: `src/app/styles/layout.css:1`, `src/widgets/monitor-chrome/ui/ResizeHandle.tsx:26`

- [ ] **N2**: Button size `xs`/`icon-xs` hit target 24px — 최소 32px 미달
  - 파일: `src/shared/ui/primitives/button.tsx:25,29`

- [ ] **N3**: Checkbox hit target 16px — 최소 32px 미달
  - 파일: `src/shared/ui/primitives/checkbox.tsx:15`

## Test Gaps

- [ ] **T1**: Monitor/Eval 뷰 전환 시 keyboard listener 비활성화 테스트
- [ ] **T3**: Eval concurrent mutation test (backend)
- [ ] **T4**: cross-case run_id 거부 test (backend)

## Resolved

- [x] **M2**: Archived score 저장 후 캐시 stale — badge 갱신 안 됨 (commit 6a2d78d)
- [x] **M3**: Eval mutation 동시성 — lock 없이 데이터 유실 가능 (commit ad638c2)
- [x] **M4**: run_id가 case_id에 종속 안 됨 — cross-case overwrite 가능 (commit 182310d)
- [x] **M5**: repoPath 검증 없음 — 임의 Git repo HEAD 읽기 가능 (commit bdd469f)
- [x] **M6**: guidance_preview 마스킹 없음 — 비밀값 노출 가능 (commit e5713e7)
- [x] **m1**: Subagent 탐색 full scan 비효율 (commit fe19cac)
- [x] **m2**: Claude recent index filter-before-limit 순서 오류 (commit f35d522)
- [x] **U1**: Inspector에서 sessionReview가 Summary 위에 렌더링 (이번 세션)
- [x] **U2**: 왼쪽 rail에 status-first 그룹 없음 — UX_SPEC 재검토 결과 현 구현이 올바름 (anti-goal)
- [x] **U3**: Primary run tree에 loading/empty/no-matches 상태 UI 없음 (이번 세션)
- [x] **U4**: F shortcut이 새 filter UI에 연결 안 됨 (이번 세션)
- [x] **U5**: Eval compare에서 같은 run 중복 선택 허용 (이번 세션)
- [x] **U6**: Compare view 2열 breakpoint가 2xl (이번 세션)
- [x] **U7**: Score save dialog에 error slot 없음 (이번 세션)
- [x] **u1**: Provider badge가 CC/CX 2글자만 — aria-label 없음 (이번 세션)
- [x] **u3**: Score editor에 helper text/inline validation 없음 (이번 세션)
- [x] **u4**: Eval 화면 copy에 내부 구현 용어 노출 (이번 세션)
- [x] **u5**: 접힘 animation 중 focusable content가 aria-hidden만 — inert 필요 (이번 세션)
- [x] **u6**: Reduced-motion scope가 .monitor-shell 안에만 (이번 세션)
- [x] **u7**: EvalScoreBar에서 0점이 4% bar로 과장됨 (이번 세션)
- [x] **T2**: Archived score 저장 후 badge 갱신 integration test (commit 6a2d78d)
- [x] **I1**: eval_storage.rs path traversal — experiment_id 파일명 삽입 취약점 (이번 세션)
- [x] **I9**: live_session_subscriptions.rs expect 패닉 → unwrap_or_else (이번 세션)
- [x] **C-1/C-2**: unhandled promise rejection in useRecentMonitorRequests (이번 세션)
- [x] **RC-2**: useSkillActivityPageView unhandled rejection + 영구 loading (이번 세션)
- [x] **C-6**: sessionScoreEditorState 빈 문자열 score=0 처리 (이번 세션)
- [x] Phase 1: scrollIntoView jsdom guard + live follow scroll behavior fix (이번 세션)
