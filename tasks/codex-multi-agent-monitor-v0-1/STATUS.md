# Current slice

`SLICE-1` Static/visual UI shell

# Done

- `SLICE-0`는 이미 커밋 `3862e24`로 닫힌 상태임을 확인했고, stale한 retry 기록 대신 실제 다음 slice로 전진했다.
- App composition root를 정리하고 static `MonitorShell` 화면을 추가해 run rail, Graph top bar, summary strip, mode tabs, graph shell, inspector를 한 화면에 고정했다.
- 정적 shell 안에 `handoff`, `transfer`, folded gap, waiting, blocked, interrupted, failed/completed, final artifact vocabulary를 모두 배치해 `SLICE-2` mock interaction 전 visual shell 기준선을 만들었다.

# Decisions made during implementation

- `SLICE-1`은 static/presentational shell로만 유지하고, local state, keyboard, filter, import/watch, Tauri coupling은 도입하지 않았다.
- sample view data와 leaf rendering helper는 `src/features/monitor-shell/MonitorShell.tsx` 내부 private scope에 두고 shared type이나 schema-shaped fixture를 만들지 않았다.
- `src/styles.css`에는 feature selector를 추가하지 않고 기존 observatory token/base/utility와 inline Tailwind class만으로 화면을 구성했다.
- Waterfall과 Map은 이번 slice에서 navigation placeholder만 제공하고 실제 interaction은 `SLICE-2`로 넘긴다.

# Verification results

- `pnpm typecheck`: pass
- `pnpm build`: pass
- visual smoke: 미실행 (이 turn에는 browser harness를 열지 않아 수동 레이아웃 확인은 잔여 리스크로 남김)
- commit closure: 이번 실행에서 `feat(monitor-shell): 정적 모니터 셸 추가` 메시지로 커밋을 시도해 slice를 닫는다

# Known issues / residual risk

- `RISK-05`: review gate는 one-time 예외로 `SLICE-0`와 `SLICE-1`에 한해 승인됐다. `SLICE-2` 진입 전에는 추가 review approval이 필요하다.
- `RISK-06`: canonical fixture와 `schema.json` review가 닫히기 전에는 `SLICE-3` import/watch 구현을 시작할 수 없다.
- `RISK-07`: privacy/export 기본 승인 전에는 `SLICE-4` privacy/export/raw handling을 시작할 수 없다.
- 현재 shell은 static sample data 기준이라 interaction density, lane focus, inspector state transition은 `SLICE-2` mock interaction에서 다시 검증해야 한다.
- visual smoke가 빠졌으므로 실제 뷰포트별 spacing/overflow 이슈는 다음 확인에서 재검토가 필요하다.

# Next slice

`SLICE-2` Local state and mock interaction

먼저 볼 경계:
- canonical fixture를 정의하고 Graph shell의 selected event, jump target, gap fold/unfold, mode toggle을 local state로 연결
- Waterfall/Map placeholder를 mock interaction 대상 view로 승격하되 real API/integration은 계속 금지
- `src/styles.css`에는 feature selector를 더 쌓지 않고 feature-owned module과 utility-first 확장을 우선 유지
