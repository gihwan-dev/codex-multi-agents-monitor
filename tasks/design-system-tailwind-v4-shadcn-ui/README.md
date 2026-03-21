# Tailwind v4 + shadcn/ui Design System Migration

## Goal

GitHub issue [#4](https://github.com/gihwan-dev/codex-multi-agents-monitor/issues/4)를 기준으로, monitor UI를 Tailwind CSS v4 + shadcn/ui 기반 디자인 시스템으로 전환하되 graph-first 디버깅 워크벤치의 30초 이해 경험을 유지한다.

## Document map

- UX Structure: `UX_SPEC.md`
- UX Behavior: `UX_BEHAVIOR_ACCESSIBILITY.md`
- Design references: `DESIGN_REFERENCES/`
- Architecture: `TECH_SPEC.md`
- Migration plan: `MIGRATION.md`
- Verification: `VERIFICATION.md`
- Rollback: `ROLLBACK.md`
- Acceptance: `ACCEPTANCE.feature`
- Decisions: `ADRs/`
- Execution: `EXECUTION_PLAN.md`
- Validation: `SPEC_VALIDATION.md`
- Repo baseline rules: `../../docs/ai/ENGINEERING_RULES.md`

## Task continuity

- decision: create-new
- compared tasks:
  - `tasks/codex-multi-agent-monitor-v0-1`
  - `tasks/run-workbench-ui-redesign`
  - `tasks/run-workbench-causal-graph-reset`
- reason: 세 후보 모두 run workbench UX 자체를 다루는 task였고, 이번 요청은 `Tailwind CSS v4 + shadcn/ui + Storybook feedback loop + staged CSS retirement`라는 별도 migration goal을 가진다. `codex-multi-agent-monitor-v0-1`의 bootstrap supplement (`IMPLEMENTATION_CONTRACT.md`, `source_of_truth.implementation`)는 continuity 비교에서 정규화했지만 결과를 바꾸지 않았다.
- chosen task path: `tasks/design-system-tailwind-v4-shadcn-ui`

## Quality preflight

- verdict: orchestrated-task
- current repo state:
  - Tailwind, shadcn, Radix 기반은 아직 도입되지 않았다.
  - Storybook story는 `src/pages/monitor/ui/MonitorPage.stories.tsx` 한 개뿐이라 component feedback loop 용도로는 부족하다.
  - 현재 baseline rules는 `src/theme/* + src/shared/ui/*` thin primitive layer를 고정하고 Tailwind와 heavyweight UI kit 도입을 금지한다.
- structure preflight:
  - target file roles:
    - `src/theme/tokens.css`: 전역 semantic token source
    - `src/theme/primitives.css`: reset + primitive styles + utility-like classes
    - `src/shared/ui/*`: repo-local primitive layer
    - `src/widgets/*/*.css`: screen-block presentation ownership
    - `.storybook/*`: visual review bootstrap
  - current large files:
    - `src/widgets/causal-graph/ui/causal-graph.css`: 675 LOC
    - `src/theme/primitives.css`: 361 LOC
    - `src/widgets/workspace-run-tree/ui/workspace-run-tree.css`: 307 LOC
    - `src/widgets/monitor-chrome/ui/monitor-chrome.css`: 267 LOC
    - `src/widgets/causal-graph/ui/CausalGraphView.tsx`: 468 LOC
  - expected post-change LOC: append-first 방식이면 global CSS와 graph shell 파일이 400~900 LOC 이상으로 커질 가능성이 높다.
  - split-first: required. foundation, primitive stories, real surface adoption, CSS retirement를 분리하지 않으면 giant mixed diff가 된다.

## Key decisions

- `work_type=migration`, `delivery_strategy=ui-first`, `execution_topology=keep-local`로 고정한다.
- 디자인 시스템의 visual source of truth는 Storybook이며, app integration 전에 `foundations -> primitives -> monitor composites -> screens` 순서로 리뷰한다.
- shadcn/ui는 closed kit가 아니라 open-code primitive source로 사용하고, monitor-specific semantics는 repo-local wrapper로 유지한다.
- graph-first shell, warm graphite tone, IBM Plex typography, 30-second checklist는 `reuse + delta`로 이어받는다.
- GitHub issue [#5](https://github.com/gihwan-dev/codex-multi-agents-monitor/issues/5)는 이 task의 결과를 소비하는 follow-up으로 두고, 이 task는 `theme-ready token architecture + Storybook preview`까지만 책임지는 것으로 확정한다.
- end state의 CSS는 `Tailwind entry CSS + semantic token CSS + motion CSS`만 남기고, primitive/widget presentation CSS는 제거 대상으로 본다.

## Validation gate status

- gate: blocking
- state: bootstrap cleared, ready for `SLICE-1`
- implementation contract: `IMPLEMENTATION_CONTRACT.md`가 task implementation SSOT로 추가됐다.
- active concern:
  - GitHub issue `#4`는 theme-ready architecture까지만, `#5`는 full theme UX/productization을 담당하는 것으로 문서와 execution slice를 함께 유지해야 한다.

## Implementation slices

- `BOOTSTRAP`: repo baseline, implementation supplement, execution gate를 구현 상태로 전환
- `SLICE-1`: Tailwind v4 foundation, token bridge, Storybook visual foundation
- `SLICE-2`: shadcn primitives + monitor composites story coverage
- `SLICE-3`: top chrome and shared control surface adoption
- `SLICE-4`: rail, summary, inspector, drawer migration
- `SLICE-5`: graph-adjacent shell migration and primitive CSS retirement
- `SLICE-6`: widget CSS retirement audit, theme-ready handoff, rollback and verification closeout
