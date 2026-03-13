# Current slice

SLICE-6

# Done

- `src/features/timeline` 모듈을 추가해 selected session detail을 vertical sequence timeline과 detail drawer로 투영했다. projection, viewport preset, SVG canvas, drawer binding을 모듈 내부로 분리했다.
- Live Monitor는 selected session detail query를 page에서 소유하고, timeline/drawer가 같은 selection state를 공유하도록 재배선했다.
- 타임라인은 `User -> Main -> 기타 lane` 순서, top -> bottom 시간축, latest-at-bottom, merged tool span, reasoning summary, token collapse 규칙으로 실제 canonical detail을 렌더링한다.
- live는 recent-zoom + latest follow on으로 시작하고, archive는 fit-all preset을 지원하도록 모델을 열어 두었다. 사용자가 scrub/drag/zoom으로 개입하면 follow를 끄고 `Eye` control로 다시 최신 추적을 복구할 수 있다.
- Detail drawer는 `Summary`, `Input-Output`, `Raw`, `Tokens`, `Related metrics` 탭으로 selection source-of-truth를 공유한다.
- root README와 task bundle 문서를 vertical timeline, live/archive preset, latest follow state machine 기준으로 갱신했다.

# Decisions made during implementation

- `SLICE-6` 범위는 session-local MVP로 고정하고 Rust/Tauri detail contract는 변경하지 않았다.
- lane label은 `meta.agent_nickname` 우선, 없으면 `agent_role`, 그것도 없으면 정제된 `lane_id`를 사용한다.
- `tool_call` + `tool_output`는 `call_id` 기준 merged item으로 렌더하고, `token_delta`는 timeline noise 대신 drawer totals로 접었다.
- archive 화면의 실제 timeline 소비는 `SLICE-7`로 넘기고, 이번 slice는 archive preset과 테스트만 먼저 고정했다.
- 문서 영향 범위는 root `README.md`, `UX_SPEC.md`, `TECH_SPEC.md`, `PRD.md`, `ADR-002`, `STATUS.md`로 판정했다.

# Verification results

- edit-only phase라 validation/commit은 아직 수행하지 않았다.
- 다음 phase에서 `pnpm test -- src/features/timeline/model/projection.test.ts src/features/timeline/model/viewport.test.ts src/features/timeline/ui/timeline-detail-sync.test.tsx src/pages/monitor/lib/ui-qa-fixtures.test.ts`, `pnpm typecheck`, 필요 시 `pnpm exec playwright test playwright/monitor-ui.spec.ts`를 실행한다.
- commit: 금지 상태 유지

# Known issues / residual risk

- true cross-session sub-agent replay parity는 아직 없다. 현재 detail renderer는 선택된 session의 query contract만 사용한다.
- archive 화면은 아직 placeholder shell이므로 fit-all preset이 실제 archive replay surface까지 연결되지는 않았다.
- 10k-event 성능 예산은 unit/component 테스트로 규칙만 고정했고, 실제 브라우저 상호작용 성능 smoke는 후속 slice에서 더 봐야 한다.
- live append가 매우 빠르게 들어오는 동안 latest follow와 manual mode 전환을 사람이 눌러 보는 상호작용 smoke는 아직 못 했다.

# Next slice

SLICE-7
- 목표: archive 화면이 `features/timeline`의 fit-all preset을 실제로 소비하도록 연결하고, archive filter/result rail과 live/detail parity를 연다.
- 선행조건: 현재 `pages/monitor`의 archive placeholder 경계를 archive result selection + detail feed로 치환하고, session-local MVP를 archive result list UX와 충돌 없이 재사용해야 한다.
- 먼저 볼 경계: archive monitor shell, archive result selection, timeline module의 `mode="archive"` 소비 지점, dense result/filter surface.
