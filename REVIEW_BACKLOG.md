# Review Backlog

이전 리뷰에서 발견된 이슈 추적. 새 iteration마다 갱신한다.

## Major

- [ ] **M1**: Monitor 뷰 전환 시 언마운트 안 됨 — 다른 뷰에서도 keyboard listener + live IPC 활성
  - 파일: `src/App.tsx`, `src/pages/monitor/lib/useMonitorKeyboardShortcuts.ts`, `src/pages/monitor/model/useMonitorBootstrap.ts`
  - 수정: currentView !== "monitor"일 때 keyboard/live subscription effect 비활성화

- [ ] **M2**: Archived score 저장 후 캐시 stale — badge 갱신 안 됨
  - 파일: `src/pages/monitor/model/createMonitorActions.ts`, `src-tauri/src/commands/sessions.rs`
  - 수정: 점수 저장 후 `refresh_archived_session_index` 호출로 캐시 무효화

- [ ] **M3**: Eval mutation 동시성 — lock 없이 데이터 유실 가능
  - 파일: `src-tauri/src/application/eval_service.rs`, `src-tauri/src/infrastructure/eval_storage.rs`
  - 수정: experiment ID 기준 mutex 추가

- [ ] **M4**: run_id가 case_id에 종속 안 됨 — cross-case overwrite 가능
  - 파일: `src-tauri/src/application/eval_service.rs`
  - 수정: run lookup/upsert를 (experiment_id, case_id, run_id) 기준으로 제한

- [ ] **M5**: repoPath 검증 없음 — 임의 Git repo HEAD 읽기 가능
  - 파일: `src-tauri/src/application/eval_service.rs`
  - 수정: repoPath를 configured project roots 아래로 제한하거나 backend fs read 제거

- [ ] **M6**: guidance_preview 마스킹 없음 — 비밀값 노출 가능
  - 파일: `src-tauri/src/domain/eval_candidate.rs`, `src/widgets/eval-compare/ui/EvalCandidateFingerprint.tsx`
  - 수정: guidance는 hash만 저장, preview는 explicit opt-in 시에만

## Minor

- [ ] **m1**: Subagent 탐색 full scan 비효율
  - 파일: `src-tauri/src/application/session_relationships.rs`
  - 수정: fallback full scan은 힌트 결과가 비어있을 때만

- [ ] **m2**: Claude recent index filter-before-limit 순서 오류
  - 파일: `src-tauri/src/application/recent_sessions.rs`
  - 수정: filter_map 이후에 take 적용

## Test Gaps

- [ ] **T1**: Monitor/Eval 뷰 전환 시 keyboard listener 비활성화 테스트
- [ ] **T2**: Archived score 저장 후 badge 갱신 integration test
- [ ] **T3**: Eval concurrent mutation test (backend)
- [ ] **T4**: cross-case run_id 거부 test (backend)

## UI/UX (Major)

- [ ] **U1**: Inspector에서 sessionReview가 Summary 위에 렌더링 — UX_SPEC의 "Summary default" 계약 위반
  - 파일: `src/widgets/causal-inspector/ui/CausalInspectorSections.tsx:31`
  - 수정: session review를 Summary 아래로 이동

- [ ] **U2**: 왼쪽 rail에 status-first 그룹 없음 — UX_SPEC의 Running/Waiting/Recent 그룹 누락
  - 파일: `src/widgets/workspace-run-tree/ui/WorkspaceTreeList.tsx:61`
  - 수정: status group 복원 또는 status + workspace 병행 제공

- [ ] **U3**: Primary run tree에 loading/empty/no-matches 상태 UI 없음
  - 파일: `src/widgets/workspace-run-tree/ui/WorkspaceTreeList.tsx:61`
  - 수정: 명시적 빈 상태 UI 추가

- [ ] **U4**: F shortcut이 새 filter UI에 연결 안 됨 — keyboard-first 계약 깨짐
  - 파일: `src/pages/monitor/lib/useSearchFocusShortcut.ts:4`
  - 수정: F로 filter control에 포커스되도록 구현 + shortcut help 노출

- [ ] **U5**: Eval compare에서 같은 run 중복 선택 허용 + invalid pair empty state 없음
  - 파일: `src/pages/eval/ui/EvalRunPicker.tsx:22`
  - 수정: 중복 선택 방지 + invalid pair UI state 추가

- [ ] **U6**: Compare view 2열 breakpoint가 2xl — 1280px 데스크톱에서 세로 적층
  - 파일: `src/widgets/eval-compare/ui/EvalCompareView.tsx:45`
  - 수정: breakpoint를 xl로 내림

- [ ] **U7**: Score save dialog에 error slot 없음 — 실패 이유 미표시
  - 파일: `src/features/session-scoring/ui/SessionScoreEditorDialog.tsx:42`
  - 수정: inline error + aria-live 추가

## UI/UX (Minor)

- [ ] **u1**: Provider badge가 CC/CX 2글자만 — aria-label 없음
  - 파일: `src/widgets/workspace-run-tree/lib/providerBadge.ts:8`

- [ ] **u2**: Unscored session에 placeholder badge 없음 — discoverability 저하
  - 파일: `src/widgets/workspace-run-tree/ui/ScoreBadge.tsx:42`

- [ ] **u3**: Score editor에 helper text/inline validation 없음
  - 파일: `src/features/session-scoring/ui/SessionScoreEditorFields.tsx:52`

- [ ] **u4**: Eval 화면 copy에 내부 구현 용어 노출 (issue #23, add_case 등)
  - 파일: `src/pages/eval/ui/EvalPageHeader.tsx:20`

- [ ] **u5**: 접힘 animation 중 focusable content가 aria-hidden만 — inert 필요
  - 파일: `src/widgets/workspace-run-tree/ui/ArchiveSectionBody.tsx:36`

- [ ] **u6**: Reduced-motion scope가 .monitor-shell 안에만 — eval은 밖
  - 파일: `src/theme/motion.css:171`

- [ ] **u7**: EvalScoreBar에서 0점이 4% bar로 과장됨
  - 파일: `src/widgets/eval-compare/ui/EvalScoreBar.tsx:7`

## Resolved

(수정 완료된 이슈는 여기로 이동)
