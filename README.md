# Codex Multi-Agent Monitor

Codex 세션 로그를 로컬에서 읽어 멀티 에이전트 진행 상황을 관찰하는 Tauri + React 데스크톱 앱이다.

현재 frontend는 TanStack Query 기반 data-access foundation까지 반영된 Live shell 기준으로 동작한다. workspace-grouped sidebar, selected session summary, app-level live bridge bootstrap, query-backed workspace/session data flow가 연결되어 있고, Archive/Dashboard는 다음 slice를 위한 placeholder 경계만 유지한다.

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
- `query_session_detail` hook 준비
- Live / Archive / Dashboard 탭 셸
- selected session summary 카드
- timeline canvas / detail drawer placeholder
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
    timeline-placeholder/
    detail-drawer-placeholder/
    tab-placeholder-panel/
  features/
    live-session-feed/
    session-detail/
    session-selection/
  entities/session/
  shared/
    api/
    query/
    model/
    queries.ts
```

Live shell 데이터 흐름은 `shared/api -> shared/query -> features -> entities -> widgets -> page -> app-shell` 순서를 따른다. Rust/Tauri IPC 계약은 그대로 유지하고, frontend는 Query cache와 local UI state를 분리한 채 Live 중심으로 FSD 경계에 맞춰 분리했다.
