# Codex Multi-Agent Monitor

Codex Desktop 멀티에이전트 실행 흐름을 `Live / Archive / Summary` 정보 구조로 탐색하기 위한 macOS 로컬 모니터 앱이다.  
현재 기준선은 `Tauri v2 + React + TypeScript` 위에서 root chat session 중심 탐색 UX와 session flow 시각화를 제품 언어로 고정하는 것이다.

## 제품 용어 기준

- `Workspace > Chat(Session) > Agent Session > Item(Event)`를 user-facing canonical hierarchy로 사용한다.
- UI copy는 `챗` 또는 `세션`을 우선 사용하고, 새 public contract는 `session` naming을 우선 사용한다.
- 기존 `thread`와 `thread_id`는 DB schema, legacy command, internal compatibility naming으로만 유지한다.

## 목적

- 실행 중인 chat(session)의 병목과 대기 구간을 timeline-first UX로 관측한다.
- root chat session 안에서 메인/서브에이전트 관계를 한 흐름으로 연결한다.
- 원문은 기본 접고, 요약 중심으로 빠르게 상태를 파악한다.

## Non-goals

- agent 제어(중지/재개/interrupt)
- 클라우드 업로드/동기화/공유
- Codex 내부 저장소를 쓰기하는 동작
- updater/global shortcut/notification/remote control

## 로컬 데이터 소스 (읽기 전용)

- Live: `~/.codex/sessions/**/*.jsonl`
- Archive: `~/.codex/archived_sessions/*.jsonl`
- Metadata: `~/.codex/state_5.sqlite`
- App index DB: Tauri app data dir 하위 `monitor.db` (앱 소유)

## 빠른 시작

```bash
pnpm install
pnpm tauri:dev
```

## 스크립트

- `pnpm dev`: Vite dev server
- `pnpm build`: TypeScript + Vite build
- `pnpm tauri`: Tauri CLI
- `pnpm tauri:dev`: Desktop app dev run
- `pnpm tauri:build`: Desktop app build
- `pnpm lint`: Biome check
- `pnpm format`: Biome format (write)
- `pnpm typecheck`: TypeScript type check
- `pnpm test`: Vitest run
- `pnpm cargo:test`: Rust test (`src-tauri/Cargo.toml`)

## 디렉터리 구조

```text
src/
  app/                 # app shell, providers, router
  pages/               # route-level pages
  features/            # feature shells (live/archive/summary/session-flow)
  entities/            # domain state/store
  shared/              # tauri bridge, contracts, ui primitives
src-tauri/src/
  domain/              # Rust domain contract types
  sources/             # source path resolution
  ingest/              # ingest entry stub
  index_db/            # monitor.db initialization
  commands/            # tauri command handlers
  events/              # monitor event constants
  state/               # AppState and path ownership
tasks/
  codex-desktop-multi-agent-monitor/PLAN.md  # 제품 요구사항 기준선
```

## 제품 방향

1. Live: workspace sidebar와 current chat(session) browser 제공
2. Archive: archived chat(session) browser 제공
3. Summary: workspace/session/time-range 기반 요약 dashboard 제공
4. Session Flow: `User / Main / Subagents` sequence diagram으로 item(event) 흐름 시각화
5. Raw detail은 inspector 패널에서만 확장

## 문서

- 제품 계획: [`tasks/codex-desktop-multi-agent-monitor/PLAN.md`](./tasks/codex-desktop-multi-agent-monitor/PLAN.md)
- 아키텍처: [`docs/architecture.md`](./docs/architecture.md)
- 초기 ADR: [`docs/adr/0001-initial-foundation.md`](./docs/adr/0001-initial-foundation.md)
- 작업 규약: [`AGENTS.md`](./AGENTS.md)
