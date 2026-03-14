Feature: Run workbench UI redesign

  Scenario: AC-001 workspace tree helps find the anomalous run quickly
    Given multiple workspaces and runs are loaded in the left rail
    And quick filters for All, Live, Waiting, and Failed are available
    When the user narrows to the suspicious status and scans the workspace tree
    Then the user can identify the target run with workspace and thread context in under 10 seconds

  Scenario: AC-002 row-based graph answers the 30-second checklist
    Given a run is open in graph mode
    When the user reviews the compact summary strip, anomaly chips, and row-based graph
    Then the user can identify the current blocker, last handoff, first failure, and final artifact without opening raw payload

  Scenario: AC-003 selection keeps graph and inspector on the same causal path
    Given a waiting, blocked, failed, or handoff-related item is selected
    When the selection changes through a row, edge, or anomaly chip
    Then the graph highlights the same causal path that the inspector explains in Summary, Cause, and Impact sections

  Scenario: AC-004 drawer stays hidden until explicitly opened
    Given the run detail workbench is visible
    When the user has not requested artifacts, log, raw, or import detail
    Then the bottom drawer consumes no layout height
    And it only appears after an explicit drawer-opening action

  Scenario: AC-005 large-run degradation preserves key anomalies
    Given the dense parallel fixture is loaded
    When default collapse and gap folding rules are applied
    Then selected path, first error, and longest wait affordances remain visible and reachable

  Scenario: AC-006 keyboard-only navigation remains complete
    Given the user is navigating with keyboard only
    When the user moves through the workspace tree, graph rows, inspector, and drawer
    Then focus order, focus return, and core shortcuts remain intact
