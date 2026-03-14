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

- `SCR-01`~`SCR-04`와 `FLOW-01`~`FLOW-05`는 정의됐지만, 실제 visual fidelity는 `SLICE-0`의 baseline token 정리 이후 `SLICE-1`의 mock UI 결과물로 검증돼야 한다.
- Graph mode의 dense row threshold와 gap folding trigger는 설계 의도가 있으나 실제 fixture를 통한 조정이 필요하다.
- Waterfall과 Map은 보조 모드로 정의됐으므로 `SLICE-1`에서 navigation shell만, `SLICE-2`에서 interaction mock까지 확보해야 한다.

# Architecture/operability risks

- `RISK-01` import source format이 여러 형태로 들어오면 adapter 책임이 과도해질 수 있다.
- `RISK-02` local watch가 direct Codex runtime coupling으로 확장되면 v0.1 범위가 흔들릴 수 있다.
- `RISK-03` preview-only default를 지키지 않으면 privacy posture가 무너진다.
- `RISK-04` summary aggregation이 wall-clock과 compressed graph 사이에서 일관되지 않으면 사용자 신뢰가 떨어진다.

# Slice dependency risks

- `SLICE-0`의 Tailwind baseline 정리가 닫히지 않으면 `SLICE-1` shell visual consistency가 흔들린다.
- `SLICE-1`의 shell 승인 없이는 `SLICE-2` 상태 모델이 흔들린다.
- `SLICE-2`에서 mock trace와 state transition이 정리되지 않으면 `SLICE-3`의 store/read model 계약이 불안정하다.
- `SLICE-3`에서 import adapter와 schema validation이 닫히지 않으면 `SLICE-4`의 live watch incremental update가 불안정하다.

# Blocking issues

- `RISK-05` review gate는 one-time 예외로 `SLICE-0`와 `SLICE-1`에 한해 승인됐다. `SLICE-2` 진입 전에는 추가 review approval이 필요하다.
- `RISK-06` canonical fixture와 `schema.json` 계약 검토가 끝나기 전에는 import pipeline 또는 local watch 구현 시작 금지.
- `RISK-07` privacy/export policy의 기본값에 대한 운영 승인 전에는 privacy/export 구현과 raw payload handling 시작 금지.

# Proceed verdict

`limited-proceed`

문서는 `SLICE-0`과 `SLICE-1`을 시작할 수 있을 만큼 정리됐지만, 그 이후 slice는 추가 review gate 확인이 필요하다. 따라서 import/watch와 privacy/export/raw handling은 각 blocker가 해소되기 전까지 시작하지 않는다.
