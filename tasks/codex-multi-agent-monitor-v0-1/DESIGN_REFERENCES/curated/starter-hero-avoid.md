# Avoid: Current Starter Hero Layout

- Source: file:///Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/src/App.tsx
- Use for: explicit anti-pattern record
- Avoid because:
  - single centered card는 project/run hierarchy를 수용하지 못한다.
  - hero copy는 debugging context, live status, anomaly scan에 필요한 정보 밀도를 제공하지 못한다.
  - marketing-like surface treatment는 workbench seriousness와 맞지 않는다.
- Replace with:
  - left rail + main canvas + inspector의 orientation-first shell
  - dense list + graph + detail drawer 조합
