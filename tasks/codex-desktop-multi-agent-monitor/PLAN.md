# Goal
- `tasks/codex-desktop-multi-agent-monitor/PLAN.md`를 제품 기준선 문서로 유지한다.
- 이번 계획의 목표는 현재 `Overview / History / Thread Detail` 중심 UI를 `Live / Archive / Summary` 3페이지 정보 구조로 재편하고, 각 페이지가 모두 “root chat session 중심”으로 동작하도록 만드는 것이다.
- 성공 기준은 다음 열 가지다.
- Live는 워크스페이스 사이드바를 기준으로 현재 진행 중인 root session 목록을 보여주고, child/subagent thread를 top-level 리스트에 직접 노출하지 않는다.
- Archive는 사이드바를 통해 archived chat session 목록에 진입하고, 선택한 session의 흐름을 같은 UX 언어로 탐색할 수 있다.
- Summary는 워크스페이스, session 단위 필터 조합으로 KPI/분포/비교 뷰를 보여준다.
- 제품 용어는 `Workspace > Chat(Session) > Agent Session > Item(Event)` 위계로 정렬되고, UI/contract/internal naming의 역할이 혼동되지 않는다.
- session 진입 UX는 별도 “thread detail 전용 화면”보다 session browser 안의 split view를 우선으로 한다.
- session flow는 `User / Main / Subagents` 3개 매크로 컬럼을 가지는 sequence-diagram 스타일로 표현한다.
- time axis는 세로로 흐르고, subagent column 안에서는 실제 subagent session별 세부 lane을 구분한다.
- 다이어그램은 SVG 기반 pan/zoom으로 동작하고, 확대/축소 후에도 벡터 선명도를 유지한다.
- main diagram은 summary-first를 유지하고, 원문/JSONL/raw snippet은 inspector 패널에서만 확장한다.
- 이번 계획은 이미 완료된 live visibility 기준(`archived = 0`)을 되돌리지 않고 그 위에서 IA와 UX를 재구성한다.

# Task Type
- `feature`

# Scope / Non-goals
- Scope:
- `Overview / History / Thread Detail` 라우트 구조를 `Live / Archive / Summary`로 재편한다.
- 용어 기준을 `Workspace > Chat(Session) > Agent Session > Item(Event)`로 고정하고, UI copy / public contract / internal compatibility naming의 역할을 분리한다.
- root thread를 UI 용어상 “session”으로 재해석하고, list 화면에서는 root session만 노출한다.
- session flow용 backend contract를 추가해 `user question / commentary / tool call / wait / spawn / final answer`를 같은 흐름 모델로 정렬한다.
- 기존 horizontal swimlane을 vertical time, 3-column sequence diagram UX로 재설계한다.
- Live/Archive에서 재사용 가능한 session browser shell과 Summary 전용 filter/dashboard shell을 설계한다.
- Summary는 현재 단계에서 `workspace`, `session`, `time range` 수준의 필터 조합만 지원해도 충분하다고 본다.
- Non-goals:
- agent 제어(중지/재개/interrupt), remote control, notification, updater
- Codex source 파일 쓰기/정리/마이그레이션
- frontend의 로컬 파일 직접 접근(`~/.codex`, SQLite 직접 읽기)
- full-blown BI 플랫폼, 복수 페이지 drill-through analytics, 실시간 협업 기능
- draw.io 전체 기능 복제(infinite canvas 편집, 노드 자유 배치, 다중 문서 관리)

# Keep / Change / Don't touch
- Keep:
- Frontend는 계속 Tauri `invoke` command와 event만 소비하고, 로컬 소스 파일/DB를 직접 읽지 않는다.
- live visibility의 canonical rule은 계속 `archived = 0` root thread다.
- subagent는 root list의 top-level row가 아니라 session 내부 문맥으로만 드러난다.
- timeline-first UX와 summary-first / raw-expand 정책을 유지한다.
- `thread_id`는 저장소 식별자로 유지하고, DB schema와 legacy command compatibility를 위해 즉시 제거하지 않는다.
- Change:
- 앱 navigation을 `Live / Archive / Summary` 3축으로 재편한다.
- History의 KPI retrospective를 Archive와 Summary로 분리 재배치한다.
- Thread Detail의 horizontal swimlane + drilldown 조합을 재사용 가능한 session flow workspace로 재구성한다.
- backend contract를 `session list`, `session flow`, `summary dashboard` 관점으로 확장한다.
- UI는 `챗`, public contract는 `session`, 내부 호환 계층은 `thread` 중심으로 역할을 분리한다.
- `agent session`, `item(event)` 용어를 명시적으로 도입해 subagent 실행 단위와 timeline item을 구분한다.
- session flow item taxonomy에 `user_message`를 정식 편입한다.
- Don't touch:
- `~/.codex` source 구조와 write path
- 비공개 IPC 의존 구현
- updater/global shortcut/notification/remote control 도입
- app-owned DB가 아닌 외부 저장소 추가

# Evidence
## Repo evidence
- 현재 라우트는 `/`(Overview), `/history`, `/threads/:threadId` 3개뿐이라서, 사용자가 요구한 `Live / Archive / Summary` IA와 일치하지 않는다. 근거: `src/app/router.tsx:1-20`
- 현재 전역 shell은 상단 nav의 `Overview / History` 두 탭만 제공하고, persistent workspace/sidebar 구조가 없다. 상세 thread 선택 상태도 footer의 단일 `selected=` 텍스트만 보여준다. 근거: `src/app/shell/root-layout.tsx:1-72`
- Live 화면은 2초 polling으로 live thread 리스트를 가져오고, header + filter panel + bottleneck ranking + flat card list를 한 화면에 쌓는다. 워크스페이스 사이드바, split-pane, session flow 진입 구조는 없다. 근거: `src/pages/overview/overview-page.tsx:1-29`, `src/features/overview/ui/live-overview-shell.tsx:12-47`, `src/features/overview/ui/live-overview-content.tsx:19-58`, `src/features/overview/ui/overview-filter-panel.tsx:12-78`, `src/features/overview/ui/live-thread-card.tsx:17-92`
- current Live top-level row는 이미 root session 중심이다. state snapshot root는 `threads`에 적재되고 subagent는 `agent_sessions`로만 들어가므로, “리스트에서 child thread를 감춘다”는 요구와 데이터 모델 방향은 맞는다. 근거: `src-tauri/src/ingest/mod.rs:723-783`, `src-tauri/src/ingest/mod.rs:1258-1380`
- History 화면은 archived chat browser가 아니라 최근 7일 KPI + role breakdown + slow thread retrospective다. 즉 Archive UX로 바로 재활용하기 어렵다. 근거: `src/pages/history/history-page.tsx:1-18`, `src/features/history/ui/history-shell.tsx:50-260`
- 현재 공개 command surface는 `list_live_threads`, `get_thread_detail`, `get_thread_drilldown`, `get_history_summary` 네 개뿐이라서, archived session list와 summary filter dashboard 전용 API가 없다. 근거: `src-tauri/src/commands/api/entrypoints.rs:13-49`
- 현재 shared contract는 `ThreadDetail`에 `thread`, `agents`, `timeline_events`, `wait_spans`, `tool_spans`만 제공하고, `ThreadDrilldown`도 latest commentary / recent tool / related wait / raw snippet 정도만 준다. session browser용 item stream contract는 없다. 근거: `src/shared/types/contracts.ts:36-167`
- 현재 public/internal naming은 `MonitorThread`, `ThreadDetail`, `thread_id`처럼 `thread` 중심이고, 사용자가 이해하기 쉬운 `chat/session` 용어 계층은 아직 문서화돼 있지 않다. 근거: `src/shared/types/contracts.ts:36-167`, `src/pages/thread-detail/thread-detail-page.tsx:9-36`
- 현재 ingest는 `user_message`를 title과 latest summary 계산에는 사용하지만, timeline event로 저장하지 않는다. 반면 `commentary`, `final`, `spawn`, `wait`, 일반 tool call은 timeline/wait/tool rows로 정규화한다. 사용자가 요구한 “질문 + 사고 흐름 + 툴 호출” full item view를 만들려면 user message 정규화가 먼저 필요하다. 근거: `src-tauri/src/ingest/mod.rs:241-257`, `src-tauri/src/ingest/mod.rs:268-275`, `src-tauri/src/ingest/mod.rs:387-412`, `src-tauri/src/ingest/mod.rs:480-559`
- 현재 monitor DB는 `threads`, `agent_sessions`, `timeline_events`, `wait_spans`, `tool_spans`를 이미 갖고 있어 sequence diagram용 정규화 확장 기반은 있다. 다만 flow payload를 직접 주는 API와 stable taxonomy는 없다. 근거: `src-tauri/src/index_db/mod.rs:15-119`
- 현재 thread detail view model은 horizontal time window 위에 main/agent lane을 놓고 `commentary / spawn / final` marker와 `wait / tool` block을 분리해서 그린다. 사용자가 요청한 `User / Main / Subagents` 3컬럼 sequence-diagram과는 표현 축 자체가 다르다. 근거: `src/features/thread-detail/lib/build-thread-timeline-view-model.ts:3-240`, `src/features/thread-detail/ui/thread-swimlane-panel.tsx:44-260`
- current detail page는 별도 route로 진입하고, 같은 화면 안에서 list-context를 유지하지 못한다. 이는 Live/Archive에서 “리스트 클릭 후 같은 뷰에서 흐름 확인”이라는 요구와 충돌한다는 해석이 가능하다. 이 해석은 route structure에서 나온 추론이다. 근거: `src/pages/thread-detail/thread-detail-page.tsx:9-36`, `src/features/thread-detail/ui/thread-timeline-shell.tsx:18-108`
- History summary backend는 `status = 'completed'` thread를 최근 7일 집계와 `slow_threads` 상위 8개로 잘라 반환할 뿐, archived session browser에 필요한 `archived = 1` 전체/필터 list를 제공하지 않는다. 근거: `src-tauri/src/commands/api/history_summary.rs:82-225`, `src-tauri/src/commands/api/history_summary.rs:228-249`
- 직전 구현 체인에서 live semantics는 이미 `archived = 0` 기준으로 정리됐고, detail polling도 archive-aware로 맞춰졌다. 이번 설계는 그 기준을 되돌리는 것이 아니라 그 위에서 IA를 바꾸는 후속 단계다. 근거: `tasks/codex-desktop-multi-agent-monitor/STATUS.md:1-56`
- Planning lens는 `product-clarification`, `ux-journey`, `module-structure`, `delivery-risk`를 선택했다. `explorer` fan-out으로 backend data/contract 가용성을 검증했고, `architecture-reviewer` fan-out은 응답 없이 interrupted되어 frontend boundary review는 메인 스레드 read-only evidence로 보강했다.

## External evidence
- 없음.
- 이유: 이번 턴은 외부 벤치마크나 라이브러리 채택보다 저장소 내부 구조와 사용자 요구 사이의 불일치를 먼저 고정하는 것이 핵심이다.
- 보류 사항: SVG pan/zoom 구현을 native transform/viewBox로 갈지 helper library를 둘지는 Slice 6 prototype 단계에서 필요 시 별도 조사한다.

## Options considered
- Option A: 현재 `Overview / History / Thread Detail` 이름만 바꾸고 기존 data contract를 그대로 재사용한다.
- 장점은 초기 diff가 작다.
- 단점은 Archive가 archived session browser가 되지 못하고, session flow에 user question이 빠진다.
- Option B: backend는 건드리지 않고 frontend에서 현재 `ThreadDetail + Drilldown`을 조합해 sequence diagram처럼만 보이게 한다.
- 장점은 Rust 변경을 피할 수 있다.
- 단점은 `user_message` 부재, archived list 부재, subagent raw-snippet 의존 때문에 계약 불일치가 그대로 남는다.
- Option C: 현재 normalized DB는 유지하되, `session list + session flow + summary dashboard` 관점의 command/contract를 추가하고 그 위에 새 IA를 얹는다.
- 장점은 현재 저장소의 read-only boundary와 root-vs-subagent 모델을 유지하면서도 요구사항을 직접 만족시킨다.
- 단점은 command surface, shared contract, route shell, diagram renderer를 모두 건드리는 architecture-level 변화다.
- Option D: diagram engine을 먼저 library-first로 고른 뒤 그 라이브러리에 맞춰 data model을 끼워 맞춘다.
- 장점은 시각 효과 프로토타입이 빠를 수 있다.
- 단점은 item taxonomy와 API shape가 고정되기 전에 구현이 라이브러리 제약에 종속될 위험이 크다.
- 채택은 Option C다.

# Decisions / Open questions
## Chosen approach
- IA는 `Live`, `Archive`, `Summary` 3개의 top-level page로 고정한다.
- 용어 위계의 canonical baseline은 `Workspace > Chat(Session) > Agent Session > Item(Event)`다.
- 여기서 `Chat`과 `Session`은 제품 레벨에서 같은 루트 객체를 가리키며, UI copy는 `챗`을 우선 사용하고 API/contract는 `session`을 우선 사용한다.
- 현재 코드와 저장소 구조에 남아 있는 `thread`는 internal compatibility naming으로만 유지한다. 즉 `thread_id`는 storage identifier이지만, user-facing IA의 상위 개념명은 아니다.
- `User / Main / Subagents`는 도메인 위계가 아니라 sequence-diagram의 표현 컬럼이다. 실제 도메인 위계는 `Workspace > Chat(Session) > Agent Session > Item(Event)`다.
- Live와 Archive는 공통 `SessionWorkspaceShell`을 재사용하고, 사이드바에서 workspace 또는 archive scope를 선택한 뒤 session list와 flow canvas를 같은 화면에서 보여준다.
- route도 session browser 중심으로 재편한다. 기본 가정은 `/live`, `/live/:sessionId`, `/archive`, `/archive/:sessionId`, `/summary`다. 기존 `/threads/:threadId`는 migration 기간 동안 redirect 또는 compatibility route로만 남긴다.
- UI의 top-level list는 계속 root session만 보여주고, subagent는 session 내부 column/lane 문맥으로만 드러낸다. 이는 현재 `threads` vs `agent_sessions` 데이터 모델과도 맞는다.
- session flow 표현은 horizontal swimlane을 유지하지 않고, `x = participant column`, `y = time`인 vertical sequence-diagram UX로 전환한다.
- participant column은 `User / Main / Subagents` 3개다. subagent column 안에서는 실제 spawned session별 sub-lane을 stack으로 나눠 session identity를 잃지 않게 한다.
- flow item taxonomy의 canonical set은 `user_message | commentary | tool_call | wait | spawn | final_answer`다. raw JSONL 전체는 inspector에서만 보여주고 main canvas에는 summary label만 둔다.
- draw.io 같은 확대/축소 요구는 canvas가 아니라 SVG 기반으로 충족한다. 1차 구현은 native SVG viewBox/transform 기반 pan/zoom을 우선한다.
- Summary는 1차 단계에서 `workspace`, `session`, `time range` 필터만 지원하고, KPI + workspace distribution + role mix + session compare 정도의 lightweight dashboard를 목표로 한다.
- 기존 History KPI 일부는 Summary로 흡수하고, Archive는 browser 역할에 집중한다.

## Rejected alternatives
- `History`를 archive browser로 이름만 바꿔서 쓰는 방안
- `Thread Detail`을 그대로 두고 Live/Archive에서 항상 full-page route 이동만 하는 방안
- subagent thread를 root session과 같은 list row로 승격하는 방안
- `user_message`를 raw snippet에만 남기고 sequence item으로는 추가하지 않는 방안
- diagram library를 먼저 확정하고 data contract를 나중에 맞추는 방안

## Need user decision
- 없음.
- 기본 가정:
- Archive sidebar의 1차 grouping은 workspace 기준으로 통일한다.
- Summary MVP 시각화는 KPI + workspace/role/session 비교 수준이면 충분하다.
- user가 별도 요청하지 않는 한 sequence diagram의 원문은 inspector 패널에서만 연다.

## Quality preflight
- verdict: `promote-architecture`
- 근거:
- route IA가 `/`, `/history`, `/threads/:threadId`에서 `Live / Archive / Summary`로 바뀌며 top-level navigation 구조 자체가 바뀐다.
- backend command surface에 archived list, session flow, summary dashboard 계열의 새 public/shared contract가 필요하다.
- current detail visualization은 horizontal swimlane이고, 요구사항은 vertical 3-column sequence diagram이어서 view-model 축이 달라진다.
- `user_message`가 현재 contract에 없어서 session item model을 완성하려면 ingest normalization까지 손봐야 한다.
- 후속 경로:
- contract/data slice를 먼저 고정하고, shell/diagram/page adoption을 뒤따르는 순서로 간다.
- Live/Archive/Summary를 한 번에 치환하지 않고 `taxonomy -> API -> shell -> diagram -> page adoption` 순으로 자른다.

# Execution slices
## Slice 1. 용어 baseline과 naming rule을 먼저 고정한다
- Change boundary:
- 제품/UX/contract/internal naming의 역할을 문서와 shared type layer에서 먼저 고정한다.
- canonical hierarchy를 `Workspace > Chat(Session) > Agent Session > Item(Event)`로 문서화하고, 새 public contract naming은 `session` 기준으로 설계한다.
- DB schema와 legacy command의 `thread` naming은 compatibility 이유로 유지하되, user-facing copy와 새 API 이름에는 직접 노출하지 않는다.
- Expected files:
- 예상 파일: `docs/architecture.md`, `README.md`, `src/shared/types/contracts.ts`
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm typecheck`
- 저비용 체크 1개: `rg -n "Thread Detail|Overview|History|thread_id|ThreadDetail|MonitorThread" docs README.md src/shared/types/contracts.ts`
- Stop / Replan trigger:
- naming baseline만 고정하려 해도 DB schema rename이나 기존 command rename까지 동시에 요구되면, compatibility layer를 유지하는 방향으로 되돌리고 schema migration plan을 별도 분리한다.

## Slice 2. Session item taxonomy에 `user_message`를 편입한다
- Change boundary:
- ingest normalization이 `user_message`를 session flow item으로 기록하도록 확장한다.
- existing `commentary / wait / spawn / tool / final` taxonomy를 canonical kind 집합으로 정리한다.
- 아직 새 page/route/UI는 만들지 않는다.
- Expected files:
- 기본 3-file guardrail 예외를 허용한다.
- 예상 파일: `src-tauri/src/ingest/mod.rs`, `src-tauri/src/commands/api/thread_detail.rs`, `src-tauri/src/commands/api/tests/thread_detail.rs`, `src-tauri/src/ingest/mod.rs` 테스트
- 예외 사유: 하나의 backend ingest/detail 모듈 경계 안에서 item taxonomy와 read model을 함께 잠가야 한다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm cargo:test -- thread_detail ingest`
- 저비용 체크 1개: `rg -n "user_message|commentary|final|spawn|wait|tool" src-tauri/src/ingest/mod.rs`
- Stop / Replan trigger:
- archived snapshot 데이터만으로는 `user_message`를 일관되게 재구성할 수 없어 request-time raw file scan이 필수가 되면, 즉시 중단하고 `timeline_events` 확장 대신 별도 normalized item table 도입안을 먼저 설계한다.

## Slice 3. Session flow public/shared contract를 고정한다
- Change boundary:
- `SessionFlowPayload`, `SessionFlowItem`, `SessionLane` 계열 shared/public contract를 정의한다.
- 새 `get_session_flow` command를 추가하고, migration 기간에는 기존 `get_thread_detail`/`get_thread_drilldown`를 compatibility surface로 유지한다.
- raw snippet은 flow payload에 직접 싣지 않고 inspector secondary payload 또는 optional section으로 둔다.
- Expected files:
- 기본 3-file guardrail 예외를 허용한다.
- 예상 파일: `src-tauri/src/domain/models.rs`, `src/shared/types/contracts.ts`, `src-tauri/src/commands/api/session_flow.rs`, `src-tauri/src/commands/api/entrypoints.rs`, `src/shared/lib/tauri/commands.ts`, 관련 테스트 파일
- 예외 사유: backend/frontend public surface를 한 slice에서 함께 잠가야 downstream UI churn을 줄일 수 있다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm cargo:test -- session_flow thread_detail`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- flow payload가 raw snippet, summary, selection state까지 모두 떠안아 API가 비대해지면, core flow payload와 inspector payload를 분리하는 쪽으로 즉시 재설계한다.

## Slice 4. Archived session list API를 추가한다
- Change boundary:
- `archived = 1` root session만 반환하는 archived list command를 추가한다.
- workspace/search/date 정도의 lightweight filter만 지원하고 pagination 필요 여부를 먼저 측정한다.
- History summary API는 이 slice에서 대체하지 않는다.
- Expected files:
- 기본 3-file guardrail 예외를 허용한다.
- 예상 파일: `src-tauri/src/commands/api/archive_list.rs`, `src-tauri/src/commands/api/entrypoints.rs`, `src/shared/types/contracts.ts`, `src/shared/lib/tauri/commands.ts`, 관련 Rust 테스트
- 예외 사유: command boundary와 shared contract를 같이 묶어야 archive browser UI가 불필요한 shape 변경 없이 붙는다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm cargo:test -- archive_list history_summary`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- archived session 개수가 즉시 수백~수천 단위라 cursor/pagination 없이 UI가 성립하지 않으면, 무한 리스트를 만들지 말고 cursor contract를 먼저 추가하는 쪽으로 재계획한다.

## Slice 5. Summary dashboard API를 추가한다
- Change boundary:
- `workspace`, `session`, `time range` 필터를 받는 summary dashboard payload를 추가한다.
- KPI, workspace distribution, role mix, session compare처럼 DB-derived metric만 다룬다.
- narrative summary 생성이나 raw JSONL 스캔은 포함하지 않는다.
- Expected files:
- 기본 3-file guardrail 예외를 허용한다.
- 예상 파일: `src-tauri/src/commands/api/summary_dashboard.rs`, `src-tauri/src/commands/api/entrypoints.rs`, `src/shared/types/contracts.ts`, `src/shared/lib/tauri/commands.ts`, 관련 Rust 테스트
- 예외 사유: analytics query와 public/shared contract는 한 번에 잠가야 frontend filter shell이 안정된다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm cargo:test -- summary_dashboard history_summary`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- 필터 하나를 바꿀 때마다 raw rollout file 분석이 필요해지면, scope를 DB-derived aggregate로 다시 축소하고 narrative/semantic summary는 후속 계획으로 분리한다.

## Slice 6. App shell과 route IA skeleton을 바꾼다
- Change boundary:
- top-level navigation을 `Live / Archive / Summary`로 바꾸고, 공통 sidebar/panel shell의 뼈대를 만든다.
- 기존 feature 내부 UI는 placeholder 또는 compatibility mount로 잠시 유지해도 된다.
- 이 slice에서는 diagram renderer 완성까지 욕심내지 않는다.
- Expected files:
- 기본 3-file guardrail 예외를 허용한다.
- 예상 파일: `src/app/router.tsx`, `src/app/shell/root-layout.tsx`, `src/pages/live/live-page.tsx`, `src/pages/archive/archive-page.tsx`, `src/pages/summary/summary-page.tsx`, `src/features/session-browser/ui/session-workspace-shell.tsx`
- 예외 사유: 라우트와 전역 shell은 하나의 cohesive app boundary라 분할 적용 이득이 낮다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- --run src/app/App.test.tsx`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- route 변경이 기존 deep-link와 selected state를 한 번에 깨뜨리기 시작하면, placeholder page 도입과 legacy redirect 추가를 먼저 land하는 2단계 전환으로 나눈다.

## Slice 7. SVG sequence diagram workspace를 프로토타입이 아니라 제품 slice로 고정한다
- Change boundary:
- reusable `SessionFlowDiagram`과 `SessionFlowInspector`를 만든다.
- vertical time axis, `User / Main / Subagents` column, subagent stack, spawn/wait connector, pan/zoom, selection/hover 상태를 이 slice에서 정리한다.
- raw snippet은 inspector 안에서만 확장한다.
- Expected files:
- 기본 3-file guardrail 예외를 허용한다.
- 예상 파일: `src/features/session-flow/lib/build-session-flow-view-model.ts`, `src/features/session-flow/ui/session-flow-diagram.tsx`, `src/features/session-flow/ui/session-flow-inspector.tsx`, `src/features/session-flow/ui/session-flow-diagram.test.tsx`
- 예외 사유: 하나의 응집된 diagram 모듈 경계다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- --run src/features/session-flow/ui/session-flow-diagram.test.tsx`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- native SVG pan/zoom 계산이 pointer/wheel interaction에서 불안정하거나, 200개 이상 item에서 frame drop이 재현되면 helper library 비교를 위한 별도 prototype plan으로 분리하고 이 slice를 멈춘다.

## Slice 8. Live page를 workspace sidebar 기반 session browser로 교체한다
- Change boundary:
- current Overview의 flat card stack을 workspace sidebar + session list + embedded flow workspace로 교체한다.
- `list_live_threads`는 root session source로 계속 쓰고, 선택한 session의 flow는 `get_session_flow`로 읽는다.
- child/subagent는 list row로 승격하지 않는다.
- Expected files:
- 기본 3-file guardrail 예외를 허용한다.
- 예상 파일: `src/pages/live/live-page.tsx`, `src/features/live/ui/live-shell.tsx`, `src/features/live/ui/live-workspace-sidebar.tsx`, `src/features/live/ui/live-session-list.tsx`, 관련 테스트
- 예외 사유: Live page 하나의 cohesive module boundary다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- --run src/pages/live/live-page.test.tsx`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- unarchived root 수가 많아서 sidebar/list만으로는 탐색성이 급격히 떨어지면, visual polish 전에 workspace sectioning 또는 status/search 보조 필터를 먼저 추가하는 재계획이 필요하다.

## Slice 9. Archive page를 archived chat browser로 교체한다
- Change boundary:
- current History의 KPI retrospective를 archive browser와 분리하고, Archive는 sidebar + archived session list + reusable flow workspace에 집중한다.
- open workspace/log 액션은 메인 리스트 대신 inspector 보조 액션으로 옮길 수 있다.
- Expected files:
- 기본 3-file guardrail 예외를 허용한다.
- 예상 파일: `src/pages/archive/archive-page.tsx`, `src/features/archive/ui/archive-shell.tsx`, `src/features/archive/ui/archive-sidebar.tsx`, `src/features/archive/ui/archive-session-list.tsx`, 관련 테스트
- 예외 사유: Archive page 하나의 cohesive module boundary다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- --run src/pages/archive/archive-page.test.tsx`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- archive browsing과 retrospective KPI를 같은 화면에 계속 두려는 요구가 재발하면, Archive를 다시 비대화하지 말고 Summary에 retrospective를 유지하는 탭/section으로 해결하는 방향으로 재조정한다.

## Slice 10. Summary page를 filter-driven dashboard로 추가한다
- Change boundary:
- workspace/session/time-range filter bar와 KPI/분포/비교 뷰를 추가한다.
- Archive용 browser affordance는 넣지 않고, summary insight에 집중한다.
- current History의 KPI card 일부를 재사용할 수 있어도 page semantics는 새로 고정한다.
- Expected files:
- 기본 3-file guardrail 예외를 허용한다.
- 예상 파일: `src/pages/summary/summary-page.tsx`, `src/features/summary/ui/summary-shell.tsx`, `src/features/summary/ui/summary-filter-bar.tsx`, `src/features/summary/ui/summary-visuals.tsx`, 관련 테스트
- 예외 사유: Summary page 하나의 cohesive module boundary다.
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- --run src/pages/summary/summary-page.test.tsx`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- chart/visual choice가 정보 전달보다 장식으로 흐르거나 설계 시스템 부채를 급격히 키우면, 차트 다양화보다 KPI + compare table + sparkline 수준의 MVP로 축소한다.

# Verification
- Backend taxonomy/API slices:
- `pnpm cargo:test -- thread_detail ingest`
- `pnpm cargo:test -- session_flow`
- `pnpm cargo:test -- archive_list history_summary`
- `pnpm cargo:test -- summary_dashboard history_summary`
- Frontend page/diagram slices:
- `pnpm test -- --run src/app/App.test.tsx`
- `pnpm test -- --run src/features/session-flow/ui/session-flow-diagram.test.tsx`
- `pnpm test -- --run src/pages/live/live-page.test.tsx`
- `pnpm test -- --run src/pages/archive/archive-page.test.tsx`
- `pnpm test -- --run src/pages/summary/summary-page.test.tsx`
- Low-cost repo checks:
- `pnpm typecheck`
- `pnpm lint`
- Integration milestone:
- `pnpm test`
- `pnpm cargo:test`
- `pnpm tauri:build`
- Manual acceptance checks:
- UI copy에서 `워크스페이스 / 챗(session) / 에이전트 세션 / 이벤트` 구분이 일관되고, `thread`가 user-facing 1차 용어로 남지 않는지
- Live에서 workspace sidebar를 선택했을 때 root session만 list에 보이고 child/subagent는 top-level row로 보이지 않는지
- Live/Archive에서 session 클릭 시 같은 browser shell 안에서 flow canvas가 열리는지
- flow canvas가 `User / Main / Subagents` 3개 매크로 컬럼을 유지하는지
- user question, commentary, tool call, wait, spawn, final answer가 시간순으로 끊기지 않고 표현되는지
- SVG diagram이 wheel zoom + pan 후에도 텍스트/선이 깨지지 않는지
- Summary filter를 workspace/session/time range로 조합했을 때 KPI와 분포가 일관되게 갱신되는지

# Stop / Replan conditions
- `user_message`를 안정적으로 정규화할 수 없어 session flow가 “질문 없는 반쪽 타임라인”으로 남는다면, UI 착수 전에 ingestion/data model 계획을 다시 세운다.
- 용어 정리를 시도하는 과정에서 `chat`, `session`, `thread`가 화면/contract/DB에서 같은 레벨 용어로 혼용되기 시작하면, 구현 진행을 멈추고 naming baseline slice를 다시 분리해 먼저 닫는다.
- archive list 결과가 즉시 pagination 없이 감당되지 않는 규모라면, Archive UI를 붙이기 전에 cursor/filter contract부터 다시 설계한다.
- native SVG pan/zoom이 상호작용 안정성이나 성능 기준을 넘지 못하면, diagram engine 선택을 별도 prototype decision으로 승격한다.
- Live/Archive/Summary 전환 과정에서 기존 `Overview / History / Thread Detail`를 한 slice에 동시에 삭제해야만 하는 상황이 되면, giant mixed slice로 간주하고 중단 후 단계적 migration plan으로 다시 쪼갠다.
- Summary 요구가 workspace/session 범위를 넘어 자연어 요약, 장기 트렌드, cross-run correlation까지 확장되면 현재 범위를 유지한 채 analytics 후속 plan을 별도 분리한다.
