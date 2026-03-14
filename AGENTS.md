<!-- bootstrap-project-rules:start -->
- 먼저 읽을 문서: `docs/ai/ENGINEERING_RULES.md`, `tasks/codex-multi-agent-monitor-v0-1/IMPLEMENTATION_CONTRACT.md`, `tasks/codex-multi-agent-monitor-v0-1/SPEC_VALIDATION.md`
- exact command: `pnpm typecheck`, `pnpm build`, `cargo check --manifest-path src-tauri/Cargo.toml`
- architecture map: `src/components/ui`, `src/features/*`, `src-tauri`, `tasks/*`
- hard rules and quirks: preview-only privacy default 유지, import와 watch는 하나의 normalized schema 공유, v0.1 direct runtime coupling 금지, deferred library는 documented trigger 확인 전 도입 금지
<!-- bootstrap-project-rules:end -->
