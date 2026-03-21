# Inputs Read

- `README.md`
- `SPEC_VALIDATION.md`
- `UX_SPEC.md`
- `UX_BEHAVIOR_ACCESSIBILITY.md`
- `TECH_SPEC.md`
- `MIGRATION.md`
- `VERIFICATION.md`
- `EXECUTION_PLAN.md`
- `ACCEPTANCE.feature`
- `ADRs/ADR-001-design-system-baseline.md`
- `DESIGN_REFERENCES/manifest.json`
- repo facts from `package.json`, `vite.config.ts`, `.storybook/main.ts`, `.storybook/preview.ts`, and `src/main.tsx`

# Task-Specific Decisions

- This task now has two implementation SSOT layers:
  - repo baseline: `docs/ai/ENGINEERING_RULES.md`
  - task supplement: `IMPLEMENTATION_CONTRACT.md`
- `BOOTSTRAP` and `SLICE-1` implementers must read `UX_SPEC.md` and `UX_BEHAVIOR_ACCESSIBILITY.md` before touching any styling or Storybook files.
- The root styling entry is `src/app/styles/index.css`. It owns `@import "tailwindcss"`, `@theme inline`, and the minimal base layer only.
- Semantic token ownership stays in `src/theme/tokens.css`; motion token ownership stays in `src/theme/motion.css`.
- `src/theme/primitives.css` is a migration bridge. It may be reduced during `SLICE-1` and must be retired by `SLICE-5`.
- Shared primitives live in `src/shared/ui/primitives/`; monitor-specific wrappers live in `src/shared/ui/monitor/`.
- `src/shared/lib/cn.ts` is the shared class-composition helper and the only approved place for `clsx` + `tailwind-merge` composition.
- shadcn/ui is an open-code source, not a kit runtime. Initialize once, then add only the components needed by the current slice. Do not use `add --all --overwrite`.
- `main.tsx` and `.storybook/preview.ts` must import the same root styling entry so app and Storybook share the exact Tailwind/token baseline.
- The FE boundary contract remains `app / pages / widgets / features / entities / shared`. Tailwind adoption does not change import direction or public API rules.

# Allowed Core Libraries

- Runtime and shell: `React 19`, `React DOM 19`, `Vite 7`, `Tauri 2`
- Language and package management: `TypeScript`, `pnpm`
- Validation baseline: `Biome`, `Vitest`, `Playwright`, `Storybook`
- UI implementation baseline: `tailwindcss`, `@tailwindcss/vite`, `shadcn`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, and used-only `@radix-ui/*`
- State and selectors baseline: feature-local React state, reducer, context, and selector modules
- Icon library: `lucide-react`

# Deferred Decisions And Trigger

- Full theme feature
  - Trigger: issue `#5` starts user-facing theme toggle, persistence, or system preference sync work.
  - Current rule: `#4` stops at theme-ready architecture and Storybook dark/light preview.
- Graph shell exception
  - Trigger: `SLICE-5` proves graph/event-row readability regresses materially under utility-only styling.
  - Current rule: keep graph renderer custom, but migrate shell/chrome first.
- Additional Radix families
  - Trigger: an approved primitive/composite requires a Radix dependency not already present in the repo.
  - Current rule: add only used families and validate import/public API boundaries immediately.

# Validation Overrides

- `BOOTSTRAP`: baseline contract review, task-doc sync review, `pnpm lint`
- `SLICE-1`: `pnpm storybook:build`, `pnpm build`, root CSS import smoke
- `SLICE-2`: story interaction smoke, `pnpm storybook:build`, `pnpm typecheck`
- `SLICE-3`: top chrome keyboard smoke, `pnpm typecheck`, `pnpm build`
- `SLICE-4`: fixture smoke across default/waiting/dense/import-open, `pnpm storybook:build`
- `SLICE-5`: graph readability review, dense fixture smoke, `pnpm build`
- `SLICE-6`: CSS retirement audit, handoff doc sync, full baseline checks from `VERIFICATION.md`

# Open Risks

- Tailwind class sprawl can hide monitor semantics if primitive/composite boundaries are not enforced.
- Storybook drift can let unreviewed surface changes slip into later slices.
- Theme-ready architecture can accidentally drift into full theme feature work if issue `#5` boundaries are ignored.
- `src/theme/primitives.css` can remain a hidden second styling source if reduced piecemeal without explicit retirement tracking.
