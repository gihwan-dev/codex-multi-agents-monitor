# Architecture (Session-First Baseline)

## Naming Baseline

- User-facing hierarchy: `Workspace > Chat(Session) > Agent Session > Item(Event)`
- UI copy: `챗` 또는 `세션`
- Public/shared contract naming: `session`
- Internal compatibility naming: `thread`, `thread_id`
- Storage/database naming은 현재 단계에서 유지하고, user-facing copy에 직접 노출하지 않는다.

## 1) 시스템 컨텍스트

```mermaid
flowchart LR
    U["사용자 (Desktop Operator)"] --> F["Frontend (React + TS)"]
    F -->|invoke/listen| B["Backend (Tauri + Rust)"]
    B -->|read-only| S["~/.codex/sessions/**/*.jsonl"]
    B -->|read-only| A["~/.codex/archived_sessions/*.jsonl"]
    B -->|read-only| M["~/.codex/state_5.sqlite"]
    B -->|read/write(app-owned)| D["monitor.db (app data dir)"]
```

## 2) Ingestion/Data Flow

```mermaid
flowchart TD
    P["Source path resolver"] --> W["ingest watermark (path/inode/offset)"]
    W --> L["line reader (jsonl stream)"]
    L --> N["normalizer (session/agent-session/item mapping)"]
    N --> I["index writer (monitor.db)"]
    I --> Q["query service (live/archive/session-flow/summary)"]
    Q --> E["monitor://* event emission (optional in v1 setup)"]
```

## 3) Frontend-Backend Command/Event Boundary

```mermaid
sequenceDiagram
    participant UI as React UI
    participant Bridge as Tauri Bridge (TS)
    participant Cmd as Rust Commands
    participant DB as monitor.db

    UI->>Bridge: listLiveThreads()
    Bridge->>Cmd: invoke("list_live_threads")
    Cmd->>DB: read unarchived root session summary
    Cmd-->>Bridge: MonitorThread[]
    Bridge-->>UI: render live shell

    UI->>Bridge: getSessionFlow(sessionId)
    Bridge->>Cmd: invoke("get_session_flow")
    Cmd-->>Bridge: SessionFlowPayload | null
    Bridge-->>UI: render session flow workspace

    UI->>Bridge: listArchivedSessions(filters)
    Bridge->>Cmd: invoke("list_archived_sessions")
    Cmd-->>Bridge: ArchivedSessionListPayload
    Bridge-->>UI: render archive browser

    UI->>Bridge: getSummaryDashboard(filters)
    Bridge->>Cmd: invoke("get_summary_dashboard")
    Cmd-->>Bridge: SummaryDashboardPayload
    Bridge-->>UI: render summary dashboard

    UI->>Bridge: getThreadDetail(threadId)
    Bridge->>Cmd: invoke("get_thread_detail")
    Cmd-->>Bridge: ThreadDetail | null
    Bridge-->>UI: compatibility/detail lookup only
```

## 모듈 경계 요약

- `src/shared/lib/tauri/*`: command/event 경계의 단일 진입점
- `src/shared/types/*`: session-first public/shared contract 정의
- `src-tauri/src/commands/*`: frontend가 호출 가능한 표면
- `src-tauri/src/state/*`: app-owned path (`monitor.db`)와 source path resolution
- `src-tauri/src/index_db/*`: app-owned SQLite 초기화/관리 책임
