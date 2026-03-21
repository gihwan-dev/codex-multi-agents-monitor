# Avoid Reference

- Title: Current style-system accumulation
- Source URL: file:///Users/choegihwan/.codex/worktrees/36f8/codex-multi-agent-monitor/src/theme/primitives.css
- Why selected:
  - reset, primitive, semantic component 스타일이 한 파일에 누적돼 있어 migration 경계가 흐려진다.
  - widget-local CSS가 계속 쌓이면 Tailwind 도입 후 dual styling stack이 된다.
- Avoid in this task:
  - monolithic primitive stylesheet
  - 새 widget CSS file 추가
  - screen-specific styling을 shared primitive layer에 숨기는 패턴
