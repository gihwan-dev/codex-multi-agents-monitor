# Execution slices

## `SLICE-1` Log ingestion spike

- Change boundary:
  - Rust backend only
  - live/archive file discovery + append parser + sample fixture capture
- Expected files:
  - `src-tauri/src/codex_source.rs`
  - `src-tauri/src/log_parser.rs`
  - `src-tauri/src/lib.rs`
- Validation owner:
  - `implementer`
- Focused validation plan:
  - current local sample jsonl 2종으로 parser fixture 실행
  - `session_meta`, `user_message`, `agent_message`, `function_call`, `function_call_output`, `token_count` 검출 확인
- Stop / Replan trigger:
  - 로그 포맷이 append-only 가정과 다르거나 필수 필드(`session_id`, timestamp, parent relation)가 불안정하면 즉시 재설계

## `SLICE-2` Canonical schema and persistence

- Change boundary:
  - canonical event model + SQLite repository
- Expected files:
  - `src/shared/canonical.ts`
  - `src-tauri/src/repository.rs`
  - `src-tauri/src/normalize.rs`
- Validation owner:
  - `implementer`
- Focused validation plan:
  - `schema.json`와 canonical serialization 일치 검증
  - archive query fixture로 session/event count 확인
- Stop / Replan trigger:
  - canonical model이 raw event 다양성을 1:1로 흡수하지 못하면 schema split 필요

## `SLICE-3` Query API and live stream bridge

- Change boundary:
  - backend commands/events + minimal shared query contract
- Expected files:
  - `src-tauri/src/ipc.rs`
  - `src/shared/queries.ts`
  - `src-tauri/src/lib.rs`
- Validation owner:
  - `implementer`
- Focused validation plan:
  - workspace/session list snapshot query
  - live append subscription smoke test
- Stop / Replan trigger:
  - event flood가 frontend main thread를 압박하면 batching protocol 재설계

## `SLICE-4` App shell and navigation

- Change boundary:
  - frontend shell, route/state skeleton, workspace sidebar
- Expected files:
  - `src/main.tsx`
  - `src/app-shell.tsx`
  - `src/styles.css`
- Validation owner:
  - `implementer`
- Focused validation plan:
  - empty/loading/error/live state visual check
  - workspace grouping interaction 확인
- Stop / Replan trigger:
  - shell state와 session detail state가 과도하게 결합되면 store 구조 재설계

## `SLICE-5` Frontend query foundation

- Change boundary:
  - frontend server-state ownership
  - Query provider, query keys/options, app-level live bridge bootstrap
  - session detail query contract
  - focused test infrastructure and task/docs sync
- Expected files:
  - `src/main.tsx`
  - `src/shared/query/*`
  - `src/features/live-session-feed/*`
  - `src/features/session-detail/*`
  - `tasks/codex-multi-agent-monitoring-app/*`
- Validation owner:
  - `implementer`
- Focused validation plan:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build` (Node baseline warning은 advisory로 기록)
  - workspace bootstrap + live-before-bootstrap race + detail disabled/key split 자동 검증
- Stop / Replan trigger:
  - StrictMode/remount에서 중복 subscription이 반복되거나, detail invalidate 정책이 selection 안정성을 깨면 explicit bridge manager를 먼저 분리

## `SLICE-6` Sequence timeline renderer MVP

- Change boundary:
  - SVG renderer, zoom/pan, lane projection, detail drawer
- Expected files:
  - `src/features/timeline/TimelineCanvas.tsx`
  - `src/features/timeline/projection.ts`
  - `src/features/timeline/DetailDrawer.tsx`
- Validation owner:
  - `implementer`, noisy profile은 `verification-worker`
- Focused validation plan:
  - 10k normalized events fixture로 first paint와 zoom/pan 프로파일
  - detail level 3단계 전환 검증
- Stop / Replan trigger:
  - SVG primitive 수가 budget을 넘겨 frame drop이 심하면 WebGL/canvas hybrid 검토

## `SLICE-7` Archive filters and parity

- Change boundary:
  - archive query UI + dense results + detail reuse
- Expected files:
  - `src/features/archive/ArchiveView.tsx`
  - `src/features/archive/filter-state.ts`
  - `src/features/archive/ResultsList.tsx`
- Validation owner:
  - `implementer`
- Focused validation plan:
  - multi-filter combination query
  - result-to-detail transition
- Stop / Replan trigger:
  - archive query latency가 300ms budget을 반복적으로 초과하면 index/materialized snapshot 추가

## `SLICE-8` Dashboard metrics and heuristics

- Change boundary:
  - metric aggregation + dashboard cards/charts
- Expected files:
  - `src-tauri/src/metrics.rs`
  - `src/features/dashboard/DashboardView.tsx`
  - `src/features/dashboard/metric-definitions.ts`
- Validation owner:
  - `implementer`, metric sanity는 `verification-worker`
- Focused validation plan:
  - repeated-work, wait ratio, spawn depth 샘플 검증
  - chart drill-down navigation 검증
- Stop / Replan trigger:
  - heuristic false positive가 과도하면 dashboard labeling을 "suspected" 중심으로 조정

## `SLICE-9` Performance hardening and theme polish

- Change boundary:
  - profiling, memoization/culling, glass-inspired visual system
- Expected files:
  - `src/styles.css`
  - `src/features/timeline/TimelineCanvas.tsx`
  - `src/features/dashboard/DashboardView.tsx`
- Validation owner:
  - `implementer`, profile review는 `verification-worker`
- Focused validation plan:
  - large fixture profile
  - contrast/readability visual QA
- Stop / Replan trigger:
  - glass treatment이 readability나 timeline density를 해치면 decorative layer 축소

# Verification

- Parser fixtures:
  - live session sample
  - archived session sample
  - malformed line sample
- Contract validation:
  - canonical event serialization vs `schema.json`
- UI validation:
  - live sidebar state
  - query cache bootstrap race
  - detail query disabled/key split
  - timeline zoom/pan
  - detail drawer
  - archive filters
  - dashboard drill-down
- Performance validation:
  - 10k events detail view
  - 1k sessions archive query
  - live append burst
- Regression focus:
  - parent-child agent relation
  - token aggregation consistency
  - archived/live classification

# Stop / Replan conditions

- `RISK-001` Codex 로그 필드가 버전별로 크게 다르면 parser adapter layer를 먼저 분리해야 한다.
- `RISK-002` session file watch만으로 live completeness를 보장하지 못하면 polling + checkpoint hybrid로 전환한다.
- `RISK-003` query foundation이 future slice에서 우회되면 summary/detail/archive cache 정책이 분기될 수 있으니 shared query layer를 source of truth로 유지한다.
- `RISK-004` time-axis SVG renderer가 성능 한계를 보이면 canvas overlay 또는 hybrid renderer로 전환한다.
- `RISK-005` repeated-work heuristic이 설명 가능하지 않으면 v1 dashboard에서 score보다 evidence list 중심으로 축소한다.
- `RISK-006` local data volume이 커서 startup indexing 비용이 높으면 background indexing과 recent-first lazy hydration이 필요하다.
