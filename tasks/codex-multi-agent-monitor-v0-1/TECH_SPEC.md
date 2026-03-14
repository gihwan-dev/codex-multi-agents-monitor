# Codex Multi-Agent Monitor v0.1 Tech Spec

## Technical objective

v0.1은 vendor-agnostic한 normalized trace envelope를 중심으로 completed import와 local watch를 같은 내부 모델로 수렴시키고, 그 결과를 Graph, Waterfall, Map read model로 재구성하는 desktop monitoring workbench를 목표로 한다.

## Concept mapping

| Internal model | Codex / OpenAI | OpenTelemetry | Langfuse | 역할 |
| --- | --- | --- | --- | --- |
| `Project` | project/workspace | resource scope 일부와 유사 | project grouping | repo/workspace 식별 |
| `Session` | thread 또는 작업 맥락 | trace collection grouping | session | multi-turn task 묶음 |
| `RunTrace` | run | trace | trace | 상세 화면 단위 |
| `AgentLane` | sub-agent thread | parent span lineage 일부 | agent graph node 관점 | lane 단위 실행 주체 |
| `EventObservation` | LLM/tool/handoff/custom event | span/event | observation | 의미 있는 단계 |
| `EdgeLink` | handoff/transfer/merge | span link | graph edge | parent-child 외 인과 관계 |

## Architecture boundaries

- ingest adapters: `import`와 `watch`의 입력 차이를 absorber로 처리
- normalizer: vendor-specific payload를 internal schema로 변환
- store: run detail query에 최적화된 normalized store
- read model composer: Graph/Waterfall/Map 전용 view model 생성
- privacy layer: preview/raw policy, redaction hook, export filter

## Ingest pipeline

### Import path

1. completed run file 선택
2. parser가 raw event stream을 읽음
3. normalizer가 `schema.json` 구조로 변환
4. validation이 required field와 enum을 확인
5. store에 write 후 summary/read model 생성

### Local watch path

1. local tail/watch source 등록
2. adapter가 append-only event를 incremental하게 수신
3. normalizer가 동일한 schema로 upsert
4. summary/read model을 incremental recompute
5. UI가 live mode로 follow

## Normalization rules

- run identity는 `project_id`, `session_id`, `trace_id`로 고정한다.
- event identity는 `event_id` 단일 키로 식별하고 `parent_id`와 `link_ids`를 분리 보관한다.
- `EventObservation`은 stable-shape envelope다. non-applicable field는 omitted가 아니라 explicit `null`로 유지해 import와 watch가 같은 key set을 보장한다.
- handoff와 transfer는 같은 arrow가 아니라 다른 `edge_type`으로 유지한다.
- `waiting`, `blocked`, `interrupted` 상태는 모두 `wait_reason`을 요구한다.
- payload는 기본적으로 preview만 저장하고 raw는 opt-in으로만 참조한다.

## Store and read model

### Canonical store

- project/session/run/lane/event/edge를 entity별로 저장
- derived summary는 canonical store에서 계산
- event ordering은 `start_ts`, 동률 시 `event_id`로 안정화

### View model

- Run List summary row
- Graph row + lane layout data
- Waterfall bar model
- Map node/edge aggregate
- Inspector detail payload

## Summary aggregation

summary contract는 아래 필드를 사용한다.

- `duration`
- `active_time`
- `idle_time`
- `agent_count`
- `peak_parallelism`
- `llm_calls`
- `tool_calls`
- `total_tokens`
- `total_cost`
- `error_count`

집계 규칙:

- `active_time`은 event duration 합계의 lane-aware union 기준으로 계산한다.
- `idle_time`은 run duration에서 active union을 뺀 값이다.
- `peak_parallelism`은 겹치는 active event 수의 최댓값이다.
- `error_count`는 `run.failed`, `error`, `failed` status event를 포함한다.

## Graph composition

- tree: `parent_id`로 event lineage를 구성한다.
- link: `link_ids`와 `edges[]`로 handoff, transfer, merge를 별도 표현한다.
- lane membership: 각 event는 정확히 하나의 `thread_id`/`lane_id`에 속한다.
- Graph mode는 compressed row order를 우선하고, Waterfall은 wall-clock duration을 우선한다.

## Privacy and export policy

- 기본 저장은 preview-only
- raw prompt/tool output은 opt-in
- project 단위 sensitive storage off를 지원
- export 기본값은 raw excluded
- event 단위 redaction hook을 normalizer 직후에 적용한다

## Versioning and contract policy

- `schema.json`은 v0.1 internal contract다.
- top-level `schema_version`으로 하위 호환 여부를 판단한다.
- stable contract를 유지하기 위해 `EventObservation`의 non-applicable normalized field는 누락하지 않고 `null`로 직렬화한다.
- adapter는 raw source format과 internal schema 사이의 유일한 translation layer다.
- direct Codex runtime coupling은 후속 adapter로만 추가한다.

## Performance assumptions

- run 하나의 기본 관찰 목표는 단일 desktop session에서 즉시 읽히는 수준이다.
- Graph mode는 full zoom chart보다 scan speed를 우선한다.
- gap folding은 long idle section이 있을 때만 적용한다.
- live watch는 low-latency append를 우선하고, expensive recompute는 summary delta 계산으로 제한한다.

## Implementation notes

- `SLICE-1`과 `SLICE-2`는 real API/integration 없이 mock data로 UX shell을 고정한다.
- `SLICE-3`에서 import adapter와 normalized store를 붙인다.
- `SLICE-4`에서 local watch와 privacy/export policy를 연결한다.

## References

- Codex app, multi-agents
- OpenTelemetry overview, trace API, handling sensitive data
- Langfuse data model, agent graphs
- OpenAI Agents SDK tracing
