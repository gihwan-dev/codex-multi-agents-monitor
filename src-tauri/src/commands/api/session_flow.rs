use std::collections::HashSet;

use crate::commands::error::CommandError;
use crate::domain::models::{
    AgentSession, SessionFlowColumn, SessionFlowItem, SessionFlowItemKind, SessionFlowPayload,
    SessionLane, ThreadDetail,
};
use crate::state::AppState;

use super::thread_detail::get_thread_detail_from_db;

const USER_LANE_ID: &str = "user";

pub(super) fn get_session_flow_from_db(
    state: &AppState,
    thread_id: &str,
) -> Result<Option<SessionFlowPayload>, CommandError> {
    let detail = get_thread_detail_from_db(state, thread_id)?;
    Ok(detail.map(build_session_flow_payload))
}

fn build_session_flow_payload(detail: ThreadDetail) -> SessionFlowPayload {
    let main_lane_id = detail.thread.thread_id.clone();
    let sorted_agents = sort_agents(&detail.agents);
    let lanes = build_lanes(&detail, &sorted_agents);
    let lane_ids = lanes
        .iter()
        .map(|lane| lane.lane_id.clone())
        .collect::<HashSet<_>>();
    let mut items = build_event_items(&detail, &lane_ids, &main_lane_id);
    items.extend(build_tool_items(&detail, &lane_ids, &main_lane_id));
    items.extend(build_wait_items(&detail, &lane_ids, &main_lane_id));
    items.sort_by(|left, right| {
        left.started_at
            .cmp(&right.started_at)
            .then_with(|| left.item_id.cmp(&right.item_id))
    });

    SessionFlowPayload {
        session: detail.thread,
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

fn build_lanes(detail: &ThreadDetail, sorted_agents: &[AgentSession]) -> Vec<SessionLane> {
    let mut lanes = vec![
        SessionLane {
            lane_id: USER_LANE_ID.to_string(),
            column: SessionFlowColumn::User,
            label: "User".to_string(),
            agent_session_id: None,
            depth: 0,
            started_at: detail.thread.started_at,
            updated_at: None,
        },
        SessionLane {
            lane_id: detail.thread.thread_id.clone(),
            column: SessionFlowColumn::Main,
            label: "Main".to_string(),
            agent_session_id: None,
            depth: 0,
            started_at: detail.thread.started_at,
            updated_at: detail.thread.updated_at,
        },
    ];

    lanes.extend(sorted_agents.iter().map(|agent| SessionLane {
        lane_id: agent.session_id.clone(),
        column: SessionFlowColumn::Subagent,
        label: agent
            .agent_nickname
            .clone()
            .or_else(|| (!agent.agent_role.trim().is_empty()).then(|| agent.agent_role.clone()))
            .unwrap_or_else(|| agent.session_id.clone()),
        agent_session_id: Some(agent.session_id.clone()),
        depth: agent.depth,
        started_at: agent.started_at,
        updated_at: agent.updated_at,
    }));

    lanes
}

fn build_event_items(
    detail: &ThreadDetail,
    lane_ids: &HashSet<String>,
    main_lane_id: &str,
) -> Vec<SessionFlowItem> {
    detail
        .timeline_events
        .iter()
        .filter_map(|event| {
            let (kind, lane_id) = match event.kind.as_str() {
                "user_message" => (
                    SessionFlowItemKind::UserMessage,
                    USER_LANE_ID.to_string(),
                ),
                "commentary" => (
                    SessionFlowItemKind::Commentary,
                    resolve_session_lane_id(
                        event.agent_session_id.as_deref(),
                        lane_ids,
                        main_lane_id,
                    ),
                ),
                "final" => (
                    SessionFlowItemKind::FinalAnswer,
                    resolve_session_lane_id(
                        event.agent_session_id.as_deref(),
                        lane_ids,
                        main_lane_id,
                    ),
                ),
                "spawn" => (
                    SessionFlowItemKind::Spawn,
                    resolve_session_lane_id(
                        event.agent_session_id.as_deref(),
                        lane_ids,
                        main_lane_id,
                    ),
                ),
                _ => return None,
            };

            Some(SessionFlowItem {
                item_id: event.event_id.clone(),
                lane_id,
                kind,
                started_at: event.started_at,
                ended_at: event.ended_at,
                summary: event.summary.clone(),
                agent_session_id: event.agent_session_id.clone(),
                target_lane_id: None,
            })
        })
        .collect()
}

fn build_tool_items(
    detail: &ThreadDetail,
    lane_ids: &HashSet<String>,
    main_lane_id: &str,
) -> Vec<SessionFlowItem> {
    detail
        .tool_spans
        .iter()
        .map(|span| SessionFlowItem {
            item_id: span.call_id.clone(),
            lane_id: resolve_session_lane_id(
                span.agent_session_id.as_deref(),
                lane_ids,
                main_lane_id,
            ),
            kind: SessionFlowItemKind::ToolCall,
            started_at: span.started_at,
            ended_at: span.ended_at,
            summary: Some(span.tool_name.clone()),
            agent_session_id: span.agent_session_id.clone(),
            target_lane_id: None,
        })
        .collect()
}

fn build_wait_items(
    detail: &ThreadDetail,
    lane_ids: &HashSet<String>,
    main_lane_id: &str,
) -> Vec<SessionFlowItem> {
    detail
        .wait_spans
        .iter()
        .map(|span| {
            let lane_id = if lane_ids.contains(&span.parent_session_id) {
                span.parent_session_id.clone()
            } else {
                main_lane_id.to_string()
            };
            let agent_session_id = (lane_id != main_lane_id).then(|| span.parent_session_id.clone());

            SessionFlowItem {
                item_id: span.call_id.clone(),
                lane_id,
                kind: SessionFlowItemKind::Wait,
                started_at: span.started_at,
                ended_at: span.ended_at,
                summary: span.child_session_id.clone(),
                agent_session_id,
                target_lane_id: span.child_session_id.clone(),
            }
        })
        .collect()
}

fn resolve_session_lane_id(
    candidate: Option<&str>,
    lane_ids: &HashSet<String>,
    main_lane_id: &str,
) -> String {
    match candidate {
        Some(candidate) if lane_ids.contains(candidate) => candidate.to_string(),
        _ => main_lane_id.to_string(),
    }
}
