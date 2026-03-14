Feature: Codex Multi-Agent Monitor v0.1 run debugging
  사용자는 하나의 멀티 에이전트 run을 열었을 때 30초 안에 핵심 lifecycle과 interaction을 읽을 수 있어야 한다.

  Background:
    Given canonical fixture "multi-agent-run-v0-1"
    And fixture는 3개 이상의 agent lane과 1개 이상의 handoff, transfer, wait, failure or completion event를 가진다

  Scenario: 30초 안에 run 핵심 질문 6개에 답한다
    When 사용자가 Run Detail 기본 Graph 화면을 연다
    Then 사용자는 30초 안에 agent count를 말할 수 있다
    And 현재 running, waiting, blocked, interrupted, done, failed 상태를 구분할 수 있다
    And 마지막 handoff의 source와 target을 말할 수 있다
    And 가장 긴 hidden gap을 찾을 수 있다
    And 첫 실패 지점을 찾을 수 있다
    And final artifact를 만든 agent를 찾을 수 있다

  Scenario: wait reason jump로 막힌 이유를 바로 본다
    Given run에 waiting 또는 blocked event가 있다
    When 사용자가 jump bar에서 "Longest wait" 또는 waiting filter를 선택한다
    Then 선택된 event는 focus 상태가 된다
    And inspector는 `wait_reason`을 반드시 보여준다

  Scenario: 마지막 handoff를 inspection 한다
    Given run에 `handoff` edge가 하나 이상 있다
    When 사용자가 jump bar에서 "Last handoff"를 선택한다
    Then source agent와 target agent가 강조된다
    And inspector는 edge type, source, target, related payload preview를 보여준다

  Scenario: longest gap을 inspection 한다
    Given run에 folded gap row가 있다
    When 사용자가 gap row를 클릭한다
    Then hidden duration과 idle lane 수를 볼 수 있다
    And 필요 시 gap을 expand할 수 있다

  Scenario: 첫 실패 지점을 식별한다
    Given run에 `failed` status event 또는 `error` event가 있다
    When 사용자가 jump bar에서 "First error"를 선택한다
    Then 가장 이른 실패 event가 focus 상태가 된다
    And inspector는 `error_code` 또는 `error_message`를 보여준다

  Scenario: final artifact author를 식별한다
    Given run에 artifact_ref가 포함된 completed event가 있다
    When 사용자가 final artifact 관련 edge 또는 event를 선택한다
    Then inspector는 artifact와 source agent를 보여준다

  Scenario: raw payload는 opt-in이며 export 기본값은 raw excluded다
    Given project privacy policy가 기본값이다
    When 사용자가 기본 export를 수행한다
    Then export 결과에는 raw payload가 포함되지 않는다
    When 사용자가 raw capture를 명시적으로 opt-in 한다
    Then raw payload reference는 선택적으로 저장될 수 있다
