# Goal

Codex Multi-Agent Monitor v0.1은 대시보드가 아니라 디버깅 워크벤치다. 사용자가 하나의 멀티 에이전트 run을 열었을 때 30초 안에 누가 생성됐고, 누가 누구에게 일을 넘겼고, 어디서 기다리고 있고, 무엇을 남기고 어떻게 끝났는지를 읽을 수 있어야 한다.

# Document map

- `PRD.md`: 문제 정의, 사용자 가치, v0.1 범위, 성공 기준
- `UX_SPEC.md`: 정보 구조, 화면, 상태, interaction, visual grammar
- `TECH_SPEC.md`: ingest, normalization, storage/read model, privacy, performance
- `schema.json`: normalized trace envelope와 entity contract
- `ACCEPTANCE.feature`: 사용자 관점 acceptance scenario
- `EXECUTION_PLAN.md`: `SLICE-0 -> SLICE-1 -> SLICE-2 -> SLICE-3 -> SLICE-4` 구현 순서
- `IMPLEMENTATION_CONTRACT.md`: bootstrap 기준의 구현 계약, baseline override, deferred dependency trigger
- `SPEC_VALIDATION.md`: 현재 설계의 coverage, risk, blocking verdict
- `STATUS.md`: design 단계 초기 상태와 다음 slice
- `ADRs/*`: 핵심 결정 기록

# Key decisions

- `work_type=feature`, `delivery_strategy=ui-first`
- 정보 구조는 `Project -> Session -> Run`
- normalized model은 `Project`, `Session`, `RunTrace`, `AgentLane`, `EventObservation`, `EdgeLink`
- v0.1 기본 읽기 모드는 실제 비례 시간축이 아니라 compressed graph
- 수집 범위는 completed run import + local live tail/watch
- privacy 기본값은 preview-only storage, raw opt-in, export raw excluded
- repo baseline stack과 dependency policy는 `docs/ai/ENGINEERING_RULES.md`에 고정한다
- task-specific implementation narrowing은 `IMPLEMENTATION_CONTRACT.md`를 단일 계약으로 사용한다
- 내부 모델은 vendor-agnostic으로 두고 Codex/OTel/Langfuse/Agents SDK 개념과 매핑한다

# Validation gate status

- Gate: `partial approval`
- 이유: one-time review gate 예외로 `SLICE-0`와 `SLICE-1`은 시작할 수 있지만, `SLICE-2` 이후는 추가 승인과 blocker 해소가 필요하다
- 현재 상태: Tailwind baseline setup과 static shell slice는 진행 가능하지만, import/watch와 privacy/export/raw handling은 여전히 각 gate에 묶여 있다
- review gate 승인 범위는 `SLICE-0`/`SLICE-1` 한정이며, canonical fixture/schema review와 privacy approval blocker는 그대로 유지된다

# Implementation slice order

1. `SLICE-0` Tailwind CSS Vite baseline
2. `SLICE-1` Static/visual UI shell
3. `SLICE-2` Local state and mock interaction
4. `SLICE-3` Import pipeline and normalized store
5. `SLICE-4` Local watch, privacy/export, focused regression
