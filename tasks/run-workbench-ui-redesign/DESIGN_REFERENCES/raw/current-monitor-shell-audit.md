# Raw Reference Note

- Title: Current monitor shell audit
- Source URL: file:///Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/app/MonitorApp.tsx
- Captured at: 2026-03-14T12:53:46Z
- Observed value:
  - status-grouped run cards가 workspace 탐색을 대체한다.
  - summary, anomaly, filters, graph, drawer가 panel stack으로 쌓여 graph priority가 약해진다.
  - graph는 detached edge pills + lane cards 구조라 time/causality view보다 board에 가깝다.
- Relevance:
  - 이번 redesign의 avoid baseline
  - current implementation에서 제거해야 할 정보 구조 패턴 명시
