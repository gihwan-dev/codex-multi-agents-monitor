# Codex Multi-Agent Monitor

Codex 세션 로그를 로컬에서 읽어 멀티 에이전트 진행 상황을 관찰하는 Tauri + React 데스크톱 앱이다.

현재 frontend는 TanStack Query 기반 Live shell과 session-local vertical timeline MVP까지 연결된 상태다. workspace-grouped sidebar, selected session summary, app-level live bridge bootstrap, selected session detail query, vertical sequence timeline, shared detail drawer가 동작하고 Archive/Dashboard는 후속 slice를 위한 경계만 유지한다.

## 환경

- Node.js `20.19+`
- pnpm `10+`

## 실행

```bash
pnpm install
pnpm tauri:dev
```

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 현재 기능

- `QueryClientProvider` + dev-only React Query Devtools
- `query_workspace_sessions` bootstrap query와 live-before-bootstrap merge
- `start_live_bridge` + `codex://live-session-updated` 기반 app-level live cache update
- `query_session_detail` 기반 selected session detail fetch
- Live / Archive / Dashboard 탭 셸
- selected session summary 카드
- `User -> Main -> 기타 lane` 순서의 vertical sequence timeline
- live recent-zoom preset + latest follow / resume control
- Summary / Input-Output / Raw / Tokens / Related metrics detail drawer
- archive fit-all preset 지원 준비 (`SLICE-7` 화면 연결 예정)
- snapshot merge, live bridge, selection fallback, detail query lifecycle 자동 테스트

## Frontend Data Access Rules

- Tauri IPC로 읽는 server state는 TanStack Query가 소유한다.
- live summary event는 workspace sessions cache를 갱신하고 관련 session detail cache를 invalidate 한다.
- `activeTab`, `selectedSessionId`, future filter draft 같은 UI state는 feature-local state로 유지한다.
- TanStack Virtual은 archive/dashboard dense surface가 열리는 slice에서만 도입한다.
- 테스트는 `shared/api/tauri-monitor.ts` adapter boundary를 mock 하고 Tauri global mock에 직접 묶지 않는다.

## Frontend 구조

```text
src/
  app-shell.tsx
  app/ui/
  pages/monitor/
  widgets/
    monitor-header/
    workspace-sidebar/
    live-session-overview/
    timeline/
    detail-drawer/
    tab-placeholder-panel/
  features/
    live-session-feed/
    session-detail/
    session-selection/
    timeline/
  entities/session/
  shared/
    api/
    query/
    model/
    queries.ts
```

Live shell 데이터 흐름은 `shared/api -> shared/query -> features -> entities -> widgets -> page -> app-shell` 순서를 따른다. Rust/Tauri IPC 계약은 그대로 유지하고, frontend는 Query cache와 local UI state를 분리한 채 `pages/monitor`가 selected session detail을 소유하고 `features/timeline`이 projection, viewport, latest-follow, drawer selection을 담당하도록 경계를 분리했다. Archive preset은 feature/module 수준까지만 연결되어 있으며 실제 archive timeline surface는 `SLICE-7`로 미룬다.
