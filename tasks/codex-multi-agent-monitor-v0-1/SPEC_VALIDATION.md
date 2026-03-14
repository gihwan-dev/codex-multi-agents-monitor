# Requirement coverage

| Requirement | Covered by | 상태 |
| --- | --- | --- |
| `REQ-01` run triage list | `PRD.md`, `UX_SPEC.md` | covered |
| `REQ-02` compressed graph detail | `PRD.md`, `UX_SPEC.md`, `TECH_SPEC.md` | covered |
| `REQ-03` waiting family + `wait_reason` | `PRD.md`, `UX_SPEC.md`, `schema.json` | covered |
| `REQ-04` handoff vs transfer separation | `PRD.md`, `UX_SPEC.md`, `TECH_SPEC.md`, `schema.json`, `ADR-001` | covered |
| `REQ-05` Graph/Waterfall/Map | `UX_SPEC.md`, `TECH_SPEC.md`, `ADR-002` | covered |
| `REQ-06` summary contract | `PRD.md`, `TECH_SPEC.md`, `schema.json` | covered |
| `REQ-07` import + local watch | `PRD.md`, `TECH_SPEC.md`, `ADR-004` | covered |
| `REQ-08` preview-only privacy default | `PRD.md`, `TECH_SPEC.md`, `schema.json`, `ADR-003` | covered |

# UX/state gaps

- `SCR-01`~`SCR-04`와 `FLOW-01`~`FLOW-05`는 정의됐지만, 실제 visual fidelity는 `SLICE-1`의 mock UI 결과물로 검증돼야 한다.
- Graph mode의 dense row threshold와 gap folding trigger는 설계 의도가 있으나 실제 fixture를 통한 조정이 필요하다.
- Waterfall과 Map은 보조 모드로 정의됐으므로 `SLICE-1`에서 navigation shell만, `SLICE-2`에서 interaction mock까지 확보해야 한다.

# Architecture/operability risks

- `RISK-01` import source format이 여러 형태로 들어오면 adapter 책임이 과도해질 수 있다.
- `RISK-02` local watch가 direct Codex runtime coupling으로 확장되면 v0.1 범위가 흔들릴 수 있다.
- `RISK-03` preview-only default를 지키지 않으면 privacy posture가 무너진다.
- `RISK-04` summary aggregation이 wall-clock과 compressed graph 사이에서 일관되지 않으면 사용자 신뢰가 떨어진다.

# Slice dependency risks

- `SLICE-1`의 shell 승인 없이는 `SLICE-2` 상태 모델이 흔들린다.
- `SLICE-2`에서 mock trace와 state transition이 정리되지 않으면 `SLICE-3`의 store/read model 계약이 불안정하다.
- `SLICE-3`에서 import adapter와 schema validation이 닫히지 않으면 `SLICE-4`의 live watch incremental update가 불안정하다.

# Blocking issues

- `RISK-05` 이 bundle은 구현 전 review gate를 통과해야 한다. 승인 전에는 실제 build slice 시작 금지.
- `RISK-06` canonical fixture와 `schema.json` 계약 검토가 끝나기 전에는 import/watch 구현 시작 금지.
- `RISK-07` privacy/export policy의 기본값에 대한 운영 승인 전에는 raw payload handling 구현 시작 금지.

# Proceed verdict

`blocking`

문서는 v0.1 구현 방향을 시작할 수 있을 만큼 정리됐지만, 현재 단계는 design bundle 생성 단계다. 따라서 gate 해소 전 실제 build slice를 시작하지 않는다.
