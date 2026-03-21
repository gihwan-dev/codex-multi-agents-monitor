# ADR-001: Adopt Tailwind CSS v4 + shadcn/ui as the new UI baseline

- Status: Proposed
- Date: 2026-03-20

## Context

현재 repo는 `src/theme/*`와 `src/shared/ui/*` thin primitive layer 위에 widget-local CSS를 얹는 구조다. GitHub issue `#4`는 Tailwind CSS v4 + shadcn/ui 기반 디자인 시스템 전환을 요구하고, issue `#5`는 이를 바탕으로 theme system을 확장하려고 한다.

## Decision

- Tailwind CSS v4를 공식 CSS-first/Vite 방식으로 도입한다.
- shadcn/ui는 open-code primitive source로 사용한다.
- semantic token SSOT는 CSS custom properties로 두고 Tailwind utility world에는 `@theme inline`으로 연결한다.
- graph-first workbench identity, domain semantics, and specialized visualization surfaces는 repo-local contract로 유지한다.
- full theme feature는 기본적으로 issue `#5`에 남기고, 이 task는 theme-ready architecture까지만 책임진다.

## Consequences

- repo baseline docs와 implementation supplement를 함께 갱신해야 한다.
- `src/theme/primitives.css`와 widget presentation CSS는 retirement 대상으로 바뀐다.
- Storybook은 optional showcase가 아니라 design approval baseline이 된다.
- graph/timeline shell은 shadcn default aesthetics를 그대로 따르지 않고 custom monitor wrappers를 유지한다.
