# Current slice

Live row-DAG / SLICE-1

# Done

- `src/features/timeline/model/live-dag/`를 추가하고, 기존 `TimelineProjection` 위에 `TimelineLiveDagView`를 파생하는 builder를 도입했다.
- live row-DAG의 핵심 규칙인 global semantic row ordering, `user/main` 고정 track, subagent branch slot reserve/release/reuse, `45_000ms` gap row folding, connector/tool edge taxonomy를 새 모델 안에서 고정했다.
- row/edge가 기존 selection contract로 역매핑되도록 `itemId`, `connectorId`, `turnBandId`, `segmentId` 계열 메타를 유지했다.
- `builder.test.ts`를 추가해 branch slot 재사용, global gap folding, connector direction/request-response preview 파생, turn header ordering을 검증했다.

# Decisions made during implementation

- 이번 slice는 model split만 수행하고, 기존 `projection`, `live-layout`, `viewport`, `timeline-canvas`의 소비 경로는 건드리지 않았다.
- track label은 UI header용 정적 `User/Main/Branch N`로 두고, row/edge의 actor/direction copy는 기존 lane/session label에서 파생하도록 분리했다.
- tool은 row 자체의 input/output preview를 유지하고, annotation leader용 `tool` taxonomy edge를 별도로 파생하는 방식으로 고정했다.
- 문서 영향 범위는 현재 slice 진행 상태를 반영하는 `STATUS.md` 하나로 제한했다. README/UX/TECH 문서는 아직 사용자-visible surface가 바뀌지 않아 이번 slice에서 수정하지 않았다.

# Verification results

- `pnpm test -- src/features/timeline/model/live-dag/builder.test.ts`: pass
- `pnpm test -- src/features/timeline/model/projection.test.ts`: pass
- `pnpm typecheck`: pass
- commit: 요청되지 않아 수행하지 않음

# Known issues / residual risk

- live 화면은 아직 기존 vertical sequence renderer를 사용한다. 새 row-DAG 모델은 `SLICE-2`에서 UI skeleton에 연결해야 실제 화면 변화가 난다.
- `merge rail`, hover path highlight, selection-to-drawer sync, latest-follow의 row-mode semantics는 아직 미구현이다.
- 현재 검증은 fixture 기반 model/test 수준이다. 실제 live append burst와 horizontal scroll viewport smoke는 UI slice 이후 다시 확인해야 한다.

# Next slice

Live row-DAG / SLICE-2
- 목표: `src/features/timeline/ui/live-dag/` skeleton과 synchronized scroll shell을 만들고, `timeline-canvas.tsx`를 얇은 shell로 정리한다.
- 선행조건: 새 `TimelineLiveDagView`를 live 전용 렌더 경로에 주입하되 archive의 `archive-absolute` 경로는 그대로 유지해야 한다.
- 먼저 볼 경계: `src/features/timeline/ui/timeline-canvas.tsx`, 새 `ui/live-dag/*` 컴포넌트, live stage의 gutter/graph/annotation 3열 레이아웃, horizontal scroll 정책.
