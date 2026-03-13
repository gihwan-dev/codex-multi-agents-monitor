# Product summary

Codex Multi-Agent Monitor는 Codex 세션 로그를 읽어 멀티 에이전트 협업을 "보이는 상태"로 만든다. 사용자는 라이브 세션 진행 상황, 아카이브 세션 재분석, 그리고 에이전트 활용 현황을 한 앱 안에서 확인할 수 있어야 한다.

# Problem

- 현재 Codex 세션은 로그 파일로 남지만, 라이브 세션에서 "누가 지금 무엇을 하고 있는지"를 직관적으로 파악하기 어렵다.
- 서브 에이전트 입력/출력, 툴 호출 흐름, 대기 시간, 토큰 사용 분포, 반복 작업 신호가 한 곳에 모여 있지 않다.
- 긴 세션은 시간 축이 흐릿해서 롱 러닝 작업과 병목을 파악하기 어렵다.
- 아카이브 세션은 검색/필터/비교 관점이 부족하다.

# Users

- 1차 사용자: Codex를 실제로 쓰면서 멀티 에이전트 orchestration 품질을 개선하고 싶은 파워 유저.
- 2차 사용자: 특정 세션이 왜 느리거나 비효율적이었는지 사후 분석하고 싶은 워크플로우 디자이너.

# Jobs to be done

- "지금 어떤 workspace에서 어떤 세션이 진행 중인지 보고 싶다."
- "메인 에이전트가 언제 서브 에이전트를 불렀고, 얼마나 오래 기다렸는지 알고 싶다."
- "토큰이 어느 행동에서 많이 쓰였는지 보고 싶다."
- "오케스트레이터가 비슷한 reasoning/tool loop를 반복했는지 확인하고 싶다."
- "과거 세션을 필터링해서 특정 패턴과 문제를 다시 보고 싶다."

# In-scope screens

- `SCR-001` Live Monitor
- `SCR-002` Archive Monitor
- `SCR-003` Dashboard

# Out of scope

- Codex 세션 직접 편집 또는 조작
- 원격 multi-user collaboration
- draw.io 수준의 범용 diagram editing
- 클라우드 sync, 팀 권한, 공유 링크
- LLM 기반 자동 remediation 실행

# Functional requirements

- `REQ-001` 앱은 `~/.codex/sessions`와 `~/.codex/archived_sessions`를 구분해 라이브/아카이브 세션을 표시해야 한다.
- `REQ-002` 워크스페이스 사이드바는 workspace 단위로 세션 목록을 그룹핑해야 한다.
- `REQ-003` Live Monitor 상세 화면은 `User | Main | Sub-agent...` lane과 세로 시간 축을 갖는 sequence timeline을 제공해야 한다. 최신 이벤트는 가장 아래에 보여야 한다.
- `REQ-004` 타임라인은 너무 많은 raw event를 그대로 뿌리지 않고 zoom level과 detail setting에 따라 요약/확장을 제공해야 한다.
- `REQ-005` Archive Monitor는 날짜, workspace, agent role, tool, duration, error, repeated-work flag 등의 필터를 제공해야 한다.
- `REQ-006` Dashboard는 토큰, agent utilization, delegation quality, latency, repeat-work, tool efficiency를 시각화해야 한다.
- `REQ-007` 토큰 사용량은 세션 기준으로 drill-down 가능해야 하며, subagent/session metadata가 있는 경우 agent/session 기준 exact 집계를 제공해야 한다. turn/tool exact attribution은 explicit raw evidence 확보 전까지 deferred한다.
- `REQ-008` 서브 에이전트 입력/출력은 기본적으로 요약 상태로 보이고, 선택 시 원문 패널로 확장 가능해야 한다.
- `REQ-009` 오케스트레이터 반복 작업 의심 시그널을 heuristic metric으로 계산해 보여줘야 한다.
- `REQ-010` 대량 세션에서도 usable한 성능을 유지해야 한다.
- `REQ-011` 시각 테마는 glass-inspired, modern, desktop-native mood를 갖되 readability를 해치지 않아야 한다.
- `REQ-012` 모든 데이터 처리는 로컬 장치 안에서 끝나야 한다.
- `REQ-013` live timeline은 최근 하단 시퀀스를 기본으로 따라가야 하며, 사용자가 viewport에 개입하면 latest follow를 끄고 명시적 control로 다시 켤 수 있어야 한다.

# Success criteria

- `AC-001` 사용자는 진행 중인 live 세션을 workspace sidebar에서 즉시 찾을 수 있다.
- `AC-002` 사용자는 한 세션 안에서 user question, main agent action, sub-agent work span, tool spans를 같은 시간 축에서 본다.
- `AC-002a` 사용자는 live에서 최신 시퀀스를 별도 조작 없이 바로 보고, 필요할 때 manual review와 latest follow를 오갈 수 있다.
- `AC-003` 사용자는 archived session 집합에서 원하는 세션을 필터링해 다시 연다.
- `AC-004` 사용자는 dashboard에서 delegation quality와 repeat-work 징후를 빠르게 파악한다.
- `AC-005` 10,000+ normalized events 샘플에서 첫 detail paint와 zoom/pan이 사용 가능한 수준을 유지한다.

# UX sketch

```text
+-----------------------------------------------------------------------------------+
| Sidebar (workspace)     | Top nav: Live | Archive | Dashboard | filters | search |
|-------------------------+---------------------------------------------------------|
| exem-ui                 | Timeline (zoomable SVG)                                |
|  - live session A       | time                                                    |
|  - archived session B   |   |                                                     |
| resume-with-ai          |   v                                                     |
|  - live session C       | User | Main | Agent Writer | Agent Reviewer            |
|                         |  Q1                                                     |
|                         |      |---- plan ----|                                   |
|                         |      | tool:rg      |                                   |
|                         |      | spawn ------>|                                   |
|                         |      | wait --------|==== work span ====|               |
|                         |      | result <-----|                                   |
|                         |                            latest at bottom             |
|                         |                                                         |
|                         | detail panel: summary / raw input / raw output / tokens |
+-----------------------------------------------------------------------------------+
```

```text
+------------------------------------------------ Dashboard ------------------------------------------------+
| Token heatmap | Agent utilization | Spawn depth | Wait ratio | Repeated work | Tool latency | Error trend |
+-----------------------------------------------------------------------------------------------------------+
```

# Key flows

- `FLOW-001` Live ingest -> session summary update -> timeline stream append.
- `FLOW-002` Archived session filter -> result list -> detail replay.
- `FLOW-003` Metric drilldown -> suspicious session -> timeline jump.
- `FLOW-004` Live default follow -> manual scrub/zoom -> eye control로 latest follow resume.

# Dependencies and assumptions

- Codex local session logs는 append-friendly JSONL 형태를 유지한다.
- `session_meta.forked_from_id`, `agent_role`, `agent_nickname`, `source.subagent.thread_spawn.parent_thread_id`, `token_count`, `function_call`, `function_call_output` 계열 이벤트는 현재 버전에서 관찰 가능하다.
- live/archive 분류는 현재 파일 위치 snapshot 기준으로 처리하며 archive move 시점 복원은 v1 범위 밖이다.
- token exactness는 session totals와 metadata가 있는 agent/session totals까지만 계약하고 turn/tool attribution은 deferred한다.
- `SLICE-6` detail renderer는 session-local query contract만 사용한다. true cross-session sub-agent replay parity는 `SLICE-7+` 범위다.
- 로그 포맷은 future-proof하지 않으므로 parser versioning이 필요하다.
