# Continuous Review & Fix Loop

이 프롬프트는 매번 새 세션에서 반복 실행된다.
매 iteration은 아래 3단계 워크플로우를 수행한다.

## 필수 사전 읽기

- `CLAUDE.md` — 프로젝트 규칙, 명령어
- `docs/ai/ENGINEERING_RULES.md` — 코딩 규칙, 금지 패턴
- `REVIEW_BACKLOG.md` — 이전 iteration에서 발견/수정된 이슈 추적

## 워크플로우

### Step 1: E2E 테스트 리뷰 (잘 동작하는가?)

```bash
pnpm build
pnpm test:e2e
pnpm test
cd src-tauri && cargo test
```

- 위 명령을 순서대로 실행한다.
- 실패하면 **실패 원인을 분석**하고 수정한다.
- 수정 후 재검증하여 통과를 확인한다.
- 통과하면 Step 2로 넘어간다.

### Step 2: 코드 기반 리뷰

`REVIEW_BACKLOG.md`의 미해결 이슈를 확인한다.

**미해결 이슈가 있으면:**
- 가장 심각도 높은 이슈 하나를 선택하여 수정한다.
- `pnpm lint && pnpm typecheck && cargo test` 통과 확인 후 커밋한다.
- `REVIEW_BACKLOG.md`에서 해당 이슈를 `[x]`로 체크한다.

**미해결 이슈가 없으면:**
- `git log --oneline -5`로 최근 변경을 확인한다.
- 최근 변경 파일을 중심으로 **새로운 이슈를 탐색**한다:
  - 보안: path traversal, 인젝션, 민감정보 노출
  - 정확성: null 미처리, 경쟁 조건, 타입 불일치
  - 성능: 불필요한 재렌더링, O(n²), 메모리 누수
  - 아키텍처: FSD 위반, import 방향 위반
- 발견된 이슈는 `REVIEW_BACKLOG.md`에 추가한다.
- 가장 심각한 것 하나를 바로 수정하고 커밋한다.

### Step 3: UI/UX 리뷰 (실 데이터 기반)

`pnpm build`로 빌드된 앱을 대상으로 검증한다.

- `tests/e2e/` 디렉토리의 기존 E2E 테스트를 실행한다.
- 테스트가 커버하지 않는 영역을 확인한다:
  - 새로 추가된 UI (eval compare view, score panel, provider badge 등)
  - motion/animation 적용 상태
  - 접근성 (aria-label, keyboard nav, focus indicator)
  - 빈 상태/에러 상태/로딩 상태 처리
- 커버리지 갭이 있으면 **E2E 테스트를 추가**한다.
- 코드 리뷰로 발견한 UI 이슈가 있으면 수정하고 커밋한다.

## 완료 조건

하나의 iteration에서 아래 모든 조건을 만족하면 종료:
1. `pnpm build && pnpm test:e2e && pnpm test && cargo test` 모두 통과
2. `pnpm lint && pnpm typecheck` 통과
3. `REVIEW_BACKLOG.md`에 미해결 이슈 없음
4. 새로 발견된 이슈 없음

이 조건을 만족하면 `<promise>ALL CLEAN</promise>`을 출력한다.

## 규칙

- 한 iteration에 **최대 1개 이슈**만 수정한다 (집중).
- 수정 후 반드시 검증 명령을 실행한다.
- 커밋 메시지는 conventional commit 형식.
- 범위 밖 리팩터링 금지.
- `REVIEW_BACKLOG.md`가 single source of truth이다.
- 발견만 하고 수정하지 않은 이슈도 반드시 backlog에 기록한다.
