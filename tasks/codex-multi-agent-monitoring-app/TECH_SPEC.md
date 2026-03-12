# Current state

- Repository state:
  - Vite + React + Tauri 최소 스켈레톤
  - frontend entry 1개, static hello world
  - Rust backend는 default builder만 존재
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

- workspace/session navigation
- list virtualization
- svg timeline projection
- filter state and drill-down UX
- metric visualization

# Timeline renderer choice

결정: custom SVG timeline renderer + zoom/pan 전용 interaction layer.

## Why not full graph editor first

- 요구사항은 time-axis sequence diagram이지 자유 배치 node editor가 아니다.
- lane alignment, duration scaling, level-of-detail culling이 핵심이라 graph abstraction보다 time-series abstraction이 맞다.
- draw.io처럼 복잡한 편집 기능은 범위 밖이다.

## Renderer layers

- grid + time axis
- lane headers
- session/turn/tool/sub-agent spans
- connectors
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
  - `@tanstack/react-virtual` for large lists/tables
  - SVG + `d3-zoom` or equivalent for canvas transform
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
- Fact: TanStack Virtual은 headless virtualization utility이며 long list rendering 제어권을 앱 쪽에 남긴다. [TanStack Virtual - Introduction](https://tanstack.com/virtual/latest/docs/introduction)
- Fact: Tauri Store plugin은 persistent key-value storage를 제공한다. [Tauri Store Plugin](https://v2.tauri.app/plugin/store/)
- Fact: Tauri SQL plugin은 sqlx 기반 frontend-to-database bridge를 제공한다. [Tauri SQL Plugin](https://v2.tauri.app/plugin/sql/)

# Design inference from references

- React Flow는 benchmark로 참고할 가치는 있지만 v1 요구는 time-axis sequence diagram이라 custom SVG가 더 적합하다.
- TanStack Virtual은 archived list와 dashboard dense table에 바로 맞는다.
- Tauri Store plugin은 preference 저장에 적합하고, event store는 backend-owned SQLite가 더 일관적이다.
