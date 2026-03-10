# ADR 0001 - Initial Foundation

- 상태: Accepted
- 날짜: 2026-03-10

## Context

Codex Desktop 멀티에이전트 모니터 v1 구현을 시작하기 전에, 런타임/툴링/아키텍처 경계를 고정할 초기 기준선이 필요했다.

## Decision

1. 스타터
- 공식 `create-tauri-app` 기반으로 시작한다.
- UI template은 `react-ts`, 패키지 매니저는 `pnpm`으로 고정한다.

2. Frontend baseline
- `React + TypeScript + Vite + React Router + TanStack Query + Zustand`
- `Tailwind CSS v4`와 shadcn baseline(`components.json`, `cn` util, shared ui component) 도입

3. Backend baseline
- `Tauri v2 + Rust`
- plugin baseline: `opener`, `window-state`, `log`
- crate baseline: `notify`, `rusqlite(bundled)`, `serde`, `serde_json`, `anyhow`, `thiserror`, `tracing`, `chrono`

4. 데이터 소유권
- source(`~/.codex/...`)는 read-only
- 앱 전용 인덱스 DB는 app data dir 하위 `monitor.db`로 Rust가 소유
- frontend는 command/event만 사용하고 파일 시스템 직접 접근을 금지

## Consequences

- 장점: 초기 범위를 작게 유지하면서도 v1 ingest/timeline 구현으로 바로 확장 가능
- 장점: frontend/backend 경계가 명확해 데이터 소스 변경에도 UI 영향 최소화
- 단점: 초기 단계에서 기능이 stub 중심이라 UX는 shell 수준에 머무름
- 단점: 실제 ingest 성능/정확도는 후속 slice에서 검증 필요
