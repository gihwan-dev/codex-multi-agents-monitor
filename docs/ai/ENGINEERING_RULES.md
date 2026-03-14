# Project Profile

- 제품 성격: Codex 멀티 에이전트 run을 읽는 Tauri desktop-first monitoring workbench v0.1
- active bundle: `tasks/codex-multi-agent-monitor-v0-1`
- 저장소 형태: React/Vite frontend와 Tauri native shell을 가진 pnpm single-package app
- bootstrap 범위: 문서와 agent memory contract만 다루며, 코드/설정/패키지 설치는 범위 밖이다

# Locked Decisions

- runtime and language: Node.js `20.19+`, TypeScript `5.8`, Rust `2021`
- framework and app shell: React `19`, Vite `7`, Tauri `2`
- package manager: `pnpm@10` single-package repository
- state and data baseline:
  - `SLICE-1` and `SLICE-2`: feature-local React state and mock-driven interaction only
  - `SLICE-3` and `SLICE-4`: repo-local normalized store plus read-model composer
  - v0.1 does not introduce a remote query or cache layer
- styling and design-system baseline:
  - Tailwind CSS for tokens and utility composition
  - Radix primitives for accessible low-level behavior
  - shadcn/ui-style local component pattern for repo-owned UI building blocks
  - visual direction은 `UX_SPEC.md`의 `Warm Graphite Observatory`를 따른다
- quality baseline: ESLint, Prettier, Vitest, `pnpm typecheck`, `pnpm build`, `cargo check --manifest-path src-tauri/Cargo.toml`

# Architecture Boundaries

- `src/components/ui`: Tailwind + Radix + shadcn/ui-style local composition 위의 shared low-level primitives
- `src/features/monitor-shell`: top-level shell, layout chrome, mode framing
- `src/features/run-list`: run triage list와 project/session/run navigation 책임
- `src/features/run-detail`: Graph, Waterfall, Map, jump bar, inspector interaction 책임
- `src/features/ingest`: import adapter와 raw source parsing boundary
- `src/features/store`: canonical normalized entity와 write-side store logic
- `src/features/read-model`: Graph, Waterfall, Map, inspector, summary view-model composition
- `src/features/watch`: local tail/watch adapter와 incremental ingest entry
- `src/features/privacy`: preview/raw policy enforcement와 redaction hook
- `src/features/export`: export filtering과 raw exclusion default
- `src-tauri`: native filesystem, watch, shell adapter boundary만 담당하며 UI state와 read-model logic은 두지 않는다

# Coding Conventions

- 구현 전 읽기 순서: `docs/ai/ENGINEERING_RULES.md` -> task `IMPLEMENTATION_CONTRACT.md` -> task `SPEC_VALIDATION.md`
- 문서는 한국어 기본으로 유지하되 enum, event type, field name, command, traceability ID는 영어를 유지한다
- source와 문서 모두 ASCII 기본을 우선하고, 기존 파일 특성상 필요한 경우에만 예외를 둔다
- shared primitive는 `src/components/ui`에 두고, task-specific behavior는 owning feature module 안에 둔다
- schema, privacy policy, slice sequencing의 두 번째 source of truth를 task bundle 밖에 만들지 않는다

# Validation Commands

기본 validation contract는 아래 exact command를 사용한다:

```bash
pnpm typecheck
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

- bootstrap 검증 메모: 위 명령은 2026-03-14 현재 스캐폴드에서 모두 통과했다
- slice-specific smoke check는 추가 가능하지만, 위 baseline command를 대체하지는 않는다

# Dependency Policy

## Locked now

- core platform: React `19`, React DOM `19`, Vite `7`, TypeScript `5.8`, Tauri `2`, Rust `2021`
- workspace tooling: `pnpm@10`, ESLint, Prettier, Vitest
- UI baseline: Tailwind CSS, Radix primitives, shadcn/ui-style local component pattern

## Deferred

### Graph or visualization library

- Decision: Graph, Waterfall, Map rendering library choice는 deferred로 둔다
- Why deferred: `SLICE-1`과 `SLICE-2`에서 shell density와 interaction shape를 먼저 검증해야 heavy graph abstraction lock-in을 피할 수 있다
- Trigger: handcrafted shell이나 mock interaction만으로 dense lane layout, edge routing, Map readability를 감당하지 못할 때
- Needed input: fixture density, interaction pain point, required layout primitive

### List virtualization

- Decision: virtualization library choice는 deferred로 둔다
- Why deferred: 현재 bundle은 scan-speed goal은 고정했지만 virtualization overhead를 정당화할 row count는 아직 고정하지 않았다
- Trigger: canonical fixture나 live watch run에서 row count 또는 scroll cost가 run-detail readability를 무너뜨릴 때
- Needed input: event-count envelope, measured render cost, expected inspector coupling

### JSON schema validator implementation

- Decision: concrete JSON schema validator library choice는 deferred로 둔다
- Why deferred: `schema.json` contract는 고정됐지만, executable validation path는 import adapter와 store boundary가 붙는 `SLICE-3` 책임이다
- Trigger: import pipeline implementation이 시작되거나 fixture validation에 executable schema check가 필요해질 때
- Needed input: schema validation runtime need, bundle-size tolerance, Tauri/frontend ownership boundary

### Command palette or helper library

- Decision: command palette와 keyboard-helper library choice는 deferred로 둔다
- Why deferred: `Cmd/Ctrl+K`와 관련 shortcut은 정의됐지만, shell-first slice에서는 helper abstraction lock-in 전 UX flow 확인이 우선이다
- Trigger: shortcut handling이나 jump-bar search가 dedicated helper를 정당화할 만큼 branch-heavy해질 때
- Needed input: final shortcut matrix, accessibility expectation, cross-platform keybinding constraint

### Icon pack

- Decision: icon pack choice는 deferred로 둔다
- Why deferred: state signal과 edge semantic은 정의됐지만 final icon vocabulary는 승인된 shell visual language를 따라야 한다
- Trigger: `SLICE-1` shell approval에서 placeholder glyph를 넘어서는 stable icon set이 필요해질 때
- Needed input: approved visual system, export constraint, Graph/Waterfall/Map 간 consistency need

## Banned/Avoid

- 같은 surface에 Tailwind와 병행되는 두 번째 styling system
- repo-local normalized store 계획을 우회하는 duplicate global state/data-fetching layer
- raw-by-default payload storage 또는 export behavior
- v0.1 implementation slice 내부의 direct Codex runtime coupling
- pnpm에서 벗어나는 package-manager 변경
- adapter boundary에서 privacy layer 또는 `schema.json` contract를 우회하는 구현

# Decision Update Rules

- `docs/ai/ENGINEERING_RULES.md`는 platform, tooling, module boundary, dependency policy의 repo baseline source of truth다
- task document가 task-specific choice를 좁힐 때는 task `IMPLEMENTATION_CONTRACT.md`와 기존 task source-of-truth bundle만 사용한다
- baseline stack, validation contract, boundary map이 바뀌면 먼저 `ENGINEERING_RULES.md`를 갱신하고 그 다음 task-level document를 갱신한다
- Deferred item은 문서에 적힌 trigger가 충족되고 task contract에 narrowed decision이 기록되기 전까지 deferred 상태를 유지한다
- `SPEC_VALIDATION.md` blocker는 해당 blocker가 bootstrap documentation 부재를 직접 가리킬 때만 baseline edit로 해소할 수 있다

# Prohibited Patterns

- native adapter logic와 UI business logic를 같은 module에 섞는 패턴
- normalized store/read-model boundary를 우회하는 feature code
- preview-only privacy default를 v0.1에서 optional처럼 다루는 패턴
- documented trigger와 task contract 확인 없이 optional library를 도입하는 패턴
- baseline command를 건너뛰고 ad hoc smoke check만으로 validation을 대체하는 패턴
