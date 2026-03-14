Feature: Codex Multi-Agent Monitor v0.1

  Scenario: AC-001 prioritize anomalous runs on the home screen
    Given multiple runs across projects include live, waiting, failed, and completed states
    When the user opens the home screen
    Then live and waiting or blocked runs appear before recent completed runs
    And each row shows project context, duration, agent count, error signal, and last update

  Scenario: AC-002 answer the 30-second checklist from graph mode
    Given a run contains multiple agents, handoffs, waits, and a final artifact
    When the user opens graph mode
    Then the user can identify agent count, current states, last handoff, longest gap, first failure, and final artifact without opening raw payload

  Scenario: AC-003 distinguish wait reasons and routing semantics
    Given a run contains waiting, blocked, interrupted, handoff, and transfer events
    When the user inspects the event graph
    Then waiting-class states show a wait reason
    And handoff and transfer edges remain visually distinct

  Scenario: AC-004 jump directly to anomalies
    Given a run includes an error, a long idle gap, and a blocked event
    When the user uses filters or anomaly jump actions
    Then the view jumps to first error, longest wait, or blocked reason without scanning the full timeline manually

  Scenario: AC-005 import a completed run with masking defaults
    Given a completed run payload contains prompts, tool output, and metadata
    When the user imports the run
    Then preview fields are stored by default
    And raw payload stays opt-in
    And export excludes raw payload unless explicitly enabled

  Scenario: AC-006 follow a live run and recover from watch interruption
    Given a live watch stream is connected
    When new events arrive and the user scrolls away from the latest event
    Then follow-live pauses with a visible badge
    And reconnect or stale status is surfaced if the watch source stops updating

  Scenario: AC-007 switch between graph, waterfall, and map views
    Given normalized run data is available
    When the user toggles modes in run detail
    Then graph, waterfall, and map views render from the same dataset and preserve current run selection
