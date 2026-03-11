# Current slice
Deleted Worktree Workspace Root Fallback
- 상태: 완료
- 범위:
  - 삭제된 `.codex/worktrees/...` 경로도 main clone workspace로 추론
  - `.git` directory / `.git` file resolver의 path normalization 정책 통일
  - live enrich가 state snapshot에서 추론한 workspace root를 덮어쓰지 않도록 보정

# Done
- state snapshot ingest가 `git_origin_url` 기준 후보 root를 모아, 이미 삭제된 codex worktree 경로를 유일한 main repo root로 보정하도록 바뀌었다.
- live session enrich는 삭제된 codex worktree에서만 state snapshot의 추론 결과를 재사용하고, 일반 live cwd는 그대로 유지한다.
- `.git` file 기반 checkout은 `commondir`가 없더라도 checkout root를 workspace root로 사용한다.
- resolver 테스트와 ingest visibility 테스트에 deleted worktree fallback 회귀 케이스를 추가했다.

# Decisions made during implementation
- 삭제된 worktree fallback은 `git_origin_url`이 비어 있지 않고, 같은 origin에서 접근 가능한 canonical root 후보가 정확히 1개일 때만 적용한다.
- 별도 clone이 여러 개 있는 origin은 자동 추론하지 않고 기존 raw path fallback을 유지한다.
- `.git` resolver는 `canonicalize()` 대신 lexical normalize를 사용해 `/var` 대 `/private/var` 같은 workspace key drift를 피한다.

# Verification results
- `pnpm cargo:test` 통과
- `pnpm typecheck` 통과
- `pnpm test` 통과
- `pnpm lint` 통과
- `pnpm tauri:build` 통과
- 커밋: `fix(monitor): 삭제된 worktree workspace 추론 보강`

# Known issues / residual risk
- 동일 `git_origin_url`을 가진 별도 local clone이 2개 이상 있으면 deleted worktree는 의도적으로 자동 병합하지 않는다.
- `git_origin_url`이 비어 있는 오래된 state row는 deleted worktree fallback 대상이 아니다.

# Next slice
없음.
- 후속 후보:
  - 다중 clone이 있는 동일 origin을 더 안전하게 구분할 추가 heuristic 설계
  - worktree별 분포를 Summary 보조 drilldown으로 추가할지 별도 설계
