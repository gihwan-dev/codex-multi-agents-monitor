# ADR-001: Normalize raw Codex logs into a backend-owned canonical event pipeline

- Status: accepted
- Related IDs: `ADR-001`, `REQ-001`, `REQ-006`, `REQ-007`, `REQ-009`

## Context

Codex 세션 로그는 JSONL raw event stream이며, 라이브/아카이브/대시보드 요구사항은 같은 데이터를 서로 다른 추상도에서 소비해야 한다. raw event를 frontend에서 직접 다루면 parser drift, privacy, performance, query complexity가 모두 악화된다.

## Decision

- Rust backend가 raw logs를 읽고 canonical event로 정규화한다.
- canonical event와 aggregated span/metric snapshot만 frontend로 노출한다.
- durable state는 backend-owned SQLite에 저장한다.
- UI preference만 key-value persistence로 분리한다.

## Consequences

- 장점:
  - live, archive, dashboard가 같은 contract를 공유한다.
  - parser drift 대응을 backend adapter에 국한할 수 있다.
  - archive query와 metric aggregation을 로컬 DB에서 빠르게 처리할 수 있다.
- 비용:
  - Rust 구현량이 늘어난다.
  - schema versioning과 migration 관리가 필요하다.

## Rejected alternatives

- Frontend에서 raw JSONL 직접 파싱
  - reason: query complexity와 large file cost가 너무 크다.
- Tauri SQL plugin을 frontend query 주체로 바로 사용
  - reason: business logic가 frontend로 새어 나오기 쉽다.
