const runRows = [
  {
    session: "Spec alignment",
    status: "Live",
    duration: "21m 14s",
    agents: "4",
    updated: "now",
    active: true,
  },
  {
    session: "Schema review",
    status: "Waiting",
    duration: "18m 24s",
    agents: "3",
    updated: "2m ago",
  },
  {
    session: "Regression sweep",
    status: "Failed",
    duration: "9m 48s",
    agents: "5",
    updated: "14m ago",
  },
  {
    session: "Artifact export",
    status: "Done",
    duration: "6m 10s",
    agents: "2",
    updated: "32m ago",
  },
];

const summaryItems = [
  ["duration", "21m 14s"],
  ["active_time", "12m 08s"],
  ["idle_time", "9m 06s"],
  ["agent_count", "4"],
  ["peak_parallelism", "3"],
  ["llm_calls", "18"],
  ["tool_calls", "7"],
  ["total_tokens", "92k"],
  ["total_cost", "$3.42"],
  ["error_count", "1"],
];

const laneLabels = ["planner", "worker.alpha", "worker.beta", "reviewer"];

const graphRows = [
  {
    event: "Run bootstrapped",
    meta: "00:00 · spawn",
    cells: [
      { label: "running", tone: "running" },
      { label: "spawn", tone: "spawn" },
      { label: "queued", tone: "idle" },
      { label: "queued", tone: "idle" },
    ],
  },
  {
    event: "Delegate parser lane",
    meta: "00:42 · handoff",
    cells: [
      { label: "handoff → alpha", tone: "handoff" },
      { label: "running", tone: "running" },
      { label: "waiting", tone: "waiting" },
      { label: "preview", tone: "idle" },
    ],
  },
  {
    event: "Transfer fixture digest",
    meta: "02:18 · transfer",
    cells: [
      { label: "routing", tone: "idle" },
      { label: "transfer → beta", tone: "transfer" },
      { label: "tool", tone: "tool" },
      { label: "trace tap", tone: "idle" },
    ],
  },
  {
    event: "// 18m 24s hidden · 2 lanes idle //",
    meta: "gap fold",
    gap: true,
  },
  {
    event: "Schema approval blocked",
    meta: "20:51 · wait_reason=review pending",
    cells: [
      { label: "waiting", tone: "waiting" },
      { label: "blocked", tone: "blocked" },
      { label: "done", tone: "done" },
      { label: "interrupted", tone: "interrupted" },
    ],
  },
  {
    event: "Trace validation failed",
    meta: "21:04 · first error",
    cells: [
      { label: "done", tone: "done" },
      { label: "artifact", tone: "artifact" },
      { label: "done", tone: "done" },
      { label: "failed", tone: "failed" },
    ],
  },
];

const inspectorRows = [
  ["edge_type", "handoff"],
  ["source", "planner"],
  ["target", "worker.alpha"],
  ["wait_reason", "schema review pending"],
  ["artifact_ref", "report.md"],
];

function toneClasses(tone: string) {
  switch (tone) {
    case "running":
      return "border-emerald-400/30 bg-emerald-400/12 text-emerald-100";
    case "waiting":
      return "border-amber-300/30 bg-amber-300/12 text-amber-100";
    case "blocked":
      return "border-rose-300/30 bg-rose-300/12 text-rose-100";
    case "interrupted":
      return "border-slate-300/25 bg-slate-200/10 text-slate-100";
    case "handoff":
      return "border-[rgba(210,163,109,0.35)] bg-[rgba(210,163,109,0.16)] text-[#f7d7b5]";
    case "transfer":
      return "border-sky-300/30 bg-sky-300/12 text-sky-100";
    case "tool":
      return "border-cyan-300/30 bg-cyan-300/12 text-cyan-100";
    case "failed":
      return "border-rose-400/30 bg-rose-400/16 text-rose-100";
    case "artifact":
      return "border-violet-300/30 bg-violet-300/12 text-violet-100";
    case "done":
      return "border-white/12 bg-white/6 text-obs-text-primary";
    default:
      return "border-white/8 bg-white/5 text-obs-text-secondary";
  }
}

function statusClasses(status: string) {
  switch (status) {
    case "Live":
      return "bg-emerald-400/14 text-emerald-100 ring-1 ring-emerald-400/20";
    case "Waiting":
      return "bg-amber-300/14 text-amber-100 ring-1 ring-amber-300/20";
    case "Failed":
      return "bg-rose-400/14 text-rose-100 ring-1 ring-rose-400/20";
    default:
      return "bg-white/8 text-obs-text-primary ring-1 ring-white/10";
  }
}

export function MonitorShell() {
  return (
    <main className="observatory-shell">
      <section className="observatory-panel grid min-h-[88vh] w-full max-w-[1600px] gap-4 overflow-hidden rounded-[1.75rem] border border-obs-panel-border bg-obs-panel-strong/90 p-4 text-obs-text-primary xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="rounded-[1.5rem] border border-white/8 bg-black/14 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="observatory-eyebrow">Run List</span>
              <h1 className="mt-2 text-3xl">Observatory</h1>
            </div>
            <span className="rounded-full bg-obs-accent-soft px-3 py-1 text-xs font-semibold text-[#f7d7b5]">
              preview-only
            </span>
          </div>
          <div className="mt-6 rounded-[1.25rem] border border-white/8 bg-white/4 p-3">
            <p className="text-xs uppercase tracking-[0.24em] text-obs-text-muted">
              project
            </p>
            <p className="mt-2 text-lg font-semibold">codex-multi-agent-monitor</p>
            <p className="mt-1 text-sm text-obs-text-secondary">
              Session &gt; Run triage shell
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {runRows.map((run) => (
              <article
                key={run.session}
                className={`rounded-[1.25rem] border p-3 transition ${
                  run.active
                    ? "border-[rgba(210,163,109,0.35)] bg-[rgba(210,163,109,0.12)] shadow-[0_12px_30px_rgba(4,9,15,0.22)]"
                    : "border-white/8 bg-white/4"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{run.session}</p>
                    <p className="mt-1 text-xs text-obs-text-muted">
                      duration {run.duration} · agents {run.agents}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(run.status)}`}
                  >
                    {run.status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-obs-text-secondary">
                  updated {run.updated}
                </p>
              </article>
            ))}
          </div>
        </aside>

        <section className="space-y-4 rounded-[1.5rem] border border-white/8 bg-black/10 p-4">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-obs-text-muted">
                Project / Session / Run
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                REQ coverage shell pass
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-obs-text-secondary">
                <span className="rounded-full bg-white/8 px-3 py-1">running</span>
                <span className="rounded-full bg-white/8 px-3 py-1">desktop</span>
                <span className="rounded-full bg-emerald-400/14 px-3 py-1 text-emerald-100">
                  live indicator
                </span>
              </div>
            </div>
            <div className="grid min-w-[240px] gap-2 rounded-[1.25rem] border border-white/8 bg-white/4 p-3 text-sm">
              <span className="text-xs uppercase tracking-[0.24em] text-obs-text-muted">
                jump bar
              </span>
              <div className="flex flex-wrap gap-2 text-xs text-obs-text-secondary">
                <span className="rounded-full border border-white/8 px-3 py-1">
                  First error
                </span>
                <span className="rounded-full border border-white/8 px-3 py-1">
                  Longest wait
                </span>
                <span className="rounded-full border border-white/8 px-3 py-1">
                  Last handoff
                </span>
              </div>
            </div>
          </header>

          <div className="grid gap-3 md:grid-cols-5">
            {summaryItems.map(([label, value]) => (
              <article
                key={label}
                className="rounded-[1.15rem] border border-white/8 bg-white/4 p-3"
              >
                <p className="text-[11px] uppercase tracking-[0.24em] text-obs-text-muted">
                  {label}
                </p>
                <p className="mt-3 text-xl font-semibold tabular-nums">{value}</p>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-[rgba(210,163,109,0.16)] px-4 py-2 text-sm font-semibold text-[#f7d7b5] ring-1 ring-[rgba(210,163,109,0.28)]"
            >
              Graph
            </button>
            <button
              type="button"
              className="rounded-full border border-white/8 px-4 py-2 text-sm text-obs-text-secondary"
            >
              Waterfall
            </button>
            <button
              type="button"
              className="rounded-full border border-white/8 px-4 py-2 text-sm text-obs-text-secondary"
            >
              Map
            </button>
          </div>

          <section className="overflow-hidden rounded-[1.4rem] border border-white/8 bg-[rgba(10,14,18,0.42)]">
            <div className="grid grid-cols-[minmax(12rem,15rem)_repeat(4,minmax(8rem,1fr))] border-b border-white/8 bg-white/4">
              <div className="px-4 py-3 text-xs uppercase tracking-[0.24em] text-obs-text-muted">
                event
              </div>
              {laneLabels.map((lane) => (
                <div
                  key={lane}
                  className="border-l border-white/8 px-4 py-3 text-xs uppercase tracking-[0.24em] text-obs-text-muted"
                >
                  {lane}
                </div>
              ))}
            </div>
            {graphRows.map((row) => (
              <div
                key={row.event}
                className={`grid grid-cols-[minmax(12rem,15rem)_repeat(4,minmax(8rem,1fr))] ${
                  row.gap ? "bg-white/3" : "border-t border-white/6"
                }`}
              >
                <div className="px-4 py-3">
                  <p className={`text-sm ${row.gap ? "text-[#f7d7b5]" : "font-medium"}`}>
                    {row.event}
                  </p>
                  <p className="mt-1 text-xs text-obs-text-muted">{row.meta}</p>
                </div>
                {row.gap
                  ? laneLabels.map((lane) => (
                      <div
                        key={lane}
                        className="border-l border-white/8 px-4 py-3 text-xs text-obs-text-muted"
                      >
                        folded
                      </div>
                    ))
                  : row.cells?.map((cell, index) => (
                      <div
                        key={`${row.event}-${laneLabels[index]}`}
                        className="border-l border-white/8 px-4 py-3"
                      >
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClasses(cell.tone)}`}
                        >
                          {cell.label}
                        </span>
                      </div>
                    ))}
              </div>
            ))}
          </section>
        </section>

        <aside className="rounded-[1.5rem] border border-white/8 bg-black/14 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="observatory-eyebrow">Inspector</span>
              <h2 className="mt-2 text-2xl font-semibold">Last handoff</h2>
            </div>
            <span className="rounded-full border border-white/8 px-3 py-1 text-xs text-obs-text-secondary">
              Trace
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Summary", "Input", "Output", "Trace", "Raw"].map((tab) => (
              <span
                key={tab}
                className={`rounded-full px-3 py-1 text-xs ${
                  tab === "Trace"
                    ? "bg-white/12 text-obs-text-primary"
                    : "border border-white/8 text-obs-text-secondary"
                }`}
              >
                {tab}
              </span>
            ))}
          </div>
          <dl className="mt-6 space-y-3 rounded-[1.25rem] border border-white/8 bg-white/4 p-4">
            {inspectorRows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[96px_1fr] gap-3 text-sm">
                <dt className="text-obs-text-muted">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-[1.25rem] border border-[rgba(210,163,109,0.24)] bg-[rgba(210,163,109,0.08)] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[#f7d7b5]">
              payload preview
            </p>
            <pre className="mt-3 overflow-x-auto text-xs leading-6 text-obs-text-secondary">
{`{
  "handoff_reason": "continue schema reconciliation",
  "selected_row": "Delegate parser lane",
  "final_artifact_author": "worker.alpha"
}`}
            </pre>
          </div>
          <div className="mt-4 rounded-[1.25rem] border border-violet-300/18 bg-violet-300/8 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-violet-100">
              final artifact
            </p>
            <p className="mt-2 text-lg font-semibold">report.md</p>
            <p className="mt-1 text-sm text-obs-text-secondary">
              authored by worker.alpha after reviewer failure surfaced the first
              blocking edge
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
