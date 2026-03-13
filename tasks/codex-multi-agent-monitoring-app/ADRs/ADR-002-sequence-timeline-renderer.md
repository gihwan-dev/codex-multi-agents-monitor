# ADR-002: Use a custom SVG sequence timeline instead of a general graph editor

- Status: accepted
- Related IDs: `ADR-002`, `REQ-003`, `REQ-004`, `REQ-010`

## Context

요구사항은 draw.io 수준의 범용 그래프 편집이 아니라, lane과 시간 축을 갖는 observability timeline이다. 핵심은 자유 배치보다 duration scaling, long-running span visibility, zoom-level summary, latest-follow readability다. `SLICE-6` 구현에서는 time axis를 top -> bottom vertical flow로 고정하고 최신 이벤트를 하단에 둔다.

## Decision

- v1 timeline은 custom SVG renderer로 구현한다.
- live는 recent-zoom + latest follow on으로 시작한다.
- archive는 fit-all + follow off preset으로 시작한다.
- 사용자가 scroll/drag/zoom으로 viewport에 개입하면 follow를 끄고 `Eye` control로 다시 latest follow를 복구한다.
- `tool_call` + `tool_output`는 `meta.call_id` 기준 merged item으로 렌더한다.
- reasoning raw와 token noise는 기본 timeline이 아니라 drawer/totals로 보낸다.
- low zoom에서는 aggregate spans만, high zoom에서는 상세 span과 payload preview를 보인다.
- large sidebar/result set은 virtualization을 사용하되, timeline canvas는 visible-range culling을 사용한다.

## Consequences

- 장점:
  - time-axis semantics에 맞는 projection이 가능하다.
  - live recent focus와 archive fit-all을 같은 renderer contract로 다룰 수 있다.
  - draw.io 같은 불필요한 편집 복잡도를 피한다.
  - level-of-detail 설계가 자연스럽다.
- 비용:
  - renderer와 interaction layer를 직접 만들어야 한다.
  - latest follow 상태 전이와 manual override를 명시적으로 테스트해야 한다.
  - very large dataset에서 추가 culling 전략이 필요할 수 있다.

## Rejected alternatives

- React Flow를 v1 renderer로 채택
  - reason: viewport와 graph 성능 참고에는 유용하지만, v1 요구는 자유 그래프보다 시계열 sequence projection이 핵심이다.
- Canvas-only renderer
  - reason: text selection, accessibility, debug inspectability를 초기에 희생하고 싶지 않다.
