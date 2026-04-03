# Eval Boundary

Issue #23 and issue #25 solve different problems and should stay separate.

- Issue #23 is session-level scoring. It evaluates a single session/run and keeps the lens on one thread, one timeline, and one set of session artifacts.
- Issue #25 is experiment-level evaluation. It evaluates a shared experiment that contains multiple cases and compares baseline and candidate runs against the same case contract.
- Session scoring can feed experiment evaluation later, but experiment evaluation must not overwrite or masquerade as the session-level truth.
- The canonical eval schema therefore starts from `Experiment -> Case -> CandidateRun` and keeps grades attached to candidate runs, not to the session-log entity model.
- Preview-first privacy rules also stay separate: session import/export policies continue to govern raw session material, while eval storage only persists preview-safe experiment data unless a future raw opt-in path is explicitly added.
