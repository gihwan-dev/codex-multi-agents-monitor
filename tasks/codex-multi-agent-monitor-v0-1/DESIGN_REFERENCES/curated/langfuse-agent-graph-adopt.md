# Adopt: Langfuse Agent Graph Mental Model

- Source: https://langfuse.com/docs/observability/features/agent-graphs
- Use for: map mode, agent interaction overview, handoff density reading
- Adopt:
  - multi-agent interaction을 node/edge로 압축해 macro relationship을 읽는 view
  - node size나 edge emphasis를 derived metrics에 연결하는 방식
  - graph를 trace 이해의 보조 lens로 쓰는 접근
- Do not copy:
  - primary detail exploration을 map view만으로 해결하려는 접근
  - event row/inspector 없이 macro graph만 남기는 구조
