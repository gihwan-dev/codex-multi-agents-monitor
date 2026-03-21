# Raw Reference Note

- Title: Current style-system audit
- Source URL: file:///Users/choegihwan/.codex/worktrees/36f8/codex-multi-agent-monitor/src/theme/primitives.css
- Captured at: 2026-03-20T00:00:00Z
- Observed value:
  - reset, primitive styles, semantic chips, metric pills, lane headers가 한 파일에 누적돼 있다.
  - widget CSS들도 각각 presentation ownership을 많이 가지고 있다.
  - Tailwind/shadcn 도입 전에 boundary를 풀지 않으면 dual styling stack이 되기 쉽다.
- Relevance:
  - avoid baseline
  - split-first와 CSS retirement 필요성의 직접 근거
