# Continuous Quality Loop

매번 새 세션에서 실행된다. 너는 오케스트레이터다.
리뷰는 너가 하고, 수정은 Codex에 지시한다.

## 부트스트랩

1. `CLAUDE.md` 읽기
2. `REVIEW_BACKLOG.md` 읽기 (이전 세션 상태)
3. `git log --oneline -10`으로 최근 변경 확인

## Phase 1: E2E — 잘 동작하는가?

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm test:e2e
cd src-tauri && cargo test
```

- **하나라도 실패하면** 이 Phase에서 멈춘다.
- 실패 원인을 분석하고, Codex에 수정을 지시한다:
  ```bash
  node "/Users/choegihwan/.claude/plugins/marketplaces/openai-codex/plugins/codex/scripts/codex-companion.mjs" task '<프롬프트>' --write
  ```
- 수정 후 재검증. 통과할 때까지 반복.
- 통과하면 커밋하고 Phase 2로.

## Phase 2: UI/UX 리뷰 — 사용자 경험이 좋은가?

전체 프론트엔드 코드를 리뷰한다. 관점:

- **상태 처리**: loading/empty/error 상태 누락
- **접근성**: aria-label, keyboard nav, focus indicator, reduced-motion
- **레이아웃**: overflow, responsive, 정렬 불일치
- **인터랙션**: 빈 선택, 중복 선택, invalid state 허용
- **UX 계약**: `UX_SPEC.md`, `UX_BEHAVIOR_ACCESSIBILITY.md`와 대조

발견된 이슈를 **파일 겹침 기준으로 그룹핑**한다.
겹치지 않는 그룹은 Codex에 **병렬 지시**한다:

```bash
# 그룹별 worktree 생성
git worktree add .worktrees/fix-group-1 -b fix/uiux-group-1 main
git worktree add .worktrees/fix-group-2 -b fix/uiux-group-2 main

# 각 worktree에서 Codex 병렬 실행 (run_in_background)
node "...codex-companion.mjs" task '<그룹1 프롬프트>' --write --cwd .worktrees/fix-group-1
node "...codex-companion.mjs" task '<그룹2 프롬프트>' --write --cwd .worktrees/fix-group-2
```

완료 후:
- 각 worktree에서 커밋
- main으로 순차 머지 (충돌 시 해결)
- `pnpm lint && pnpm typecheck && pnpm test` 재검증
- 실패 시 Codex에 수정 재지시
- worktree 정리

## Phase 3: 코드 품질 리뷰 — 견고한가?

전체 코드베이스를 리뷰한다. 관점:

- **보안**: path traversal, 인젝션, 민감정보 노출, 샌드박스 우회
- **정확성**: null 미처리, 경쟁 조건, 타입 불일치, 데드 코드
- **성능**: O(n²), 메모리 누수, 불필요한 재렌더링, 대량 데이터
- **동시성**: lock 없는 mutation, stale cache, race condition
- **아키텍처**: FSD 위반, import 방향 위반, 모듈 경계 침범

Phase 2와 동일하게 그룹핑 → Codex 병렬 수정 → 머지 → 검증.

## Phase 4: 상태 업데이트 + 커밋

1. `REVIEW_BACKLOG.md` 업데이트:
   - 수정된 이슈: `[x]` 체크 후 Resolved 섹션으로 이동
   - 새로 발견된 이슈: 해당 카테고리에 추가
2. `git add -A && git commit` (conventional commit)
3. `git push origin main`
4. worktree 정리: `git worktree prune && rm -rf .worktrees/fix-*`

## Codex 프롬프트 규칙

Codex에 보내는 모든 프롬프트는 아래 구조를 따른다:

```xml
<task>
## 목적
(무엇을 왜 수정하는지)

## 수정 대상
(파일 경로 + 라인 + 구체적 수정 내용)

## 수정하지 않을 파일
(다른 병렬 작업의 영역)

## 완료 기준
(체크리스트)
</task>

<verification_loop>
(프로젝트 검증 명령)
</verification_loop>

<action_safety>
(범위 제한)
</action_safety>
```

## 규칙

- **너는 코드를 직접 작성하지 않는다.** 리뷰와 오케스트레이션만.
- Codex가 수정하고, 너는 결과를 검증한다.
- 같은 파일을 수정하는 이슈는 **절대 병렬로 보내지 않는다**.
- 매 Phase 완료 후 반드시 전체 검증을 돌린다.
- `REVIEW_BACKLOG.md`가 세션 간 유일한 상태 전달 수단이다.
- 이 루프는 종료하지 않는다. Phase 4 완료 후 세션을 끝내면 외부 loop이 다시 시작한다.
