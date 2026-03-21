# Verification Plan

## Automated checks

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm storybook:build`
- `pnpm build`

## Storybook review matrix

- `REQ-001` / `AC-001`
  - Foundations stories show typography, spacing, radius, semantic status tokens, dark/light preview
- `REQ-002`
  - Primitive stories cover default, hover/focus, disabled, and overflow cases
- `REQ-003` / `AC-003`
  - Dialog, Sheet, DropdownMenu, Tabs, Command are keyboard navigable
- `REQ-006`
  - dark/light preview works from the same semantic token source

## App-integrated checks

- `AC-002`
  - default run fixture still answers the 30-second checklist
- `AC-004`
  - dense parallel fixture keeps graph readability and shell density
- imported run and live watch chips keep distinct semantics
- inspector and drawer focus return works after migration

## CSS retirement checks

- no new widget `.css` files are introduced after `SLICE-1`
- deleted CSS selectors do not reappear in migrated files
- legacy primitive selectors are absent from migrated surfaces

## Manual approval loop

- review `SCR-001` and `SCR-002` with Storybook first
- only after approval, land `SCR-003` migrations
- if a primitive family needs more than one semantic wrapper layer, re-open the design review before continuing
