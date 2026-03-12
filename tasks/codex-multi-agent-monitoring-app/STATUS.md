# Current slice

SLICE-4

# Done

- React app shell을 추가해 Live / Archive / Dashboard 탭, workspace-grouped sidebar, selected session summary card, timeline placeholder, detail drawer placeholder를 같은 레이아웃 안에 고정했다.
- frontend가 `query_workspace_sessions` 초기 로드와 `start_live_bridge` + `codex://live-session-updated` 구독을 통해 local snapshot을 유지하고, live summary upsert/re-sort로 sidebar를 갱신할 수 있게 됐다.
- startup 중 live update가 먼저 도착해도 bootstrap snapshot이 이를 덮어쓰지 않도록 merge path를 보강했고, listen 등록이 unmount 이후 완료될 때도 cleanup이 안전하게 동작하도록 정리했다.
- `@tauri-apps/api` 의존성을 추가하고 `feat(app): 라이브 모니터 셸과 워크스페이스 사이드바 추가` 커밋으로 `SLICE-4` code diff를 기록했다.

# Decisions made during implementation

- shell architecture는 router/store 없이 local state만 사용하고, `activeTab`, snapshot, selected session, loading/error/degraded 상태를 `src/app-shell.tsx` 하나로 수렴했다.
- workspace/session 정렬 규칙은 backend query contract와 동일하게 `workspace_path ASC`, `last_event_at DESC`, `session_id ASC`를 frontend upsert path에도 그대로 적용했다.
- Tauri runtime 부재는 crash 대신 error shell로 degrade하고, live bridge/listen 실패는 마지막 snapshot을 유지한 채 warning banner만 노출하는 정책으로 고정했다.
- Archive / Dashboard는 이번 slice에서 navigation skeleton만 열고, `query_session_detail` 기반 detail drawer와 실제 renderer wiring은 `SLICE-5` 이후로 deferred했다.

# Verification results

- `pnpm typecheck`: pass
- `pnpm build`: pass
- `pnpm tauri:dev`: startup pass (Vite dev server + Rust dev binary 실행 확인 후 수동 종료)
- runtime smoke: initial shell boot, query bootstrap, live bridge startup path가 즉시 crash 없이 올라오는 것까지 확인
- `git commit -m "feat(app): 라이브 모니터 셸과 워크스페이스 사이드바 추가"`: pass (`107992b`)

# Known issues / residual risk

- Raw Codex log schema drift risk remains.
- live bridge는 metadata poll 기반이라 deleted/renamed live file cleanup과 byte-offset incremental append는 아직 없다.
- 실제 live append가 들어왔을 때 sidebar reorder와 degraded banner UX를 사람이 클릭하면서 본 상호작용 smoke는 아직 못 했다.
- timeline renderer, `query_session_detail` fetch, raw/tokens drawer 탭은 아직 placeholder 상태라 session summary 이상 drill-down은 다음 slice가 필요하다.

# Next slice

SLICE-5
- 목표: selected session을 실제 timeline/detail surface에 연결하고, `query_session_detail` 기반 sequence timeline MVP와 drawer drill-down을 연다.
- 선행조건: `src/app-shell.tsx`의 selected session state를 timeline boundary로 넘기고, lane/time-axis projection 규칙을 `src/features/timeline/*` 쪽으로 고정한다.
- 먼저 볼 경계: timeline canvas projection, session detail fetch lifecycle, lane placeholder를 실제 canonical detail 데이터로 치환하는 흐름.
