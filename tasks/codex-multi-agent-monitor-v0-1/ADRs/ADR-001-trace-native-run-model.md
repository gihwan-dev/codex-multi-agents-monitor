# ADR-001: Use A Trace-Native Run Model With Tree + Links

- Status: Accepted
- Date: 2026-03-14

## Context

멀티에이전트 run은 단순 parent-child tree만으로 설명되지 않는다. spawn은 tree로 읽히지만 handoff, transfer, merge, fork-join은 별도 link semantics가 필요하다. 또한 v0.1은 completed-run import와 live watch를 같은 dataset으로 읽어야 한다.

## Decision

- 내부 canonical model을 `Project -> Session -> Run -> AgentLane -> Event` tree로 둔다.
- `Edge`를 별도 object로 도입해 `spawn`, `handoff`, `transfer`, `merge`를 source/target 기반 link로 표현한다.
- event schema는 OTel/OpenAI/Langfuse mental model과 호환되는 OTel-like naming을 따르되 내부 UI 친화 필드(`wait_reason`, `input_preview`, `output_preview`, `artifact_ref`)를 유지한다.
- `waiting`, `blocked`, `interrupted` 상태에는 `wait_reason`를 필수로 둔다.

## Consequences

- JSONL/custom stream에서 시작해도 OTLP bridge나 vendor adapter를 나중에 붙이기 쉬워진다.
- UI는 tree view와 relationship view를 같은 dataset에서 파생할 수 있다.
- normalization layer와 redaction layer가 필수 컴포넌트가 된다.
