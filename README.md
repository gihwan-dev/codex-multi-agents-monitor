# Codex Multi-Agent Monitor

Codex Desktop 멀티에이전트 실행 흐름에서 병목을 빠르게 찾기 위한 macOS 로컬 모니터 앱 초기 골격이다.  
현재 버전은 `Tauri v2 + React + TypeScript` 기반의 baseline setup이며, 실제 ingestion/timeline 로직은 후속 slice에서 구현한다.

## 목적

- 실행 중 thread의 병목과 대기 구간을 timeline-first UX로 관측한다.
- 메인/서브에이전트 관계를 thread detail에서 한 화면으로 연결한다.
- 원문은 기본 접고, 요약 중심으로 빠르게 상태를 파악한다.

## Non-goals (초기 셋업 기준)

- agent 제어(중지/재개/interrupt)
- 클라우드 업로드/동기화/공유
- Codex 내부 저장소를 쓰기하는 동작
- updater/global shortcut/notification/remote control

## 로컬 데이터 소스 (읽기 전용)

- Live: `~/.codex/sessions/**/*.jsonl`
- History: `~/.codex/archived_sessions/*.jsonl`
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
  features/            # feature shells (overview/detail/history)
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

## 구현 로드맵

1. ingestion watermark + normalized index schema
2. live overview query + bottleneck ranking
3. thread detail swimlane timeline + wait linkage
4. history aggregation + deep link polish
5. malformed source recovery + cold start tuning

## 문서

- 제품 계획: [`tasks/codex-desktop-multi-agent-monitor/PLAN.md`](./tasks/codex-desktop-multi-agent-monitor/PLAN.md)
- 아키텍처: [`docs/architecture.md`](./docs/architecture.md)
- 초기 ADR: [`docs/adr/0001-initial-foundation.md`](./docs/adr/0001-initial-foundation.md)
- 작업 규약: [`AGENTS.md`](./AGENTS.md)
