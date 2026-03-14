# ADR-001 Hybrid Trace Model

- Traceability ID: `ADR-001`
- Related requirements: `REQ-02`, `REQ-04`

## Context

멀티 에이전트 run은 spawn처럼 tree 구조로 읽히는 관계와, handoff/transfer/merge처럼 link로 읽히는 관계가 동시에 존재한다. parent-child만으로는 artifact transfer와 scatter/gather를 충분히 설명할 수 없다.

## Decision

v0.1 내부 모델은 tree와 link를 병행하는 hybrid trace model을 채택한다.

- lineage는 `parent_id`로 표현한다.
- cross-lane causality는 `EdgeLink`와 `link_ids`로 표현한다.
- edge semantics는 `spawn`, `handoff`, `transfer`, `merge`를 유지한다.

## Consequences

- Graph mode가 spawn tree와 handoff/transfer를 동시에 읽을 수 있다.
- Waterfall과 Map도 같은 canonical edge data를 재사용할 수 있다.
- schema와 read model이 단순 span tree보다 복잡해진다.

## Alternatives

- pure tree model: handoff/transfer semantics 손실로 기각
- pure graph model: lineage 읽기가 어려워져 기각
