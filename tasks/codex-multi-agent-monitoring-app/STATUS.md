# Current slice

Live row-DAG / SLICE-2

# Done

- live 전용 renderer를 `src/features/timeline/ui/live-dag/` 아래로 분리하고, row-DAG 3열 구조(gutter / graph rail / annotation)를 `LiveDagStage`로 도입했다.
- `timeline-canvas.tsx`는 viewport, latest-follow, selection shell을 유지하고 live일 때만 새 row-DAG stage를 타도록 재배선했다. archive는 기존 absolute renderer 경로를 유지했다.
- gap row, turn header row, event row, connector path, annotation meta를 row-DAG 모델 기반으로 렌더하도록 맞췄고, item/connector/turn-header 클릭이 기존 drawer selection contract에 연결되도록 유지했다.
- 통합 테스트를 row-DAG copy와 구조에 맞게 갱신하고, 좁은 viewport에서 horizontal scroll을 전제하는 stage 폭 계약을 추가로 고정했다.

# Decisions made during implementation

- `timeline-canvas.tsx`는 live stage 렌더만 외부 컴포넌트로 분리하고, archive absolute path는 이번 slice에서 재설계하지 않았다.
- live viewport는 기존 `live-layout` 대신 row-DAG content height 기준으로 shell 내부에서 별도 follow/refollow 계산을 하도록 분기했다. `viewport.ts` 자체는 변경하지 않았다.
- row-DAG stage의 최소폭 정책은 stacked fallback 대신 horizontal scroll을 강제하는 쪽으로 고정했다.
- 이번 slice의 문서 영향 범위도 구현 진행 상태를 반영하는 `STATUS.md` 하나로 제한했다. README/UX/TECH 문서 갱신은 row-DAG interaction semantics가 더 고정되는 다음 slice 이후로 미뤘다.

# Verification results

- `pnpm typecheck`: pass
- `pnpm test -- src/features/timeline/ui/timeline-detail-sync.test.tsx src/features/timeline/model/live-dag/builder.test.ts src/features/timeline/model/projection.test.ts`: pass
- advisory review: `code-quality-reviewer`, `test-engineer` 요청 후 대기 중이었으나 응답 지연. 현재 커밋 sign-off는 메인 검증 결과 기준으로 진행
- commit: 아직 수행하지 않음

# Known issues / residual risk

- live row-DAG는 아직 hover path highlight, connector label pill, explicit segment affordance를 제공하지 않는다. 이 상호작용 정리는 `SLICE-3` 범위다.
- archive renderer는 여전히 기존 absolute path라 shell 파일 크기가 완전히 줄지는 않았다. archive 전용 추출은 별도 slice 또는 cleanup에서 정리해야 한다.
- viewport smoke는 jsdom 기반 width 계약까지만 확인했다. 실제 브라우저에서 390px 가로 스크롤 affordance와 edge fade는 후속 visual 검증이 필요하다.

# Next slice

Live row-DAG / SLICE-3
- 목표: hover path highlight, connector label pill, selection-to-drawer mapping polish, latest-follow의 row-mode semantics를 정리한다.
- 선행조건: 현재 row-DAG skeleton을 유지한 채 connector/row hover와 drawer sync를 강화해야 하며, archive 경로는 계속 영향 없이 유지해야 한다.
- 먼저 볼 경계: `src/features/timeline/ui/live-dag/*`, `timeline-canvas.tsx`의 viewport shell, drawer selection copy, live follow state copy/gesture semantics.
