# Spec Validation

## Requirement coverage

- `REQ-001`: `TECH_SPEC.md`와 `MIGRATION.md`가 Tailwind v4 + shadcn foundation 도입 경로를 정의한다.
- `REQ-002`: `UX_SPEC.md`의 `SCR-001`, `SCR-002`, `FLOW-001`, `FLOW-002`와 `VERIFICATION.md`가 Storybook approval loop를 고정한다.
- `REQ-003`: `UX_SPEC.md` `Token + Primitive Contract`와 `TECH_SPEC.md` `Proposed architecture`가 semantic token SSOT를 정의한다.
- `REQ-004`: `EXECUTION_PLAN.md` `SLICE-3`~`SLICE-5`와 `MIGRATION.md` `Phase 3`가 staged surface adoption을 다룬다.
- `REQ-005`: `MIGRATION.md` `Phase 4`, `VERIFICATION.md`, `ROLLBACK.md`가 CSS retirement와 rollback 규칙을 다룬다.
- `REQ-006`: `MIGRATION.md` scope split과 `TECH_SPEC.md` risk `RISK-003`가 issue `#5` handoff를 정의한다.

## UX/state gaps

- user-facing theme toggle 위치와 final UX는 의도적으로 issue `#5`로 남겨 두었다.
- graph event-row styling을 utility-only로 끝낼지, documented custom exception을 둘지는 `SLICE-5` 검증 결과에 따라 재판단이 필요하다.
- Storybook story taxonomy는 고정했지만, 실제 naming convention은 implementation supplement에서 최종 잠금이 필요하다.

## Architecture/operability risks

- `RISK-001`: utility class sprawl가 dense graph shell 가독성을 낮출 수 있다.
- `RISK-002`: shadcn default aesthetics가 기존 operator-console identity를 약화시킬 수 있다.
- `RISK-003`: 확정된 `#4`/`#5` 경계가 implementation 중 다시 섞이면 slice order가 흔들린다.
- `RISK-004`: Vite/Tauri/Storybook 세 환경에서 Tailwind entry CSS가 다르게 동작할 수 있다.

## Slice dependency risks

- `SLICE-1`이 token bridge와 Storybook foundation을 고정하지 못하면 이후 모든 surface slice가 블로킹된다.
- `SLICE-2`가 primitive/composite stories를 충분히 만들지 못하면 `SLICE-3+`가 giant surface rewrite로 흘러간다.
- `SLICE-5`가 graph shell readability를 해치면 `SLICE-6`의 CSS retirement는 진행하면 안 된다.
- issue `#5` 범위가 조기 편입되면 현재 slice plan을 다시 쪼개야 한다.

## Blocking issues

- Bootstrap cleared: repo baseline `../../docs/ai/ENGINEERING_RULES.md`와 task supplement `IMPLEMENTATION_CONTRACT.md`가 같은 styling contract를 공유한다.
- Theme scope는 확정됐다. issue `#4`는 `theme-ready architecture + Storybook preview`, issue `#5`는 full theme UX/productization을 담당한다. 구현 중 이 경계를 깨면 replan 해야 한다.

## Proceed verdict

- verdict: advisory
- reason: UX packet, migration plan, repo baseline, task supplement가 정렬됐고 다음 실행 대상은 `SLICE-1`이다.
