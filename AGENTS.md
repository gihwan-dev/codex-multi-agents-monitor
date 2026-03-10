# Repository Agent Rules

이 문서는 이 레포에서만 적용되는 구현 규칙을 정의한다.

## 기준 문서 우선순위

- 제품 요구사항의 단일 기준선은 `tasks/codex-desktop-multi-agent-monitor/PLAN.md`다.
- 구현 중 충돌이 생기면 이 레포 문서보다 PLAN.md의 요구사항을 우선한다.

## 소유권 경계

- Frontend는 로컬 파일(`~/.codex`, SQLite)을 직접 읽지 않는다.
- Frontend는 Tauri `invoke` command와 Tauri event만 소비한다.
- 파일 접근, source parsing, index DB 관리는 Rust backend만 수행한다.

## 구현 원칙

- timeline-first UX를 유지한다. 테이블 나열보다 시간축 컨텍스트를 우선한다.
- 기본 노출은 요약 우선, 원문은 확장 패널에서만 노출한다.
- 작은 슬라이스 단위로 진행한다.
- 기본 가드레일: `repo-tracked files 3개 이하` 또는 `하나의 응집된 모듈 경계`, 순 diff 약 `150 LOC`.

## 검증 명령

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm cargo:test`
- `pnpm tauri:build`

## 금지 범위 (현재 단계)

- updater/global shortcut/notification/remote control 도입
- Codex source 파일 쓰기/정리/마이그레이션
- 비공개 IPC 의존 구현
