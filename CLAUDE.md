<!-- bootstrap-project-rules:start -->
- Read first: `@docs/ai/ENGINEERING_RULES.md`
- Task bundle: `@tasks/codex-multi-agent-monitor-v0-1/README.md`
- Task implementation contract: `@tasks/codex-multi-agent-monitor-v0-1/IMPLEMENTATION_CONTRACT.md`
- UX ownership stays in `@tasks/codex-multi-agent-monitor-v0-1/UX_SPEC.md` and `@tasks/codex-multi-agent-monitor-v0-1/UX_BEHAVIOR_ACCESSIBILITY.md`
- Do not treat starter UI or Tauri `Hello World` metadata as product source of truth
- CI/CD: `.github/workflows/ci.yml` (PR 검증), `.github/workflows/release.yml` (태그 릴리스)
- 버전 동기화: `node scripts/bump-version.mjs <version>` (package.json + tauri.conf.json + Cargo.toml)
- 릴리스: `bump-version.mjs` → 커밋 → `git tag v<version>` → push → GitHub Releases draft 확인 후 퍼블리시
<!-- bootstrap-project-rules:end -->
