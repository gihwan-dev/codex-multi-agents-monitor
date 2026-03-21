# Rollback Plan

## Rollback triggers

- Tailwind v4 foundation breaks Vite/Tauri dev or production build
- Storybook can no longer render monitor fixtures reliably
- migrated surface regresses the 30-second checklist or keyboard/focus behavior
- graph readability drops materially on dense parallel fixtures

## Safe checkpoints

- Checkpoint A: after `SLICE-1`, before any real monitor surface adoption
- Checkpoint B: after `SLICE-2`, with stories approved but app screens mostly untouched
- Checkpoint C: after each real-surface slice (`SLICE-3` to `SLICE-6`)

## Rollback method

- revert the current slice only; do not unwind approved earlier slices automatically
- if a primitive/composite family is the failure source, keep Tailwind foundation and roll back that family alone
- if the failure source is token mapping or root CSS entry, roll back to the prior safe checkpoint before resuming
- document rollback cause and surviving artifacts in `STATUS.md`

## Partial-retain rule

- Storybook fixtures and review notes may remain even when a surface migration is rolled back
- issue `#5` handoff docs remain valid unless the rollback changes token architecture itself
