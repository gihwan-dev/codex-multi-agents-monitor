# ADR-004 Import Plus Local Watch Scope

- Traceability ID: `ADR-004`
- Related requirements: `REQ-07`

## Context

v0.1은 새로운 모니터링 workbench의 첫 버전이다. 초기부터 collector, direct runtime coupling, cross-system transport를 모두 넣으면 범위가 크게 흔들릴 수 있다.

## Decision

v0.1 수집 범위는 completed run import와 local live tail/watch로 제한한다.

- 두 경로 모두 같은 normalized schema를 사용한다.
- direct Codex runtime coupling은 후속 adapter 문제로 남긴다.
- collector/OTLP bridge는 future extension point로만 기록한다.

## Consequences

- 구현 범위를 통제하면서도 import와 live 관찰을 모두 검증할 수 있다.
- adapter boundary가 명확해진다.
- direct runtime API가 필요한 경우 별도 범위 재평가가 필요하다.

## Alternatives

- import only: live debugging 가치가 부족해 기각
- direct runtime integration first: v0.1 범위와 운영 리스크가 과도해져 기각
