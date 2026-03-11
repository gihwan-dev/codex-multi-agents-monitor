# Current slice
Git Worktree Workspace Canonicalization
- 상태: 완료
- 범위:
  - `cwd` 대신 canonical git repository root를 workspace identity로 고정
  - `threads.workspace_root` 저장과 ingest resolver 도입
  - `workspace_hint` public contract 추가
  - Live/Archive/Summary/Session Flow의 workspace 표시를 `루트 + 힌트`로 통일

# Done
- backend ingest가 state snapshot과 live session root 모두에서 `cwd -> workspace_root`를 계산해 저장하도록 바뀌었다.
- session list, session flow session summary, summary dashboard가 모두 canonical `workspace_root` 기준으로 필터링/집계/표시를 수행한다.
- public contract에 `workspace_hint`가 추가되어 worktree 경로를 session-level 보조 정보로 노출한다.
- Live/Archive 세션 카드, Session workspace header, Summary session compare가 canonical workspace를 primary로, actual worktree path를 secondary로 렌더한다.
- Rust/TS 테스트에 worktree grouping 시나리오와 hint 노출 시나리오를 추가했다.

# Decisions made during implementation
- workspace grouping 기준은 remote URL이나 branch가 아니라 local git repository root 공유 여부로 고정했다.
- `workspace_root` 계산은 query-time이 아니라 ingest-time에만 수행하고, read-model은 `coalesce(nullif(workspace_root, ''), cwd)`로 구버전 DB fallback을 유지한다.
- `workspace_hint`는 string equality가 아니라 저장된 actual `cwd`와 canonical `workspace`가 다를 때만 노출한다.
- 경로 정규화는 display path 보존을 위해 `canonicalize()` 대신 lexical normalize를 우선 사용하고, worktree의 `commondir`만 해석한다.
- worker sub-agent가 반복적으로 체크포인트 없이 종료돼 구현은 메인 스레드에서 직접 마무리했다.

# Verification results
- `pnpm cargo:test` 통과
- `pnpm typecheck` 통과
- `pnpm test` 통과
- `pnpm lint` 통과
- `pnpm tauri:build` 통과
- 커밋: 예정

# Known issues / residual risk
- `.git` file을 사용하는 특수 git layout 중 `commondir` 없이도 별도 canonical root가 필요한 케이스는 현재 명시적으로 다루지 않는다. 현재 구현은 worktree와 일반 repo를 우선한다.
- workspace hint는 session-level UI에만 노출되므로, workspace distribution 자체에서 worktree별 분포를 따로 보고 싶다면 후속 slice가 필요하다.

# Next slice
없음.
- 후속 후보:
  - workspace rail에 search/pinning이 필요할 정도로 저장소 수가 많아질 때 UX 보강
  - worktree별 분포를 Summary 보조 drilldown으로 추가할지 별도 설계
