# Codex Multi-Agent Monitor

Tauri 2 + React 19 데스크톱 워크벤치. 멀티 에이전트 런 디버깅 도구.

## 필수 읽기 순서

1. `docs/ai/ENGINEERING_RULES.md` — 스택, 아키텍처, 코딩 규칙, 금지 패턴
2. `tasks/codex-multi-agent-monitor-v0-1/README.md` — 태스크 번들
3. `tasks/codex-multi-agent-monitor-v0-1/IMPLEMENTATION_CONTRACT.md` — 구현 계약

UX 소스: `tasks/codex-multi-agent-monitor-v0-1/UX_SPEC.md`, `UX_BEHAVIOR_ACCESSIBILITY.md`

## 명령어

```
pnpm lint          # Biome
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest
pnpm test:e2e      # Playwright
pnpm storybook:build
pnpm build         # Tauri 빌드
```

## CI/CD

- PR 검증: `.github/workflows/ci.yml` (Validate / E2E / Rust Check)
- 릴리스: `.github/workflows/release.yml` (`v*` 태그 → 크로스빌드 → GitHub Releases draft)
- 버전 동기화: `node scripts/bump-version.mjs <version>`
- 릴리스 플로우: bump-version → 커밋 → `git tag v<version>` → push → draft 퍼블리시

## 주의

- starter Hello World UI/메타데이터는 제품 소스가 아님
- `pnpm` 외 패키지 매니저 사용 금지
- 상세 규칙은 `ENGINEERING_RULES.md` 참조
