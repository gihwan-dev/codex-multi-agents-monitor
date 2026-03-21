Feature: Tailwind v4 + shadcn/ui design system migration

  Background:
    Given the monitor remains a graph-first desktop debugging workbench

  @AC-001
  Scenario: Storybook becomes the design approval surface
    When a maintainer opens Storybook foundations and primitive stories
    Then they can review token, focus, status, and density decisions before real screen integration

  @AC-002
  Scenario: Migrated monitor shell preserves the 30-second checklist
    Given the default or dense parallel fixture is loaded
    When a user inspects the migrated monitor shell
    Then they can still find agent count, current status split, last handoff, longest gap, first failure, and final artifact without opening raw payload

  @AC-003
  Scenario: Keyboard and theme preview behavior remain accessible
    When a user navigates migrated primitives and overlay surfaces with only the keyboard
    Then focus order, focus return, and visible focus treatment remain intact
    And dark and light previews use the same semantic token contract

  @AC-004
  Scenario: CSS retirement does not break core screens
    When legacy primitive and widget presentation CSS is removed for a migrated surface
    Then the Storybook build and production build still succeed
    And the migrated surface does not depend on deleted selectors
