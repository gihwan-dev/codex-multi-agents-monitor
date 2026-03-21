# Technical Specification

## Scope

- `REQ-001`: Tailwind CSS v4 + shadcn/ui 기반 디자인 시스템 foundation을 도입한다.
- `REQ-002`: Storybook을 design review baseline으로 재구성한다.
- `REQ-003`: semantic token architecture를 dark baseline + light-ready 구조로 재설계한다.
- `REQ-004`: monitor chrome, rail, inspector, drawer, graph-adjacent shell을 staged migration 한다.
- `REQ-005`: legacy primitive/widget presentation CSS를 retire 가능한 구조로 만든다.
- `REQ-006`: GitHub issue `#5`가 consume할 theme-ready architecture를 남긴다.

Out of scope by default:

- graph layout algorithm 변경
- live ingestion/state machine 변경
- virtualization helper 도입
- full user-facing theme feature completion 자체

## Current-state evidence

| Surface | Current role | Evidence | Migration risk |
| --- | --- | --- | --- |
| `src/theme/tokens.css` | semantic token source | 56 LOC, dark-only `:root` palette | theme-ready 구조가 아직 없다 |
| `src/theme/primitives.css` | reset + primitive styles + utility-like selectors | 361 LOC | Tailwind 도입 시 가장 먼저 충돌하는 파일 |
| `src/widgets/causal-graph/ui/causal-graph.css` | dense graph shell and interaction styling | 675 LOC | utility migration을 무리하게 하면 readability가 깨질 수 있다 |
| `src/widgets/workspace-run-tree/ui/workspace-run-tree.css` | rail/list presentation | 307 LOC | shadcn primitive로 옮기기 좋은 첫 대상 |
| `src/widgets/monitor-chrome/ui/monitor-chrome.css` | top bar, summary, toolbar | 267 LOC | chrome standardization 후보 |
| `.storybook/*` | page-level preview only | story 1개 | primitive feedback loop 부재 |

## Proposed architecture

### Styling stack

- Tailwind CSS v4를 공식 Vite plugin 기준으로 도입한다.
  - Official references:
    - [Tailwind CSS v4 blog](https://tailwindcss.com/blog/tailwindcss-v4)
    - [Tailwind CSS Vite installation guide](https://tailwindcss.com/docs/installation/framework-guides/vite)
- shadcn/ui는 open-code primitive source로 사용한다.
  - Official references:
    - [shadcn/ui manual installation](https://ui.shadcn.com/docs/installation/manual)
    - [shadcn/ui Vite dark mode guide](https://ui.shadcn.com/docs/dark-mode/vite)

### File-boundary direction

- new Tailwind entry CSS: `src/app/styles/index.css` 또는 동등한 root-import CSS
  - 책임: `@import "tailwindcss"`, `@theme inline`, minimal base layer only
- keep `src/theme/tokens.css`
  - 책임: semantic CSS custom properties, `:root` / `[data-theme="dark"]` / `[data-theme="light"]`
- keep `src/theme/motion.css`
  - 책임: motion tokens only
- retire `src/theme/primitives.css`
  - 책임 이동: primitive presentation은 component-level class composition으로 이동
- `src/shared/ui/primitives/*`
  - 책임: shadcn open-code primitives with shared variants
- `src/shared/ui/monitor/*`
  - 책임: monitor semantics wrappers such as `StatusChip`, `MetricPill`, `InspectorTabs`
- `src/shared/lib/cn.ts`
  - 책임: `clsx` + `tailwind-merge` 기반 class composition helper

### Component mapping

| Current surface | Target direction | Notes |
| --- | --- | --- |
| `Panel` | `Card` or `PanelSection` on top of shadcn `Card` | generic shell + monitor title row |
| `StatusChip` | `Badge`-based monitor composite | color + icon + text semantics 유지 |
| `MetricPill` | `Card`-based stat composite | dense numeric treatment 유지 |
| Inspector tabs | shadcn `Tabs` wrapper | keyboard behavior 강화 |
| Help dialog | shadcn `Dialog` | focus trap 표준화 |
| Drawer | shadcn `Sheet` wrapper | desktop drawer tone 커스터마이징 필요 |
| Toolbar / filter controls | `Button`, `Toggle`, `DropdownMenu`, `Command` | chrome 일관성 확보 |
| Resize handle | custom | shadcn 범위 밖, utility-based custom 유지 |
| Graph canvas shell | custom + monitor composites | generic primitive로 대체하지 않음 |

## Storybook contract

- group taxonomy:
  - `Foundations/*`
  - `Primitives/*`
  - `Monitor Composites/*`
  - `Screens/*`
- every primitive family ships with:
  - default, hover/focus, disabled, dark/light preview
  - accessibility notes
  - monitor-specific examples when relevant
- every migrated screen fixture ships with:
  - default desktop state
  - dense parallel state
  - import/drawer or error state

## Dependency contract

- allow:
  - `tailwindcss`
  - `@tailwindcss/vite`
  - `shadcn`
  - `class-variance-authority`
  - `clsx`
  - `tailwind-merge`
  - `tw-animate-css`
  - used-only `@radix-ui/*` packages
- disallow:
  - second component kit
  - CSS-in-JS
  - parallel token systems
  - page-level styling that bypasses semantic tokens

## Migration guardrails

- `SLICE-1` 첫 구현 diff에서 `docs/ai/ENGINEERING_RULES.md`와 새 task supplement를 함께 갱신한다.
- `SLICE-1` 이후 새 UI 변경은 legacy CSS selector를 추가하지 않는다.
- `src/shared/ui/index.ts`는 public surface만 export하고 deep import를 늘리지 않는다.
- one-shot rewrite 금지. 각 surface migration은 story-approved primitive/composite 위에서만 진행한다.
- graph shell이 utility-only 전환으로 unreadable 해지면 `SLICE-5`는 즉시 replan 한다.

## Risks

- `RISK-001`: Tailwind class sprawl가 dense desktop readability를 해칠 수 있다.
- `RISK-002`: shadcn default aesthetics가 기존 graph-first identity를 덮어쓸 수 있다.
- `RISK-003`: issue `#4`와 `#5`의 theme scope가 implementation 중 섞일 수 있다.
- `RISK-004`: Storybook story coverage가 surface migration 속도를 따라가지 못할 수 있다.
