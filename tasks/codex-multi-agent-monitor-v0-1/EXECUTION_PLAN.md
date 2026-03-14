# Execution slices

## `SLICE-0` Tailwind CSS Vite baseline

- Change boundary: official Tailwind CSS Vite baseline, global token/base layer, shell-compatible compatibility classes only
- Expected files: `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `src/styles.css`
- Validation owner: main thread
- Focused validation plan: `pnpm typecheck` + `pnpm build`
- Stop / Replan trigger: Radix, shadcn CLI/bootstrap, shared primitive extraction, 또는 App shell markup 변경이 필요해지면 현재 slice를 닫고 `SLICE-1` 진입 전에 재계획
- Split decision: `src/styles.css` 안에 App-specific layout/state logic가 섞이기 시작하면 중단하고 이후 slice에서 owning module로 분리
- Guardrail: Tailwind baseline setup만 허용, Radix/shadcn/shared primitive 추출 금지, App.tsx markup 수정 금지

## `SLICE-1` Static/visual UI shell

- Change boundary: Run List, Run Detail Graph shell, summary strip, inspector skeleton, navigation shell
- Expected files: `src/App.tsx`, `src/styles.css`, 필요 시 `src/features/monitor-shell/*`로 분리
- Validation owner: main thread
- Focused validation plan: `pnpm typecheck` + visual shell smoke check
- Stop / Replan trigger: Graph shell 안에 lane layout, rail, inspector stateful logic가 한 파일에 과도하게 섞이기 시작하면 분리 후 재설계
- Split decision: shell과 graph event row가 150 LOC 내외를 넘기거나 반복 view logic가 생기면 component split을 먼저 수행
- Guardrail: real API/integration 금지

## `SLICE-2` Local state and mock interaction

- Change boundary: mock trace fixture, filter state, selected event state, gap fold/unfold, mode toggle, jump bar interaction
- Expected files: `src/features/run-detail/*`, `src/features/run-list/*`, `src/mocks/*`
- Validation owner: main thread
- Focused validation plan: `pnpm typecheck` + mock-driven interaction smoke check
- Stop / Replan trigger: local state가 ingestion adapter나 persistence concern과 결합되기 시작하면 `SLICE-3`로 넘기고 현재 slice를 닫음
- Split decision: filter/jump bar/selection state가 branch-heavy해지면 custom hook 또는 feature module로 분리
- Guardrail: real API/integration 금지

## `SLICE-3` Import pipeline and normalized store

- Change boundary: completed import parser, `schema.json` validation, normalized store, summary aggregation, Graph/Waterfall/Map read model 연결
- Expected files: `src/features/ingest/*`, `src/features/store/*`, `src/features/read-model/*`, 필요 시 `src-tauri/src/*`
- Validation owner: main thread
- Focused validation plan: targeted schema fixture validation + `pnpm typecheck`
- Stop / Replan trigger: import source format이 하나의 adapter로 흡수되지 않거나 schema drift가 확인되면 adapter boundary를 재정의
- Split decision: parser, normalizer, read model이 한 모듈에 섞이면 adapter/store/read-model로 즉시 분리

## `SLICE-4` Local watch, privacy/export, focused regression

- Change boundary: local tail/watch adapter, incremental updates, preview/raw policy enforcement, export defaults, final regression polish
- Expected files: `src/features/watch/*`, `src/features/privacy/*`, `src/features/export/*`, 필요 시 `src-tauri/src/*`
- Validation owner: main thread
- Focused validation plan: watch fixture smoke check + `pnpm typecheck` + `pnpm build`
- Stop / Replan trigger: watch source가 direct runtime coupling을 요구하거나 privacy policy가 adapter layer 밖으로 새면 범위를 재설정
- Split decision: watch transport와 privacy/export policy가 서로 다른 실패 모드를 가지면 별도 module로 유지

# Verification

- `SLICE-0`: `pnpm typecheck`, `pnpm build`
- `SLICE-1`: `pnpm typecheck`
- `SLICE-2`: `pnpm typecheck`
- `SLICE-3`: `pnpm typecheck`, import fixture/schema validation
- `SLICE-4`: `pnpm typecheck`, `pnpm build`, 필요 시 `cargo check --manifest-path src-tauri/Cargo.toml`
- 모든 slice는 `타깃 검증 1개 + 저비용 체크 1개` 원칙을 따른다

# Stop / Replan conditions

- review gate limited approval은 `SLICE-0`와 `SLICE-1`까지만 유효하며, `SLICE-2` 진입 전 다시 확인한다
- `UX_SPEC.md`의 screen/state/source-of-truth가 변경되면 다음 slice 진입 전에 replan
- `schema.json`이 import와 watch를 동시에 설명하지 못하면 `SLICE-3` 시작 금지
- privacy/export 기본 정책에 합의가 없으면 `SLICE-4` 시작 금지
- direct Codex runtime coupling 요구가 생기면 v0.1 범위를 넘는지 재평가
- giant mixed slice 징후가 보이면 현재 slice를 닫고 분해안을 먼저 만든다
