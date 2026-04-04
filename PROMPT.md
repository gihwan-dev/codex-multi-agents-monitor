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

**이 앱은 멀티 에이전트 런 디버깅 워크벤치다.** 사용자는 개발자이며, 에이전트 실행을 추적·분석한다.
리뷰할 때 이 도메인 맥락을 반드시 고려한다:

- 이 앱은 관측 콘솔이다. 화려한 UI가 아니라 **정보 밀도와 스캔 효율**이 핵심이다.
- 사용자는 "이상한 run을 빠르게 찾고, 원인을 파악"하는 흐름으로 움직인다.
- 대량 이벤트(수천 개)를 다루므로 성능과 가상화가 중요하다.

리뷰 관점:

- **도메인 적합성**: 이 앱의 사용 맥락에서 실제로 문제가 되는가? 일반론적 UX 개선은 하지 않는다.
- **상태 처리**: loading/empty/error 상태 누락 (실제 사용 시나리오에서 발생하는 것만)
- **접근성**: aria-label, keyboard nav, focus indicator, reduced-motion
- **레이아웃**: overflow, responsive, 정렬 불일치
- **UX 계약**: `UX_SPEC.md`, `UX_BEHAVIOR_ACCESSIBILITY.md`와 대조

**UI/UX 절대 금지 패턴:**
- 과한 카드 UI, 장식적 border/shadow/radius 남용
- 정보 밀도를 낮추는 과도한 padding/spacing
- 관측 콘솔 톤에 맞지 않는 마케팅 스타일 UI
- 불필요한 모달/토스트/알림 추가
- 기존 compact한 레이아웃을 깨는 변경

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

**이 앱의 도메인 특성을 고려한다:**
- Tauri 2 데스크톱 앱 — 로컬 파일시스템 접근, IPC, SQLite
- 대량 JSONL 파싱 — 수천 개 이벤트, 스트리밍 처리
- 실시간 세션 감시 — file watcher, polling, live subscription

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

**UI/UX 수정을 지시할 때는 반드시 아래를 포함한다:**
- `~/.codex/skills/ui-ux-pro-max/SKILL.md`를 참조하라는 지시
- 앱 특성 명시: "멀티 에이전트 런 디버깅 관측 콘솔. 정보 밀도 우선. 과한 카드 UI, 장식적 스타일링, 마케팅 톤 절대 금지."
- `UX_SPEC.md`, `UX_BEHAVIOR_ACCESSIBILITY.md` 참조 지시

**Codex는 자율적 판단 능력이 낮다.** 프롬프트가 구체적이지 않으면 엉뚱한 방향으로 간다.
코드를 대신 써주는 게 아니라, **지시를 구체적으로** 해야 한다:

- "접근성 개선해" (X) → "WorkspaceRunItem.tsx:33의 provider badge span에 aria-label={provider === 'claude' ? 'Claude Code' : 'Codex'} 추가" (O)
- "성능 개선해" (X) → "buildEdgeMaps (graphSceneLayout.ts:120)에서 edges.filter를 매번 호출하지 말고, edgesBySource Map을 한 번 빌드해서 O(n) 조회로 변경" (O)
- "UX 개선해" (X) → "EvalRunPicker.tsx:22에서 baselineRunId === candidateRunId일 때 candidate select를 disabled 처리하고, 같은 run 선택 시 '동일한 run은 비교할 수 없습니다' 인라인 메시지 표시" (O)

**왜(why)와 무엇(what)을 명확히, 어떻게(how)는 Codex에게 맡기되 방향은 제시한다.**
파일 경로, 라인 번호, 현재 동작, 기대 동작을 반드시 포함한다.

Codex에 보내는 모든 프롬프트는 아래 구조를 따른다:

```xml
<task>
## 목적
(무엇을 왜 수정하는지 — 도메인 맥락 포함)

## 현재 동작
(지금 코드가 어떻게 동작하는지, 왜 문제인지)

## 기대 동작
(수정 후 어떻게 동작해야 하는지)

## 수정 대상
(파일 경로 + 라인 번호 + 구체적 변경 방향)

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
