# Codex Multi-Agent Monitor v0.1 PRD

## Problem statement

멀티 에이전트 run은 span, handoff, tool call, wait, artifact가 서로 다른 lane에서 동시에 일어나기 때문에 단순 로그 나열만으로는 “누가 무엇을 하고 왜 멈췄는지”를 빠르게 읽기 어렵다. 현재 v0.1의 핵심 문제는 한 run을 열었을 때 인과 관계, 병렬성, waiting point, 실패 지점을 30초 안에 파악하기 어렵다는 점이다.

## Product goal

하나의 멀티에이전트 run을 열면, 30초 안에 누가 생성됐고, 누가 누구에게 일을 넘겼고, 어디서 기다리고 있고, 무엇을 남기고 어떻게 끝났는지를 파악할 수 있어야 한다.

## Target user

- Codex multi-agent run을 디버깅하는 개발자
- handoff와 worktree 흐름을 추적해야 하는 operator
- trace 구조를 빠르게 읽고 병목과 실패 지점을 찾아야 하는 reviewer

## User problem

- run list에서는 이상한 run을 빨리 찾기 어렵다.
- run detail에서는 parent-child만으로 설명되지 않는 handoff/transfer/merge 관계가 묻힌다.
- waiting, blocked, interrupted가 같은 “멈춤”으로 보이면 원인 파악이 늦어진다.
- raw payload를 기본 저장하면 privacy risk가 커지고, 반대로 아무것도 저장하지 않으면 디버깅 가치가 떨어진다.

## User value

- run triage 시간이 줄어든다.
- 병목, 실패, idle gap을 바로 찾을 수 있다.
- handoff와 artifact transfer를 눈으로 읽을 수 있다.
- privacy 기본값을 유지하면서도 필요한 경우만 raw를 열람할 수 있다.

## v0.1 in scope

- Tauri desktop app 기준의 monitoring workbench
- `Project -> Session -> Run` 정보 구조
- Run List와 Run Detail 화면
- Graph, Waterfall, Map 세 가지 read mode
- completed run import
- local live tail/watch
- normalized event schema와 summary contract
- preview-only default privacy policy와 raw opt-in/export rule

## v0.1 out of scope

- web deployment
- direct Codex runtime coupling
- team analytics dashboard
- cross-run 비교
- eval/scoring
- prompt playground
- full diff viewer
- sampling policy UI

## Success metrics

- 사용자가 단일 run에서 30초 안에 핵심 질문 6개에 답할 수 있다.
- run list에서 live, waiting/blocked, failed run을 우선적으로 triage할 수 있다.
- Graph mode가 parallelism과 causality를, Waterfall이 latency를, Map이 macro dependency를 설명한다.
- import와 local watch가 동일한 schema와 summary contract를 유지한다.
- privacy 기본값이 raw opt-in을 강제하고 export 기본값에서 raw를 제외한다.

## Product requirements

- `REQ-01` Run List는 문제 있는 run을 빠르게 찾도록 상태, duration, agent 수, error 유무, 마지막 업데이트를 보여준다.
- `REQ-02` Run Detail은 기본적으로 compressed graph를 보여주고 lane, event, edge, gap folding, drawer를 제공한다.
- `REQ-03` waiting, blocked, interrupted는 서로 다른 상태로 보여야 하며 waiting 계열 이벤트에는 `wait_reason`이 필수다.
- `REQ-04` handoff와 transfer는 서로 다른 edge semantics를 유지해야 한다.
- `REQ-05` Graph, Waterfall, Map 세 모드는 같은 run data를 서로 다른 mental model로 보여준다.
- `REQ-06` summary bar는 `duration`, `active_time`, `idle_time`, `agent_count`, `peak_parallelism`, `llm_calls`, `tool_calls`, `total_tokens`, `total_cost`, `error_count`를 제공한다.
- `REQ-07` ingest는 completed import와 local watch 두 경로를 지원하되 내부 schema는 동일해야 한다.
- `REQ-08` preview-only default, raw opt-in, export raw excluded를 기본 privacy policy로 적용한다.

## Acceptance anchors

| Acceptance ID | 질문 | 관련 요구사항 |
| --- | --- | --- |
| `AC-01` | 몇 개 agent가 돌았는가 | `REQ-01`, `REQ-06` |
| `AC-02` | 지금 누가 running / waiting / done 인가 | `REQ-02`, `REQ-03` |
| `AC-03` | 마지막 handoff는 어디서 어디로 갔는가 | `REQ-02`, `REQ-04` |
| `AC-04` | 가장 긴 공백은 어디였는가 | `REQ-02`, `REQ-06` |
| `AC-05` | 실패했다면 첫 실패 지점은 어디인가 | `REQ-02`, `REQ-03`, `REQ-06` |
| `AC-06` | 최종 산출물은 어느 agent가 만들었는가 | `REQ-02`, `REQ-04` |

## References

- Codex concepts: Multi-agents, Codex app
- OpenTelemetry: overview, trace API, handling sensitive data
- Langfuse: data model, agent graphs
- OpenAI Agents SDK: tracing
