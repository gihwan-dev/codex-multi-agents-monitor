# Current state

- Repository state:
  - Rust backend가 SQLite-backed session snapshot/detail query와 live bridge command를 노출한다.
  - frontend는 TanStack Query 기반 workspace snapshot/detail query, app-level live bridge bootstrap, Live shell, session-local vertical timeline/detail surface를 렌더링한다.
  - Archive/Dashboard는 navigation skeleton만 열어 두고 후속 slice에서 채운다.
- Observed local data sources:
  - `~/.codex/sessions/**/*.jsonl`
  - `~/.codex/archived_sessions/**/*.jsonl`
  - `~/.codex/.codex-global-state.json`
- Observed useful raw fields:
  - `session_meta.id`
  - `session_meta.forked_from_id`
  - `session_meta.cwd`
  - `session_meta.source`
  - `session_meta.agent_role`
  - `event_msg.user_message`
  - `event_msg.agent_message`
  - `response_item.reasoning`
  - `response_item.function_call`
  - `response_item.function_call_output`
  - `event_msg.token_count`

# Target architecture

```text
Codex local files
  |
  +--> session file watcher
  +--> archive file scanner
  +--> global state reader
          |
          v
  Rust ingestion services
    - source discovery
    - append parser
    - canonical normalizer
    - heuristic calculator
          |
          v
  Local SQLite store
    - sessions
    - timeline_events
    - spans
    - metrics_snapshots
          |
          +--> Tauri commands (snapshot/query)
          +--> Tauri events   (live append/update)
                      |
                      v
  React app
    - shell + navigation
    - live/archive views
    - svg timeline renderer
    - dashboard + drill-down
```

# Canonical model

1. Raw JSONL event를 직접 UI에 흘리지 않는다.
2. Rust에서 parser version을 갖는 canonical event로 변환한다.
3. UI는 canonical event와 aggregated span만 소비한다.

## Session-level entities

- Workspace
- Session
- Agent instance
- Turn
- Timeline event
- Timeline span
- Metric snapshot

## Event normalization mapping

- `session_meta` -> session started, agent identity, parent-child relation seed
- `user_message` / `response_item.message(role=user)` -> user turn marker
- `agent_message` -> progress update marker
- `reasoning` -> reasoning span or reasoning node
- `function_call` + matching `function_call_output` -> tool span
- `token_count` -> session token snapshot event
- `turn_aborted` / errors -> failure marker

## Scope guards for `SLICE-1`

- live/archive 상태는 파일 위치 snapshot으로만 계산한다.
- archive move 시점 복원과 archive lag metric은 `SLICE-1` 범위 밖이다.
- token exactness는 session totals와 metadata가 있는 agent/session totals까지만 계약한다.
- turn/tool token attribution은 explicit raw evidence가 생길 때까지 deferred한다.
- reasoning raw는 기본 timeline에 올리지 않고 detail drawer에서만 연다.

# Storage design

- Backend-owned SQLite를 기본 선택으로 둔다.
- 목적:
  - live append를 durable하게 기록
  - archive filter/query 속도 확보
  - dashboard pre-aggregation 지원
- Preference storage:
  - UI filters, density mode, theme preference는 key-value store로 분리한다.

## Suggested tables

- `workspaces`
- `sessions`
- `agent_instances`
- `timeline_events`
- `timeline_spans`
- `metric_snapshots`
- `parser_checkpoints`
- `ui_preferences`

## Index hints

- `(workspace_id, is_archived, last_event_at desc)`
- `(session_id, occurred_at)`
- `(session_id, event_kind, occurred_at)`
- `(session_id, agent_instance_id, occurred_at)`
- `(metric_name, bucket_start_at, workspace_id)`

# Backend responsibilities

- file discovery and watch lifecycle
- incremental JSONL parse with byte offset checkpoint
- malformed line quarantine
- canonical event generation
- heuristic metric computation
- query API for list/detail/dashboard

# Frontend responsibilities

- query cache ownership for Tauri server state
- workspace/session navigation
- list virtualization
- svg timeline projection
- filter state and drill-down UX
- metric visualization

## Frontend module structure

- `app`
  - `app-shell.tsx`는 thin facade만 담당한다.
  - global decorative UI와 top-level composition만 가진다.
- `pages/monitor`
  - `activeTab`, selected session, timeline selection을 소유한다.
  - selected session detail query owner로 동작하고 Live surface와 deferred placeholder surface를 스위칭한다.
- `widgets`
  - `workspace-sidebar`, `monitor-header`, `live-session-overview`, `timeline`, `detail-drawer`, `tab-placeholder-panel`
  - 모두 prop-driven dumb component로 유지한다.
- `features`
  - `live-session-feed`: workspace sessions query + app-level live bridge bootstrap/cache update
  - `session-detail`: `query_session_detail` fetch lifecycle, disabled/detail state contract
  - `session-selection`: selected session id, auto-select, selection fallback
  - `timeline`: detail snapshot -> lane/item projection, live/archive viewport preset, SVG canvas, drawer binding
- `entities/session`
  - snapshot sort/upsert/find 규칙
  - workspace/timestamp/badge formatting
  - `SessionBadges` UI
- `shared`
  - `api/tauri-monitor`: Tauri invoke/listen runtime bridge
  - `query/*`: stable query client, query provider, query key/options factory
  - `model/monitor`: tab contract과 deferred placeholder copy
  - `queries.ts`: Rust와 공유하는 query contract

## Frontend query layer

- server state ownership:
  - `query_workspace_sessions`, `query_session_detail`, future archive/dashboard query는 TanStack Query가 소유한다.
- app bootstrap:
  - `start_live_bridge`와 `codex://live-session-updated` listen은 query function 안이 아니라 app-level hook에서 1회 등록한다.
- cache policy:
  - workspace snapshot bootstrap은 첫 fetch가 pending일 때 cache에 들어온 live summary만 `mergeBootstrapSnapshot`으로 병합한다.
  - 이후 refetch는 backend snapshot을 source of truth로 사용하고 기존 cache를 다시 병합하지 않는다.
  - live summary event는 workspace sessions cache만 `setQueryData`로 갱신한다.
  - summary payload만으로 안전 merge가 불가능한 detail cache는 session key 기준으로 invalidate 하고, remount 시 fresh fetch가 일어나도록 유지한다.
- local UI state:
  - `activeTab`, `selectedSessionId`, future filter draft는 Query cache에 올리지 않고 feature-local state로 유지한다.

## Live shell data flow

```text
shared/api/tauri-monitor
  -> shared/query
  -> features/live-session-feed
  -> features/session-detail
  -> entities/session
  -> features/session-selection
  -> features/timeline
  -> widgets/*
  -> pages/monitor
  -> app-shell
```

- `query_workspace_sessions`는 TanStack Query bootstrap snapshot을 가져오고 pending 중 도착한 live summary를 병합한다.
- `start_live_bridge`와 `codex://live-session-updated`는 workspace sessions query cache를 갱신한다.
- `query_session_detail`는 session별 key를 갖고 disabled/detail fetch lifecycle을 분리한다.
- `entities/session`는 backend contract와 동일한 정렬 규칙을 query cache merge path에도 적용한다.
- `pages/monitor`는 tab state, selected session, timeline selection을 소유하고 timeline/drawer는 같은 detail snapshot과 selection state를 props로 공유한다.
- `features/timeline`는 `User -> Main -> others` lane order, `tool_call + tool_output` merge, reasoning summary projection, token collapse, live/archive viewport preset을 고정한다.

# Timeline renderer choice

결정: custom SVG vertical timeline renderer + session-local viewport interaction layer.

## Why not full graph editor first

- 요구사항은 time-axis sequence diagram이지 자유 배치 node editor가 아니다.
- lane alignment, duration scaling, level-of-detail culling이 핵심이라 graph abstraction보다 time-series abstraction이 맞다.
- draw.io처럼 복잡한 편집 기능은 범위 밖이다.
- 현재 v1 time axis는 top -> bottom vertical flow로 고정하고 최신 이벤트를 하단에 배치한다.

## Viewport state machine

- `mode=live`
  - recent-zoom preset으로 시작한다.
  - `followLatest=true`로 시작하고 새 live detail이 들어오면 최신 하단 구간으로 유지한다.
- `mode=archive`
  - fit-all preset으로 시작한다.
  - `followLatest=false`로 유지한다.
- manual interaction:
  - scroll scrub, drag pan, Ctrl+wheel zoom은 모두 `followLatest=false`로 전환한다.
  - live에서만 `Eye` control로 latest follow를 복구한다.

## Renderer layers

- grid + time axis
- lane headers
- session/turn/tool/sub-agent spans
- follow state chrome
- hover/selection overlay
- minimap or overview strip (optional later)

## Performance strategy

- visible time range 기준 culling
- span aggregation at low zoom
- raw detail lazy hydration
- sidebar/result list는 virtualization
- dashboard chart data는 pre-aggregated query 우선

# Suggested implementation stack

- Rust:
  - `notify` or equivalent file watching
  - `serde` for raw/canonical decode
  - SQLite repository layer
- React:
  - React 19
  - `@tanstack/react-query` for server-state ownership
  - `@tanstack/react-query-devtools` in dev-only environments
  - `@tanstack/react-virtual` for archive/dashboard dense lists in later slices
  - SVG + custom viewport state machine (no extra zoom dependency in `SLICE-6`)
- Tauri:
  - commands/events for bridge
  - optional store plugin for UI preference persistence

# Performance budgets

- `RISK-001` live append to UI under 150ms p95 on local machine sample
- `RISK-002` session detail first meaningful paint under 500ms for 10k normalized events
- `RISK-003` zoom/pan stays at 55+ FPS for 5k visible primitives
- `RISK-004` archive filter response under 300ms for 1k sessions local index

# Security and privacy

- 모든 raw session content는 local only
- optional redaction mode:
  - user prompt preview blur
  - reasoning hidden by default
  - raw reasoning visible only in selected detail drawer
  - export disabled in v1

# External benchmark references

- Fact: React Flow 공식 문서는 viewport customization과 panning/zooming 개념을 제공한다. [React Flow - Panning and Zooming](https://reactflow.dev/learn/concepts/the-viewport)
- Fact: React Flow 공식 문서는 큰 그래프에서 성능 최적화 전략을 따로 다룬다. [React Flow - Performance](https://reactflow.dev/learn/advanced-use/performance)
- Fact: TanStack Query는 `QueryClientProvider`와 query key/options factory 패턴을 공식 문서로 제공한다. [TanStack Query - Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start)
- Fact: TanStack Query는 cache lifecycle과 refetch 기본 정책을 `Important Defaults`로 문서화한다. [TanStack Query - Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- Fact: TanStack Query는 reusable query factory 패턴으로 `queryOptions`를 제공한다. [TanStack Query - queryOptions](https://tanstack.com/query/latest/docs/framework/react/guides/query-options)
- Fact: TanStack Virtual은 headless virtualization utility이며 long list rendering 제어권을 앱 쪽에 남긴다. [TanStack Virtual - Introduction](https://tanstack.com/virtual/latest/docs/introduction)
- Fact: Tauri Store plugin은 persistent key-value storage를 제공한다. [Tauri Store Plugin](https://v2.tauri.app/plugin/store/)
- Fact: Tauri SQL plugin은 sqlx 기반 frontend-to-database bridge를 제공한다. [Tauri SQL Plugin](https://v2.tauri.app/plugin/sql/)

# Design inference from references

- React Flow는 benchmark로 참고할 가치는 있지만 v1 요구는 time-axis sequence diagram이라 custom SVG가 더 적합하다.
- TanStack Query는 Tauri IPC로 읽는 server state를 query cache와 local UI state로 분리하는 foundation에 적합하다.
- TanStack Virtual은 archived list와 dashboard dense table에 바로 맞는다.
- Tauri Store plugin은 preference 저장에 적합하고, event store는 backend-owned SQLite가 더 일관적이다.
