# Technical Specification

## Context and evidence

- 캡처 일시: `2026-03-14T10:20:05Z`
- 공식 개념 근거:
  - [Codex app](https://developers.openai.com/codex/app/)
  - [Multi-agents](https://developers.openai.com/codex/concepts/multi-agents/)
  - [Tracing - OpenAI Agents SDK](https://openai.github.io/openai-agents-python/tracing/)
  - [Overview | OpenTelemetry](https://opentelemetry.io/docs/specs/otel/overview/)
  - [Semantic conventions for OpenAI client operations | OpenTelemetry](https://opentelemetry.io/docs/specs/semconv/gen-ai/openai/)
  - [Handling sensitive data | OpenTelemetry](https://opentelemetry.io/docs/security/handling-sensitive-data/)
  - [Tracing Data Model in Langfuse](https://langfuse.com/docs/observability/data-model)

## Quality preflight

- verdict: `orchestrated-task`
- 현재 UI root는 `src/App.tsx`가 얇은 composition만 담당하고 있다.
- 현재 shell/style 결합 지점은 `src/app/MonitorApp.tsx`, `src/app/useMonitorAppState.ts`, `src/app/app.css`, `src/shared/domain/*`, `src/app/session-log-loader/*` 쪽에 집중되어 있다.
- `src/main.tsx`는 bootstrap only entry이므로 안정 경계로 유지한다.
- `src-tauri/`는 runtime container지만 v0.1 shell/trace workbench 구현 초기에는 주 변경 대상이 아니다.
- 예상 post-change LOC는 append-only 기준으로 `src/app`와 `src/shared/domain`이 급격히 비대화되기 쉬우므로 FSD 분리 없이는 유지보수가 어렵다.
- split-first: true. `src/app`, `src/pages`, `src/widgets`, `src/features`, `src/entities`, `src/shared`에 책임을 분산하지 않은 채 append-only로 기능을 누적하지 않는다.

| Existing file | Current role | Post-change risk | Decision |
| --- | --- | --- | --- |
| `src/App.tsx` | root composition only | 낮음 | root composition only 유지 |
| `src/app/MonitorApp.tsx` | monitor shell + page orchestration | app, page, widget 책임이 뒤섞일 위험 | `pages/monitor`로 이동 |
| `src/app/app.css` | shell + widget styles | layout, drawer, graph, inspector 스타일이 한 파일에 공존 | widget별 CSS로 분리 |
| `src/shared/domain/*` | mixed domain DTO + selectors | entity model과 widget model이 한 파일군에 공존 | `entities`와 widget model로 분해 |
| `src/main.tsx` | app bootstrap | 낮음 | 그대로 유지 |

## FSD boundary model

- target layers are `app / pages / widgets / features / entities / shared`.
- `processes` is intentionally not part of the v0.1 plan.
- `src/app/` is bootstrap only after migration. Page orchestration lives in `src/pages/monitor/`.
- `src/widgets/` owns the screen blocks: run tree, graph, inspector, shell, drawer.
- `src/features/` owns user actions: archive session, import run, follow live, search focus, workspace identity override, view-mode toggles.
- `src/entities/` owns run/session/workspace/archive-session and session-log models, selectors, and adapters.
- `src/shared/domain/` is transitional and should be dismantled into `entities/*` and widget-local `model` modules.
- `src/shared/*` keeps primitives, theme, lib helpers, and testing assets only.

```mermaid
flowchart TB
  App["src/app"] --> Page["src/pages/monitor"]
  Page --> Widgets["src/widgets/*"]
  Widgets --> Features["src/features/*"]
  Features --> Entities["src/entities/*"]
  Entities --> Shared["src/shared/*"]
```

## Normalized trace domain model

- 핵심 entity는 `Project`, `Session`, `Run`, `AgentLane`, `Event`, `Edge`, `Artifact`다.
- tree hierarchy는 `Project -> Session -> Run -> AgentLane -> Event`다.
- link hierarchy는 `Edge`를 통해 `spawn`, `handoff`, `transfer`, `merge`를 추가 연결한다.
- `wait_reason`는 `waiting`, `blocked`, `interrupted` 상태에서 필수다.

| Entity | Required ids | Core fields |
| --- | --- | --- |
| `Project` | `project_id` | `name`, `repo_path`, `badge` |
| `Session` | `session_id` | `title`, `owner`, `started_at` |
| `Run` | `trace_id` | `status`, `start_ts`, `end_ts`, `duration_ms`, `summary_metrics` |
| `AgentLane` | `agent_id`, `thread_id` | `role`, `model`, `provider`, `lane_status` |
| `Event` | `event_id`, `parent_id`, `link_ids[]` | `event_type`, `status`, `wait_reason`, `retry_count`, `start_ts`, `end_ts`, `payload previews` |
| `Edge` | `edge_id` | `edge_type`, `source_agent_id`, `target_agent_id`, `source_event_id`, `target_event_id` |
| `Artifact` | `artifact_id` | `title`, `artifact_ref`, `producer_event_id`, `preview` |

- lifecycle status는 `queued -> running -> waiting | blocked | interrupted -> done | failed | cancelled`를 사용한다.
- v0.1 event type은 아래 집합으로 고정한다.
  - `run.started`
  - `run.finished`
  - `run.failed`
  - `run.cancelled`
  - `agent.spawned`
  - `agent.state_changed`
  - `agent.finished`
  - `llm.started`
  - `llm.finished`
  - `tool.started`
  - `tool.finished`
  - `handoff`
  - `transfer`
  - `error`
  - `note`

### Event field groups

- identity: `project_id`, `session_id`, `trace_id`, `event_id`, `agent_id`, `thread_id`, `parent_id`, `link_ids[]`
- time: `start_ts`, `end_ts`, `duration_ms`
- state: `event_type`, `status`, `wait_reason`, `retry_count`
- routing: `source_agent_id`, `target_agent_id`, `edge_type`
- model/tool: `provider`, `model`, `tool_name`, `api_type`
- usage: `tokens_in`, `tokens_out`, `cache_read_tokens`, `cache_write_tokens`, `cost_usd`, `finish_reason`
- payload: `title`, `input_preview`, `output_preview`, `artifact_ref`, `error_code`, `error_message`

```mermaid
flowchart LR
  Import["Completed run import"] --> Parser["Parser"]
  Watch["Live watch tail"] --> Parser
  Parser --> Normalizer["Normalizer"]
  Normalizer --> Redactor["Redaction / masking"]
  Redactor --> Store["Local normalized store"]
  Store --> Selectors["Derived metrics + selectors"]
  Selectors --> Graph["Graph renderer"]
  Selectors --> Waterfall["Waterfall renderer"]
  Selectors --> Map["Map renderer"]
  Selectors --> Inspector["Inspector"]
```

## Derived metrics and selectors

- summary strip는 `total duration`, `active time`, `idle time`, `agent count`, `peak parallelism`, `llm calls`, `tool calls`, `tokens`, `cost`, `error count`를 계산한다.
- anomaly jump bar는 `first error`, `longest wait`, `most expensive step`, `last handoff`, `final artifact`를 selector로 계산한다.
- gap folding은 lane별 idle segment를 merge한 뒤 `hidden duration`, `idle lane count`, `expandable row index`로 보관한다.
- graph/waterfall/map는 공통 normalized dataset을 공유하고 renderer만 다르게 둔다.

## Ingestion and masking pipeline

- v0.1 입력 경로는 `completed-run import`, `live watch tail` 두 개뿐이다.
- source format은 JSONL 또는 custom event stream이어도 UI 진입 전에는 하나의 normalized schema로 바꾼다.
- redaction 단계는 parser 직후, persistence 이전에 실행한다.
- 기본 저장 정책:
  - preview만 저장
  - raw prompt/tool output은 opt-in
  - project 단위 `no raw storage` 스위치 제공
  - export는 raw 제외 default
- live watch는 reconnect tolerant 해야 하며 partial parse failure를 `error` event로 남긴다.

## Renderer boundaries and split-first file plan

- `src/app/`는 bootstrap only다.
- `src/pages/monitor/`는 page composition과 page-local orchestration을 담당한다.
- `src/widgets/run-tree/`, `src/widgets/causal-graph/`, `src/widgets/inspector/`, `src/widgets/monitor-shell/`, `src/widgets/bottom-drawer/`는 screen-scale view blocks를 담당한다.
- `src/features/archive-session/`, `src/features/import-run/`, `src/features/follow-live/`, `src/features/search-focus/`, `src/features/workspace-identity/`, `src/features/view-mode-toggle/`는 user action slices를 담당한다.
- `src/entities/run/`, `src/entities/session-log/`, `src/entities/workspace/`, `src/entities/archive-session/`는 normalized models, selectors, adapters를 담당한다.
- `src/shared/domain/`은 migration-only aggregation으로 보고 최종적으로 해체한다.
- `src/shared/ui/`, `src/shared/lib/`, `src/shared/testing/`, `src/theme/*`는 공용 primitive, helper, fixture, token layer를 담당한다.

`FSD boundary note`: `../../docs/architecture/frontend-fsd.md`

```mermaid
flowchart TD
  App["App root"] --> Page["Monitor page"]
  Page --> Shell["Desktop shell"]
  Shell --> Rail["Run tree widget"]
  Shell --> Workbench["Graph workbench widget"]
  Workbench --> Summary["Summary strip + jump bar"]
  Workbench --> Mode["Graph / Waterfall / Map widgets"]
  Workbench --> Inspector["Inspector widget"]
  Mode --> GraphRenderer["Graph renderer"]
  Mode --> WaterfallRenderer["Waterfall renderer"]
  Mode --> MapRenderer["Map renderer"]
  Shell --> Drawer["Bottom drawer widget"]
```

- target-file append 금지 규칙:
  - `src/App.tsx`는 composition만 유지한다.
  - `src/app/app.css`는 starter-era shell 파일을 계속 확장하지 않는다.
  - parser/normalizer/storage/UI selector는 같은 파일에 같이 두지 않는다.
  - `shared/domain`을 새 catch-all으로 재생성하지 않는다.

## Performance and degradation

- lane `> 8`, event `> 120`, repeated edge `> 40`, map node `> 20`에서 degradation 규칙을 활성화한다.
- graph hover highlight는 direct path 우선 계산 후 필요 시 확장한다.
- summary metrics는 renderer와 분리된 selector layer에서 계산해 mode toggle 비용을 줄인다.

## Privacy and operability

- sensitive payload는 preview-first, raw opt-in 원칙을 유지한다.
- inspector raw tab은 explicit permission 또는 import flag가 없으면 숨긴다.
- masking/redaction hook는 event 단위로 실행 가능해야 한다.
- operability summary는 stale/disconnected, parse error, missing fields, schema drift를 명시적으로 surface 해야 한다.

## Deferred scope

- cross-run comparison
- team analytics dashboard
- full diff viewer
- prompt playground
- sampling policy UI
