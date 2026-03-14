# Execution slices

## SLICE-1

- Change boundary: top bar, summary strip, separated graph toolbar, dense rail shell, compact inspector shell
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: 1280px hierarchy review, compact chrome review, drawer hidden-by-default check
- Stop / Replan trigger: graph가 시각적 primary surface로 읽히지 않으면 중단

## SLICE-2

- Change boundary: workspace tree interaction, quick filters, path-only toggle, keyboard/focus behavior, compact mobile inspector
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: `AC-001`, `AC-004`, `AC-006`
- Stop / Replan trigger: selection context가 rail/graph/inspector 사이에서 일치하지 않으면 중단

## SLICE-3

- Change boundary: selection path, summary facts, graph canvas model, inspector causal summary selectors
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: `AC-002`, `AC-003`, `AC-005`
- Stop / Replan trigger: Graph가 cell grid처럼 읽히거나 edge semantics가 path를 설명하지 못하면 중단

## SLICE-4

- Change boundary: Waterfall demotion, mode switching, large-run focus, map alignment
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: mode switch persistence, dense fixture focus preservation, mobile compact inspector
- Stop / Replan trigger: Waterfall이 primary로 남거나 mode switch가 selection을 잃으면 중단

## SLICE-5

- Change boundary: inspector copy, drawer actions, regression tests, Storybook scenario stability
- Expected files: 3
- Validation owner: main thread
- Focused validation plan: end-to-end verification plus Storybook build
- Stop / Replan trigger: causal summary가 sparse metadata box로 후퇴하면 중단

# Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm storybook:build`
- `pnpm test:e2e`

# Stop / Replan conditions

- shared selection context가 rail, Graph, Waterfall, inspector, drawer 사이에서 깨지면 즉시 재설계한다.
- graph selector가 dense fixture에서 전체 transitive chain을 다시 다 끌고 오면 depth heuristic을 다시 조정한다.
- drawer가 닫혀 있을 때 layout height를 점유하면 closeout하지 않는다.
