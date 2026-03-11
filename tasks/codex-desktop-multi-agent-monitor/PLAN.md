# Goal
- `tasks/codex-desktop-multi-agent-monitor/PLAN.md`를 현재 기준선 문서로 유지한다.
- 이번 계획의 목표는 라이브 모니터링의 기준을 `status = inflight`가 아니라 `archived = 0`인 root thread로 재정의해서, 아직 아카이브되지 않은 현재 대화가 Overview와 Thread Detail에서 끊기지 않게 만드는 것이다.
- 성공 기준은 다음 세 가지다.
- Live Overview가 `completed` 상태라도 아직 아카이브되지 않은 현재 대화 thread를 계속 노출한다.
- Thread Detail과 drilldown이 `completed but unarchived` thread에서도 자동 갱신을 유지한다.
- UI 문구, 테스트, 아키텍처 문서가 더 이상 live를 `inflight`의 동의어로 설명하지 않는다.

# Task Type
- `bugfix`

# Scope / Non-goals
- Scope:
- Live membership를 `archived = 0`인 main/root thread 기준으로 재정의한다.
- Live Overview query, Thread Detail polling, 관련 copy/test/doc를 같은 의미 체계로 정렬한다.
- 기존 Slice 7B 이후 구현 상태를 전제로, 이번 턴은 다음 구현 세션에서 바로 집행 가능한 bounded slice를 설계한다.
- Non-goals:
- ingest 파이프라인 전면 재설계
- archived history 계산 방식 변경
- subagent를 Overview top-level card로 승격
- Codex source 파일 쓰기, 아카이브 동작 자체 제어, 비공개 IPC 의존

# Keep / Change / Don't touch
- Keep:
- Frontend는 계속 Tauri `invoke` contract만 사용하고 `~/.codex`를 직접 읽지 않는다.
- `status`는 실행 상태(`inflight`/`completed`) 의미로 유지한다.
- History 화면은 계속 archived source 중심 회고 화면으로 유지한다.
- timeline-first UX와 summary-first/raw-expand 정책을 유지한다.
- Change:
- Live Overview의 membership 기준을 `archived = 0`으로 옮긴다.
- Thread Detail polling 기준도 `status` 대신 archive visibility를 반영하도록 바꾼다.
- shared thread contract가 필요 최소한으로 archive visibility를 전달하도록 조정한다.
- Overview/Detail/UI copy와 architecture wording에서 `inflight thread` 표현을 현재 대화 의미와 분리한다.
- Don't touch:
- `~/.codex` 내부 파일 구조와 write path
- command 이름(`list_live_threads`, `get_thread_detail`, `get_thread_drilldown`)
- source health Slice 7B 동작과 History health contract

# Evidence
## Repo evidence
- `src-tauri/src/commands/api/live_overview.rs:60-101`의 base row query가 `archived = 0 and status = 'inflight'`를 hard filter로 사용한다.
- 같은 파일의 agent role, open wait, active tool, mini timeline query도 모두 같은 `threads.status = 'inflight'` 조건을 반복한다 (`src-tauri/src/commands/api/live_overview.rs:104-223`, `src-tauri/src/commands/api/live_overview.rs:252-423`).
- Thread Detail page와 drilldown polling은 모두 `thread.status === "inflight"`일 때만 2초 polling을 유지한다 (`src/pages/thread-detail/thread-detail-page.tsx:16-22`, `src/features/thread-detail/ui/thread-timeline-shell.tsx:28-33`).
- Overview header/empty/filter-empty copy가 live를 직접 `inflight thread`로 설명한다 (`src/features/overview/ui/live-overview-shell.tsx:20-26`, `src/features/overview/ui/live-overview-empty-state.tsx:10-12`, `src/features/overview/ui/live-overview-content.tsx:45-48`).
- Rust test가 현재 동작을 `only_inflight_unarchived_threads`로 고정하고 있다 (`src-tauri/src/commands/api/tests/live_overview.rs:15-57`).
- Frontend test도 completed detail은 첫 fetch 이후 polling하지 않는 동작을 고정한다 (`src/pages/thread-detail/thread-detail-page.test.tsx:90-130`).
- ingest는 이미 live session file이 들어오면 archived snapshot root를 `archived = 0`으로 되돌려 live overview/detail에 다시 노출시키도록 설계돼 있다 (`src-tauri/src/commands/api/tests/ingest_visibility.rs:86-156`). 즉 archived flag는 visibility 경계로 이미 사용 중이다.
- 아키텍처 문서도 현재 Overview query를 `read inflight summary`로 설명하고 있어 구현과 함께 수정 포인트가 명확하다 (`docs/architecture.md:36-40`).
- 현재 기준 STATUS는 Slice 7B까지 완료됐고, 이번 이슈는 source health가 아니라 live visibility semantics의 후속 버그픽스다 (`tasks/codex-desktop-multi-agent-monitor/STATUS.md:1-50`).
- 로컬 read-only 확인 결과 `2026-03-11` 기준 `~/.codex/state_5.sqlite`에는 unarchived row 583개, 그중 root thread 157개가 있다. 가장 최근 unarchived root에는 현재 사용자 요청이 포함되어 있어, 실제 사용 흐름에서도 `archived = 0`이 현재 대화 집합과 맞닿아 있다. 이 수치는 로컬 환경 증거이며 제품 계약 그 자체는 아니다.

## External evidence
- 확인일: `2026-03-11`
- Codex App Features 문서는 “active conversation thread”를 별도 창으로 유지할 수 있다고 설명한다. 이는 현재 작업 중인 대화가 실행 상태와 별개로 UI 객체로 유지된다는 근거다. 출처: [developers.openai.com/codex/app/features](https://developers.openai.com/codex/app/features)
- 같은 문서는 app/IDE 사이에서 “threads running in the Codex app inside the IDE Extension, and vice versa”를 본다고 설명한다. thread visibility가 단순 one-run inflight보다 넓은 수명 주기를 가진다는 근거다. 출처: [developers.openai.com/codex/app/features](https://developers.openai.com/codex/app/features)
- Codex CLI slash commands 문서는 `/resume`가 saved-session picker로 이전 conversation transcript를 다시 불러오고 “original history intact”를 유지한다고 설명한다. 현재 대화의 continuity는 실행 상태보다 conversation/session lifecycle에 가깝다. 출처: [developers.openai.com/codex/cli/slash-commands](https://developers.openai.com/codex/cli/slash-commands)
- Codex CLI features 문서는 `codex resume <SESSION_ID>`가 `~/.codex/sessions/` 아래 파일을 기준으로 동작한다고 설명한다. 현재 세션 집합의 1차 소스가 live sessions directory라는 기존 설계와 일치한다. 출처: [developers.openai.com/codex/cli/features](https://developers.openai.com/codex/cli/features)
- Codex Automations 문서는 결과가 없으면 task를 자동 archive하고, finding이 있으면 inbox/triage로 남긴다고 설명한다. archive는 visibility lifecycle의 경계로 해석하는 것이 문서화된 Codex UX와 맞다. 출처: [developers.openai.com/codex/app/automations](https://developers.openai.com/codex/app/automations)
- 위 문서들은 “live는 archived=0”를 문자 그대로 정의하지는 않는다. 이 결론은 official docs의 active conversation/resume/archive lifecycle 설명과 현재 저장소 구현 증거를 결합한 추론이다.

## Options considered
- Option A: Overview backend filter에서 `status = 'inflight'`만 제거한다.
- 장점은 diff가 작다.
- 단점은 Thread Detail/drilldown polling이 여전히 completed thread에서 멈춰서, 사용자는 live card를 클릭해도 detail이 stale해질 수 있다.
- Option B: frontend detail polling을 무조건 2초로 유지한다.
- 장점은 shared contract를 안 바꿀 수 있다.
- 단점은 archived/history thread까지 polling하게 되고, user가 명시한 archive boundary를 무시한다.
- Option C: archive visibility를 shared contract에 최소 노출하고, Overview membership와 Detail polling을 같은 규칙으로 정렬한다.
- 장점은 user rule(`아카이브되지 않은 채팅`)과 backend/frontend semantics가 일관된다.
- 단점은 shared/public contract 변경이 필요하다.
- 채택은 Option C다.

# Decisions / Open questions
## Chosen approach
- live membership의 canonical rule은 `root thread && archived = 0`으로 둔다.
- `status`는 계속 run execution state로만 사용한다. 즉 `completed but unarchived`는 “지금 실행 중은 아니지만 아직 현재 대화 집합에 남아 있는 thread”로 취급한다.
- Detail polling을 위해 `MonitorThread` 계열 shared contract에 archive visibility를 노출한다. 구현 표현은 `archived: boolean`이 우선이다.
- 이유는 `is_live` 같은 derived field보다 DB/source truth와 user language를 그대로 유지하고, frontend가 `!archived`를 명시적으로 사용할 수 있기 때문이다.
- Live Overview는 여전히 root thread만 보여준다. subagent는 detail lane과 drilldown으로만 유지한다.
- overview 정렬은 `updated_at desc`를 유지하고, 병목/mini timeline 계산은 같은 thread 집합 안에서 열린 wait/tool과 최근 10분 이벤트를 보여준다.
- overview/detail copy는 `inflight` 대신 `현재 대화`, `live`, `아카이브되지 않은 thread` 중 현재 UX 톤에 맞는 표현으로 통일한다. 기본 가정은 `현재 대화 thread`다.

## Rejected alternatives
- `completed` thread를 recent window(예: 최근 10분) 같은 휴리스틱으로만 live에 포함하는 방안
- archive visibility는 숨긴 채 detail polling만 unconditional로 돌리는 방안
- 기존 `list_live_threads` semantics를 유지하고 별도 `list_current_threads` API를 추가하는 방안

## Need user decision
- 없음

## Quality preflight
- verdict: `promote-architecture`
- 근거:
- 문제는 단일 query 버그처럼 보이지만 실제로는 backend query semantics, shared thread contract, frontend polling rule, UI wording, docs/tests에 같은 `inflight == live` 가정이 중복돼 있다.
- `archived` visibility를 frontend가 알 수 없어서, user 요구를 충족하려면 backend/frontend public surface 변경이 필요하다.
- 후속 경로:
- shared contract를 먼저 안정화한 뒤 query/filter/polling/UI copy를 순차 slice로 분리한다.
- 한 번에 giant mixed diff로 밀지 않고 boundary fix -> backend query -> frontend polling -> wording/docs 순으로 자른다.

# Execution slices
## Slice 1. Thread visibility contract를 archive-aware로 고정
- Change boundary:
- `MonitorThread`/`ThreadDetail` 계열 contract에 archive visibility를 추가한다.
- thread detail API가 `threads.archived`를 읽어 직렬화하도록 바꾼다.
- live overview membership 자체는 아직 바꾸지 않는다.
- Expected files:
- 기본 3개 경계 예외를 허용한다.
- 예상 파일: `src-tauri/src/domain/models.rs`, `src/shared/types/contracts.ts`, `src-tauri/src/commands/api/thread_detail.rs`, `src-tauri/src/commands/api/tests/thread_detail.rs`
- 예외 사유: backend/frontend shared contract + single API surface를 함께 잠가야 의미가 있다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm cargo:test -- thread_detail`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- `archived` 노출이 history/live payload 전반으로 연쇄되어 4개 이상 command surface를 건드리기 시작하면 중단하고 `is_live` derived field 또는 detail-only view-model 분리안을 다시 비교한다.

## Slice 2. Live Overview membership를 `archived = 0` 기준으로 재정의
- Change boundary:
- `list_live_threads` 및 그 파생 query들의 `status = 'inflight'` membership 전제를 제거한다.
- root thread 집합은 archived flag로만 나누고, 병목/mini timeline 계산은 같은 집합에 대해 유지한다.
- Expected files:
- 예상 파일: `src-tauri/src/commands/api/live_overview.rs`, `src-tauri/src/commands/api/tests/live_overview.rs`, `src-tauri/src/commands/api/tests/ingest_visibility.rs`
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm cargo:test -- live_overview ingest_visibility`
- 저비용 체크 1개: `rg -n \"status = 'inflight'\" src-tauri/src/commands/api/live_overview.rs`
- Stop / Replan trigger:
- completed-but-unarchived root가 실제 DB에서 과도하게 많아 overview가 즉시 noise 상태가 되면, silent rollback 대신 user rule을 유지한 채 secondary filter/section 설계가 필요한지 재계획한다.

## Slice 3. Thread Detail polling을 archive-aware rule로 전환
- Change boundary:
- page query와 drilldown query의 polling predicate를 `!detail.thread.archived` 기준으로 맞춘다.
- detail payload/empty state 흐름은 그대로 둔다.
- Expected files:
- 예상 파일: `src/pages/thread-detail/thread-detail-page.tsx`, `src/features/thread-detail/ui/thread-timeline-shell.tsx`, `src/pages/thread-detail/thread-detail-page.test.tsx`
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- --run src/pages/thread-detail/thread-detail-page.test.tsx`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- page query와 drilldown query의 polling 조건이 서로 달라져 race/stale 상태가 생기면, predicate를 공용 helper로 끌어올리는 구조 정리를 먼저 수행한다.

## Slice 4. Overview wording과 empty/filter copy를 현재 의미에 맞게 정리
- Change boundary:
- Overview header, empty state, filter-empty 문구에서 `inflight` 표현을 제거한다.
- live definition을 UI 문구에서 `현재 대화` 또는 `아카이브되지 않은 thread`로 정렬한다.
- Expected files:
- 기본 3개 경계 예외를 허용한다.
- 예상 파일: `src/features/overview/ui/live-overview-shell.tsx`, `src/features/overview/ui/live-overview-content.tsx`, `src/features/overview/ui/live-overview-empty-state.tsx`, `src/features/overview/ui/live-overview-shell.test.tsx`
- 예외 사유: 하나의 overview UI 모듈 경계 안에서 copy와 expectation을 같이 잠가야 한다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- --run src/features/overview/ui/live-overview-shell.test.tsx`
- 저비용 체크 1개: `rg -n \"inflight thread\" src/features/overview/ui`
- Stop / Replan trigger:
- 문구 변경이 UX acceptance를 바꿔 추가 필터/label 결정이 필요해지면, UI copy patch를 잠시 멈추고 product wording만 별도 확정한다.

## Slice 5. Architecture wording과 남은 regression expectation 동기화
- Change boundary:
- architecture 문서와 남은 grep-level expectation을 새 live semantics에 맞춘다.
- 기능 코드는 건드리지 않는다.
- Expected files:
- 예상 파일: `docs/architecture.md`
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `rg -n \"inflight summary|inflight thread\" docs src/tasks`
- 저비용 체크 1개: manual diff review
- Stop / Replan trigger:
- 문서를 바꾸려면 기능 경계 설명 자체가 더 크게 흔들린다는 신호가 나오면, docs-only closeout 대신 architecture mini-review를 먼저 수행한다.

# Verification
- Rust focused validation:
- `pnpm cargo:test -- thread_detail`
- `pnpm cargo:test -- live_overview ingest_visibility`
- Frontend focused validation:
- `pnpm test -- --run src/pages/thread-detail/thread-detail-page.test.tsx`
- `pnpm test -- --run src/features/overview/ui/live-overview-shell.test.tsx`
- Low-cost repo checks:
- `pnpm typecheck`
- `rg -n "status = 'inflight'" src-tauri/src/commands/api/live_overview.rs`
- `rg -n "inflight thread" src/features/overview/ui docs`
- Manual acceptance checks:
- completed-but-unarchived root가 Overview에 남아 있는지
- 같은 thread detail이 task complete 이후에도 archive 전까지 자동 갱신되는지
- archived thread는 detail/drilldown polling을 멈추는지
- live copy가 더 이상 inflight-only semantics를 암시하지 않는지

# Stop / Replan conditions
- shared contract 변경이 history/live/detail 전체에 파급돼 diff가 `150 LOC`와 다중 화면 경계를 동시에 넘기기 시작하면 slice를 더 쪼갠다.
- 실제 로컬 데이터에서 unarchived root volume이 너무 커서 overview가 즉시 unusable해지면, archive rule을 유지한 채 secondary sorting/filter strategy를 새 bugfix plan으로 분리한다.
- Codex 공식 문서에서 이후 `archive`/`resume`/active thread lifecycle 설명이 바뀌면, 이 계획의 external evidence 해석을 다시 검증한다.
- 구현 중 `archived = 0`이어도 Codex app에서 더 이상 current conversation으로 취급되지 않는 예외 케이스가 발견되면, heuristic을 덧씌우지 말고 source-of-truth를 재조사한 뒤 재계획한다.
