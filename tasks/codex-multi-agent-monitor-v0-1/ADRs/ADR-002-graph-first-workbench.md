# ADR-002: Make Run Detail A Graph-First Workbench

- Status: Accepted
- Date: 2026-03-14

## Context

현재 repo starter UI처럼 centered card나 일반 dashboard chrome은 `누가 생성됐고, 어디서 기다리고 있고, 무엇을 남기고 끝났는지`를 빠르게 읽게 해 주지 못한다. v0.1의 핵심 목표는 single run understanding이며, 사용자는 KPI보다 causality와 waiting point를 먼저 읽어야 한다.

## Decision

- 앱 정체성은 dashboard가 아니라 graph-first debugging workbench로 고정한다.
- primary detail view는 `compressed event graph`, secondary views는 `Waterfall`과 `Map`으로 둔다.
- 기본 shell은 `left rail + main canvas + inspector` 3-pane 구조로 고정한다.
- anomaly jump bar, gap folding, edge drilldown, follow-live semantics를 first-class interaction으로 둔다.

## Consequences

- 시각 밀도와 interaction complexity가 높아지므로 keyboard/focus, degradation, microcopy 계약이 필수다.
- raw JSON이나 full log는 보조 drawer로 밀려난다.
- generic card dashboard, centered hero layout, analytics-first KPI wall은 v0.1에서 배제된다.
