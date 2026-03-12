# ADR-002: Use a custom SVG sequence timeline instead of a general graph editor

- Status: accepted
- Related IDs: `ADR-002`, `REQ-003`, `REQ-004`, `REQ-010`

## Context

요구사항은 draw.io 수준의 범용 그래프 편집이 아니라, lane과 시간 축을 갖는 observability timeline이다. 핵심은 자유 배치보다 duration scaling, long-running span visibility, zoom-level summary, and drill-down readability다.

## Decision

- v1 timeline은 custom SVG renderer로 구현한다.
- zoom/pan은 viewport transform 전용으로 제공한다.
- low zoom에서는 aggregate spans만, high zoom에서는 상세 span과 payload preview를 보인다.
- large sidebar/result set은 virtualization을 사용하되, timeline canvas는 visible-range culling을 사용한다.

## Consequences

- 장점:
  - time-axis semantics에 맞는 projection이 가능하다.
  - draw.io 같은 불필요한 편집 복잡도를 피한다.
  - level-of-detail 설계가 자연스럽다.
- 비용:
  - renderer와 interaction layer를 직접 만들어야 한다.
  - very large dataset에서 추가 culling 전략이 필요할 수 있다.

## Rejected alternatives

- React Flow를 v1 renderer로 채택
  - reason: viewport와 graph 성능 참고에는 유용하지만, v1 요구는 자유 그래프보다 시계열 sequence projection이 핵심이다.
- Canvas-only renderer
  - reason: text selection, accessibility, debug inspectability를 초기에 희생하고 싶지 않다.
