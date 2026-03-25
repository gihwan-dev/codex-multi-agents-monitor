# Codex 데이터 저장소 구조

Codex CLI(`~/.codex/`)의 데이터 구조와 본 앱의 Rust 백엔드가 이를 읽는 방식을 정리한다.

## 디렉토리 레이아웃

```
~/.codex/
├── state_5.sqlite          # 핵심 상태 DB (threads, logs, spawn edges)
├── logs_1.sqlite           # 애플리케이션 이벤트 로그
├── sqlite/codex-dev.db     # Desktop 앱 메타 (automations, inbox)
│
├── sessions/               # 최근/라이브 세션 JSONL (날짜별 정리)
│   └── YYYY/MM/DD/
│       └── rollout-{ISO}-{UUIDv7}.jsonl
│
├── archived_sessions/      # 아카이브 세션 JSONL (flat directory)
│   └── rollout-{ISO}-{UUIDv7}.jsonl
│
├── session_index.jsonl     # 최근 세션 캐시 인덱스 (경량)
├── history.jsonl           # 사용자 입력 히스토리
├── config.toml             # 설정 (모델, MCP 서버, 프로필 등)
├── auth.json               # 인증 정보 (암호화)
├── internal_storage.json   # 내부 플래그
├── automations/            # 자동화 설정
├── skills/                 # 설치된 스킬
├── agents/                 # 에이전트 설정 참조
├── shell_snapshots/        # 터미널 출력 스냅샷
├── cache/                  # 런타임 캐시
└── log/                    # 애플리케이션 로그
```

## SQLite 데이터베이스

### state_N.sqlite (핵심 상태)

가장 최근 수정된 `state_*.sqlite` 파일이 사용된다. READ_ONLY로 연다.

#### threads 테이블

세션/스레드 메타데이터. `archived = 0`이면 라이브, `1`이면 아카이브.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | TEXT PK | 세션 UUID (UUIDv7) |
| `rollout_path` | TEXT | JSONL 파일 경로 |
| `created_at` | INTEGER | 생성 타임스탬프 |
| `updated_at` | INTEGER | 최종 갱신 타임스탬프 |
| `source` | TEXT | "vscode", "cli", "desktop" |
| `cwd` | TEXT | 작업 디렉토리 |
| `title` | TEXT | 세션 제목 |
| `archived` | INTEGER | 0=라이브, 1=아카이브 |
| `agent_nickname` | TEXT | 서브에이전트 닉네임 (nullable) |
| `agent_role` | TEXT | 서브에이전트 역할 (nullable) |
| `model` | TEXT | 사용 모델 (e.g., "gpt-5.4") |
| `first_user_message` | TEXT | 첫 사용자 메시지 (500자) |

#### thread_spawn_edges 테이블

부모-자식 스레드 관계. **인덱스 포함.**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `parent_thread_id` | TEXT | 부모 세션 UUID |
| `child_thread_id` | TEXT PK | 자식 세션 UUID |
| `status` | TEXT | 관계 상태 |

인덱스: `idx_thread_spawn_edges_parent_status(parent_thread_id, status)`

> **참고:** 현재 이 테이블은 비어 있을 수 있다. Codex CLI 버전에 따라 채워지는 시점이 다르다.

#### logs 테이블

애플리케이션 진단 로그 (901K+ rows).

### logs_1.sqlite (이벤트 로그)

| 테이블 | rows | 설명 |
|--------|------|------|
| `logs` | 526K+ | 구조화된 이벤트 로그 (`ts`, `level`, `target`, `thread_id`) |

### sqlite/codex-dev.db (Desktop 메타)

| 테이블 | 설명 |
|--------|------|
| `automations` | 자동화 스케줄 (rrule, prompt, cwds) |
| `automation_runs` | 자동화 실행 이력 |
| `inbox_items` | 알림 인박스 |

## JSONL 세션 로그 포맷

각 세션은 하나의 `.jsonl` 파일. 각 줄은 독립 JSON 객체.

### 줄 타입 (type 필드)

| type | 설명 |
|------|------|
| `session_meta` | 세션 초기화 메타 (첫 줄) |
| `event_msg` | 턴 시작/종료/사용자 메시지 |
| `response_item` | LLM 응답, 함수 호출, 함수 결과 |
| `turn_context` | 턴 설정 (모델, 샌드박스, 승인 정책) |

### session_meta 구조 (부모 세션)

```jsonc
{
  "type": "session_meta",
  "timestamp": "2026-03-07T05:45:04Z",
  "payload": {
    "id": "019cc6d3-...",              // 세션 UUID
    "timestamp": "2026-03-07T05:44:48Z",
    "cwd": "/Users/.../project",
    "originator": "Codex Desktop",
    "cli_version": "0.108.0-alpha.12",
    "source": "vscode",               // "vscode" | "cli" | "desktop"
    "model_provider": "openai",
    "base_instructions": { "text": "..." }
  }
}
```

### session_meta 구조 (서브에이전트 세션)

```jsonc
{
  "type": "session_meta",
  "payload": {
    "id": "019cc6d5-...",              // 서브에이전트 UUID
    "forked_from_id": "019cc6d3-...", // 부모 세션 UUID
    "agent_nickname": "Helmholtz",
    "agent_role": "explorer",
    "source": {
      "subagent": {
        "thread_spawn": {
          "parent_thread_id": "019cc6d3-...",
          "depth": 1,
          "agent_nickname": "Helmholtz",
          "agent_role": "explorer"
        }
      }
    }
  }
}
```

### 부모-자식 연결 방식

서브에이전트 세션 파일의 구조:
1. **Fork context**: 부모 세션의 `session_meta` + 부모 턴 엔트리 복제
2. **Fork boundary**: 두 번째 `session_meta` (서브에이전트 자신의 메타)
3. **서브에이전트 엔트리**: fork boundary 이후의 고유 엔트리

Rust 백엔드의 `SubagentCollector`는 `past_fork_boundary` 플래그로 fork context를 제거한다.

### event_msg payload.type 값

| payload.type | 설명 |
|---|---|
| `task_started` | 턴 시작 (`turn_id`, `model_context_window`) |
| `task_complete` | 턴 종료 (`turn_id`, `last_agent_message`) |
| `user_message` | 사용자 입력 (`message`, `images`) |
| `token_count` | 토큰 사용량/레이트 리밋 |

### response_item payload.type 값

| payload.type | 설명 |
|---|---|
| `message` | 텍스트 메시지 (`role`, `content[]`) |
| `function_call` | 도구 호출 (`name`, `call_id`, `arguments`) |
| `function_call_output` | 도구 결과 (`call_id`, `output`) |

## Rust 백엔드 데이터 접근 패턴

### 라이브 세션 로딩

```
state_N.sqlite → threads WHERE archived=0
  ↓
LiveThreadRow[] (id, rollout_path, source, cwd)
  ↓ parse_recent_index_entry()  [첫 80줄 + 마지막 128KB]
RecentSessionIndexItem (사이드바 표시용 경량 데이터)
  ↓ parse_live_session_snapshot()  [전체 파싱]
SessionLogSnapshot
  ↓ append_recent_subagents()  [sessions/ 전체 스캔!]
SessionLogSnapshot { subagents: [...] }
```

### 아카이브 세션 로딩

```
~/.codex/archived_sessions/*.jsonl
  ↓ collect_jsonl_files()  [재귀 수집]
  ↓ parse_archived_index_entry()  [첫 50줄]
ArchivedSessionIndex[] (사이드바 표시용)
  ↓ parse_archived_session_snapshot()  [전체 파싱]
SessionLogSnapshot
  ↓ collect_archived_subagents()  [같은 디렉토리 전체 스캔!]
SessionLogSnapshot { subagents: [...] }
```

### 서브에이전트 탐색 (현재 구현)

세션 1개 로드 시:
1. 디렉토리 내 **모든 `.jsonl` 파일** 수집
2. 각 파일의 **첫 줄을 열어** `session_meta` 파싱
3. `source.subagent.thread_spawn.parent_thread_id` 매칭 확인
4. 매칭되면 `SubagentSnapshot`으로 파싱

**문제점:** O(n) brute-force 스캔. archived_sessions에 2000+ 파일이면 세션 하나 로드에 2000번 파일 I/O.

### Tauri 명령 API

| 명령 | 입력 | 출력 |
|------|------|------|
| `load_recent_session_index` | - | `Vec<RecentSessionIndexItem>` |
| `load_recent_session_snapshot` | `filePath` | `SessionLogSnapshot` |
| `load_archived_session_index` | `{offset, limit, search}` | `ArchivedSessionIndexResult` |
| `load_archived_session_snapshot` | `filePath` | `SessionLogSnapshot` |

## 최적화 기회

### thread_spawn_edges 테이블 (현재 비어 있음)

`state_5.sqlite`에 `thread_spawn_edges` 테이블과 인덱스가 존재하지만, Codex CLI가 아직 이 테이블을 채우지 않고 있다 (0 rows). 향후 채워지면 직접 활용 가능.

### threads.source 컬럼 (현재 사용 가능)

서브에이전트 스레드의 `source` 컬럼에 `parent_thread_id`가 JSON으로 저장되어 있다:

```sql
-- 부모 세션의 모든 서브에이전트 + 파일 경로를 즉시 조회 (검증 완료)
SELECT id, agent_nickname, agent_role, rollout_path
FROM threads
WHERE source LIKE '%{parent_session_id}%';
```

> `json_extract()`는 부모 세션의 `source`가 순수 문자열(`"vscode"`)이라 malformed JSON 에러가 발생한다. `LIKE`가 더 안정적.

이를 활용하면 디렉토리 전체 스캔(2187+ 파일 I/O) 없이 서브에이전트를 즉시 찾을 수 있다. 관련 이슈: #42

## 스캔 리밋 & 인덱스 정책

Rust 백엔드의 JSONL 파싱은 전체 파일을 읽지 않고 제한된 범위만 스캔한다.

| 상수 | 값 | 용도 |
|------|---|------|
| `MAX_RECENT_SESSIONS` | 24 | 사이드바 최근 세션 최대 수 |
| `RECENT_INDEX_PREFIX_SCAN_LIMIT` | 80 | JSONL 파일 앞에서 스캔하는 줄 수 |
| `RECENT_INDEX_TAIL_BYTES` | 128 KB | JSONL 파일 끝에서 읽는 바이트 수 |
| `RECENT_INDEX_TAIL_ENTRY_LIMIT` | 120 | tail 버퍼에서 파싱하는 최대 엔트리 수 |
| `ARCHIVED_INDEX_SCAN_LIMIT` | 50 | 아카이브 인덱스 스캔 줄 수 |

아카이브 인덱스는 `ArchivedIndexCache`(in-memory Mutex)로 캐싱된다. `refresh_archived_session_index` 명령 호출 시에만 갱신.

## 프롬프트 어셈블리

세션의 시스템 프롬프트가 어떤 레이어로 구성되는지를 추출한다. `response_item` 엔트리 중 첫 `task_complete` 이전의 developer/system 메시지를 분류한다.

| 콘텐츠 시작 패턴 | layer_type | label |
|---|---|---|
| `<permissions` | `permissions` | Permissions & Sandbox |
| `<app-context>` | `app-context` | App Context |
| `<collaboration_mode>` | `collaboration-mode` | Collaboration Mode |
| `<apps_instructions>` | `apps` | Apps / Connectors |
| `<skills_instructions>` | `skills-catalog` | Skills Catalog |
| `# AGENTS.md instructions` | `agents` | AGENTS.md |
| `<environment_context>` | `environment` | Environment Context |
| `Automation:` | `automation` | Automation Envelope |
| `PLEASE IMPLEMENT THIS PLAN` | `delegated` | Delegated Plan |
| `<skill>` | `skill` | Skill: {name} |
| `<subagent_notification>` | `subagent-notification` | Subagent Notification |

`base_instructions.text`는 별도로 `system / Base Instructions` 레이어로 추출된다.

## 엔트리 스냅샷 빌드

Rust 백엔드가 JSONL 엔트리를 `SessionEntrySnapshot`으로 변환할 때의 특수 처리:

### function_call arguments_preview

| 함수명 | 추출 방식 |
|--------|----------|
| `exec_command` | args에서 `cmd` 필드만 추출 |
| `spawn_agent`, `close_agent` 등 | 전체 args (2000자 제한) |
| `apply_patch` | 패치 헤더에서 파일 경로 요약 |
| 기타 | 첫 200자 |

### message text 추출

`content[]` 배열의 각 항목을 `\n`으로 조인:
- `input_text`, `output_text` → `text` 필드 추출
- `input_image` → `[Image]`로 대체
- 기타 타입 → 스킵

### context_compacted 요약

`replacement_history`에서 역할별 메시지 수와 상위 5개 도구를 집계:
```
"42 messages compacted (3 user, 5 developer, 34 assistant) · tools: exec_command, apply_patch, ..."
```

## 워크스페이스 식별

### Git 해석 전략

1. `.git`이 디렉토리면 → 표준 레포, 경로 정규화
2. `.git`이 파일이면 → linked worktree, `gitdir:` → `commondir` → 부모 레포 해석

### Conductor 워크스페이스 제외

경로에 `["conductor", "workspaces", _, _]` 패턴이 포함되면 라이브 세션에서 제외. Conductor 도구의 격리된 작업 디렉토리가 UI를 오염시키는 것을 방지.

### 라이브 세션 소스 필터

`LIVE_SESSION_SOURCES`: `"desktop"`, `"cli"`, `"vscode"` 만 허용. 다른 source의 스레드는 사이드바에 표시되지 않는다.

## 에러 처리

| 상황 | 동작 |
|------|------|
| JSONL 줄 파싱 실패 | 해당 줄 스킵, 다음 줄 계속 |
| 파일 I/O 에러 | 스캔 중단 (수집된 엔트리만 반환) |
| SQLite 연결 실패 | `io::Error`로 래핑, 호출자에 전파 |
| rollout_path 파일 없음 | `Ok(None)` 반환, 해당 세션 스킵 |
| Git 메타데이터 없음 | 경로 이름으로 폴백 |

## 부가 파일

| 파일/디렉토리 | 설명 |
|---|---|
| `config.toml` | 모델(`gpt-5.4`), 프로필, MCP 서버, `[agents]` (max_depth=1, max_threads=8), 프로젝트 신뢰 수준 |
| `rules/default.rules` | 셸 명령 허용/차단 규칙 (`prefix_rule()` 형식, git/pnpm/gh 등) |
| `history.jsonl` | 사용자 입력 히스토리 (`{session_id, ts, text}`, ~50건) |
| `models_cache.json` | OpenAI 모델 레지스트리 캐시 (50+ 모델, `fetched_at` 포함) |
| `version.json` | 업데이트 확인 (`latest_version`, `last_checked_at`) |
| `.codex-global-state.json` | Electron 앱 상태 (workspace-roots, atom-state 등) |
| `memories/` | 에이전트 메모리 (현재 비어 있음) |
| `shell_snapshots/` | zsh 환경 덤프 (`{UUID}.{ns}.sh`, ~398KB/건) |
| `automations/` | 자동화별 디렉토리 (`automation.toml` + `memory.md`) |
| `skills/` | 스킬 라이브러리 (31개 symlink + 5개 실제 디렉토리) |
| `vendor_imports/` | 공식 스킬 로컬 캐시 (`skills-curated-cache.json`, 50+ 스킬) |
| `worktrees/` | Git worktree 격리 환경 (4자리 hex 이름, 22개) |

## 라이브 세션 폴링 아키텍처

**파일 워칭 없음.** Rust 백엔드에 FSEvents/inotify 등 파일 감시가 없다. 프론트엔드가 2초 간격으로 Tauri RPC를 폴링한다.

```
프론트엔드 (React)
  ↓ LIVE_RECENT_POLL_INTERVAL_MS = 2000ms
  ↓ loadRecentSessionSnapshot(filePath)
Tauri 백엔드 (Rust)
  ↓ parse_live_session_snapshot()  [매번 파일 전체 재파싱]
SessionLogSnapshot
  ↓ 프론트엔드 diff
  ↓ mergeLiveEvents()  [eventId 기반 중복 제거]
UI 갱신
```

### 폴링 조건

다음 조건이 모두 충족될 때만 폴링 활성화:
- 세션이 recent index에 존재
- `isArchived === false`
- `liveMode === "live"`
- `activeFollowLive === true` (사용자가 follow 모드 활성화)

사용자가 이벤트를 클릭하면 `followLive → false`로 전환되어 폴링 중단.

### 라이브 연결 상태

| 상태 | 의미 |
|------|------|
| `live` | 활성 세션, 업데이트 추적 중 |
| `paused` | 활성이지만 사용자가 수동 탐색 중 |
| `stale` | 파일은 있지만 마지막 갱신이 임계값 초과 |
| `disconnected` | 세션 접근 불가 |

## 세션 상태 도출

세션의 `status`는 파일 메타데이터가 아닌 **엔트리 내용 분석**으로 결정된다 (`derive_recent_index_status`):

| 조건 | 상태 |
|------|------|
| 마지막 메시지에 `<turn_aborted>` 태그 | `interrupted` |
| abort 이벤트가 마지막 메시지 이후 발생 | `interrupted` |
| 마지막 메시지가 user role + `task_complete` 없음 | `running` |
| 마지막 메시지가 assistant role 또는 `task_complete` 존재 | `done` |
| 메시지 없음 | `done` (abort 있으면 `interrupted`) |

기본 제목(`DEFAULT_THREAD_TITLE`): `"새 스레드"`. 제목 없는 세션은 사이드바에서 숨겨질 수 있다.

## 프론트엔드 엣지 빌드 알고리즘

백엔드는 엣지를 전송하지 않는다. 프론트엔드가 `SessionLogSnapshot.subagents`에서 재구축한다.

### Spawn 엣지 (서브에이전트 생성)

```
sourceEventId = subagentToSpawnSource.get(sessionId)   // 1순위: 명시적 매핑
             ?? findClosestParentEvent(parentEvents, targetTs)  // 2순위: 시간 기반
             ?? nthSpawnEvent  // 3순위: 위치 기반 폴백
```

- `edgeType`: `"spawn"`
- `edgeId`: `spawn:{sessionId}`
- source: 부모의 `spawn_agent` 호출 이벤트
- target: 서브에이전트의 합성 spawn 이벤트

### Merge 엣지 (서브에이전트 완료)

두 가지 경로:
1. **close_agent**: 단일 `agentId`를 `args.id`에서 읽음
2. **wait_agent / wait**: `args.ids[]` 배열에서 여러 에이전트 읽음

```
sourceEventId = latestSubagentEvent  // 서브에이전트의 마지막 비종료 이벤트
             ?? spawnedEvent         // 폴백: 합성 spawn 이벤트
targetEventId = callEventToOutputEvent.get(callEventId)  // 도구 결과 이벤트
             ?? callEventId          // 폴백: 도구 호출 이벤트 자체
```

- `edgeType`: `"merge"`
- `edgeId`: `merge:close:{sessionId}` 또는 `merge:wait:{sessionId}`

### 세션 링크 맵 구축 (3단계)

1. **buildCallMaps**: 엔트리 스캔 → `callIdToName`, `spawnCallIdToEventId` 인덱스
2. **collectOutputLinks**: function_call_output 파싱 → `callEventToOutputEvent`, `codexAgentIdToSessionId`, `parentFunctionArgsByEventId`
3. **fillMissingSpawnSourceEvents**: 미매핑 spawn 보완 → 시간순 정렬 후 n번째 서브에이전트 ↔ n번째 spawn 이벤트 위치 매칭

## 프론트엔드 데이터 변환 파이프라인

```
SessionLogSnapshot (Tauri RPC)
  ↓ Web Worker (비동기, UI 블로킹 방지)
  ↓ buildDatasetFromSessionLog()
  │
  ├─ buildParentRunContext()     → mainLane, userLane, parentEvents
  ├─ buildSubagentTimeline()     → lanes[], events[], spawn edges[]
  │   ├─ indexSubagents()        → bySessionId, byNickname
  │   └─ buildSessionLinkMaps() → callMaps, outputLinks, spawnLinks
  ├─ buildTimelineEdges()        → spawn + merge edges
  └─ calculateSummaryMetrics()   → peakParallelism, tokenCount 등
  ↓
RunDataset (lanes + events + edges + artifacts + promptAssembly)
  ↓
Monitor state (reducer)
  ↓
Graph / Timeline / Inspector UI
```

> `summaryMetrics`는 Rust가 아닌 프론트엔드에서 EventRecord 그래프로부터 계산된다.
