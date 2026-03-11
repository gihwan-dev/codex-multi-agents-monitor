# Goal
- 현재 `Live / Archive / Summary` 기능 구조는 유지한 채, 앱의 전반적인 시각 테마와 레이아웃만 현대화한다.
- 목표 미감은 Apple `Liquid Glass`에서 가져온 절제된 반투명 레이어, 깊이감, 얇은 하이라이트, 낮은 채도의 chrome이며, 이를 이 앱의 생산성 도구 문맥에 맞게 재해석한다.
- 데스크톱 기준의 통상적인 좌측 고정 사이드바를 사용하고, 전역 navigation은 shadcn/ui `sidebar` 패턴으로 재구성한다.
- 성공 기준은 다음과 같다.
- 모든 주요 페이지가 상단 탭 중심 shell이 아니라 좌측 persistent sidebar + content inset shell로 동작한다.
- `Live`와 `Archive`는 현재의 page-local workspace 버튼 목록을 전역 또는 준전역 sidebar 구조로 재배치해 더 익숙한 탐색 흐름을 제공한다.
- `Summary`도 같은 시각 언어를 사용해 “별도 페이지처럼 보이는 이질감”을 줄인다.
- 전역 색/표면/경계/blur/spacing/motion 토큰이 한 곳에서 관리되고, 과도한 cyan 채도와 중첩 border를 줄인다.
- session list, flow workspace, KPI card는 동일한 surface hierarchy를 공유하되, flow canvas의 가독성을 해치지 않는다.
- 1차 구현은 frontend 범위에서 닫히고, 기존 Tauri command/shared contract는 유지한다.

# Task Type
- `refactor`

# Scope / Non-goals
- Scope:
- `src/app/styles.css` 중심의 visual system 토큰 재정의
- shadcn/ui `sidebar` 기반 전역 shell 도입
- `RootLayout`, `SessionWorkspaceShell`, `Live`, `Archive`, `Summary`의 레이아웃 재정렬
- glass-inspired surface, border, shadow, blur, density, typography hierarchy 재설계
- desktop 우선 responsive 기준 정리와 좁은 폭에서의 sidebar collapse 전략 정의
- `SessionFlowWorkspace` 주변 패널 chrome를 줄여 nested panel 과밀도를 완화
- Non-goals:
- backend command, Rust ingest, index DB, shared/public contract 변경
- `Live / Archive / Summary` 정보구조 자체의 재정의
- session flow 의미 체계, lane 모델, analytics 규칙 변경
- light mode/full theme switcher 도입
- updater/global shortcut/notification/remote control
- Apple UI의 1:1 복제 또는 macOS native component mimicry

# Keep / Change / Don't touch
- Keep:
- 현재 route 구조와 session-first 흐름: `src/app/router.tsx:9-20`
- frontend가 Tauri `invoke` command만 소비하는 소유권 경계
- `Live / Archive / Summary` 각각의 데이터 질의와 선택 상태 모델
- `SessionFlowWorkspace`의 기능적 역할: session 선택 시 같은 화면 안에서 flow + inspector를 여는 구조
- Change:
- 전역 shell을 상단 header 중심에서 좌측 persistent sidebar 중심으로 재구성
- page header, card, button, filter field, panel surface의 위계와 시각 밀도
- `Live / Archive`의 workspace/session 탐색 노출 위치와 시각적 묶음 방식
- `Summary`의 filter/KPI/panel 레이아웃을 같은 shell 언어로 정렬
- flow workspace 바깥 chrome와 안쪽 panel density를 줄여 hierarchy를 단순화
- Don't touch:
- `src-tauri/**`
- `src/shared/lib/tauri/commands.ts`와 `src/shared/types/contracts.ts`의 public/shared contract
- ingest source, archive semantics, session taxonomy
- 비공개 IPC 의존 구현, source 파일 직접 접근

# Evidence
## Repo evidence
- planning lens와 evidence 수집 방식:
- `external-benchmark`: main thread에서 공식 문서/공식 블로그를 직접 조사했다.
- `product-clarification`: 사용자 요구사항과 제공된 스크린샷을 기준으로 “모던화 + Apple glass 느낌 + 좌측 고정 sidebar + shadcn sidebar”를 목표로 고정했다.
- `module-structure`: `explorer` fan-out으로 shell/style/module 경계를 읽어 영향 범위를 확인했다.
- `ux-journey`: 현재 shell의 header 중심 구조와 nested panel 밀도를 기준으로 마찰 지점을 식별했다.
- 현재 전역 shell은 좌측 고정 sidebar가 아니라, 중앙 정렬 container 안에 상단 header nav와 하단 footer를 두는 구조다. 사용자 요구인 “화면 좌측에 붙는 통상적인 sidebar”와 어긋난다. 근거: `src/app/shell/root-layout.tsx:29-75`
- 현재 `SessionWorkspaceShell`은 page 내부에서 다시 `sidebar / list / detail` 3열 그리드를 만든다. 전역 sidebar가 없는 상태에서는 동작하지만, 새 좌측 navigation을 넣으면 중첩 sidebar처럼 느껴질 위험이 있다. 근거: `src/features/session-browser/ui/session-workspace-shell.tsx:12-47`
- `SessionFlowWorkspace`는 detail pane 안에서 다시 `diagram + inspector` 2열을 만든다. 즉 현재는 `전역 shell 없음 -> page 3열 -> detail 2열` 중첩 구조라 panel chrome를 줄이지 않으면 과밀해진다. 근거: `src/features/session-flow/ui/session-flow-workspace.tsx:74-108`
- 전역 테마 토큰은 `src/app/styles.css`에 집중돼 있지만 수가 적고 dark/cyan 중심이다. surface/elevation/blur/density/motion 분화가 부족해 “테마 개편”이 곧 global token refactor로 이어진다. 근거: `src/app/styles.css:3-34`
- shadcn baseline은 이미 존재한다. `components.json`이 있고 alias가 `@/shared/ui`, `@/shared/lib`로 잡혀 있다. 즉 이번 작업은 shadcn 도입 자체보다 `sidebar` 실사용과 shell 치환의 문제다. 근거: `components.json:1-14`, `docs/adr/0001-initial-foundation.md:16-19`
- 현재 repo에는 shadcn `sidebar` 구현이나 관련 primitive 사용 흔적이 없다. 근거: `rg -n "SidebarProvider|SidebarTrigger|SidebarInset|Sidebar" src/shared/ui src/app src/features src/pages` 결과 없음
- `Live`와 `Archive`는 같은 `SessionWorkspaceShell`에 각각 workspace 버튼 목록과 session list를 주입한다. 따라서 sidebar 개편 영향은 `RootLayout` 하나로 끝나지 않고 `SessionWorkspaceShell`, `LivePage`, `ArchivePage`까지 이어진다. 근거: `src/pages/live/live-page.tsx:46-148`, `src/pages/archive/archive-page.tsx:35-147`
- `Summary`는 공통 shell을 재사용하지 않고 단일 페이지 내부에서 filter와 KPI panel을 직접 렌더링한다. 그래서 sidebar 중심 shell로 맞추려면 별도 alignment slice가 필요하다. 근거: `src/pages/summary/summary-page.tsx:53-217`
- 현재 route와 command/contract는 이미 `Live / Archive / Summary`와 session flow를 공급한다. 이번 요청은 design-only 범위라면 backend/public/shared contract를 건드리지 않고도 닫을 수 있다. 근거: `src/app/router.tsx:9-20`, `src/shared/lib/tauri/commands.ts:28-63`, `src/shared/types/contracts.ts:180-288`

## External evidence
- Fact, 2025-06-09, Apple: Apple은 WWDC25에서 `Liquid Glass`를 새로운 소프트웨어 디자인 재료로 소개했고, controls/navigation 주변의 반투명 레이어를 통해 콘텐츠 집중과 깊이감을 동시에 만들겠다고 설명했다. 출처: [Apple Newsroom - iOS 26](https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/) (2026-03-11 확인)
- Fact, Apple Developer Documentation: sidebar 중심 탐색은 top-level destination과 detail content를 분리해 navigation-heavy 앱의 구조를 안정화한다. 출처: [Enhancing your app content with tab navigation and sidebars](https://developer.apple.com/documentation/swiftui/enhancing-your-app-content-with-tab-navigation-and-sidebars) (2026-03-11 확인)
- Fact, shadcn/ui docs: `sidebar`는 `SidebarProvider`, `SidebarTrigger`, `SidebarInset` 중심의 composable shell이며 collapsible mode와 keyboard shortcut을 포함해 앱 shell 수준에서 쓰도록 설계돼 있다. 출처: [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar) (2026-03-11 확인)
- Inference: 이 앱에서 말하는 “애플 글래스 느낌”은 전체를 과하게 흐리거나 floating card를 남발하는 방향이 아니라, 전역 navigation과 outer panel에만 제한된 translucency를 쓰고 data-dense 영역은 더 단단한 surface를 유지하는 쪽이 맞다.
- Inference, 2026-01-20, Linear official changelog: 최근 생산성 도구 리디자인은 기능 추가보다 navigation chrome를 가볍게 만들고 작업 영역 대비 장식 비중을 줄이는 방향에 가깝다. 이 앱에도 saturated accent와 다중 border를 줄이고, hierarchy를 type/spacing으로 옮기는 접근이 적합하다. 출처: [A new look for Linear](https://linear.app/changelog/new-look) (2026-03-11 확인)

## Options considered
- Option A. 현재 shell은 유지하고 색/그림자만 바꾸는 token-only reskin
- 장점: 가장 싸고 빠르다.
- 단점: 상단 nav 구조와 page 내부 pseudo-sidebar 문제를 해결하지 못한다.
- Option B. shadcn sidebar 기반 전역 shell + glass surface system + page shell 단순화
- 장점: 사용자 요구와 가장 직접적으로 맞고, frontend-only로 닫힐 가능성이 높다.
- 단점: `RootLayout`, `SessionWorkspaceShell`, `Live/Archive/Summary`를 함께 조정해야 한다.
- Option C. 완전히 새로운 floating dashboard shell과 자유로운 panel composition
- 장점: 시각적 변화 폭은 가장 크다.
- 단점: 앱 정체성보다 실험성이 커지고, flow workspace 가독성과 구현 비용이 동시에 악화될 수 있다.
- 채택은 Option B다.

# Decisions / Open questions
## Task continuity
- decision: `create-new`
- compared tasks: `tasks/codex-desktop-multi-agent-monitor/PLAN.md`
- reason:
- 기존 task의 goal은 `Live / Archive / Summary` IA, backend command surface, session flow contract를 만드는 architecture-level feature다.
- 이번 요청의 goal은 visual theme와 layout만 현대화하는 frontend refactor다.
- 성공 기준, 주요 변경 경계, quality preflight verdict가 모두 다르다. 기존 task는 `feature` + `promote-architecture`, 이번 task는 `refactor` + `promote-refactor`다.
- chosen task path: `tasks/glass-sidebar-theme-refresh/PLAN.md`

## Chosen approach
- 전역 shell은 shadcn `SidebarProvider` + `SidebarInset` 패턴을 기준으로 재구성한다.
- sidebar는 app navigation(`Live / Archive / Summary`)을 최상단에 두고, route별 contextual section은 하위 group 또는 content rail로 배치한다.
- visual system은 다음 hierarchy를 따른다.
- Level 0: window/background haze
- Level 1: persistent sidebar glass
- Level 2: page surface / content inset
- Level 3: dense data panel(list, KPI, inspector)은 더 불투명한 solid surface
- typography hierarchy로 정보 구조를 드러내고, border와 neon accent는 보조 수단으로만 쓴다.
- `Live`/`Archive`의 workspace 선택은 “전역 sidebar에 붙는 section”과 “page content rail” 중 정보 밀도와 반응형 조건을 보고 결정하되, 최종 결과는 좌측에서 시작하는 탐색 흐름을 유지한다.
- `Summary`는 같은 sidebar shell을 공유하되, filter bar와 KPI grid를 더 넓은 content canvas에 맞춘다.
- `SessionFlowWorkspace`는 glass effect의 대상이 아니라, glass shell 안에 놓이는 `solid working canvas`로 취급한다.
- remove할 로직/표현:
- 상단 header 안에 있던 top-level nav 버튼 배열
- 페이지마다 반복되는 강한 border + 강한 cyan fill 조합
- sidebar처럼 보이지만 실제로는 page 내부에 떠 있는 220px card 느낌의 pseudo-sidebar 표현
- keep할 로직/표현:
- route param, query param, selected session store, query key
- `SessionFlowWorkspace`의 diagram/inspector 기능 구조
- `listLiveThreads`, `listArchivedSessions`, `getSummaryDashboard` 데이터 호출 방식
- 모듈 경계:
- app shell 경계: `src/app/**`
- session browser shell 경계: `src/features/session-browser/ui/**`
- page adoption 경계: `src/pages/live/**`, `src/pages/archive/**`, `src/pages/summary/**`
- dense workspace boundary: `src/features/session-flow/ui/**`
- 허용 추상화:
- shared surface/card/sidebar primitives
- shell slot component와 route-aware section component
- theme token과 semantic utility class
- 금지 추상화:
- 새 global state manager 추가
- theme engine/brand engine 같은 과한 메타 abstraction
- backend contract 변경을 숨기기 위한 임시 adapter 추가
- 테스트 삭제 / 축소 / 이동 / 유지 기준:
- visual refactor로 DOM 구조가 바뀌더라도 route/selection/query 동작을 검증하는 테스트는 유지한다.
- snapshot 성격이 강한 테스트는 role/text 기준 assertion으로 축소할 수 있다.
- flow/command/data behavior 테스트는 삭제하지 않는다.
- 새 shadcn sidebar 도입으로 바뀌는 접근성 role/query는 테스트를 이동 또는 갱신한다.
- desktop target shell 스케치:

```text
+--------------------------------------------------------------------------------------------------+
| Sidebar (persistent)     | Content Inset                                                         |
|--------------------------+------------------------------------------------------------------------|
| Codex Monitor            | Page intro / utility strip                                              |
| Live                     |------------------------------------------------------------------------|
| Archive                  | Live/Archive: session rail | detail workspace                           |
| Summary                  | Summary: filter bar + KPI row + insight panels                          |
|--------------------------+------------------------------------------------------------------------|
| Workspace / status group | Flow canvas stays denser + more solid than outer glass chrome           |
+--------------------------------------------------------------------------------------------------+
```

## Rejected alternatives
- 기존 top header는 두고 page 내부에만 shadcn sidebar를 넣는 방안
- 모든 panel에 강한 blur를 적용해 glass effect를 극대화하는 방안
- `Live`, `Archive`, `Summary`마다 서로 다른 shell을 유지한 채 색감만 통일하는 방안
- Session flow canvas까지 glass 처리해 background depth를 강조하는 방안

## Need user decision
- 없음.
- 기본 가정:
- 1차 결과물은 dark-first desktop shell이다.
- Apple reference는 “정확한 복제”가 아니라 “절제된 translucency + hierarchy 정리” 수준으로 해석한다.
- workspace 목록이 길더라도 1차는 sidebar section/grouping으로 처리하고, search/pinning은 후속 과제로 남긴다.

## Quality preflight
- verdict: `promote-refactor`
- 근거:
- 변경 대상이 `RootLayout`, shared shell, page layouts, theme tokens, common UI surface로 넓고 단일 파일 hotfix가 아니다.
- 그러나 backend command/shared contract 변경 신호는 없고, 영향 범위는 frontend module boundary 안에 머무른다.
- 현재 구조의 주요 문제는 기능 누락보다 shell hierarchy와 visual density이므로 architecture 변경보다 UI refactor 우선이 맞다.
- shadcn baseline이 이미 있어 설계 방향은 `new architecture`보다 `existing shell refactor`에 가깝다.
- 후속 경로:
- `visual system -> global sidebar shell -> page adaptation -> detail polish` 순서로 자른다.
- 각 slice는 frontend 검증과 visual smoke check로 닫고, full-repo build는 마지막에만 수행한다.

# Execution slices
## Slice 1. visual system baseline을 먼저 고정한다
- Change boundary:
- `src/app/styles.css` 중심으로 semantic color/surface/border/shadow/blur/radius/spacing 토큰을 재정의한다.
- 공용 button/surface primitive를 새 토큰에 맞게 맞추되, route/page 구조는 아직 바꾸지 않는다.
- Expected files:
- 예상 파일: `src/app/styles.css`, `src/shared/ui/button.tsx`, `src/shared/ui/panel.tsx`
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm tauri:dev`로 `Live` 한 페이지를 열어 텍스트 대비, blur 강도, surface hierarchy를 육안 확인
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- glass 토큰만 적용해도 flow canvas나 긴 session title의 가독성이 떨어지면, blur는 outer shell 전용으로 축소하고 dense panel은 더 불투명한 solid surface로 되돌린다.

## Slice 2. shadcn sidebar 기반 전역 shell을 도입한다
- Change boundary:
- `RootLayout`의 상단 nav를 좌측 persistent sidebar로 대체한다.
- shadcn `sidebar` primitive와 app-level content inset을 붙이되, route와 selected session state는 유지한다.
- Expected files:
- 예상 파일: `src/app/shell/root-layout.tsx`, `src/shared/ui/sidebar.tsx`, `src/app/App.tsx`
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- src/app/App.test.tsx`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- shadcn sidebar 적용 과정에서 repo의 현재 alias/config와 충돌하거나 import churn이 예상보다 커지면, official markup 구조는 유지하되 repo naming에 맞는 thin adapter wrapper를 두는 방향으로 재계획한다.

## Slice 3. Live / Archive의 page-local pseudo-sidebar를 정리한다
- Change boundary:
- `SessionWorkspaceShell`을 “전역 sidebar 아래의 content shell”로 축소한다.
- `LivePage`와 `ArchivePage`의 workspace/session 탐색을 새 sidebar/rail 구조에 맞게 재배치한다.
- Expected files:
- 예상 파일: `src/features/session-browser/ui/session-workspace-shell.tsx`, `src/pages/live/live-page.tsx`, `src/pages/archive/archive-page.tsx`
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- src/pages/live/live-page.test.tsx src/pages/archive/archive-page.test.tsx`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- workspace filter를 전역 sidebar로 올렸을 때 route별 상태가 과도하게 꼬이거나 좁은 폭에서 rail이 붕괴하면, top-level nav만 global sidebar로 고정하고 workspace 선택은 page rail에 남기는 절충안으로 되돌린다.

## Slice 4. Summary를 같은 shell 언어로 맞춘다
- Change boundary:
- `SummaryPage`의 filter bar, KPI row, insight panel을 새 visual system과 content inset 구조에 맞춘다.
- 데이터 필터 로직이나 payload shape는 건드리지 않는다.
- Expected files:
- 예상 파일: `src/pages/summary/summary-page.tsx`, `src/shared/ui/panel.tsx`, `src/shared/ui/filter-field.tsx`
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- src/pages/summary/summary-page.test.tsx`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- glass surface를 Summary의 KPI 카드까지 일괄 적용했을 때 정보 밀도가 떨어지면, KPI 카드만 opaque card treatment로 남기고 outer shell만 glass로 유지한다.

## Slice 5. detail workspace chrome와 motion을 다듬는다
- Change boundary:
- `SessionFlowWorkspace` 주변 header/meta panel/inspector chrome를 줄여 nested panel 느낌을 완화한다.
- hover, selection, loading state motion은 subtle reveal 수준으로만 추가한다.
- Expected files:
- 예상 파일: `src/features/session-flow/ui/session-flow-workspace.tsx`, `src/features/session-flow/ui/session-flow-diagram.tsx`, `src/features/session-flow/ui/session-flow-inspector.tsx`
- Validation owner:
- `main thread`
- Focused validation plan:
- 타깃 검증 1개: `pnpm test -- src/features/session-flow/ui/session-flow-diagram.test.tsx`
- 저비용 체크 1개: `pnpm typecheck`
- Stop / Replan trigger:
- blur, shadow, animation이 live-updating diagram 성능이나 선택 정확도를 떨어뜨리면, motion은 skeleton/opacity 수준으로 축소하고 canvas 주변 panel만 다듬는 선에서 멈춘다.

# Verification
- slice별 기본 원칙:
- 시각 변경은 반드시 `pnpm tauri:dev` 기준의 desktop smoke check를 먼저 수행한다.
- behavioral regression은 기존 Vitest 파일 단위 실행으로 빠르게 확인한다.
- 최종 통합 검증:
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- 필요 시 `pnpm tauri:build`
- 확인 포인트:
- sidebar가 desktop에서 좌측에 고정되고, route 전환 시 selection/query 동작이 깨지지 않는가
- glass surface가 list/detail/KPI의 텍스트 대비를 해치지 않는가
- `Live`, `Archive`, `Summary`가 같은 제품처럼 보이되 dense workspace의 가독성은 유지되는가

# Stop / Replan conditions
- 구현 도중 backend contract 변경이나 Rust API 추가가 필요해지면 이 task를 중단하고 architecture task로 분리한다.
- sidebar 도입이 `Live/Archive`의 workspace 탐색 UX를 오히려 복잡하게 만들면, global nav와 contextual workspace rail을 분리하는 절충안으로 재계획한다.
- Apple glass reference를 따라가려는 과정에서 blur/투명도 효과가 readability를 해치면, “glass shell + solid work surface” 원칙으로 즉시 후퇴한다.
- DOM 구조 변화로 기존 테스트가 대량 붕괴하더라도 behavior coverage가 사라지는 삭제 방식으로 정리하지 않는다.
- slice 하나가 `repo-tracked files 3개 이하` 또는 `하나의 응집된 모듈 경계`를 넘어서고 순 diff가 `150 LOC`를 크게 초과하기 시작하면, 그 slice를 더 잘게 나눈다.
