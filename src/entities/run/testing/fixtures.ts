import { calculateSummaryMetrics } from "../lib/summarySelectors.js";
import type {
  AgentLane,
  ArtifactRecord,
  EdgeRecord,
  EventRecord,
  LiveWatchFrame,
  RunDataset,
} from "../model/types.js";

const baseTime = Date.parse("2026-03-14T09:00:00Z");

function lane(
  laneId: string,
  name: string,
  role: string,
  model: string,
  badge: string,
  laneStatus: AgentLane["laneStatus"],
): AgentLane {
  return {
    laneId,
    agentId: laneId,
    threadId: `thread-${laneId}`,
    name,
    role,
    model,
    provider: "OpenAI",
    badge,
    laneStatus,
  };
}

function event(input: Partial<EventRecord> & Pick<EventRecord, "eventId" | "laneId" | "agentId" | "threadId" | "eventType" | "status" | "startTs" | "title">): EventRecord {
  const endTs = input.endTs ?? input.startTs + (input.durationMs ?? 30_000);
  return {
    parentId: null,
    linkIds: [],
    waitReason: null,
    retryCount: 0,
    inputPreview: null,
    outputPreview: null,
    artifactId: null,
    errorCode: null,
    errorMessage: null,
    provider: "OpenAI",
    model: "gpt-5",
    toolName: null,
    tokensIn: 0,
    tokensOut: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    finishReason: null,
    rawInput: null,
    rawOutput: null,
    ...input,
    endTs,
    durationMs: endTs - input.startTs,
  };
}

function artifact(
  artifactId: string,
  title: string,
  producerEventId: string,
  preview: string,
  rawContent: string | null = null,
): ArtifactRecord {
  return {
    artifactId,
    title,
    artifactRef: `file://${artifactId}.md`,
    producerEventId,
    preview,
    rawContent,
  };
}

function edge(
  edgeId: string,
  edgeType: EdgeRecord["edgeType"],
  sourceAgentId: string,
  targetAgentId: string,
  sourceEventId: string,
  targetEventId: string,
  payloadPreview: string,
): EdgeRecord {
  return {
    edgeId,
    edgeType,
    sourceAgentId,
    targetAgentId,
    sourceEventId,
    targetEventId,
    payloadPreview,
    artifactId: null,
  };
}

function withMetrics(dataset: Omit<RunDataset, "run"> & { run: RunDataset["run"] }): RunDataset {
  const summaryMetrics = calculateSummaryMetrics(dataset as RunDataset);
  return {
    ...dataset,
    run: {
      ...dataset.run,
      durationMs:
        dataset.run.durationMs ||
        Math.max(...dataset.events.map((item) => item.endTs ?? item.startTs)) - dataset.run.startTs,
      summaryMetrics,
    },
  };
}

function buildFix001(): RunDataset {
  const lanes = [
    lane("planner", "Planner", "orchestrator", "gpt-5", "Main", "done"),
    lane("writer", "Writer", "worker", "gpt-5-mini", "Worktree", "done"),
  ];
  const events = [
    event({
      eventId: "fix1-start",
      laneId: "planner",
      agentId: "planner",
      threadId: "thread-planner",
      eventType: "run.started",
      status: "done",
      startTs: baseTime,
      endTs: baseTime + 15_000,
      title: "Run started",
      outputPreview: "Planner opens the task bundle.",
    }),
    event({
      eventId: "fix1-handoff",
      laneId: "planner",
      agentId: "planner",
      threadId: "thread-planner",
      eventType: "handoff",
      status: "done",
      startTs: baseTime + 25_000,
      endTs: baseTime + 50_000,
      title: "Hand off implementation",
      outputPreview: "Writer receives scoped UI work.",
      tokensIn: 4400,
      tokensOut: 1200,
      costUsd: 0.12,
    }),
    event({
      eventId: "fix1-write",
      laneId: "writer",
      agentId: "writer",
      threadId: "thread-writer",
      eventType: "tool.finished",
      status: "done",
      startTs: baseTime + 55_000,
      endTs: baseTime + 170_000,
      title: "Patch workbench shell",
      outputPreview: "3-pane shell, filters, and inspector are applied.",
      artifactId: "artifact-fix1-shell",
      tokensIn: 1500,
      tokensOut: 6200,
      costUsd: 0.42,
      toolName: "apply_patch",
    }),
    event({
      eventId: "fix1-finish",
      laneId: "planner",
      agentId: "planner",
      threadId: "thread-planner",
      eventType: "run.finished",
      status: "done",
      startTs: baseTime + 180_000,
      endTs: baseTime + 195_000,
      title: "Run finished",
      outputPreview: "UI shell validated.",
      artifactId: "artifact-fix1-shell",
    }),
  ];

  return withMetrics({
    project: {
      projectId: "proj-observatory",
      name: "codex-multi-agent-monitor",
      repoPath: "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
      badge: "Desktop",
    },
    session: {
      sessionId: "session-fix1",
      title: "Static shell review",
      owner: "Choe",
      startedAt: baseTime,
    },
    run: {
      traceId: "trace-fix-001",
      title: "FIX-001 Minimal completed run",
      status: "done",
      startTs: baseTime,
      endTs: baseTime + 195_000,
      durationMs: 195_000,
      environment: "Import",
      liveMode: "imported",
      summaryMetrics: {
        totalDurationMs: 0,
        activeTimeMs: 0,
        idleTimeMs: 0,
        longestGapMs: 0,
        agentCount: 0,
        peakParallelism: 0,
        llmCalls: 0,
        toolCalls: 0,
        tokens: 0,
        costUsd: 0,
        errorCount: 0,
      },
      finalArtifactId: "artifact-fix1-shell",
      selectedByDefaultId: "fix1-write",
      rawIncluded: false,
      noRawStorage: true,
      isArchived: false,
    },
    lanes,
    events,
    edges: [edge("edge-fix1", "handoff", "planner", "writer", "fix1-handoff", "fix1-write", "Deliver shell contract")],
    artifacts: [
      artifact(
        "artifact-fix1-shell",
        "Workbench shell",
        "fix1-write",
        "3-pane graph-first shell with summary strip and inspector.",
        null,
      ),
    ],
  });
}

function buildFix002(): RunDataset {
  const start = baseTime + 500_000;
  const lanes = [
    lane("orchestrator", "Planner", "orchestrator", "gpt-5", "Main", "blocked"),
    lane("finder", "Explorer", "explorer", "gpt-5-mini", "Scout", "waiting"),
    lane("writer", "Writer", "worker", "gpt-5-mini", "Worktree", "interrupted"),
    lane("verifier", "Verifier", "verification", "gpt-5-mini", "Check", "waiting"),
  ];
  const events = [
    event({
      eventId: "fix2-start",
      laneId: "orchestrator",
      agentId: "orchestrator",
      threadId: "thread-orchestrator",
      eventType: "run.started",
      status: "running",
      startTs: start,
      endTs: start + 15_000,
      title: "Run started",
    }),
    event({
      eventId: "fix2-spawn",
      laneId: "orchestrator",
      agentId: "orchestrator",
      threadId: "thread-orchestrator",
      eventType: "agent.spawned",
      status: "running",
      startTs: start + 20_000,
      endTs: start + 50_000,
      title: "Spawn explorer and writer",
      outputPreview: "Parallel discovery begins.",
    }),
    event({
      eventId: "fix2-wait",
      laneId: "finder",
      agentId: "finder",
      threadId: "thread-finder",
      eventType: "agent.state_changed",
      status: "waiting",
      waitReason: "Waiting for repo search completion",
      startTs: start + 60_000,
      endTs: start + 420_000,
      title: "Explorer waiting on search",
      outputPreview: "rg scan is still in-flight.",
    }),
    event({
      eventId: "fix2-blocked",
      laneId: "orchestrator",
      agentId: "orchestrator",
      threadId: "thread-orchestrator",
      eventType: "agent.state_changed",
      status: "blocked",
      waitReason: "Spec approval missing for live watch contract",
      startTs: start + 80_000,
      endTs: start + 320_000,
      title: "Planner blocked",
      outputPreview: "Stop / replan gate triggered.",
    }),
    event({
      eventId: "fix2-interrupt",
      laneId: "writer",
      agentId: "writer",
      threadId: "thread-writer",
      eventType: "note",
      status: "interrupted",
      waitReason: "Interrupt received while rebasing worktree",
      startTs: start + 120_000,
      endTs: start + 160_000,
      title: "Writer interrupted",
      outputPreview: "Checkpoint flushed.",
    }),
    event({
      eventId: "fix2-verify",
      laneId: "verifier",
      agentId: "verifier",
      threadId: "thread-verifier",
      eventType: "agent.state_changed",
      status: "waiting",
      waitReason: "Waiting for edit-only phase to finish",
      startTs: start + 140_000,
      endTs: start + 260_000,
      title: "Verifier queued",
      outputPreview: "Noisy validation is deferred.",
    }),
  ];

  return withMetrics({
    project: {
      projectId: "proj-observatory",
      name: "codex-multi-agent-monitor",
      repoPath: "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
      badge: "Desktop",
    },
    session: {
      sessionId: "session-fix2",
      title: "Waiting chain review",
      owner: "Choe",
      startedAt: start,
    },
    run: {
      traceId: "trace-fix-002",
      title: "FIX-002 Waiting chain run",
      status: "blocked",
      startTs: start,
      endTs: null,
      durationMs: 420_000,
      environment: "Live",
      liveMode: "live",
      summaryMetrics: {
        totalDurationMs: 0,
        activeTimeMs: 0,
        idleTimeMs: 0,
        longestGapMs: 0,
        agentCount: 0,
        peakParallelism: 0,
        llmCalls: 0,
        toolCalls: 0,
        tokens: 0,
        costUsd: 0,
        errorCount: 0,
      },
      finalArtifactId: null,
      selectedByDefaultId: "fix2-blocked",
      rawIncluded: false,
      noRawStorage: true,
      isArchived: false,
    },
    lanes,
    events,
    edges: [
      edge("edge-fix2-spawn", "spawn", "orchestrator", "finder", "fix2-spawn", "fix2-wait", "Explorer starts waiting"),
      edge("edge-fix2-spawn-writer", "spawn", "orchestrator", "writer", "fix2-spawn", "fix2-interrupt", "Writer receives implementation slice"),
      edge("edge-fix2-spawn-verifier", "spawn", "orchestrator", "verifier", "fix2-spawn", "fix2-verify", "Verifier queued for checkpoint"),
      edge("edge-fix2-merge", "merge", "finder", "orchestrator", "fix2-wait", "fix2-blocked", "Explorer results collected"),
      edge("edge-fix2-handoff", "handoff", "orchestrator", "writer", "fix2-spawn", "fix2-interrupt", "Writer receives implementation slice"),
      edge("edge-fix2-transfer", "transfer", "writer", "verifier", "fix2-interrupt", "fix2-verify", "Pass checkpoint to verification"),
    ],
    artifacts: [],
  });
}

function buildFix003(): RunDataset {
  const start = baseTime + 1_100_000;
  const lanes = [
    lane("planner", "Planner", "orchestrator", "gpt-5", "Main", "failed"),
    lane("tooler", "Tool Runner", "worker", "gpt-5-mini", "Tool", "failed"),
  ];
  const events = [
    event({
      eventId: "fix3-start",
      laneId: "planner",
      agentId: "planner",
      threadId: "thread-planner",
      eventType: "run.started",
      status: "running",
      startTs: start,
      title: "Failure analysis started",
      endTs: start + 20_000,
    }),
    event({
      eventId: "fix3-tool",
      laneId: "tooler",
      agentId: "tooler",
      threadId: "thread-tooler",
      eventType: "tool.finished",
      status: "failed",
      startTs: start + 35_000,
      endTs: start + 95_000,
      title: "Run parser smoke test",
      errorCode: "EPIPE",
      errorMessage: "tool output stream closed before final artifact write",
      outputPreview: "Smoke test failed during parser normalization.",
      toolName: "node-test",
      costUsd: 0.09,
    }),
    event({
      eventId: "fix3-error",
      laneId: "planner",
      agentId: "planner",
      threadId: "thread-planner",
      eventType: "error",
      status: "failed",
      startTs: start + 100_000,
      endTs: start + 110_000,
      title: "First failure boundary",
      errorCode: "PARSER_FAIL",
      errorMessage: "Normalization contract missing wait_reason",
      outputPreview: "Fallback inspector copy opened.",
    }),
  ];

  return withMetrics({
    project: {
      projectId: "proj-observatory",
      name: "codex-multi-agent-monitor",
      repoPath: "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
      badge: "Desktop",
    },
    session: {
      sessionId: "session-fix3",
      title: "First failure review",
      owner: "Choe",
      startedAt: start,
    },
    run: {
      traceId: "trace-fix-003",
      title: "FIX-003 First failure run",
      status: "failed",
      startTs: start,
      endTs: start + 110_000,
      durationMs: 110_000,
      environment: "Import",
      liveMode: "imported",
      summaryMetrics: {
        totalDurationMs: 0,
        activeTimeMs: 0,
        idleTimeMs: 0,
        longestGapMs: 0,
        agentCount: 0,
        peakParallelism: 0,
        llmCalls: 0,
        toolCalls: 0,
        tokens: 0,
        costUsd: 0,
        errorCount: 0,
      },
      finalArtifactId: null,
      selectedByDefaultId: "fix3-error",
      rawIncluded: false,
      noRawStorage: true,
      isArchived: false,
    },
    lanes,
    events,
    edges: [edge("edge-fix3-transfer", "transfer", "tooler", "planner", "fix3-tool", "fix3-error", "Bubble failure context to planner")],
    artifacts: [],
  });
}

function buildFix004(): RunDataset {
  const start = baseTime + 1_600_000;
  const lanes = Array.from({ length: 10 }, (_, index) =>
    lane(
      `lane-${index + 1}`,
      `Agent ${index + 1}`,
      index === 0 ? "orchestrator" : "worker",
      index % 2 === 0 ? "gpt-5" : "gpt-5-mini",
      index === 0 ? "Main" : "Worktree",
      index < 3 ? "running" : index === 8 ? "blocked" : "done",
    ),
  );
  const events: EventRecord[] = [];
  const edges: EdgeRecord[] = [];

  lanes.forEach((laneItem, laneIndex) => {
    for (let eventIndex = 0; eventIndex < 13; eventIndex += 1) {
      const offset = laneIndex * 18_000 + eventIndex * 55_000;
      const status =
        laneIndex === 8 && eventIndex === 9
          ? "blocked"
          : eventIndex === 12
            ? "done"
            : "running";
      const eventId = `fix4-${laneItem.laneId}-${eventIndex}`;
      events.push(
        event({
          eventId,
          laneId: laneItem.laneId,
          agentId: laneItem.agentId,
          threadId: laneItem.threadId,
          eventType: eventIndex % 4 === 0 ? "llm.finished" : eventIndex % 4 === 1 ? "tool.finished" : "note",
          status,
          waitReason:
            status === "blocked" ? "Queue depth exceeds live degrade threshold" : null,
          startTs: start + offset,
          endTs: start + offset + 28_000 + ((eventIndex + laneIndex) % 3) * 12_000,
          title: `Lane ${laneIndex + 1} step ${eventIndex + 1}`,
          outputPreview: `Processed stage ${eventIndex + 1} for ${laneItem.name}.`,
          tokensIn: 900 + eventIndex * 40,
          tokensOut: 1200 + laneIndex * 25,
          costUsd: 0.02 + eventIndex * 0.002,
          toolName: eventIndex % 4 === 1 ? "patch" : null,
        }),
      );
      if (laneIndex < lanes.length - 1 && eventIndex % 4 === 2) {
        edges.push(
          edge(
            `fix4-edge-${laneIndex}-${eventIndex}`,
            eventIndex % 8 === 2 ? "transfer" : "handoff",
            laneItem.agentId,
            lanes[laneIndex + 1].agentId,
            eventId,
            `fix4-${lanes[laneIndex + 1].laneId}-${Math.min(eventIndex + 1, 12)}`,
            `Bridge ${laneItem.name} -> ${lanes[laneIndex + 1].name}`,
          ),
        );
      }
    }
  });

  return withMetrics({
    project: {
      projectId: "proj-parallel",
      name: "parallel-evidence-workbench",
      repoPath: "/Users/choegihwan/Documents/Projects/parallel-evidence-workbench",
      badge: "Desktop",
    },
    session: {
      sessionId: "session-fix4",
      title: "Dense parallel replay",
      owner: "Choe",
      startedAt: start,
    },
    run: {
      traceId: "trace-fix-004",
      title: "FIX-004 Dense parallel run",
      status: "running",
      startTs: start,
      endTs: null,
      durationMs: 830_000,
      environment: "Live",
      liveMode: "live",
      summaryMetrics: {
        totalDurationMs: 0,
        activeTimeMs: 0,
        idleTimeMs: 0,
        longestGapMs: 0,
        agentCount: 0,
        peakParallelism: 0,
        llmCalls: 0,
        toolCalls: 0,
        tokens: 0,
        costUsd: 0,
        errorCount: 0,
      },
      finalArtifactId: null,
      selectedByDefaultId: "fix4-lane-9-9",
      rawIncluded: false,
      noRawStorage: true,
      isArchived: false,
    },
    lanes,
    events,
    edges,
    artifacts: [],
  });
}

function buildFix005(): RunDataset {
  const start = baseTime + 2_600_000;
  const lanes = [
    lane("redactor", "Redactor", "worker", "gpt-5-mini", "Sanitize", "done"),
    lane("planner", "Planner", "orchestrator", "gpt-5", "Main", "done"),
  ];
  const events = [
    event({
      eventId: "fix5-redact",
      laneId: "redactor",
      agentId: "redactor",
      threadId: "thread-redactor",
      eventType: "tool.finished",
      status: "done",
      startTs: start,
      endTs: start + 70_000,
      title: "Apply preview-first masking",
      inputPreview: "Prompt preview: outline migration plan",
      outputPreview: "Tool output preview: 3 risks and 2 mitigations",
      rawInput: "FULL RAW PROMPT CONTENT",
      rawOutput: "FULL RAW TOOL CONTENT",
      tokensIn: 3000,
      tokensOut: 1800,
      costUsd: 0.08,
      toolName: "redactor",
    }),
    event({
      eventId: "fix5-finish",
      laneId: "planner",
      agentId: "planner",
      threadId: "thread-planner",
      eventType: "run.finished",
      status: "done",
      startTs: start + 75_000,
      endTs: start + 90_000,
      title: "Export sanitized dataset",
      outputPreview: "Raw payload excluded by default.",
      artifactId: "artifact-fix5-export",
    }),
  ];

  return withMetrics({
    project: {
      projectId: "proj-sanitized",
      name: "privacy-first-replay",
      repoPath: "/Users/choegihwan/Documents/Projects/privacy-first-replay",
      badge: "Import",
    },
    session: {
      sessionId: "session-fix5",
      title: "Redaction review",
      owner: "Choe",
      startedAt: start,
    },
    run: {
      traceId: "trace-fix-005",
      title: "FIX-005 Redacted payload run",
      status: "done",
      startTs: start,
      endTs: start + 90_000,
      durationMs: 90_000,
      environment: "Import",
      liveMode: "imported",
      summaryMetrics: {
        totalDurationMs: 0,
        activeTimeMs: 0,
        idleTimeMs: 0,
        longestGapMs: 0,
        agentCount: 0,
        peakParallelism: 0,
        llmCalls: 0,
        toolCalls: 0,
        tokens: 0,
        costUsd: 0,
        errorCount: 0,
      },
      finalArtifactId: "artifact-fix5-export",
      selectedByDefaultId: "fix5-redact",
      rawIncluded: false,
      noRawStorage: true,
      isArchived: false,
    },
    lanes,
    events,
    edges: [edge("edge-fix5", "merge", "redactor", "planner", "fix5-redact", "fix5-finish", "Sanitized summary only")],
    artifacts: [artifact("artifact-fix5-export", "Sanitized export", "fix5-finish", "Preview-only export bundle", null)],
  });
}

function buildFix006(): RunDataset {
  const start = baseTime + 3_000_000;
  const lanes = [
    lane("live-main", "Live Orchestrator", "orchestrator", "gpt-5", "Main", "running"),
    lane("live-worker", "Live Worker", "worker", "gpt-5-mini", "Worktree", "running"),
  ];
  const events = [
    event({
      eventId: "fix6-start",
      laneId: "live-main",
      agentId: "live-main",
      threadId: "thread-live-main",
      eventType: "run.started",
      status: "running",
      startTs: start,
      endTs: start + 20_000,
      title: "Live watch connected",
      outputPreview: "Follow live is on.",
    }),
    event({
      eventId: "fix6-handoff",
      laneId: "live-main",
      agentId: "live-main",
      threadId: "thread-live-main",
      eventType: "handoff",
      status: "running",
      startTs: start + 30_000,
      endTs: start + 55_000,
      title: "Hand off live diagnostics",
      outputPreview: "Worker tracks new events.",
    }),
    event({
      eventId: "fix6-worker",
      laneId: "live-worker",
      agentId: "live-worker",
      threadId: "thread-live-worker",
      eventType: "tool.finished",
      status: "running",
      startTs: start + 58_000,
      endTs: start + 120_000,
      title: "Process live delta batch",
      outputPreview: "2 new events appended.",
      toolName: "stream-normalizer",
      tokensIn: 1200,
      tokensOut: 900,
      costUsd: 0.04,
    }),
  ];

  return withMetrics({
    project: {
      projectId: "proj-live",
      name: "live-tail-observer",
      repoPath: "/Users/choegihwan/Documents/Projects/live-tail-observer",
      badge: "Live",
    },
    session: {
      sessionId: "session-fix6",
      title: "Disconnected live watch",
      owner: "Choe",
      startedAt: start,
    },
    run: {
      traceId: "trace-fix-006",
      title: "FIX-006 Disconnected live watch run",
      status: "running",
      startTs: start,
      endTs: null,
      durationMs: 120_000,
      environment: "Live",
      liveMode: "live",
      summaryMetrics: {
        totalDurationMs: 0,
        activeTimeMs: 0,
        idleTimeMs: 0,
        longestGapMs: 0,
        agentCount: 0,
        peakParallelism: 0,
        llmCalls: 0,
        toolCalls: 0,
        tokens: 0,
        costUsd: 0,
        errorCount: 0,
      },
      finalArtifactId: null,
      selectedByDefaultId: "fix6-worker",
      rawIncluded: false,
      noRawStorage: true,
      isArchived: false,
    },
    lanes,
    events,
    edges: [edge("edge-fix6", "handoff", "live-main", "live-worker", "fix6-handoff", "fix6-worker", "Live delta handed to worker")],
    artifacts: [],
  });
}

function buildFix007(): RunDataset {
  const start = baseTime + 3_600_000;
  const lanes = [
    lane("err-main", "Orchestrator", "orchestrator", "gpt-5.3-codex-spark", "Main", "done"),
    lane("err-gibbs", "Gibbs", "explorer", "gpt-5.4", "Scout", "interrupted"),
    lane("err-pasteur", "Pasteur", "researcher", "gpt-5.4", "Research", "running"),
    lane("err-hume", "Hume", "explorer", "gpt-5.4", "Scout", "running"),
  ];
  const events = [
    event({
      eventId: "fix7-start",
      laneId: "err-main",
      agentId: "err-main",
      threadId: "thread-err-main",
      eventType: "run.started",
      status: "running",
      startTs: start,
      endTs: start + 10_000,
      title: "Run started",
    }),
    event({
      eventId: "fix7-spawn",
      laneId: "err-main",
      agentId: "err-main",
      threadId: "thread-err-main",
      eventType: "agent.spawned",
      status: "running",
      startTs: start + 12_000,
      endTs: start + 30_000,
      title: "Spawn 3 agents",
      outputPreview: "Exploring codebase from multiple angles.",
    }),
    event({
      eventId: "fix7-gibbs-work",
      laneId: "err-gibbs",
      agentId: "err-gibbs",
      threadId: "thread-err-gibbs",
      eventType: "error",
      status: "failed",
      startTs: start + 35_000,
      endTs: start + 90_000,
      title: "Usage limit hit",
      errorMessage: "You've hit your usage limit",
      outputPreview: "Agent errored during exploration.",
    }),
    event({
      eventId: "fix7-pasteur-work",
      laneId: "err-pasteur",
      agentId: "err-pasteur",
      threadId: "thread-err-pasteur",
      eventType: "tool.started",
      status: "running",
      startTs: start + 35_000,
      endTs: start + 120_000,
      title: "Research in progress",
      outputPreview: "Scanning documentation and tests.",
    }),
    event({
      eventId: "fix7-hume-work",
      laneId: "err-hume",
      agentId: "err-hume",
      threadId: "thread-err-hume",
      eventType: "tool.started",
      status: "running",
      startTs: start + 35_000,
      endTs: start + 100_000,
      title: "Exploring structure",
      outputPreview: "Mapping module boundaries.",
    }),
    event({
      eventId: "fix7-wait",
      laneId: "err-main",
      agentId: "err-main",
      threadId: "thread-err-main",
      eventType: "tool.started",
      status: "done",
      startTs: start + 130_000,
      endTs: start + 150_000,
      title: "Wait for agents",
      toolName: "wait_agent",
    }),
  ];

  return withMetrics({
    project: {
      projectId: "proj-observatory",
      name: "codex-multi-agent-monitor",
      repoPath: "/Users/choegihwan/Documents/Projects/codex-multi-agent-monitor",
      badge: "Desktop",
    },
    session: {
      sessionId: "session-fix7",
      title: "만약 니가 멀티 에이전트 탐색",
      owner: "Choe",
      startedAt: start,
    },
    run: {
      traceId: "trace-fix-007",
      title: "FIX-007 Errored subagent run",
      status: "done",
      startTs: start,
      endTs: start + 150_000,
      durationMs: 150_000,
      environment: "Desktop",
      liveMode: "imported",
      summaryMetrics: {
        totalDurationMs: 0,
        activeTimeMs: 0,
        idleTimeMs: 0,
        longestGapMs: 0,
        agentCount: 0,
        peakParallelism: 0,
        llmCalls: 0,
        toolCalls: 0,
        tokens: 0,
        costUsd: 0,
        errorCount: 1,
      },
      finalArtifactId: null,
      selectedByDefaultId: "fix7-gibbs-work",
      rawIncluded: false,
      noRawStorage: true,
      isArchived: false,
    },
    lanes,
    events,
    edges: [
      edge("edge-fix7-spawn-gibbs", "spawn", "err-main", "err-gibbs", "fix7-spawn", "fix7-gibbs-work", "Gibbs explores codebase"),
      edge("edge-fix7-spawn-pasteur", "spawn", "err-main", "err-pasteur", "fix7-spawn", "fix7-pasteur-work", "Pasteur researches docs"),
      edge("edge-fix7-spawn-hume", "spawn", "err-main", "err-hume", "fix7-spawn", "fix7-hume-work", "Hume maps structure"),
      edge("edge-fix7-merge", "merge", "err-gibbs", "err-main", "fix7-gibbs-work", "fix7-wait", "Errored agent result collected"),
    ],
    artifacts: [],
  });
}

export const FIXTURE_DATASETS = [
  buildFix001(),
  buildFix002(),
  buildFix003(),
  buildFix004(),
  buildFix005(),
  buildFix006(),
  buildFix007(),
];

const FIXTURE_BY_ID = Object.fromEntries(
  FIXTURE_DATASETS.map((dataset) => [dataset.run.traceId, dataset]),
) as Record<string, RunDataset>;

const FIXTURE_IMPORT_PAYLOAD = {
  project: FIXTURE_BY_ID["trace-fix-005"].project,
  session: FIXTURE_BY_ID["trace-fix-005"].session,
  run: {
    ...FIXTURE_BY_ID["trace-fix-005"].run,
    summaryMetrics: undefined,
    durationMs: undefined,
  },
  lanes: FIXTURE_BY_ID["trace-fix-005"].lanes,
  events: FIXTURE_BY_ID["trace-fix-005"].events.map((item) => ({
    event_id: item.eventId,
    lane_id: item.laneId,
    agent_id: item.agentId,
    thread_id: item.threadId,
    parent_id: item.parentId,
    event_type: item.eventType,
    status: item.status,
    wait_reason: item.waitReason,
    retry_count: item.retryCount,
    start_ts: item.startTs,
    end_ts: item.endTs,
    title: item.title,
    input_preview: item.inputPreview,
    output_preview: item.outputPreview,
    input_raw: item.rawInput,
    output_raw: item.rawOutput,
    artifact_id: item.artifactId,
    error_code: item.errorCode,
    error_message: item.errorMessage,
    provider: item.provider,
    model: item.model,
    tool_name: item.toolName,
    tokens_in: item.tokensIn,
    tokens_out: item.tokensOut,
    reasoning_tokens: item.reasoningTokens,
    cache_read_tokens: item.cacheReadTokens,
    cache_write_tokens: item.cacheWriteTokens,
    cost_usd: item.costUsd,
    finish_reason: item.finishReason,
  })),
  edges: FIXTURE_BY_ID["trace-fix-005"].edges,
  artifacts: FIXTURE_BY_ID["trace-fix-005"].artifacts,
};

export const FIXTURE_IMPORT_TEXT = JSON.stringify(FIXTURE_IMPORT_PAYLOAD, null, 2);

export const LIVE_FIXTURE_FRAMES: LiveWatchFrame[] = [
  {
    delayMs: 2_000,
    events: [
      event({
        eventId: "fix6-follow-up",
        laneId: "live-worker",
        agentId: "live-worker",
        threadId: "thread-live-worker",
        eventType: "note",
        status: "running",
        startTs: baseTime + 3_140_000,
        endTs: baseTime + 3_150_000,
        title: "Live delta batch 2",
        outputPreview: "User scrolled away from latest event.",
      }),
    ],
  },
  {
    delayMs: 5_000,
    events: [],
    status: "stale",
    connection: "stale",
  },
  {
    delayMs: 9_000,
    events: [],
    status: "disconnected",
    connection: "disconnected",
  },
  {
    delayMs: 13_000,
    events: [
      event({
        eventId: "fix6-reconnect",
        laneId: "live-main",
        agentId: "live-main",
        threadId: "thread-live-main",
        eventType: "note",
        status: "running",
        startTs: baseTime + 3_180_000,
        endTs: baseTime + 3_190_000,
        title: "Reconnect applied",
        outputPreview: "Selection remains on previously focused event.",
      }),
    ],
    status: "running",
    connection: "reconnected",
  },
];
