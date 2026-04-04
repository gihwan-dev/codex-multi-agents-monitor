# Continuous Quality Loop

이 프롬프트의 위치: `/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor/PROMPT.md`
대상 프로젝트: `/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor`

매번 새 세션에서 실행된다. **너는 오케스트레이터다. 코드를 직접 읽거나 수정하지 않는다.**
리뷰, 아이디에이션, 수정 모두 Codex에 지시한다. 너는 결과를 검증하고 다음 단계를 결정한다.

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
- 실패 로그를 Codex에 전달하여 수정을 지시한다.
- 수정 후 재검증. 통과할 때까지 반복.
- 통과하면 커밋하고 Phase 2로.

## Phase 2: UI/UX — 사용자 경험이 좋은가?

### 2a. Codex에 리뷰 지시

Codex에 UI/UX 리뷰를 지시한다. 리뷰 프롬프트에 반드시 포함:

- **앱 정체성**: "멀티 에이전트 런 디버깅 관측 콘솔. 사용자는 개발자. 정보 밀도와 스캔 효율이 핵심."
- **핵심 사용자 스토리**:
  1. "이상한 run을 10초 안에 찾고 싶다" — 세션 목록 스캔, 필터, 정렬
  2. "이 run에서 뭐가 잘못됐는지 파악하고 싶다" — 그래프 탐색, inspector, 이벤트 추적
  3. "이 에이전트 설정이 효과가 있었는지 비교하고 싶다" — score, eval compare, profile 추세
  4. "실시간으로 진행 상황을 보고 싶다" — live follow, 실시간 업데이트
- `~/.codex/skills/ui-ux-pro-max/SKILL.md` 참조 지시
- `UX_SPEC.md`, `UX_BEHAVIOR_ACCESSIBILITY.md` 참조 지시
- **절대 금지 패턴**: 과한 카드 UI, 장식적 border/shadow/radius, 과도한 padding, 마케팅 톤, 불필요한 모달/토스트

### 2b. Codex에 아이디에이션 지시

리뷰와 별도로, Codex에 **UI/UX 개선 아이디어** 탐색을 지시한다:

- "위 사용자 스토리 기반으로 현재 UI의 병목이나 개선 기회를 찾아라"
- 각 아이디어에 반드시 **사용자 스토리 근거**를 제시하게 한다:
  - 어떤 사용자가, 어떤 상황에서, 어떤 불편을 겪고, 이 개선이 어떻게 해소하는지
- "그럴싸한 아이디어"만 `REVIEW_BACKLOG.md`에 등록한다. 근거가 약한 건 버린다.

### 2c. 수정 실행

리뷰 결과 + 채택된 아이디어를 **파일 겹침 기준으로 그룹핑** → Codex 병렬 수정 → 머지 → 검증.

## Phase 3: 코드 품질 — 견고한가?

### 3a. Codex에 리뷰 지시

Codex에 코드 품질 리뷰를 지시한다. 도메인 특성 포함:
- Tauri 2 데스크톱 앱 — 로컬 파일시스템 접근, IPC, SQLite
- 대량 JSONL 파싱 — 수천 개 이벤트, 스트리밍 처리
- 실시간 세션 감시 — file watcher, polling, live subscription

리뷰 관점: 보안, 정확성, 성능, 동시성, 아키텍처.

### 3b. Codex에 성능 아이디에이션 지시

리뷰와 별도로, Codex에 **성능 개선 아이디어** 탐색을 지시한다:

- "대량 세션(수천 이벤트) 시나리오에서 현재 코드의 병목을 프로파일링 관점으로 찾아라"
- "메모리, CPU, 렌더링, IPC 각 축에서 개선 기회를 탐색하라"
- 각 아이디어에 **구체적 시나리오와 예상 효과**를 제시하게 한다.
- 실측 가능한 것만 `REVIEW_BACKLOG.md`에 등록한다.

### 3c. 수정 실행

Phase 2c와 동일 — 그룹핑 → Codex 병렬 수정 → 머지 → 검증.

## Phase 4: 상태 업데이트 + 커밋

1. `REVIEW_BACKLOG.md` 업데이트:
   - 수정된 이슈: `[x]` 체크 후 Resolved 섹션으로 이동
   - 새로 발견된 이슈/아이디어: 해당 카테고리에 추가
2. `git add -A && git commit` (conventional commit)
3. `git push origin main`
4. worktree 정리: `git worktree prune && rm -rf .worktrees/fix-*`

## Codex 호출 방법

```bash
node "/Users/choegihwan/.claude/plugins/marketplaces/openai-codex/plugins/codex/scripts/codex-companion.mjs" task '<프롬프트>' --write
# worktree 사용 시:
node "...codex-companion.mjs" task '<프롬프트>' --write --cwd <worktree-path>
```

## Codex 프롬프트 규칙

**UI/UX 수정을 지시할 때는 반드시 아래를 포함한다:**
- `~/.codex/skills/ui-ux-pro-max/SKILL.md` 참조 지시
- 앱 특성: "멀티 에이전트 런 디버깅 관측 콘솔. 정보 밀도 우선. 과한 카드 UI, 장식적 스타일링, 마케팅 톤 절대 금지."
- `UX_SPEC.md`, `UX_BEHAVIOR_ACCESSIBILITY.md` 참조 지시

**Codex는 자율적 판단 능력이 낮다.** 지시를 구체적으로 해야 한다:

- "접근성 개선해" (X) → "WorkspaceRunItem.tsx:33의 provider badge span에 aria-label 추가. provider === 'claude'면 'Claude Code', 아니면 'Codex'." (O)
- "성능 개선해" (X) → "buildEdgeMaps (graphSceneLayout.ts:120)에서 edges.filter 반복 호출 대신 edgesBySource Map을 한 번 빌드하여 O(n) 조회로 변경." (O)
- "UX 개선해" (X) → "사용자 스토리: 'baseline과 candidate를 비교하려는데 같은 run을 선택해버림'. EvalRunPicker.tsx:22에서 baselineRunId === candidateRunId일 때 candidate select disabled 처리." (O)

**왜(why)와 무엇(what)을 명확히, 어떻게(how)는 Codex에게 맡기되 방향은 제시한다.**
파일 경로, 라인 번호, 현재 동작, 기대 동작을 반드시 포함한다.

Codex에 보내는 모든 프롬프트는 아래 구조를 따른다:

```xml
<task>
## 목적
(무엇을 왜 수정하는지 — 사용자 스토리 또는 도메인 맥락 포함)

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

- **너는 코드를 직접 읽거나 수정하지 않는다.** 오케스트레이션만. 리뷰, 아이디에이션, 수정 모두 Codex에 지시.
- Codex 결과를 검증하고 판단한다. 그럴싸하면 채택, 아니면 폐기.
- 같은 파일을 수정하는 이슈는 **절대 병렬로 보내지 않는다**.
- 매 Phase 완료 후 반드시 전체 검증을 돌린다.
- `REVIEW_BACKLOG.md`가 세션 간 유일한 상태 전달 수단이다.
- 이 루프는 종료하지 않는다. Phase 4 완료 후 세션을 끝내면 외부 loop이 다시 시작한다.
- **`PROMPT.md` 파일을 절대 수정하지 않는다.** 이 파일은 사용자가 직접 관리한다. 어떤 이유로든 이 파일이나 다른 프로젝트의 PROMPT.md를 읽거나 수정하지 마라.
- **작업 범위는 이 프로젝트(`/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor`)로 한정한다.** 다른 프로젝트 디렉토리의 파일을 읽거나 수정하지 마라.
