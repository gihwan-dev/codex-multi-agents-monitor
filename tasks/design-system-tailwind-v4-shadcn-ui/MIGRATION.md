# Migration Plan

## Scope split

- Primary source issue: [#4](https://github.com/gihwan-dev/codex-multi-agents-monitor/issues/4)
- Dependent follow-up: [#5](https://github.com/gihwan-dev/codex-multi-agents-monitor/issues/5)
- Confirmed scope:
  - this task ships `theme-ready token architecture + Storybook dark/light preview`
  - full end-user theme toggle UX, persistence, and system-sync polish remain in `#5`

## Phase 0. Bootstrap and contract update

- update repo baseline docs so Tailwind/shadcn adoption is no longer banned
- add task-specific implementation supplement
- lock the Tailwind entry path, token path, primitive directory strategy, and story taxonomy

Exit criteria:

- `ENGINEERING_RULES.md` and new implementation supplement agree on the same styling baseline
- Storybook-first approval rule is documented

## Phase 1. Design system foundation

- install Tailwind CSS v4 and Vite plugin
- create root CSS entry and semantic token mapping
- initialize shadcn/ui and shared `cn` helper
- stand up Storybook foundations section

Exit criteria:

- dark baseline renders correctly in app and Storybook
- spacing, radius, typography, neutral palette, and semantic status tokens are visible in Storybook
- no real monitor screen has been migrated yet

## Phase 2. Primitive and composite coverage

- add shadcn-derived primitives
- create monitor composites for status, metrics, tabs, toolbar affordances
- add mock fixtures and state stories

Exit criteria:

- `SCR-001` and `SCR-002` are reviewable
- keyboard/focus/a11y contracts are verifiable in stories
- real screen integration is still deferred except for smoke wiring

## Phase 3. Real monitor surface adoption

- migrate top chrome and shared controls first
- migrate rail, summary strip, inspector, and drawer shells next
- migrate graph-adjacent shell and panel wrappers last

Exit criteria:

- `SCR-003` preserves 30-second checklist
- migrated surfaces no longer depend on legacy primitive CSS
- screen regressions are verified against current fixtures

## Phase 4. CSS retirement and cleanup

- delete or empty legacy presentation CSS files
- leave only Tailwind entry CSS, semantic token CSS, motion CSS, and documented exceptions
- update docs, verification baselines, and rollback notes

Exit criteria:

- `src/theme/primitives.css` is retired
- widget presentation CSS is removed or explicitly documented as a temporary exception
- Storybook/app builds and smoke validation stay green

## Non-goals during migration

- changing the normalized trace model
- redesigning graph semantics from scratch
- introducing a new global state/store layer
- bundling theme toggle productization from issue `#5` unless scope is explicitly merged later
