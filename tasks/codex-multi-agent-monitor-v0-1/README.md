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
- current repo state: monitor shell과 trace workbench는 이미 구현되어 있지만 `src/app`, `src/shared/domain`, `src/app/session-log-loader`, `src/features/*`에 page, widget, entity 책임이 겹쳐 있다.
- structure preflight: 현재 구현을 append-only로 확장하면 `app`와 `shared/domain`이 page orchestration, widget model, entity model을 계속 흡수해 경계가 더 흐려질 가능성이 높다.
- split-first: required. 구현 단계에서는 `app -> pages/monitor`, `widgets`, `features`, `entities`, `shared` 경계를 먼저 분리한다.
- bootstrap: repo baseline `../../docs/ai/ENGINEERING_RULES.md`와 task supplement `IMPLEMENTATION_CONTRACT.md`가 생성되어 `SLICE-1` 선행 조건이 해소됐다.

## Key decisions

- `work_type=feature`, `delivery_strategy=ui-first`로 고정한다.
- 이 앱은 KPI 대시보드가 아니라 run-detail-first 디버깅 워크벤치로 설계한다.
- FE 구조는 `app/pages/widgets/features/entities/shared` 6레이어로 고정하고 `processes`는 도입하지 않는다.
- `src/shared/domain`은 permanent owner가 아니라 이행 구간으로 본다.
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

- `SLICE-1`은 FSD boundary 문서와 page/app 책임선을 먼저 고정한다.
- `SLICE-2`는 `app`에서 `pages/monitor`를 분리하고 bootstrap only 경계를 남긴다.
- `SLICE-3`은 `features/run-list`, `features/run-detail`, `features/inspector`를 `widgets`로 승격한다.
- `SLICE-4`는 `shared/domain`, `session-log-loader`, `features/fixtures`, `features/ingestion`의 경계를 `entities`와 `shared` 기준으로 정리한다.
