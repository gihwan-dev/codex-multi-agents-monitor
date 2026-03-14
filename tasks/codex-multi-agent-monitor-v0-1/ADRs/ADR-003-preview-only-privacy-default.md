# ADR-003 Preview-Only Privacy Default

- Traceability ID: `ADR-003`
- Related requirements: `REQ-08`

## Context

멀티 에이전트 trace에는 prompt, tool output, artifact metadata, file path 등 민감 정보가 포함될 수 있다. raw를 기본 저장하면 디버깅 편의는 높아지지만 privacy risk와 운영 부담이 크게 올라간다.

## Decision

privacy 기본값은 preview-only storage로 고정하고 raw payload는 opt-in으로만 허용한다.

- 기본 저장은 `input_preview`, `output_preview` 중심이다.
- raw payload는 optional reference로만 저장한다.
- project 단위 `sensitive storage off`를 지원한다.
- export 기본값은 raw excluded다.

## Consequences

- 기본 posture가 data minimization에 맞춰진다.
- raw 기반 deep debugging은 명시적 opt-in이 필요하다.
- normalizer 단계에서 redaction hook과 export filter를 유지해야 한다.

## Alternatives

- raw default storage: privacy risk 증가로 기각
- no payload storage at all: debugging 가치가 크게 떨어져 기각
