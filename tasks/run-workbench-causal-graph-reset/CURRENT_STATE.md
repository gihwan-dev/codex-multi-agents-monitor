# Current State Audit

## Product stance

- 기존 구현은 workbench shell은 갖췄지만, 기본 읽기 경험이 causal graph보다 timeline table에 가까웠다.
- left rail은 workspace tree semantics를 일부 가졌어도 경로, badge, owner, metadata가 기본 행보다 먼저 보였다.
- inspector는 Cause/Impact라는 제목은 있었지만, 빈 섹션 또는 jump list 수준이라 explanation 도구로는 약했다.

## Observed issues

- Graph mode가 `time gutter + lane columns + event cells` 구조라 실질적으로 Waterfall grammar였다.
- summary strip에 사실 정보보다 구현 가이드 문장이 먼저 노출됐다.
- mode toggle과 drawer toggle이 같은 row에서 경쟁해 시각화 계층이 흐려졌다.
- dense parallel fixture에서 selected path보다는 표 구조가 먼저 읽혔다.

## Preserve

- warm graphite palette와 repo-local thin primitive layer
- preview-first masking, raw opt-in, export default 정책
- fixture-backed validation과 shared normalized dataset mental model

## Refactor implication

- 이번 작업은 style polish가 아니라 `graph`, `waterfall`, `workspace tree`, `inspector explanation`의 제품 grammar를 다시 고정하는 refactor다.
