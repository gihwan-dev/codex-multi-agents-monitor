# ADR-002 Compressed Graph Default

- Traceability ID: `ADR-002`
- Related requirements: `REQ-02`, `REQ-05`

## Context

v0.1의 목표는 정밀한 wall-clock 분석보다 30초 안에 run을 읽는 것이다. 비례 시간축만 기본으로 두면 idle gap이 긴 run에서 scan speed가 크게 떨어진다.

## Decision

기본 상세 모드는 비례 시간축이 아닌 compressed graph로 고정한다.

- lane 하나는 agent thread 하나다.
- event row는 의미 있는 단계만 보여준다.
- long idle은 gap folding으로 접는다.
- Waterfall은 latency lens, Map은 macro dependency lens로 보조 제공한다.

## Consequences

- 기본 화면에서 causality와 waiting point를 빠르게 읽을 수 있다.
- 실제 time ratio가 필요한 경우 Waterfall로 전환해야 한다.
- gap folding과 event ordering 규칙을 명확히 유지해야 한다.

## Alternatives

- proportional waterfall default: latency에는 강하지만 scan speed가 느려져 기각
- map default: macro overview는 좋지만 event-level debugging이 약해 기각
