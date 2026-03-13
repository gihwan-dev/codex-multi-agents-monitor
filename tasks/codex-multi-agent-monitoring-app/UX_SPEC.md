# Information architecture

- `SCR-001` Live Monitor
  - workspace sidebar
  - live session list
  - timeline canvas
  - detail drawer
  - quick filters
- `SCR-002` Archive Monitor
  - workspace/date/status filter rail
  - archived session results
  - detail timeline reuse
  - saved view / quick facets
- `SCR-003` Dashboard
  - overview KPI strip
  - metrics grid
  - anomaly cards
  - drill-down links to session detail

# Screen spec

## `SCR-001` Live Monitor

- Layout:
  - 좌측 280-360px sidebar에 workspace group과 세션 목록을 둔다.
  - 메인 영역은 vertical timeline canvas에 우선 할당한다.
  - 우측 detail drawer는 selection source-of-truth를 공유하는 split pane으로 연다.
- Session list item:
  - session title fallback: 첫 user message 요약
  - badges: live, archived, stalled, sub-agent count, error, repeated-work suspected
  - secondary line: last event time, workspace, duration
- Timeline lanes:
  - lane 1: `User`
  - lane 2: `Main`
  - lane 3+: 기타 session-local lane
- Time axis:
  - 시간은 top -> bottom으로 흐른다.
  - 가장 최신 이벤트는 항상 가장 아래에 위치한다.
  - lane header는 상단에 고정한다.
- Default event visibility:
  - user messages
  - agent spawn/join/complete
  - tool spans (call + output merged)
  - reasoning spans summary
  - error/aborted markers
  - token annotations are collapsed into badges by default
- View presets:
  - `live`: 첫 진입 시 전체 fit 대신 최근 하단 시퀀스를 읽기 좋은 밀도로 확대한다.
  - `archive`: 첫 진입 시 전체 세션 높이를 fit-all로 보여준다.
  - archive preset 소비는 `SLICE-7`에서 화면에 연결한다.
- Latest follow:
  - live에서는 기본적으로 최신 하단 구간을 따라간다.
  - 사용자가 scroll scrub, drag pan, Ctrl+wheel zoom으로 viewport에 개입하면 follow를 끈다.
  - timeline chrome의 `Eye` 버튼으로 latest follow를 다시 켤 수 있다.
- Pan / zoom behavior:
  - 기본 scrub은 세로 시간축을 따라 이동한다.
  - lane overflow가 있을 때만 가로 pan이 추가된다.
  - Ctrl+wheel 또는 pinch 성격 입력은 세로 시간축 zoom으로 동작한다.

## `SCR-002` Archive Monitor

- Live Monitor의 timeline module을 재사용한다.
- archive 화면은 fit-all preset으로 전체 세션을 먼저 보여준다.
- full archive timeline wiring은 `SLICE-7`에서 마무리한다.
- 추가 필터:
  - workspace
  - date range
  - duration bucket
  - agent role presence
  - tool name
  - has sub-agent
  - error/aborted
  - repeated-work suspected
  - token range
  - archived only / all
- Table/list hybrid:
  - 목록은 dense mode를 지원하고 keyboard navigation이 가능해야 한다.

## `SCR-003` Dashboard

- 상단 summary strip:
  - active live sessions
  - avg session duration
  - avg spawn depth
  - repeated-work flagged sessions
  - token-heavy sessions
- 중단 metrics grid:
  - workload
  - efficiency
  - orchestration quality
  - performance
  - errors/anomalies
- 하단 drill-down:
  - suspicious sessions list
  - top workspaces
  - recent regressions

# Timeline filtering strategy

적절한 detail depth를 위해 3단계 모델을 사용한다.

- `Level 1: Operational`
  - 세션 개요 파악용
  - user turn, spawn, wait, done, error, long-running only
- `Level 2: Diagnostic`
  - 기본값
  - tool spans, reasoning summary, input/output preview, token deltas
- `Level 3: Raw`
  - side drawer에서만
  - raw event JSON 또는 거의 raw에 가까운 payload view

# State design

- Loading
  - workspace scan 중
  - session parsing 중
  - archive query 중
- Empty
  - active workspace 없음
  - filter result 없음
- Stalled
  - live session이 일정 시간 이상 append되지 않음
- Error
  - parser mismatch
  - file access denied
  - malformed jsonl
- Degraded
  - 너무 큰 세션이라 raw detail을 일부 lazy load로 전환

# Detail drawer

- Tabs:
  - Summary
  - Input-Output
  - Raw
  - Tokens
  - Related metrics
- Selection targets:
  - session
  - projected item
- 기본 규칙:
  - session selection이면 session summary/metrics를 보여준다.
  - item selection이면 해당 item의 preview, raw, tokens를 보여준다.
  - 최신 item이 선택되지 않아도 manual mode에서는 viewport를 강제로 이동시키지 않는다.

# Visual direction

- Mood:
  - "glass-inspired observability desk"
  - floating translucent panels + sharp grid + quiet status color
- Principles:
  - blur는 panel 레벨에서 제한적으로 사용하고, timeline 본문은 contrast 우선
  - 장식보다 density와 legibility 우선
  - dark-only로 고정하지 않고 light-default + dark-capable 구조 유지
- Typography:
  - expressive sans + mono pairing
  - candidate: `Instrument Sans` + `IBM Plex Mono`
- Motion:
  - lane reveal, drawer expansion, filter chip transition
  - zoom transition은 짧고 즉각적이어야 하며 cinematic easing을 피한다

# External visual references

- Fact: Apple은 2025-06-09에 Liquid Glass 기반 software design을 소개했다. [Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- Design inference:
  - 본 앱은 Liquid Glass를 그대로 복제하지 않고, "layer depth / translucency / edge highlight"만 차용한다.
  - 타임라인 본문은 blur가 아니라 crisp vector lines를 유지한다.
