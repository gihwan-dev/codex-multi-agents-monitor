# ADR-003: Let TanStack Query own frontend server state and treat live events as cache updaters

- Status: accepted
- Related IDs: `ADR-003`, `REQ-002`, `REQ-003`, `REQ-005`, `REQ-010`

## Context

frontend의 Live shell은 `useEffect + local state + Tauri invoke/listen`을 한 훅에 직접 묶고 있었다. 이 구조는 bootstrap query, live-before-bootstrap race, error/degraded 분기, cleanup, future `query_session_detail` 도입을 한 곳에 몰아 넣어 이후 timeline/archive/dashboard slice에서 같은 패턴이 반복될 위험이 있었다.

## Decision

- Tauri IPC로 읽는 frontend server state는 TanStack Query가 소유한다.
- `query_workspace_sessions`, `query_session_detail`, 이후 archive/dashboard 조회는 query key/options factory를 통해 shared query layer에서 정의한다.
- `start_live_bridge`와 live event listen은 query function 안에 넣지 않고 app-level bootstrap에서 수행한다.
- live summary event는 workspace sessions cache를 `setQueryData`로 갱신하고, 첫 bootstrap fetch pending 중에만 snapshot merge를 허용한다.
- summary payload만으로 병합할 수 없는 session detail cache는 invalidate 하고, remount 시 fresh fetch가 일어나도록 유지한다.
- `activeTab`, `selectedSessionId`, filter draft 같은 UI state는 계속 feature-local state로 유지한다.

## Consequences

- 장점:
  - bootstrap/query/error/degraded/cache policy를 shared query layer 하나로 고정할 수 있다.
  - live-before-bootstrap race를 query cache merge 규칙으로 재사용할 수 있다.
  - future timeline/archive/dashboard slice가 같은 server-state contract를 공유한다.
- 비용:
  - app entry/provider와 테스트 인프라가 추가된다.
  - summary/detail invalidate 정책을 future slice에서도 일관되게 유지해야 한다.

## Rejected alternatives

- `useEffect + local state` 패턴 유지
  - reason: query 수가 늘어날수록 race, retry, cache 정책이 화면별로 분기되기 쉽다.
- UI selection state까지 Query cache로 승격
  - reason: server state와 local interaction state의 책임이 흐려지고 selection fallback 로직이 query lifecycle에 종속된다.
