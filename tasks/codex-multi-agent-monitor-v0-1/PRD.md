# Product Requirements

## Goal

- 하나의 멀티에이전트 run을 30초 안에 설명 가능한 상태로 만드는 데스크톱 디버깅 워크벤치를 만든다.

## Audience

- 멀티에이전트 run을 추적해야 하는 제품 오너
- handoff, wait, failure 원인을 파악해야 하는 엔지니어
- sub-agent orchestration 품질을 검토해야 하는 리뷰어

## Requirements

- `REQ-001` `SCR-001` Run Home은 live, waiting/blocked, failed, recent completed run을 project context와 함께 우선순위 정렬로 보여줘야 한다.
- `REQ-002` `SCR-002` Run Detail은 summary strip, anomaly jump bar, compressed event graph, inspector를 한 화면에서 제공해야 한다.
- `REQ-003` `SCR-002` Run Detail은 `spawn`, `handoff`, `transfer`, `merge`를 서로 다른 edge semantics로 보여주고 `waiting`, `blocked`, `interrupted` 상태에는 항상 `wait_reason`을 노출해야 한다.
- `REQ-004` `SCR-002`/`SCR-003` 사용자는 agent filter, event type filter, error-only toggle, gap fold/unfold, arrow payload drilldown, blocked/wait jump를 통해 문제 지점으로 바로 이동할 수 있어야 한다.
- `REQ-005` `FLOW-004`/`FLOW-005` v0.1 입력 경로는 completed-run import와 live watch 두 가지로 제한하고, 둘 다 같은 normalized schema로 합쳐야 한다.
- `REQ-006` `FLOW-004`/`FLOW-005` raw prompt/tool output은 opt-in이고 기본 저장은 preview만 허용하며, project 단위 민감 정보 저장 금지와 event redaction hook를 제공해야 한다.
- `REQ-007` `FLOW-006` 동일한 run dataset 위에서 `Graph`, `Waterfall`, `Map` 세 모드를 전환할 수 있어야 하며 기본값은 `Graph`다.

## Success checks

- 사용자는 raw 탭을 열지 않고도 agent 수, 현재 running/waiting/done, 마지막 handoff, 가장 긴 공백, 첫 실패 지점, 최종 산출물 생성 agent를 말할 수 있어야 한다.
- waiting/blocked/interrupted 이벤트는 항상 이유를 함께 노출해야 한다.
- `handoff`와 `transfer` 화살표는 제어권 이동과 데이터 이동을 혼동하지 않게 분리되어야 한다.
- 이상한 run은 Run Home에서 10초 안에 찾을 수 있어야 한다.

## Non-goals

- 비례 시간축 전체 줌 차트 중심의 analytics dashboard
- cross-run 비교, eval/scoring, full diff viewer, prompt playground
- 팀 단위 KPI 리포팅과 sampling 정책 UI
