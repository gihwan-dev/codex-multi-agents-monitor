# Requirement coverage

- `REQ-001` -> `SCR-001` -> `AC-001` -> `SLICE-1`/`SLICE-2`
- `REQ-002` -> `SCR-002` -> `AC-002` -> `SLICE-1`/`SLICE-3`
- `REQ-003` -> `SCR-002`/`FLOW-002`/`FLOW-003` -> `AC-002`/`AC-003`/`AC-005` -> `SLICE-3`
- `REQ-004` -> `SCR-003`/`FLOW-003`/`FLOW-004` -> `AC-003`/`AC-004` -> `SLICE-4`
- `REQ-005` -> `SCR-002`/`SCR-003`/`FLOW-005` -> `AC-005`/`AC-006` -> `SLICE-5`

# UX/state gaps

- `UX_SPEC.md`의 `30-Second Understanding Checklist`, `Visual Direction + Anti-goals`, `Glossary + Object Model`, `Layout/App-shell Contract`, `Token + Primitive Contract`, `Screen + Flow Coverage`, `Implementation Prompt/Handoff`가 정의되어 있다.
- `UX_BEHAVIOR_ACCESSIBILITY.md`의 `Interaction Model`, `Keyboard + Focus Contract`, `Accessibility Contract`, `Live Update Semantics`, `State Matrix + Fixture Strategy`, `Large-run Degradation Rules`, `Microcopy + Information Expression Rules`, `Task-based Approval Criteria`가 정의되어 있다.
- `DESIGN_REFERENCES/manifest.json`에 adopt 3개, avoid 1개 reference가 저장되어 있다.
- 기존 shipped UI는 source of truth가 아니라 redesign 대상이다. `reuse + delta`의 `reuse` 범위는 token family, thin primitives, preview-first data policy, graph/waterfall/map dataset contract로 제한한다.

# Architecture/operability risks

- `RISK-001` redesign이 giant restyle diff로 시작되면 shell/state/css monolith가 더 커진다. split-first를 강제해야 한다.
- `RISK-002` workspace tree selector와 graph selection state가 분리되지 않으면 left rail과 inspector가 같은 run/context를 잃을 수 있다.
- `RISK-003` row-based graph의 time gutter, selected path, gap folding을 renderer JSX에서 직접 계산하면 large-run에서 성능과 가독성이 동시에 무너질 수 있다.
- `RISK-004` alternate views와 live/import semantics가 graph-centered redesign 이후에 늦게 맞춰지면 mode switch와 paused-follow context가 깨질 수 있다.

# Slice dependency risks

- `SLICE-2`는 `SLICE-1`의 compact chrome, quick filter 위치, drawer hidden-by-default shell이 고정돼야 진행 가능하다.
- `SLICE-3`은 `SLICE-2`의 workspace tree semantics와 active run selection contract가 고정돼야 진행 가능하다.
- `SLICE-4`는 `SLICE-3`의 selected-path contract와 anomaly target semantics가 고정돼야 진행 가능하다.
- `SLICE-5`는 `SLICE-4`의 inspector/drawer/focus contract가 고정돼야 진행 가능하다.

# Blocking issues

- Resolved: repo baseline implementation rules는 `../../docs/ai/ENGINEERING_RULES.md`에 이미 존재한다.
- Resolved: `ui-first` planning에 필요한 `UX_SPEC.md`, `UX_BEHAVIOR_ACCESSIBILITY.md`, `DESIGN_REFERENCES/manifest.json`이 모두 채워졌다.
- No additional bootstrap blocker remains. The next step is `implement-task`.

# Proceed verdict

- proceed to implement-task
