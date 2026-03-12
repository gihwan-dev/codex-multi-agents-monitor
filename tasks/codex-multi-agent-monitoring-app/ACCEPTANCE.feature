Feature: Codex multi-agent monitoring desktop app

  # AC-001
  Scenario: Live sessions appear by workspace
    Given Codex has active session files under ~/.codex/sessions
    When the user opens the Live Monitor
    Then the sidebar shows sessions grouped by workspace
    And active sessions are visually distinguished from archived sessions

  # AC-002
  Scenario: Sequence timeline explains multi-agent flow
    Given a session contains user messages, tool calls, spawned sub-agents, and token counts
    When the user opens the session detail
    Then the timeline shows User, Main, and sub-agent lanes
    And the horizontal axis represents elapsed time
    And long-running spans are visually longer than short spans

  # AC-003
  Scenario: Detail depth can be expanded without overwhelming the default view
    Given the selected session contains many raw events
    When the user stays in default diagnostic mode
    Then the app shows summarized reasoning and merged tool spans
    When the user opens the raw detail drawer
    Then the app reveals raw payloads for the selected item only

  # AC-004
  Scenario: Archive filters narrow the result set
    Given archived sessions exist
    When the user filters by workspace, date range, and repeated-work flag
    Then the result list updates without leaving the archive screen
    And opening a result reuses the same timeline detail surface

  # AC-005
  Scenario: Dashboard highlights orchestration quality
    Given normalized sessions and metric snapshots exist
    When the user opens the Dashboard
    Then the user sees token, delegation, latency, and repeated-work metrics
    And suspicious sessions provide drill-down links into detail view

  # AC-006
  Scenario: Privacy remains local-only
    Given the app processes local Codex logs
    When the user interacts with live, archive, and dashboard views
    Then session contents and derived metrics remain on the local machine only

  # AC-007
  Scenario: Performance remains usable on large session data
    Given a session contains at least 10,000 normalized events
    When the user opens the detail view and zooms or pans
    Then the timeline remains interactive without blocking the UI thread for a visibly long time

  # AC-008
  Scenario: Query foundation preserves live shell state
    Given the workspace snapshot bootstrap query is pending
    And a live summary update arrives before the bootstrap query resolves
    When the app finishes loading the Live Monitor
    Then the workspace sessions query cache contains both the bootstrap snapshot and the live summary
    And the current selection state remains feature-local instead of moving into the query cache
