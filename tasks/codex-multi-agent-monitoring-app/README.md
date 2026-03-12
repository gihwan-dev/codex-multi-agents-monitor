# Goal

Codex 멀티 에이전트 세션을 로컬에서 추적하고, "적절한 에이전트가 불렸는지", "일이 효율적으로 분배됐는지", "오케스트레이터가 같은 일을 반복하고 있지 않은지"를 실시간/아카이브/대시보드 세 화면으로 설명하는 데스크톱 앱을 구현한다.

# Document map

- `task.yaml`: machine entry point, phase/gate/source of truth.
- `PRD.md`: 문제 정의, 사용자 가치, 요구사항, 성공 기준.
- `UX_SPEC.md`: 화면 구조, 타임라인 상호작용, 필터링 깊이, visual direction.
- `TECH_SPEC.md`: data source, canonical event pipeline, storage, IPC, renderer architecture.
- `METRICS_CATALOG.md`: dashboard 후보 지표 브레인스토밍.
- `schema.json`: raw log를 앱 내부 canonical model로 바꾸는 최소 계약.
- `ACCEPTANCE.feature`: 사용자 시나리오 기준 수용 조건.
- `ADRs/`: 핵심 architectural choice 기록.
- `EXECUTION_PLAN.md`: bounded slice 순서와 검증 계획.
- `SPEC_VALIDATION.md`: blocking gate와 설계 리스크.
- `STATUS.md`: 실행 시작 전 초기 상태 템플릿.

# Key decisions

- Quality preflight: `orchestrated-task`.
  - 이유: 현재 앱은 Vite + Tauri hello world 상태이며, 이번 목표는 multi-screen UI + local ingestion + data schema + performance + observability heuristic를 동시에 요구한다.
- Task continuity: `new_task`.
  - 이유: `tasks/` 아래 재사용 가능한 bundle 후보가 없다.
- Data scope:
  - 1차 SSOT는 `~/.codex/sessions/**/*.jsonl`, `~/.codex/archived_sessions/**/*.jsonl`, `~/.codex/.codex-global-state.json`.
  - 외부 업로드/원격 저장은 초기 범위에서 제외한다.
- Session classification:
  - live/archive 판정은 현재 파일 위치 snapshot 기준으로만 계산한다.
  - archive move 시점 복원은 v1 계약에 포함하지 않는다.
- Token scope:
  - v1은 exact session totals를 우선 보장한다.
  - subagent/session metadata가 있는 별도 session 파일에 한해 exact agent/session totals를 제공한다.
  - turn/tool exact attribution은 explicit raw evidence 확보 전까지 deferred다.
- Timeline renderer:
  - draw.io 같은 범용 편집기가 아니라, time-axis sequence diagram 전용 SVG renderer로 간다.
  - zoom/pan은 지원하되, node graph editing은 범위 밖이다.
- Privacy:
  - 세션 원문, 파생 지표, 검색 인덱스는 모두 로컬 장치 안에서만 유지한다.
  - reasoning raw는 기본 화면에 노출하지 않고 selection된 item의 detail drawer에서만 연다.
- Frontend data access:
  - Tauri IPC 기반 server state는 TanStack Query가 소유한다.
  - `start_live_bridge` + live event는 query cache updater로만 동작한다.
  - `selectedSessionId`, tab, filter draft 같은 UI state는 feature-local state로 유지한다.

# Validation gate status

- Verdict: `blocking`
- 이유:
  - UI, workflow, architecture, data contract, operability가 모두 바뀐다.
  - 실제 Codex 로그 필드 coverage는 `SLICE-1`에서 고정해야 하고, renderer 10k budget은 `SLICE-6` stop/replan gate로만 남겨둔다.
- 구현 착수 기준:
  - `SPEC_VALIDATION.md`의 pre-`SLICE-1` blocking issue가 해소된 뒤 `SLICE-1` spike부터 시작한다.

# Implementation slice order

1. `SLICE-1` 로컬 로그 ingestion spike
2. `SLICE-2` canonical schema + persistence
3. `SLICE-3` query API + live stream bridge
4. `SLICE-4` app shell + workspace/navigation
5. `SLICE-5` frontend query foundation
6. `SLICE-6` sequence timeline renderer MVP
7. `SLICE-7` archive filters + parity
8. `SLICE-8` dashboard metrics + heuristics
9. `SLICE-9` performance hardening + glass-inspired theme polish
