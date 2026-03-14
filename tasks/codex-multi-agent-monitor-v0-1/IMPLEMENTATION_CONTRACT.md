# Inputs Read

- `tasks/codex-multi-agent-monitor-v0-1/README.md`
- `tasks/codex-multi-agent-monitor-v0-1/PRD.md`
- `tasks/codex-multi-agent-monitor-v0-1/UX_SPEC.md`
- `tasks/codex-multi-agent-monitor-v0-1/TECH_SPEC.md`
- `tasks/codex-multi-agent-monitor-v0-1/schema.json`
- `tasks/codex-multi-agent-monitor-v0-1/EXECUTION_PLAN.md`
- `tasks/codex-multi-agent-monitor-v0-1/SPEC_VALIDATION.md`
- `tasks/codex-multi-agent-monitor-v0-1/ADRs/ADR-001-hybrid-trace-model.md`
- `tasks/codex-multi-agent-monitor-v0-1/ADRs/ADR-002-compressed-graph-default.md`
- `tasks/codex-multi-agent-monitor-v0-1/ADRs/ADR-003-preview-only-privacy-default.md`
- `tasks/codex-multi-agent-monitor-v0-1/ADRs/ADR-004-import-plus-local-watch-scope.md`
- `README.md`
- `package.json`
- `tsconfig.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

# Task-Specific Decisions

- 기본 read mode는 계속 `compressed graph`로 두고, Waterfall과 Map은 같은 normalized run data 위의 secondary lens로 유지한다
- privacy posture는 `preview-only` default를 유지하고 `raw opt-in`, `export raw excluded`를 end to end로 보존한다
- v0.1 ingest scope는 completed run import와 local live tail/watch로 제한하며, direct runtime coupling은 이 contract에 포함하지 않는다
- internal data model은 vendor-agnostic을 유지하고, adapter는 source payload와 normalized schema 사이의 sole translation layer로 둔다
- slice sequencing은 `SLICE-1 -> SLICE-2 -> SLICE-3 -> SLICE-4`를 유지하고 `ui-first` delivery strategy를 보존한다

# Allowed Core Libraries

- platform core: React `19`, React DOM `19`, Vite `7`, TypeScript `5.8`, Tauri `2`
- UI core: Tailwind CSS, Radix primitives, shadcn/ui-style local component pattern
- quality core: ESLint, Prettier, Vitest, `pnpm typecheck`, `pnpm build`, `cargo check --manifest-path src-tauri/Cargo.toml`
- data boundary core: repo-local normalized store, read-model composer, `schema.json` fixed internal contract

# Deferred Decisions and Trigger

## Graph or visualization library

- Decision: dedicated graph 또는 visualization library는 deferred로 둔다
- Why deferred: shell density와 edge-routing 필요성은 `SLICE-1`과 `SLICE-2` fixture로 먼저 증명해야 한다
- Trigger: repo-local layout primitive만으로 Graph, Waterfall, Map의 가독성을 유지할 수 없을 때
- Needed input: lane density, edge complexity, approved shell fixture의 interaction requirement

## List virtualization

- Decision: list virtualization library adoption은 deferred로 둔다
- Why deferred: event volume threshold가 canonical fixture 기준으로 아직 검증되지 않았다
- Trigger: canonical fixture나 live watch run에서 scroll/render cost가 run-detail scan speed를 떨어뜨릴 때
- Needed input: row count envelope, render measurement, inspector synchronization need

## JSON schema validator implementation

- Decision: concrete schema validator library choice는 deferred로 둔다
- Why deferred: contract는 지금 고정됐지만 runtime validation은 import/store wiring이 시작되는 `SLICE-3` 책임이다
- Trigger: import pipeline implementation 또는 fixture validation에 executable schema enforcement가 필요해질 때
- Needed input: frontend/native ownership choice, runtime performance need, schema-validation ergonomics

## Command palette or helper library

- Decision: command palette와 keyboard helper adoption은 deferred로 둔다
- Why deferred: shortcut surface는 정의됐지만 shell-first slice에서는 실제 interaction complexity를 먼저 검증해야 한다
- Trigger: `Cmd/Ctrl+K`, jump bar, shortcut handling이 helper abstraction을 정당화할 만큼 branch-heavy해질 때
- Needed input: final shortcut matrix, accessibility expectation, desktop keybinding edge case

## Icon pack

- Decision: icon pack selection은 deferred로 둔다
- Why deferred: icon vocabulary는 승인된 `Warm Graphite Observatory` shell language를 따라야지 선행해서 고정하면 안 된다
- Trigger: shell approval에서 temporary placeholder를 넘어서는 stable icon set이 필요해질 때
- Needed input: approved visual system, required state glyph, export/licensing constraint

# Validation Overrides

- bootstrap 단계에서는 별도 override가 없다
- repo baseline validation command는 `docs/ai/ENGINEERING_RULES.md`를 따른다
- `EXECUTION_PLAN.md`의 slice-specific smoke check는 additive이며 baseline command를 대체하지 않는다

# Open Risks

- `RISK-05`: bundle이 review gate를 통과하기 전에는 implementation을 시작할 수 없다
- `RISK-06`: canonical fixture와 `schema.json` contract review가 끝나기 전에는 import/watch implementation을 시작할 수 없다
- `RISK-07`: privacy/export default가 운영 승인되기 전에는 raw payload handling을 시작할 수 없다
- bootstrap documentation은 위 blocker를 해소하지 않으며, 승인이 닫히기 전까지 task는 계속 `blocking` 상태다
