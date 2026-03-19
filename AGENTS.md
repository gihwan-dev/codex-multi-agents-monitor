<!-- bootstrap-project-rules:start -->
# Repo Rules

- Read first: `docs/ai/ENGINEERING_RULES.md`, `tasks/codex-multi-agent-monitor-v0-1/README.md`, `tasks/codex-multi-agent-monitor-v0-1/UX_SPEC.md`, `tasks/codex-multi-agent-monitor-v0-1/UX_BEHAVIOR_ACCESSIBILITY.md`, `tasks/codex-multi-agent-monitor-v0-1/IMPLEMENTATION_CONTRACT.md`, `tasks/codex-multi-agent-monitor-v0-1/EXECUTION_PLAN.md`
- Exact commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm storybook:build`, `pnpm build`
- Architecture map: `src/app`, `src/features/run-list`, `src/features/run-detail/*`, `src/features/inspector`, `src/features/ingestion`, `src/features/fixtures`, `src/shared/domain`, `src/shared/ui`, `src/theme/*`
- Do: keep `src/App.tsx` composition-only, move tokens and motion into `src/theme/*`, use custom thin UI primitives, preserve preview-first masking, keep parser, normalizer, storage, and selectors separated
- Don't: extend `src/styles.css` for feature work, add a heavy UI kit, add a second state or cache layer, store raw payload by default, mix package managers, bypass the locked validation commands
- Known quirks: repo still has starter `Hello World` metadata and placeholder UI, and that polish is deferred until the shell and trace workflow stabilize

## CI/CD

- CI: `.github/workflows/ci.yml` — `push`/`pull_request` → `main` 트리거, 3개 병렬 job (Validate, E2E Tests, Rust Check)
- Release: `.github/workflows/release.yml` — `v*` 태그 푸시 시 트리거, validate 후 macOS/Windows/Linux 크로스 빌드 → GitHub Releases draft 생성
- pnpm 설치: `corepack enable pnpm` 사용 (`package.json`의 `packageManager` 필드에서 버전 자동 감지)
- Node: 22, Rust: stable
- E2E job은 `continue-on-error: true` (flaky 테스트 허용)
- 코드 서명: v0.1에서 생략, 워크플로에 시크릿 자리만 마련 (나중에 시크릿 추가로 활성화)
- 버전 동기화: `node scripts/bump-version.mjs <version>` → `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` 일괄 업데이트
- 릴리스 프로세스: `bump-version.mjs` → 커밋 → `git tag v<version>` → `git push origin main --tags` → Releases draft 확인 후 퍼블리시
<!-- bootstrap-project-rules:end -->
