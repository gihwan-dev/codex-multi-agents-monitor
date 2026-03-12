# Current slice

SLICE-5

# Done

- frontend server state를 TanStack Query 기준으로 재정리했다. `QueryClientProvider`, shared query options/key layer, app-level live bridge bootstrap, `useWorkspaceSessionsQuery`, `useSessionDetailQuery`가 연결됐다.
- live summary event는 workspace sessions cache를 immutable update 하고 해당 session detail cache를 invalidate 하도록 고정했다. bootstrap query는 pending 중 들어온 live summary를 merge 해 race를 흡수한다.
- Live shell page는 query cache 결과와 local selection state만 조합하도록 정리했고, timeline/detail placeholder는 그대로 유지한 채 다음 slice가 바로 detail surface로 진입할 수 있는 경계를 만들었다.
- `Vitest + jsdom + @testing-library/react` 기반 테스트 인프라를 추가하고 snapshot helper, live bridge, session selection, session detail query lifecycle을 자동 검증하게 했다.
- root README와 task bundle 문서를 새 query foundation 구조와 slice 순서에 맞게 갱신했다.

# Decisions made during implementation

- Tauri IPC로 읽는 server state만 TanStack Query가 소유하고, `activeTab`/`selectedSessionId` 같은 UI state는 계속 feature-local state로 유지한다.
- `start_live_bridge`와 event listen은 query function 바깥의 app-level bootstrap으로 분리했다. live summary payload만으로 detail merge는 불가능하므로 summary cache update + detail invalidate 정책으로 고정했다.
- Query 기본 정책은 desktop/Tauri 환경 기준으로 `staleTime`을 길게 두고 focus/mount/reconnect 자동 refetch를 끄는 방향으로 잡았다.
- 현재 로컬 Node가 `20.11.1`이라 Vite 7 baseline(`20.19+`)과 어긋난다. 앱은 빌드되지만 경고가 계속 나오므로 README와 `package.json.engines`에 최소 버전을 명시했다.
- 최신 `jsdom`이 현재 로컬 Node와 맞지 않아 테스트 환경은 `jsdom@26.1.0`으로 고정했다.

# Verification results

- `pnpm install`: pass
- `pnpm typecheck`: pass
- `pnpm test`: pass (`5` files, `18` tests)
- `pnpm build`: pass, but Node `20.11.1` 경고 지속

# Known issues / residual risk

- Raw Codex log schema drift risk remains.
- live bridge는 metadata poll 기반이라 deleted/renamed live file cleanup과 byte-offset incremental append는 아직 없다.
- 실제 live append가 들어왔을 때 sidebar reorder와 degraded banner UX를 사람이 클릭하면서 본 상호작용 smoke는 아직 못 했다.
- archive/dashboard query surface와 TanStack Virtual 도입은 아직 열리지 않았고, 이후 slice가 shared query layer를 우회하지 않도록 주의가 필요하다.
- timeline renderer, raw/tokens drawer 탭은 아직 placeholder 상태라 session summary 이상 drill-down은 다음 slice가 필요하다.

# Next slice

SLICE-6
- 목표: selected session을 실제 timeline/detail surface에 연결하고, `useSessionDetailQuery` 기반 sequence timeline MVP와 drawer drill-down을 연다.
- 선행조건: `src/features/session-selection`의 selected session state와 `src/features/session-detail` query 결과를 timeline boundary로 넘기고, lane/time-axis projection 규칙을 `src/features/timeline/*` 쪽으로 고정한다.
- 먼저 볼 경계: timeline canvas projection, session detail fetch lifecycle, 현재 widget placeholder를 실제 canonical detail 데이터로 치환하는 흐름.
