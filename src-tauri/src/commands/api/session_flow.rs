use std::collections::HashSet;

use crate::commands::error::CommandError;
use crate::domain::models::{
    AgentSession, SessionFlowItem, SessionFlowItemKind, SessionFlowPayload, SessionLane,
    SessionLaneRef, StoredEventKind,
};
use crate::state::AppState;

use super::session_read_model::load_session_detail_records;

pub(super) fn get_session_flow_from_db(
    state: &AppState,
    session_id: &str,
) -> Result<Option<SessionFlowPayload>, CommandError> {
    let detail = load_session_detail_records(state, session_id)?;
    Ok(detail.map(build_session_flow_payload))
}

fn build_session_flow_payload(
    detail: super::session_read_model::SessionDetailRecords,
) -> SessionFlowPayload {
    let main_lane = SessionLaneRef::Main {
        session_id: detail.session.session_id.clone(),
    };
    let sorted_agents = sort_agents(&detail.agents);
    let lanes = build_lanes(&detail, &sorted_agents);
    let lane_refs = lanes.iter().map(|lane| lane.lane_ref.clone()).collect::<Vec<_>>();
    let mut items = build_event_items(&detail, &lane_refs, &main_lane);
    items.extend(build_tool_items(&detail, &lane_refs, &main_lane));
    items.extend(build_wait_items(&detail, &lane_refs, &main_lane));
    items.sort_by(|left, right| {
        left.started_at
            .cmp(&right.started_at)
            .then_with(|| left.item_id.cmp(&right.item_id))
    });

    SessionFlowPayload {
        session: detail.session,
        lanes,
        items,
    }
}

fn sort_agents(agents: &[AgentSession]) -> Vec<AgentSession> {
    let mut sorted = agents.to_vec();
    sorted.sort_by(|left, right| {
        left.depth
            .cmp(&right.depth)
            .then_with(|| left.started_at.cmp(&right.started_at))
            .then_with(|| left.session_id.cmp(&right.session_id))
    });
    sorted
}

fn build_lanes(
    detail: &super::session_read_model::SessionDetailRecords,
    sorted_agents: &[AgentSession],
) -> Vec<SessionLane> {
    let mut lanes = vec![
        SessionLane {
            lane_ref: SessionLaneRef::User,
            column: crate::domain::models::SessionFlowColumn::User,
            label: "User".to_string(),
            depth: 0,
            started_at: detail.session.started_at,
            updated_at: None,
        },
        SessionLane {
            lane_ref: SessionLaneRef::Main {
                session_id: detail.session.session_id.clone(),
            },
            column: crate::domain::models::SessionFlowColumn::Main,
            label: "Main".to_string(),
            depth: 0,
            started_at: detail.session.started_at,
            updated_at: detail.session.updated_at,
        },
    ];

    lanes.extend(sorted_agents.iter().map(|agent| SessionLane {
        lane_ref: SessionLaneRef::Subagent {
            agent_session_id: agent.session_id.clone(),
        },
        column: crate::domain::models::SessionFlowColumn::Subagent,
        label: agent
            .agent_nickname
            .clone()
            .or_else(|| (!agent.agent_role.trim().is_empty()).then(|| agent.agent_role.clone()))
            .unwrap_or_else(|| agent.session_id.clone()),
        depth: agent.depth,
        started_at: agent.started_at,
        updated_at: agent.updated_at,
    }));

    lanes
}

fn build_event_items(
    detail: &super::session_read_model::SessionDetailRecords,
    lane_refs: &[SessionLaneRef],
    main_lane: &SessionLaneRef,
) -> Vec<SessionFlowItem> {
    detail
        .timeline_events
        .iter()
        .filter_map(|event| {
            let (kind, lane) = match event.kind {
                StoredEventKind::UserMessage => {
                    (SessionFlowItemKind::UserMessage, SessionLaneRef::User)
                }
                StoredEventKind::Commentary => (
                    SessionFlowItemKind::Commentary,
                    resolve_lane_ref(event.agent_session_id.as_deref(), lane_refs, main_lane),
                ),
                StoredEventKind::FinalAnswer => (
                    SessionFlowItemKind::FinalAnswer,
                    resolve_lane_ref(event.agent_session_id.as_deref(), lane_refs, main_lane),
                ),
                StoredEventKind::Spawn => (
                    SessionFlowItemKind::Spawn,
                    resolve_lane_ref(event.agent_session_id.as_deref(), lane_refs, main_lane),
                ),
                StoredEventKind::ToolCall | StoredEventKind::Wait | StoredEventKind::Unknown => {
                    return None
                }
            };

            Some(SessionFlowItem {
                item_id: event.event_id.clone(),
                lane,
                kind,
                started_at: event.started_at,
                ended_at: event.ended_at,
                summary: event.summary.clone(),
                target_lane: None,
            })
        })
        .collect()
}

fn build_tool_items(
    detail: &super::session_read_model::SessionDetailRecords,
    lane_refs: &[SessionLaneRef],
    main_lane: &SessionLaneRef,
) -> Vec<SessionFlowItem> {
    detail
        .tool_spans
        .iter()
        .map(|span| SessionFlowItem {
            item_id: span.call_id.clone(),
            lane: resolve_lane_ref(span.agent_session_id.as_deref(), lane_refs, main_lane),
            kind: SessionFlowItemKind::ToolCall,
            started_at: span.started_at,
            ended_at: span.ended_at,
            summary: Some(span.tool_name.clone()),
            target_lane: None,
        })
        .collect()
}

fn build_wait_items(
    detail: &super::session_read_model::SessionDetailRecords,
    lane_refs: &[SessionLaneRef],
    main_lane: &SessionLaneRef,
) -> Vec<SessionFlowItem> {
    let subagent_lane_ids = lane_refs
        .iter()
        .filter_map(|lane| match lane {
            SessionLaneRef::Subagent { agent_session_id } => Some(agent_session_id.clone()),
            _ => None,
        })
        .collect::<HashSet<_>>();

    detail
        .wait_spans
        .iter()
        .map(|span| {
            let lane = if subagent_lane_ids.contains(&span.parent_session_id) {
                SessionLaneRef::Subagent {
                    agent_session_id: span.parent_session_id.clone(),
                }
            } else {
                main_lane.clone()
            };
            let target_lane = span.child_session_id.as_ref().map(|agent_session_id| {
                SessionLaneRef::Subagent {
                    agent_session_id: agent_session_id.clone(),
                }
            });

            SessionFlowItem {
                item_id: span.call_id.clone(),
                lane,
                kind: SessionFlowItemKind::Wait,
                started_at: span.started_at,
                ended_at: span.ended_at,
                summary: span.child_session_id.clone(),
                target_lane,
            }
        })
        .collect()
}

fn resolve_lane_ref(
    candidate: Option<&str>,
    lane_refs: &[SessionLaneRef],
    main_lane: &SessionLaneRef,
) -> SessionLaneRef {
    match candidate {
        Some(agent_session_id)
            if lane_refs.iter().any(|lane| {
                matches!(
                    lane,
                    SessionLaneRef::Subagent {
                        agent_session_id: current
                    } if current == agent_session_id
                )
            }) =>
        {
            SessionLaneRef::Subagent {
                agent_session_id: agent_session_id.to_string(),
            }
        }
        _ => main_lane.clone(),
    }
}
