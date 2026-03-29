# Codex Data Storage

이 문서는 로컬 `~/.codex` 아티팩트와 이 저장소의 Tauri backend 구현을 기준으로, Codex가 세션 데이터를 어떻게 저장하고 관리하는지 정리한다. 목적은 화면/FE 설명이 아니라 온디스크 데이터 구조, 관계, 그리고 backend read path를 정확히 문서화하는 것이다.

## Scope

- SSOT:
  - 로컬 `~/.codex` 실데이터
  - `src-tauri/src/infrastructure/filesystem.rs`
  - `src-tauri/src/infrastructure/state_sqlite.rs`
  - `src-tauri/src/infrastructure/session_jsonl.rs`
  - `src-tauri/src/support/text_entry_snapshot.rs`
  - `src-tauri/src/application/recent_sessions.rs`
  - `src-tauri/src/application/archived_sessions.rs`
  - `src-tauri/src/domain/ingest_policy.rs`
  - `src-tauri/src/commands/sessions.rs`
  - `src-tauri/src/state/archive_cache.rs`
- 제외 범위:
  - frontend 화면 구조
  - task bundle의 normalized store / renderer 설명
  - interaction / accessibility / graph view behavior

## Storage Root Resolution

Codex home은 다음 순서로 결정된다.

1. `CODEX_HOME` 환경 변수가 있으면 그 경로 사용
2. 없으면 `$HOME/.codex` 사용

현재 monitor backend는 이 경로 아래의 JSONL/SQLite를 read-only로 읽는다.

## Storage Layers

세션과 직접 관련된 핵심 저장 계층은 아래 네 개다.

| Layer | Canonical role |
| --- | --- |
| `sessions/YYYY/MM/DD/*.jsonl` | live 세션의 append-only transcript |
| `archived_sessions/*.jsonl` | archived 세션의 transcript |
| `state.sqlite`, `state_*.sqlite` | thread index / metadata / archive flag / subagent edge / dynamic tool catalog |
| `session_index.jsonl` | 작은 보조 인덱스, canonical source 아님 |

로컬 관찰 기준으로 `threads`는 수천 개 row를 가지는 반면, `session_index.jsonl`은 한 자리 수 수준의 최근 항목만 담는 경우가 반복적으로 관찰됐다. 즉, `session_index.jsonl`은 전체 세션 인덱스가 아니라 최근 일부 thread만 담는 얇은 side index로 보는 편이 정확하다.

## Directory Layout

```text
~/.codex/
  sessions/YYYY/MM/DD/rollout-<timestamp>-<thread_id>.jsonl
  archived_sessions/rollout-<timestamp>-<thread_id>.jsonl
  state.sqlite or state_*.sqlite
  logs_*.sqlite
  session_index.jsonl
  .codex-global-state.json
  shell_snapshots/*.sh
  sqlite/codex-dev.db
```

핵심 역할은 아래와 같다.

| Path | Role |
| --- | --- |
| `sessions/YYYY/MM/DD/*.jsonl` | live session transcript 본문 |
| `archived_sessions/*.jsonl` | archived session transcript 본문 |
| `state.sqlite`, `state_*.sqlite` | canonical thread index / metadata DB |
| `logs_*.sqlite` | runtime/telemetry log DB |
| `session_index.jsonl` | 작은 MRU 성격의 보조 인덱스 |
| `.codex-global-state.json` | global app/workspace state, 세션 본문 저장소는 아님 |
| `shell_snapshots/*.sh` | shell snapshot 보조 파일 |
| `sqlite/codex-dev.db` | automation/inbox 계열 DB, session core storage는 아님 |

## Canonical Relationships

Codex 세션은 JSONL과 SQLite가 서로 중복된 키를 가지는 구조다.

- `threads.id` = JSONL `session_meta.payload.id` = 파일명 suffix의 thread id
- `threads.rollout_path` = 해당 thread의 canonical JSONL 경로
- `threads.archived` = live/archived 상태
- archived row의 `rollout_path`는 `archived_sessions/*.jsonl`를 가리킨다
- `thread_spawn_edges.child_thread_id` = subagent thread id
- JSONL `payload.source.subagent.thread_spawn.parent_thread_id` = parent thread id
- `thread_dynamic_tools.thread_id` = JSONL `session_meta.payload.dynamic_tools`를 가진 thread id

즉, transcript 본문은 JSONL에 있고, 탐색/정렬/상태 관리는 SQLite에 중복 저장되어 있다.

## State SQLite Selection

backend는 `~/.codex` 루트에서 다음 파일명을 후보로 본다.

- `state.sqlite`
- `state_*.sqlite`

여러 파일이 있으면 수정 시각이 가장 최신인 파일 하나만 선택한다. 현재 monitor backend는 이 선택된 DB를 read-only로 연다.

## `threads` Table

현재 로컬 `state_5.sqlite`에서 직접 확인한 `threads` 스키마는 아래와 같다.

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `TEXT` | thread/session id, primary key |
| `rollout_path` | `TEXT` | transcript JSONL 파일 절대 경로 |
| `created_at` | `INTEGER` | 생성 시각 |
| `updated_at` | `INTEGER` | 최근 갱신 시각 |
| `source` | `TEXT` | source 문자열 또는 subagent provenance를 직렬화한 JSON 문자열 |
| `model_provider` | `TEXT` | model provider |
| `cwd` | `TEXT` | 세션 workspace path |
| `title` | `TEXT` | title 성격의 텍스트 |
| `sandbox_policy` | `TEXT` | sandbox policy |
| `approval_mode` | `TEXT` | approval policy |
| `tokens_used` | `INTEGER` | 누적 token 사용량 메타 |
| `has_user_event` | `INTEGER` | user event 존재 여부 |
| `archived` | `INTEGER` | archive flag (`0` or `1`) |
| `archived_at` | `INTEGER` | archived 시각 |
| `git_sha` | `TEXT` | workspace git sha |
| `git_branch` | `TEXT` | workspace git branch |
| `git_origin_url` | `TEXT` | workspace origin URL |
| `cli_version` | `TEXT` | Codex version |
| `first_user_message` | `TEXT` | 첫 user message |
| `agent_nickname` | `TEXT` | subagent nickname |
| `agent_role` | `TEXT` | subagent role |
| `memory_mode` | `TEXT` | memory mode |
| `model` | `TEXT` | model name |
| `reasoning_effort` | `TEXT` | reasoning effort |
| `agent_path` | `TEXT` | agent task path |

인덱스는 `created_at`, `updated_at`, `archived`, `source`, `model_provider` 기준으로 생성돼 있다.

주의할 점은 다음과 같다.

- `source`는 단순 enum이 아니라 사실상 union이다.
- root thread에서는 `vscode`, `cli`, `exec` 같은 문자열이 관찰됐다.
- subagent thread에서는 JSON object가 아니라 JSON object를 문자열로 직렬화한 값이 저장된다.
- monitor backend가 live recent index에서 인정하는 source는 현재 `desktop`, `cli`, `vscode`뿐이다. 즉, 저장된 source universe와 monitor가 노출하는 source universe는 완전히 같지 않다.
- 로컬 샘플에서는 `desktop` root row가 보이지 않았지만, 코드상 허용 source 집합에는 포함되어 있다.
- `title`과 `first_user_message`는 짧은 UI label이 아니라, 실제로는 긴 multiline 첫 프롬프트가 그대로 들어갈 수 있다.

monitor backend가 recent live thread 후보를 읽을 때 실제 사용하는 컬럼은 아래 네 개뿐이다.

```sql
SELECT id, rollout_path, source, cwd
FROM threads
WHERE archived = 0
ORDER BY updated_at DESC, id DESC
```

즉, Codex는 `threads`에 monitor가 지금 읽지 않는 메타데이터도 폭넓게 저장한다. 현재 monitor의 live recent read path는 SQLite에서 `id`, `rollout_path`, `source`, `cwd`만 읽고, `title`, `first_user_message`, `model`, `status`, `updated_at` 같은 표시용 값은 JSONL 스캔으로 다시 계산한다.

따라서 나머지 컬럼은 "현재 monitor read contract"라기보다 "Codex가 저장하는 session metadata"로 이해하는 편이 정확하다. 특히 `archived_at`, `title`, `first_user_message`, `agent_*`, `model`, `reasoning_effort`는 session lifecycle과 provenance를 설명하는 저장 메타데이터다.

## `thread_spawn_edges` Table

subagent parent-child 관계는 SQLite에서도 별도 edge table로 유지된다.

| Column | Type | Meaning |
| --- | --- | --- |
| `parent_thread_id` | `TEXT` | 부모 thread id |
| `child_thread_id` | `TEXT` | 자식 thread id, primary key |
| `status` | `TEXT` | edge status |

인덱스는 `(parent_thread_id, status)`로 잡혀 있다. 현재 로컬 데이터에서는 `open`과 `closed` 둘 다 관찰됐다.

이 테이블은 Codex가 thread graph를 별도 관리한다는 신호다. 현재 monitor backend는 snapshot 로딩 시 이 table을 subagent child lookup의 1차 힌트로 읽고, `threads.source` provenance와 JSONL `thread_spawn` 메타를 함께 사용해 관계를 검증한다.

## `thread_dynamic_tools` Table

dynamic tool catalog도 SQLite에 별도 정규화돼 있다.

| Column | Type | Meaning |
| --- | --- | --- |
| `thread_id` | `TEXT` | thread id |
| `position` | `INTEGER` | tool ordering |
| `name` | `TEXT` | tool name |
| `description` | `TEXT` | tool description |
| `input_schema` | `TEXT` | tool input schema JSON |
| `defer_loading` | `INTEGER` | lazy loading flag |

로컬 샘플에서는 `thread_dynamic_tools`에 수백 건의 row가 관찰됐다. 이 값은 JSONL `session_meta.payload.dynamic_tools[]`와 중복 저장된 것으로 보인다. 다만 필드 casing은 다르다.

- JSONL: `inputSchema`, `deferLoading`
- SQLite: `input_schema`, `defer_loading`

중요한 caveat은 현재 monitor backend가 이 정보를 읽지 않는다는 점이다. 즉, `thread_dynamic_tools`는 Codex가 저장하는 세션 인접 메타데이터이지만, monitor의 recent/archive index나 snapshot read path에는 직접 참여하지 않는다.

## Adjacent SQLite Tables

현재 `state_5.sqlite`에는 session core schema 외에도 다음 table이 존재했다.

- `_sqlx_migrations`
- `jobs`
- `agent_jobs`
- `agent_job_items`
- `stage1_outputs`
- `backfill_state`
- `logs`

이 저장소의 monitor backend는 위 table들을 세션 read path에서 직접 사용하지 않는다.

그중 `stage1_outputs`는 `threads(id)`를 참조하는 session-adjacent table이지만, 현재 로컬 DB에서는 비어 있었다. 따라서 "세션과 무관한 table"이라기보다 "현재 monitor가 읽지 않고, 로컬 샘플에서도 활성 사용이 보이지 않는 인접 table"로 보는 편이 정확하다.

## Runtime Log Stores

현재 로컬 환경에서는 log 성격의 SQLite table이 두 군데에서 관찰됐다.

### `state_5.sqlite::logs`

```sql
CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    ts_nanos INTEGER NOT NULL,
    level TEXT NOT NULL,
    target TEXT NOT NULL,
    message TEXT,
    module_path TEXT,
    file TEXT,
    line INTEGER,
    thread_id TEXT,
    process_uuid TEXT,
    estimated_bytes INTEGER NOT NULL DEFAULT 0
);
```

### `logs_1.sqlite::logs`

```sql
CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    ts_nanos INTEGER NOT NULL,
    level TEXT NOT NULL,
    target TEXT NOT NULL,
    feedback_log_body TEXT,
    module_path TEXT,
    file TEXT,
    line INTEGER,
    thread_id TEXT,
    process_uuid TEXT,
    estimated_bytes INTEGER NOT NULL DEFAULT 0
);
```

둘 다 `thread_id`로 session과 연결할 수 있지만, monitor backend는 현재 이 log store를 읽지 않는다. 따라서 writer policy, rotation, 이중 저장 여부는 이 저장소 코드만으로 단정하지 않는다.

## JSONL Transcript Format

세션 본문은 append-only JSONL이다. 한 줄당 하나의 event record가 기록된다.

live 파일명 패턴:

```text
~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<thread_id>.jsonl
```

archived 파일명 패턴:

```text
~/.codex/archived_sessions/rollout-<timestamp>-<thread_id>.jsonl
```

## First Line Contract: `session_meta`

backend는 첫 줄을 특별 취급한다. 정확히는 첫 줄의 top-level `type`을 강하게 검증하지는 않지만, 첫 줄에 `payload` object가 있고 그 안에 session metadata가 들어 있다고 가정한다.

즉, 첫 줄이 없거나 `payload`가 없으면 session을 유효하게 해석할 수 없다.

### Root Thread `session_meta`

`session_meta`의 field set은 고정 스키마라기보다 observed/optional 집합으로 보는 편이 안전하다. 2026년 3월 25일 현재 root thread 첫 줄에서 자주 관찰된 key는 아래와 같았다.

- `id`
- `timestamp`
- `cwd`
- `originator`
- `cli_version`
- `source`
- `model_provider`
- `base_instructions`
- `dynamic_tools`
- `git`

추가로 일부 파일에서는 `instructions`, `agent_path` 같은 key도 관찰됐다.

실제 shape는 대략 아래와 같다.

```json
{
  "type": "session_meta",
  "payload": {
    "id": "<thread_id>",
    "timestamp": "<iso8601>",
    "cwd": "<workspace>",
    "originator": "Codex Desktop",
    "cli_version": "<version>",
    "source": "vscode",
    "model_provider": "openai",
    "base_instructions": { "text": "<full instruction text>" },
    "dynamic_tools": [
      {
        "name": "read_thread_terminal",
        "description": "<tool description>",
        "inputSchema": { "...": "..." },
        "deferLoading": false
      }
    ],
    "git": {
      "branch": "<branch>",
      "commit_hash": "<sha>",
      "repository_url": "<origin>"
    }
  }
}
```

### Child / Subagent `session_meta`

subagent thread 첫 줄에서는 위 root key에 더해 다음 key가 관찰됐다.

- `forked_from_id`
- `agent_nickname`
- `agent_role`
- `agent_path`

그리고 `source`는 문자열이 아니라 nested object가 된다.

```json
{
  "type": "session_meta",
  "payload": {
    "id": "<child_thread_id>",
    "forked_from_id": "<parent_or_fork_origin_id>",
    "timestamp": "<iso8601>",
    "cwd": "<workspace>",
    "source": {
      "subagent": {
        "thread_spawn": {
          "parent_thread_id": "<parent_thread_id>",
          "depth": 1,
          "agent_path": "/root/<task_name>",
          "agent_nickname": "<nickname>",
          "agent_role": "<role>"
        }
      }
    },
    "agent_nickname": "<nickname>",
    "agent_role": "<role>",
    "agent_path": "/root/<task_name>"
  }
}
```

중요한 점은 다음과 같다.

- JSONL `payload.source`는 object인데, SQLite `threads.source`에서는 이 object가 문자열로 직렬화돼 저장된다.
- monitor backend가 subagent 관계를 최종 확정할 때 핵심으로 보는 값은 JSONL `payload.source.subagent.thread_spawn.parent_thread_id`다.
- child transcript에서는 첫 줄 외에 추가 `session_meta` / `turn_context` line이 뒤에 더 나타날 수 있다.
- root session parser는 여전히 첫 줄 `session_meta`를 canonical header로 사용한다.
- subagent snapshot parser는 첫 줄만 고집하지 않고, 파일 안쪽에서 뒤늦게 나타나는 child `session_meta`도 찾아서 snapshot을 구성한다.

## Top-Level Record Types

2026년 3월 25일 현재 로컬 transcript에서 관찰한 top-level `type`은 아래와 같았다.

- `session_meta`
- `turn_context`
- `event_msg`
- `response_item`
- `compacted`
- `function_call`
- `function_call_output`
- `reasoning`
- `message`

즉, raw transcript universe는 monitor가 보통 기대하는 네 가지 wrapper 타입보다 조금 넓다. 현재 backend code는 이중 top-level `type = "compacted"`를 특별 처리하고, 나머지 희귀 top-level record는 line 단위 parse 결과에 따라 보수적으로 무시될 수 있다.

즉, transcript를 읽을 때는 top-level `type`과 `payload.type`을 분리해서 봐야 한다.

## `turn_context`

`turn_context`는 turn 단위 실행 컨텍스트 snapshot이다. 여기에 나오는 field set도 고정이라기보다 observed/optional 집합으로 보는 편이 안전하다. 현재 로컬 데이터에서 관찰한 key는 아래와 같다.

- `turn_id`
- `cwd`
- `current_date`
- `timezone`
- `approval_policy`
- `sandbox_policy`
- `model`
- `personality`
- `collaboration_mode`
- `realtime_active`
- `effort`
- `summary`
- `user_instructions`
- `developer_instructions`
- `truncation_policy`

monitor backend는 여기서 특히 `model`을 추출해 recent index / snapshot metadata에 사용한다.

## `payload.type` Families

현재 로컬 transcript에서 직접 관찰한 `payload.type`과 key shape는 아래와 같다.

| `payload.type` | Observed keys |
| --- | --- |
| `message` | `content`, `role`, `type` |
| `function_call` | `arguments`, `call_id`, `name`, `type` |
| `function_call_output` | `call_id`, `output`, `type` |
| `reasoning` | `content`, `encrypted_content`, `summary`, `type` |
| `agent_message` | `memory_citation`, `message`, `phase`, `type` |
| `task_started` | `collaboration_mode_kind`, `model_context_window`, `turn_id`, `type` |
| `task_complete` | `last_agent_message`, `turn_id`, `type` |
| `token_count` | `info`, `rate_limits`, `type` |
| `context_compacted` | `summary`, `type` |
| `agent_reasoning` | `text`, `type` |
| `item_completed` | implementation-specific item fields, `type` |
| `turn_aborted` | `reason`, `turn_id`, `type` |
| `user_message` | `images`, `local_images`, `message`, `text_elements`, `type` |
| `custom_tool_call` | function-call-like tool payload, `type` |
| `custom_tool_call_output` | function-output-like payload, `type` |
| `web_search_call` | web-search payload, `type` |
| `ghost_snapshot` | ghost snapshot payload, `type` |
| `tool_search_call` | tool-search payload, `type` |
| `tool_search_output` | tool-search result payload, `type` |

실제 top-level container 기준으로는 대략 이렇게 나뉜다.

- `response_item`: `message`, `function_call`, `function_call_output`, `reasoning`
- `event_msg`: `task_started`, `user_message`, `token_count`, `agent_message`, `turn_aborted`

## Entry Types Consumed By The Monitor Backend

monitor backend가 transcript line을 `SessionEntrySnapshot`으로 승격하는 타입은 `src-tauri/src/support/text_entry_snapshot.rs` 기준 아래와 같다.

- `message`
- `function_call`
- `function_call_output`
- `custom_tool_call`
- `custom_tool_call_output`
- `web_search_call`
- `reasoning`
- `task_started`
- `task_complete`
- `agent_message`
- `context_compacted`
- `turn_aborted`
- `thread_rolled_back`
- `agent_reasoning`
- `item_completed`
- `token_count`
- top-level `compacted`

즉, Codex가 저장하는 raw event universe가 곧바로 monitor read model이 되는 것은 아니다. monitor는 일부 payload만 골라서 snapshot으로 재구성한다.

`ghost_snapshot`, `tool_search_output`, 일부 top-level helper record처럼 `SessionEntrySnapshot`으로 승격되지 않는 family는 현재 의도적으로 무시된다. raw transcript에 존재하더라도 monitor summary/status/entry 계산에 직접 참여하지 않는 값은 read model로 승격하지 않는다.

## Session Lifecycle And Read Paths

현재 monitor backend의 세션 관리 로직은 live와 archived에서 비대칭적으로 동작한다. live root는 source/path/workspace 기준으로 더 엄격하게 필터링되고, archived root는 `archived_sessions` 스캔을 entry point로 삼으며 subagent attachment 범위도 더 좁다.

### Recent Live Index

1. 최신 state DB를 고른다.
2. `threads WHERE archived = 0`을 `updated_at DESC, id DESC`로 읽는다.
3. source가 monitor 지원 목록(`desktop`, `cli`, `vscode`)인지 확인한다.
4. `rollout_path`가 실제 `~/.codex/sessions` 아래 canonical path인지 검증한다.
5. workspace identity를 복원할 수 있는 row만 남긴다.
6. 각 JSONL에 대해:
   - 앞부분 `80` lines까지만 prefix scan해서 `model`, `first_user_message`, `title`을 추출한다.
   - 뒤에서 `131072` bytes를 읽고 최대 `120` entry까지만 tail scan해서 `updated_at`, `status`, `last_event_summary`를 추출한다.
7. `title == "새 스레드" && first_user_message == null && last_event_summary == "No event summary yet."` 인 boot thread는 숨긴다.
8. 최대 `24`개까지만 recent index에 노출한다.

즉, recent 목록은 "SQLite 정렬 + 가벼운 JSONL 보강" 구조다.

### Live Snapshot

live snapshot 하나를 열 때는 다음을 수행한다.

1. 선택된 `file_path`가 `~/.codex/sessions` 아래인지 canonical path로 검증
2. 해당 JSONL 전체를 읽어 main session snapshot 구성
3. SQLite `thread_spawn_edges`에서 child candidate를 먼저 읽는다.
4. edge가 비어 있거나 sparse한 경우 `threads.source`에 직렬화된 subagent provenance를 추가 힌트로 읽는다.
5. SQLite 힌트로 검증 가능한 child가 없을 때만 `~/.codex/sessions` 전체 JSONL을 마지막 fallback으로 재귀 스캔한다.
6. 실제 attach는 항상 JSONL `thread_spawn` 메타를 다시 읽어 `parent_thread_id`가 현재 session 또는 `forked_from_id`와 맞는지 검증한 뒤 수행한다.

즉, live snapshot은 이제 "SQLite 힌트 우선 + JSONL 검증 + 필요 시만 전체 scan" 구조다.

### Archived Index

archived index는 SQLite `threads`보다 `archived_sessions` 디렉터리 스캔이 기준이다.

1. `~/.codex/archived_sessions` 전체 JSONL을 재귀 수집
2. 각 파일의 첫 `session_meta`를 읽고 subagent session은 제외
3. live와 달리 source가 supported live set에 포함될 필요는 없고, 비어 있지 않은 string source면 root 후보가 될 수 있다.
4. 파일당 최대 `50` lines까지만 훑어 model / first user message를 추출
5. command layer가 필요할 때 이 결과 벡터를 `ArchivedIndexCache`에 저장한다.

현재 구현상 archived index item의 `updatedAt`은 별도 계산 없이 `startedAt`과 같은 값으로 채워지고, `messageCount`도 `0`으로 유지된다.

### Archived Snapshot

archived snapshot은 live보다 좁은 범위를 훑는다.

1. 선택된 `file_path`가 `~/.codex/archived_sessions` 아래인지 canonical path로 검증
2. 대상 archived JSONL 전체를 읽어 main snapshot 구성
3. live snapshot과 같은 subagent resolver를 호출한다.
4. SQLite `thread_spawn_edges`와 `threads.source`에서 archived root와 매칭되는 child 힌트를 먼저 시도한다.
5. SQLite 힌트로 검증 가능한 child가 없을 때만 `~/.codex/archived_sessions` 전체를 재귀 스캔한다.

즉, archived snapshot도 sibling-only heuristic 대신 shared relationship policy를 사용한다. root discovery는 여전히 archived JSONL 스캔이 source of truth지만, subagent attachment는 live와 같은 규칙으로 정리됐다.

## Cache Behavior

현재 command layer 캐시 정책은 비대칭이다.

- `load_recent_session_index`: 캐시 없음
- `load_recent_session_snapshot`: 캐시 없음
- `load_archived_session_index`: `ArchivedIndexCache` 사용
- `load_archived_session_snapshot`: 캐시 없음
- `refresh_archived_session_index`: archived cache만 clear

즉, recent는 항상 최신 디스크 상태를 우선하고, archived index만 메모리 캐시를 쓴다.

## Side Index Files

### `session_index.jsonl`

현재 관찰된 row shape:

```json
{
  "id": "<thread_id>",
  "thread_name": "<short summary>",
  "updated_at": "<iso8601>"
}
```

이 파일은 canonical full index가 아니다.

- `threads.title`과 달리 `thread_name`은 짧은 요약 문구다.
- 로컬 샘플에서는 `session_index.jsonl`이 한 자리 수 line인 동안 `threads`는 수천 row였다.
- monitor backend는 이 파일을 읽지 않는다.

### `.codex-global-state.json`

workspace roots, prompt history, app persistence가 섞여 있는 전역 상태 파일이다. session transcript나 canonical thread index가 아니라 global app state 성격이 강하다.

## Confirmed vs Observed

이 문서는 다음 구분을 따른다.

- confirmed:
  - 로컬 `~/.codex` 실파일/실DB에서 직접 확인한 스키마와 예시
  - 현재 저장소의 Rust backend가 실제로 읽는 경로와 필드
- observed but not promoted to hard claim:
  - log DB가 두 군데 보인다는 사실 이후의 writer/rotation 해석
  - monitor backend가 아직 읽지 않는 부가 table의 장기 용도

핵심 요약은 다음 한 줄로 압축된다.

`Codex session = transcript JSONL + SQLite thread index/metadata + optional side indexes`, 그리고 monitor backend는 live에서는 SQLite를 entry point로, archived에서는 archived JSONL 디렉터리 스캔을 entry point로 사용한다.
