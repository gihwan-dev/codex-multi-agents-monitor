# Review & Fix Loop

이 프롬프트는 반복 실행됩니다. 매 iteration마다:
1. 아래 이슈 목록을 확인
2. 아직 수정되지 않은 이슈를 하나씩 수정
3. 검증 (lint/typecheck/test)
4. 커밋
5. 새로운 이슈를 발견하면 이 파일의 이슈 목록에 추가
6. 모든 이슈가 해결되면 `<promise>ALL ISSUES RESOLVED</promise>` 출력

## 필수 규칙

- `docs/ai/ENGINEERING_RULES.md` 준수
- 수정 후 반드시 `pnpm lint && pnpm typecheck && cargo test` 통과 확인
- 한 iteration에 하나의 이슈만 수정 (집중)
- 커밋 메시지는 conventional commit 형식
- 범위 밖 리팩터링 금지

## 현재 이슈 목록

### Phase 1: Code Review Issues (Major)

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

### Phase 2: Code Review Issues (Minor)

- [ ] **m1**: Subagent 탐색 full scan 비효율
  - 파일: `src-tauri/src/application/session_relationships.rs`
  - 수정: fallback full scan은 힌트 결과가 비어있을 때만

- [ ] **m2**: Claude recent index filter-before-limit 순서 오류
  - 파일: `src-tauri/src/application/recent_sessions.rs`
  - 수정: filter_map 이후에 take 적용

### Phase 3: E2E & Test Gaps

- [ ] **T1**: Monitor/Eval 뷰 전환 시 keyboard listener 비활성화 테스트
- [ ] **T2**: Archived score 저장 후 badge 갱신 integration test
- [ ] **T3**: Eval concurrent mutation test (backend)
- [ ] **T4**: cross-case run_id 거부 test (backend)

### Phase 4: UI/UX Review Issues

(UI/UX 리뷰 완료 후 추가 예정 — UIUX_REVIEW.md 참조)

## 진행 상황

iteration 수행 시마다 아래에 기록:

```
<!-- iteration log -->
```
