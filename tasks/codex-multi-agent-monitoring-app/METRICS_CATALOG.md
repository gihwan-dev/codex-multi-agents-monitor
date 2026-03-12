# Dashboard metric candidates

아래는 후보를 많이 모아둔 카탈로그다. v1에 전부 넣지 않아도 되며, dashboard card / chart / anomaly feed / drill-down 중 어디에 배치할지 추후 선별한다.

## Workload volume

- `M-001` sessions per day
- `M-002` live concurrent sessions
- `M-003` archived sessions per workspace
- `M-004` average session duration
- `M-005` median turn count per session
- `M-006` active workspace count
- `M-007` sessions with sub-agents ratio

## Token usage

- `M-010` total tokens per session
- `M-011` input/output tokens per session
- `M-012` tokens per turn
- `M-013` tokens per tool span
- `M-014` tokens per agent role
- `M-015` token share by main vs sub-agents
- `M-016` token spike events
- `M-017` token burn rate over time
- `M-018` token-heavy session leaderboard
- `M-019` token efficiency per completed slice or per useful output event

## Delegation quality

- `M-020` spawn count per session
- `M-021` spawn depth
- `M-022` parallel sub-agent overlap ratio
- `M-023` wait-before-spawn latency
- `M-024` sub-agent useful output ratio
- `M-025` sub-agent idle ratio
- `M-026` handoff turnaround time
- `M-027` sub-agent abandonment rate
- `M-028` duplicate sub-agent role spawn count
- `M-029` child-to-parent result latency

## Orchestrator efficiency

- `M-030` repeated reasoning loop score
- `M-031` repeated tool call signature count
- `M-032` repeated wait/poll churn
- `M-033` no-progress turn ratio
- `M-034` planning-to-action ratio
- `M-035` commentary churn without state change
- `M-036` same-intent prompt revisit score
- `M-037` recoverable detour count
- `M-038` restart-after-abort frequency

## Tool efficiency

- `M-040` tool calls per session
- `M-041` avg tool latency
- `M-042` tool latency p95
- `M-043` tool success/failure ratio
- `M-044` tool retry count
- `M-045` most expensive tool by tokens
- `M-046` most chatty tool by output volume
- `M-047` search-to-open conversion ratio
- `M-048` shell command burst count

## Timeline and latency

- `M-050` first response latency
- `M-051` time to first tool call
- `M-052` time to first spawn
- `M-053` longest span per session
- `M-054` cumulative waiting time
- `M-055` active work vs waiting ratio
- `M-056` stuck session count
- `M-057` archive lag from last event to archive move

## Outcome quality proxies

- `M-060` completion without abort ratio
- `M-061` archive after success ratio
- `M-062` reopened-after-archive ratio
- `M-063` sessions with explicit error markers
- `M-064` sessions ending in timeout/abort
- `M-065` sessions requiring repeated clarification
- `M-066` sessions with high tool count but low output density

## Workspace analytics

- `M-070` top workspaces by sessions
- `M-071` top workspaces by total tokens
- `M-072` top workspaces by repeated-work score
- `M-073` workspace-level avg spawn depth
- `M-074` workspace-level avg live duration
- `M-075` workspace heatmap by hour/day

## Agent analytics

- `M-080` usage by agent role
- `M-081` avg lifespan by agent role
- `M-082` avg token usage by agent role
- `M-083` role-specific failure rate
- `M-084` role-specific tool mix
- `M-085` role-specific useful output latency
- `M-086` role diversity per session

## Search / archive discoverability

- `M-090` saved filter usage
- `M-091` archive search zero-result rate
- `M-092` filter-to-open conversion
- `M-093` top recurring anomaly tags
- `M-094` most revisited archived sessions

## Visual anomaly feed candidates

- `M-100` session stalled for N minutes
- `M-101` token burn spike without progress
- `M-102` repeated identical tool call loop
- `M-103` sub-agent spawned but no meaningful output
- `M-104` main agent dominates tokens despite deep delegation
- `M-105` unusually high wait ratio
- `M-106` archived session later reopened quickly

## Suggested v1 metric shortlist

- `M-010` total tokens per session
- `M-015` token share by main vs sub-agents
- `M-020` spawn count per session
- `M-024` sub-agent useful output ratio
- `M-030` repeated reasoning loop score
- `M-031` repeated tool call signature count
- `M-041` avg tool latency
- `M-054` cumulative waiting time
- `M-056` stuck session count
- `M-080` usage by agent role
