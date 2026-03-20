# Codex Multi-Agent Monitor v0.1

## Goal

멀티에이전트 run 하나를 열었을 때 30초 안에 누가 생성됐고, 누가 누구에게 일을 넘겼고, 어디서 기다리고 있고, 무엇을 남기고 어떻게 끝났는지 파악할 수 있는 데스크톱 디버깅 워크벤치를 설계한다.

## Document map

- Product: `PRD.md`
- UX Structure: `UX_SPEC.md` (`UI Planning Packet`)
- UX Behavior: `UX_BEHAVIOR_ACCESSIBILITY.md`
- Architecture boundaries: `../../docs/architecture/frontend-fsd.md`
- Design References: `DESIGN_REFERENCES/` (`manifest.json`, `shortlist.md`, saved task-local notes)
- Architecture: `TECH_SPEC.md`
- Repo baseline rules: `../../docs/ai/ENGINEERING_RULES.md`
- Implementation guardrails: `IMPLEMENTATION_CONTRACT.md`
- Execution: `EXECUTION_PLAN.md`
- Validation: `SPEC_VALIDATION.md`
- Acceptance: `ACCEPTANCE.feature`
- Decisions: `ADRs/`

## Task continuity

- decision: create-new
- compared tasks: none
- reason: 기존 `tasks/` bundle이 없고, 현재 repo는 monitor shell과 FSD 전환 대상 코드가 이미 존재하지만 이 작업과 이어지는 이전 bundle은 없다.
- chosen task path: `tasks/codex-multi-agent-monitor-v0-1`

## Quality preflight

- verdict: orchestrated-task
- current repo state: monitor shell과 trace workbench는 `src/pages/monitor`, `src/widgets/*`, `src/features/*`, `src/entities/*`, `src/shared/*` 기준으로 재정렬되어 있고 `src/app`는 bootstrap/layout만 남는다.
- structure preflight: 이후 변경도 이 FSD 경계를 유지해야 하며, 삭제된 legacy path를 호환 shim으로 되살리지 않는다.
- split-first: required. 구현 단계에서는 `app -> pages/monitor`, `widgets`, `features`, `entities`, `shared` 경계를 먼저 분리한다.
- bootstrap: repo baseline `../../docs/ai/ENGINEERING_RULES.md`와 task supplement `IMPLEMENTATION_CONTRACT.md`가 생성되어 `SLICE-1` 선행 조건이 해소됐다.

## Key decisions

- `work_type=feature`, `delivery_strategy=ui-first`로 고정한다.
- 이 앱은 KPI 대시보드가 아니라 run-detail-first 디버깅 워크벤치로 설계한다.
- FE 구조는 `app/pages/widgets/features/entities/shared` 6레이어로 고정하고 `processes`는 도입하지 않는다.
- `src/shared/domain`과 `src/app/sessionLogLoader` 계열 shim은 제거됐고 재도입하지 않는다.
- 내부 데이터 모델은 OTel/OpenAI Agents/Langfuse mental model을 따르되 `tree + link`를 모두 가지는 trace-native schema를 사용한다.
- 기본 상세 모드는 `compressed event graph`이고 `Waterfall`과 `Map`은 같은 normalized dataset 위의 보조 모드로 둔다.
- 프라이버시 기본 정책은 preview-only 저장, raw payload opt-in, export 시 raw 제외다.
- repo bootstrap은 `Biome + Vitest + Playwright + Storybook`을 구현 검증 baseline으로 잠근다.
- 이후 `implement-task`는 `../../docs/ai/ENGINEERING_RULES.md`와 `IMPLEMENTATION_CONTRACT.md`를 선행 입력으로 읽는다.

## Validation gate status

- gate: blocking
- state: bootstrap cleared, ready for `implement-task`
- bootstrap: repo-level implementation rules와 task supplement contract가 생성됐다.
- ux docs: complete
- reference pack: complete
- implementation contract: created. `IMPLEMENTATION_CONTRACT.md`가 task implementation SSOT다.

## Implementation slices

- `SLICE-1`: FSD boundary 문서와 page/app 책임선을 고정한다.
- `SLICE-2`: `app`에서 `pages/monitor`를 분리하고 bootstrap only 경계를 남긴다.
- `SLICE-3`: run tree, graph, inspector, drawer, chrome을 `widgets`에 정착시킨다.
- `SLICE-4`: session-log, workspace identity, fixtures, follow-live/import 경계를 `entities`, `features`, `shared` 기준으로 정리한다.
