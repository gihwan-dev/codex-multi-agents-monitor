# Codex Desktop Multi-Agent Monitor v1

# Goal
- `tasks/codex-desktop-multi-agent-monitor/PLAN.md`를 이번 설계 문서의 단일 산출물로 고정한다.
- 이번 턴 범위는 문서 확정만이다. 앱 구현, 코드 생성, 설정 변경은 하지 않는다.
- `Tauri v2 + React + TypeScript` 기반의 macOS 로컬 앱으로 Codex Desktop 멀티에이전트의 실시간 병목과 작업 흐름을 관측한다.
- v1의 핵심 UX는 `타임라인`이다. 메인 thread, subagent, `wait`, tool 실행, commentary/final 메시지를 시간축 위에서 함께 보여줘서 "누가 누구를 기다리게 만들었는지"를 즉시 파악할 수 있어야 한다.
- 성공 기준은 다음 네 가지다.
- 지금 실행 중인 thread 중 어디가 병목인지 바로 보인다.
- 어떤 task에 어떤 subagent들이 붙었는지 보인다.
- 각 agent가 최근 무엇을 하고 있었는지 요약 우선으로 보인다.
- thread 상세 화면에서 메인/서브에이전트 타임라인과 `wait` 구간이 연결되어 보인다.

# Task Type
- `feature`

# Scope / Non-goals
- Scope:
- `~/.codex/sessions/**/*.jsonl`을 실시간 소스로 사용한다.
- `~/.codex/archived_sessions/*.jsonl`을 회고/히스토리 소스로 사용한다.
- `~/.codex/state_5.sqlite`를 thread 메타데이터와 부모-자식 관계 보강 소스로 사용한다.
- Live Overview 화면을 제공한다.
- Thread Detail 화면을 제공한다.
- Agent Drilldown 패널을 제공한다.
- Timeline 중심 시각화를 제공한다.
- 기본 텍스트 노출 정책은 `요약 우선 + 원문 펼침`으로 고정한다.
- deep link는 워크스페이스 열기와 로그 파일 열기까지만 제공한다.
- Non-goals:
- agent 중지, 재개, interrupt 같은 제어 기능
- 외부 서버 업로드, 팀 공유, 클라우드 동기화
- `~/Library/Application Support/com.openai.chat/codex-task*` 경로 의존
- Windows/Linux 대응
- Codex 내부 파일 구조 변경
- 이번 턴의 앱 구현

# Keep / Change / Don't touch
- Keep:
- Codex가 생성하는 로그와 DB는 읽기 전용으로만 사용한다.
- 로컬 우선, 오프라인 동작을 기본값으로 둔다.
- 기존 Codex Desktop 동작에는 개입하지 않는다.
- Change:
- 앱 전용 로컬 인덱스 DB `monitor.db`를 별도로 두고 source 로그를 정규화한다.
- 병목 판단을 `wait`, child session duration, 최근 commentary, tool span으로 계산한다.
- 전체 UI를 테이블 나열이 아니라 timeline-first 구조로 설계한다.
- Don't touch:
- `~/.codex` 내부 파일의 쓰기/정리/마이그레이션
- Codex Desktop 내부 비공개 IPC를 전제로 한 설계
- 비어 있는 `com.openai.chat/codex-task*` 디렉터리 기반 설계

# Evidence
## Repo evidence
- 현재 저장소는 비어 있으므로 greenfield 설계가 맞다.
- 실시간 세션 로그는 `~/.codex/sessions/2026/03/10/rollout-*.jsonl`에 존재한다.
- 완료 세션 로그는 `~/.codex/archived_sessions/*.jsonl`에 존재한다.
- session JSONL에는 `session_meta`, `task_started`, `user_message`, `agent_message`, `function_call`, `function_call_output`, `task_complete`가 들어 있다.
- 메인 thread 로그에는 `spawn_agent`, `wait`, `request_user_input`, `exec_command` 호출과 결과가 남는다.
- subagent session의 `session_meta.payload.source.subagent.thread_spawn`에 `parent_thread_id`, `depth`, `agent_nickname`, `agent_role`가 있다.
- `~/.codex/state_5.sqlite`의 `threads` 테이블에는 `id`, `rollout_path`, `created_at`, `updated_at`, `source`, `cwd`, `title`, `agent_role`, `agent_nickname`가 있다.
- `threads.source`에는 subagent spawn 관계가 JSON 문자열로 들어 있으며 `source like '%thread_spawn%'` 조건으로 892개를 확인했다.
- `logs` 테이블에는 `codex_app_server::codex_message_processor` 타깃의 `item_started`, `item_completed`, `exec_command_begin`, `exec_command_end`, `agent_message_delta` 등 보조 이벤트가 남는다.
- `wait` duration은 main thread JSONL의 `function_call` 시각과 `function_call_output` 시각 차이로 계산 가능하다.
- `~/Library/Application Support/com.openai.chat/codex-taskDetails-v1-*`, `codex-taskItems-v2-*`는 현재 머신에서 비어 있다.

## External evidence
- 없음. 현재 요구사항과 데이터 소스는 로컬 환경 증거만으로 확정 가능하다.

## Options considered
- Option A: 프런트엔드가 JSONL을 직접 스캔한다.
- 장점은 단순함이다.
- 단점은 대용량 로그 성능, 증분 수집, thread 상관관계 계산이 약하다.
- Option B: Rust 백엔드가 source를 읽어 앱 전용 SQLite 인덱스를 유지한다.
- 장점은 실시간 성능과 timeline 질의가 안정적이다.
- 단점은 초기 구현량이 약간 늘어난다.
- Option C: `com.openai.chat` 쪽 task 저장소를 1차 소스로 쓴다.
- 장점은 UI 의미가 더 가까울 수 있다.
- 단점은 현재 데이터가 비어 있어 불안정하다.
- 채택은 Option B다.

# Decisions / Open questions
## Chosen approach
- 아키텍처는 `Tauri v2 + Rust backend + React frontend + app-local SQLite`로 고정한다.
- Rust는 `notify`, `rusqlite`, `serde`, `serde_json`를 사용한다.
- 프런트엔드는 `React + TypeScript + Vite + TanStack Query + Zustand + React Router`로 고정한다.
- source는 3개다.
- live source: `~/.codex/sessions/**/*.jsonl`
- history source: `~/.codex/archived_sessions/*.jsonl`
- metadata source: `~/.codex/state_5.sqlite`
- ingestion은 `path + inode + byte_offset` watermark 방식으로 증분 처리한다.
- 인덱스 DB 핵심 테이블은 `threads`, `agent_sessions`, `timeline_events`, `wait_spans`, `tool_spans`, `ingest_watermarks`로 고정한다.
- 핵심 도메인 타입은 `MonitorThread`, `AgentSession`, `TimelineEvent`, `WaitSpan`, `ToolSpan`, `BottleneckSnapshot`으로 고정한다.
- UI는 3화면으로 고정한다.
- `Overview`: 현재 inflight thread 목록 + 병목 상위 목록 + mini timeline
- `Thread Detail`: 메인 thread와 subagent swimlane timeline
- `History`: 최근 7일 role별 duration/timeout/spawn 통계
- Timeline 표현 규칙도 고정한다.
- lane 1개는 thread 또는 agent session 1개다.
- block 색상은 `wait`, `tool`, `message`, `spawn`, `complete`로 구분한다.
- `wait` block은 parent lane에 그리고, 연결선으로 child agent lane과 연결한다.
- commentary/final answer는 marker로 찍고 hover 시 요약을 보여준다.
- 원문은 side panel에서만 펼친다.
- 느림 판단 기본값은 `wait 30초 이상 경고`, `wait 120초 이상 치명`, `tool 20초 이상 경고`다.
- 최근 활동 요약 규칙은 `최근 commentary > 최근 final_answer > 최근 user_message > 최근 function_call 이름` 우선순위로 고정한다.
- deep link는 `open_workspace(cwd)`와 `open_log_file(rollout_path)` 두 가지만 둔다.

## Rejected alternatives
- 프런트엔드 직접 파싱 방식
- `com.openai.chat/codex-task*` 1차 의존
- 관측과 제어를 함께 넣는 설계
- 원문 상시 노출 기본 정책
- timeline 없는 카드/테이블 중심 UI

## Need user decision
- 없음

# Execution slices
- Slice 1. 문서 기준선과 데이터 계약 고정
- `PLAN.md` 기준으로 source path, index schema, timeline event taxonomy를 확정한다.
- 완료 기준은 `MonitorThread`, `AgentSession`, `TimelineEvent`, `WaitSpan`, `ToolSpan` 필드 정의가 문서에 고정되는 것이다.
- Slice 2. ingestion engine 구현
- live sessions, archived sessions, state DB를 읽어 정규화 인덱스를 만든다.
- 완료 기준은 parent-child 관계, wait span, tool span, latest activity summary가 DB에 저장되는 것이다.
- Slice 3. Live Overview 구현
- inflight thread 리스트, 병목 순위, workspace/role/status 필터, mini timeline을 만든다.
- 완료 기준은 현재 실행 중 thread가 2초 이내로 갱신되고 longest wait가 overview에서 보이는 것이다.
- Slice 4. Thread Detail timeline 구현
- 메인 thread와 subagent swimlane timeline, wait-to-agent 연결선, marker summary panel을 만든다.
- 완료 기준은 한 thread 안에서 누가 누구를 기다리게 만드는지 시간축으로 바로 보이는 것이다.
- Slice 5. Agent Drilldown과 raw expansion 구현
- 선택한 agent의 최근 commentary, tool span, wait 영향, raw JSONL snippet을 펼칠 수 있게 한다.
- 완료 기준은 기본은 요약만 보이고 필요할 때만 원문을 확인할 수 있는 것이다.
- Slice 6. History Summary와 deep link 구현
- 최근 7일 기준 role별 평균 duration, timeout 횟수, spawn 빈도, 느린 thread 회고를 보여준다.
- 완료 기준은 history view와 workspace/log deep link가 동작하는 것이다.
- Slice 7. 안정화와 패키징
- malformed line skip, source path 부재 안내, 대용량 archived scan budget, macOS 패키징을 마감한다.
- 완료 기준은 corrupted line 하나로 ingestion이 멈추지 않고 cold start가 허용 시간 안에 끝나는 것이다.

# Verification
- Rust parser test로 main thread JSONL, subagent JSONL, archived JSONL fixture를 각각 검증한다.
- Rust metrics test로 `wait duration`, `timed_out`, `critical path`, `latest activity summary` 계산을 고정한다.
- SQLite integration test로 `threads`와 source JSONL correlation이 맞는지 검증한다.
- Frontend component test로 overview row, mini timeline, thread swimlane, raw expansion panel을 검증한다.
- Tauri smoke test로 임시 `.codex` fixture 디렉터리를 주입해 전체 흐름을 검증한다.
- 수용 시나리오는 다음으로 고정한다.
- 느린 agent를 overview에서 10초 안에 찾을 수 있다.
- thread detail에서 main thread와 subagent lane이 분리되어 보인다.
- `wait` 구간을 클릭하면 어떤 child agent를 기다렸는지 보인다.
- 각 agent에 대해 최근 commentary 요약이 보인다.
- 원문은 기본 접힘 상태이고 펼쳤을 때만 본문이 보인다.
- 워크스페이스와 로그 파일로 이동할 수 있다.

# Stop / Replan conditions
- `~/.codex/sessions` append 패턴이 실시간 source로 충분히 안정적이지 않으면 live monitor 설계를 재검토한다.
- `state_5.sqlite` schema drift가 커서 `threads.source` 해석 정확도가 95% 미만이면 DB 의존도를 낮추고 JSONL correlation 중심으로 재설계한다.
- timeline 한 화면에서 100 lane 이상일 때 렌더 성능이 무너지면 lane virtualized timeline 설계로 전환한다.
- 최근 7일 cold scan이 10초를 넘기면 history 기본 범위를 더 줄인다.
- malformed line 비율이 높아 parser 복구 비용이 커지면 source별 quarantine 전략을 추가한다.
- Tauri 파일 접근 권한 UX가 불안정하면 companion reader 분리안을 다시 검토한다.
