# Current slice
Completed: `SLICE-1` to `SLICE-5`.

# Done

- left rail을 dense `Workspace -> Thread -> Run` tree로 교체하고 기본 metadata를 줄였다.
- Graph mode를 causal node-edge canvas로 교체하고 `pathOnly` 기본 포커스를 도입했다.
- 기존 timeline semantics를 Waterfall secondary mode로 분리했다.
- inspector를 derived causal explanation으로 바꾸고 drawer reveal policy를 유지했다.
- unit, build, Storybook, e2e 검증을 새 interaction contract 기준으로 갱신했다.

# Decisions made during implementation

- `RunDataset`와 ingestion/storage/export contract는 변경하지 않았다.
- selection path는 dense fixture 폭주를 막기 위해 depth-limited traversal로 계산했다.
- visualization mode controls와 drawer controls는 동일 toolbar 안에서도 명확히 분리된 cluster로 유지했다.
- commit은 사용자 요청이 없어 수행하지 않았다.

# Verification results

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm storybook:build`
- `pnpm test:e2e`

# Known issues / residual risk

- dense run의 transitive path depth는 fixture 기준으로 안전하지만, 실제 longer chain data에서는 heuristic tuning 여지가 남아 있다.
- `Map` mode는 tertiary surface라 visual polish는 Graph/Waterfall보다 낮다.

# Next slice
None. Closeout complete.
