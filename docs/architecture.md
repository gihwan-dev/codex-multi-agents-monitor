# Architecture (v1 Baseline)

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
    L --> N["normalizer (thread/session/event mapping)"]
    N --> I["index writer (monitor.db)"]
    I --> Q["query service (overview/detail/history)"]
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
    Cmd->>DB: read inflight summary
    Cmd-->>Bridge: MonitorThread[]
    Bridge-->>UI: render overview shell

    UI->>Bridge: getThreadDetail(threadId)
    Bridge->>Cmd: invoke("get_thread_detail")
    Cmd-->>Bridge: ThreadDetail | null
    Bridge-->>UI: render timeline shell

    UI->>Bridge: getHistorySummary()
    Bridge->>Cmd: invoke("get_history_summary")
    Cmd-->>Bridge: HistorySummaryPayload
    Bridge-->>UI: render history shell
```

## 모듈 경계 요약

- `src/shared/lib/tauri/*`: command/event 경계의 단일 진입점
- `src-tauri/src/commands/*`: frontend가 호출 가능한 표면
- `src-tauri/src/state/*`: app-owned path (`monitor.db`)와 source path resolution
- `src-tauri/src/index_db/*`: app-owned SQLite 초기화/관리 책임
