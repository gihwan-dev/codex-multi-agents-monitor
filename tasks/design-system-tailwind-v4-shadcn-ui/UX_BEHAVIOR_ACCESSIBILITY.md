# UX Behavior & Accessibility

## Interaction Model

- design system 변경은 domain behavior를 바꾸기 위한 작업이 아니다. run selection, graph selection sync, inspector reveal, drawer open/close, follow live 동작은 유지한다.
- Storybook feedback loop는 `story 작성 -> state/variant 검토 -> 승인 -> 실제 screen 적용` 순서를 기본으로 한다.
- primitive는 base interaction만, monitor composite는 status semantics와 product microcopy까지 포함해 검토한다.
- `SLICE-1`과 `SLICE-2`에서는 real monitor integration을 하지 않고 fixture와 mock state로만 상호작용을 검토한다.
- `SLICE-3+`에서는 실제 surface를 교체하되, 같은 slice 안에서 selector/state logic까지 대수술하지 않는다.
- pointer와 keyboard는 parity를 유지한다. hover-only affordance는 허용하지 않는다.

## Keyboard + Focus Contract

- 현재 keyboard shortcuts (`/`, `I`, `.`, `E`, `?`, `Cmd/Ctrl + K`)는 migration 이후에도 유지한다.
- Dialog, Sheet, Dropdown, Command surface는 focus trap과 focus return을 보장해야 한다.
- theme preview control이 들어오면 keyboard만으로 `system -> dark -> light`를 순환할 수 있어야 한다.
- Storybook stories도 tab sequence와 visible focus ring을 확인할 수 있어야 한다.
- resize handle, drawer close, export/import, filter toggles는 mouse-only affordance가 되면 안 된다.

## Accessibility Contract

- status 의미는 color-only가 아니라 icon shape, text label, selection state로 함께 전달한다.
- dark/light 모두 WCAG AA 수준의 대비를 목표로 하고, small text와 muted border는 특히 재검토한다.
- focus ring은 Tailwind/shadcn 기본값을 그대로 쓰지 않고 monitor shell과 어울리는 고정 토큰으로 통일한다.
- icon-only control은 `aria-label`을 유지하고 tooltip이나 visible label 중 하나를 제공한다.
- reduced motion 환경에서는 pulse, drawer, hover motion을 축소하거나 제거한다.
- dense desktop UI라도 주요 interactive target은 32px 이상을 기본으로 한다.

## Live Update Semantics

- theme 변경이나 primitive 교체로 live follow 상태가 reset되면 안 된다.
- `running`, `paused`, `stale`, `disconnected` 상태는 기존처럼 chip/badge와 text가 동시에 의미를 전달해야 한다.
- partial parse failure나 missing data fallback copy는 현재 monitor semantics를 유지한다.
- imported run과 live watch의 시각 구분은 theme mode와 무관하게 유지한다.
- app shell이 remount되는 방식의 theme 전환은 피한다. theme class/data attribute update로 처리해야 한다.

## State Matrix + Fixture Strategy

- component fixtures:
  - Button, Badge, Tabs, Sheet, Command, Dropdown의 default/hover/disabled/focus-visible
  - StatusChip, MetricPill, InspectorTabs의 running/waiting/blocked/failed/done
- screen fixtures:
  - default run
  - minimal completed run
  - waiting chain run
  - dense parallel run
  - import drawer open
  - dark/light preview pair
- `SCR-001`과 `SCR-002`는 Storybook fixture로, `SCR-003`은 app-integrated fixture로 검증한다.
- fixture naming은 현재 sample ids와 가능한 한 맞춰서 screen regression 추적을 쉽게 만든다.

## Large-run Degradation Rules

- design system 도입이 DOM wrapper 수를 불필요하게 늘리면 안 된다. graph lane과 event row는 density를 우선한다.
- shadow, blur, translucent overlay는 graph readability를 해치지 않는 수준으로 제한한다.
- variant helper가 복잡해져서 한 component가 사실상 page-specific logic를 먹기 시작하면 composite split을 먼저 한다.
- graph/timeline surface에서 utility class만으로 readability가 무너지면 그 slice는 stop/replan 대상이다.
- virtualization helper 도입은 이 task의 기본 범위가 아니며, 필요 시 별도 판단으로 분리한다.

## Microcopy + Information Expression Rules

- status naming은 `Running`, `Waiting`, `Blocked`, `Failed`, `Done`, `Stale`, `Disconnected`를 유지한다.
- token/cost/time formatting은 기존 compact monitor conventions를 유지한다.
- theme labels는 `System`, `Dark`, `Light`만 사용하고 brandy naming은 금지한다.
- unknown or missing value는 `Unknown`, `Unavailable`, `Redacted`처럼 의미가 분명한 단어를 사용한다.
- generic shadcn demo copy, lorem ipsum, consumer-oriented marketing copy는 story나 screen에 남기지 않는다.

## Task-based Approval Criteria

- `AC-001`: maintainer가 Storybook `Foundations`와 `Primitives`만 보고 token, spacing, focus, status semantics에 피드백을 줄 수 있다.
- `AC-002`: migrated monitor screen에서 기존 30-second checklist를 raw drawer 없이 수행할 수 있다.
- `AC-003`: keyboard-only로 dialog, sheet, command, theme preview, drawer close가 가능하다.
- `AC-004`: dense parallel fixture에서 layout density와 graph readability가 현재 baseline보다 나빠지지 않는다.
- `AC-005`: legacy CSS selector를 제거한 뒤에도 `pnpm storybook:build`, `pnpm build`, 주요 smoke tests가 유지된다.
