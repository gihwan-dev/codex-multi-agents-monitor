Feature: Run workbench causal graph reset

  Scenario: AC-001 workspace tree helps find the anomalous run quickly
    Given multiple workspaces and runs are loaded in the left rail
    When the user filters or searches the dense workspace tree
    Then the user can identify the target run with workspace and thread context in under 10 seconds

  Scenario: AC-002 graph mode answers the 30-second checklist
    Given a run is open in Graph mode
    When the user reviews the summary strip, anomaly jumps, graph canvas, and inspector
    Then the user can identify blocker, affected agents, last handoff, longest gap, and first failure without opening raw payload

  Scenario: AC-003 selection keeps graph, waterfall, and inspector on the same causal path
    Given a row, edge, or anomaly jump is selected
    When the user changes view mode or opens the inspector
    Then the same run title and causal focus remain visible across surfaces

  Scenario: AC-004 drawer stays hidden until explicitly opened
    Given the workbench is visible
    When the user has not opened artifacts, log, raw, or import detail
    Then the bottom drawer consumes no layout height

  Scenario: AC-005 dense parallel runs preserve selected path focus
    Given the dense parallel fixture is loaded
    When the default Graph mode is rendered
    Then path-only focus keeps the selected blocker chain readable without losing selection reachability

  Scenario: AC-006 keyboard-only navigation remains complete
    Given the user is navigating with keyboard only
    When the user switches modes, moves selection, and reopens the compact inspector
    Then focus order and core shortcuts remain intact
