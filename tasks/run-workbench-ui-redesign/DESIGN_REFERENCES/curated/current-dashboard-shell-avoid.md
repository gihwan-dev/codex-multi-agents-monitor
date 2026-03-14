# Avoid Reference

- Title: Current monitor shell audit
- Source URL: file:///Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/app/MonitorApp.tsx
- Why rejected as source of truth:
  - left rail이 workspace tree가 아니라 status-grouped card list다.
  - summary, anomaly, filters, graph, drawer가 모두 같은 무게의 panel stack으로 쌓인다.
  - graph가 time/causality view보다 lane card board처럼 읽힌다.
  - inspector가 cause/impact보다 metadata table에 가깝다.
- Avoid in this task:
  - card-like run rows
  - detached edge pill strip
  - always-present drawer shell
  - panel inside panel inside panel grammar
