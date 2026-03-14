# Target State

## Goal

구현된 모니터를 `true causal Graph workbench`로 재정렬해 사용자가 `workspace tree -> blocker path graph -> causal inspector` 흐름으로 run을 이해하게 만든다.

## Requirements

- `REQ-001` left rail은 `Workspace -> Thread -> Run` dense tree여야 하고, 기본 행은 제목, 상태, 마지막 요약, 상대 시간만 보여야 한다.
- `REQ-002` summary strip은 blocker agent, affected agents, last handoff, longest gap, first failure, path focus 상태만 보여야 한다.
- `REQ-003` Graph mode는 node, edge, selected path, dimmed context, gap folding을 가진 causal canvas여야 한다.
- `REQ-004` Waterfall mode는 현재 timeline inspection view를 담당하는 secondary mode여야 한다.
- `REQ-005` inspector는 `Summary / Why blocked / Upstream dependency / Downstream impact / Payload`를 보여야 한다.
- `REQ-006` selection, mode switch, drawer reveal, mobile compact inspector가 같은 run context를 유지해야 한다.

## Non-goals

- parser, normalizer, storage, export schema 재설계
- 새로운 UI kit, state layer, styling stack 도입
- KPI dashboard, cross-run analytics, full diff viewer 추가

## Reuse + delta

- Reuse: shared dataset, token family, live/import/raw capability contracts, map overview mode
- Delta: Graph/Waterfall semantics split, dense tree row grammar, factual summary strip, causal inspector copy, large-run focus behavior
