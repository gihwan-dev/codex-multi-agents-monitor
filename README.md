# Codex Multi-Agent Monitor

Codex 세션 로그를 로컬에서 읽어 멀티 에이전트 진행 상황을 관찰하는 Tauri + React 데스크톱 앱이다.

현재 frontend는 Live shell 기준으로 동작한다. workspace-grouped sidebar, selected session summary, live bridge bootstrap, timeline/detail placeholder가 연결되어 있고, Archive/Dashboard는 다음 slice를 위한 placeholder 경계만 유지한다.

## 실행

```bash
pnpm install
pnpm tauri:dev
```

## 검증

```bash
pnpm typecheck
pnpm build
```

## 현재 기능

- `query_workspace_sessions`로 workspace/session snapshot bootstrap
- `start_live_bridge` + `codex://live-session-updated`로 live sidebar 갱신
- Live / Archive / Dashboard 탭 셸
- selected session summary 카드
- timeline canvas / detail drawer placeholder

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
    session-selection/
  entities/session/
  shared/
    api/
    model/
    queries.ts
```

Live shell 데이터 흐름은 `shared/api -> features -> entities -> widgets -> page -> app-shell` 순서를 따른다. Rust/Tauri IPC 계약은 그대로 유지하고, frontend만 Live 중심으로 FSD 경계에 맞춰 분리했다.
