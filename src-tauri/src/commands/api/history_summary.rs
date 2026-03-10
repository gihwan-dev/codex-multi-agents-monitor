use chrono::Utc;

use crate::domain::{
    BottleneckSnapshot, HistorySummary, HistorySummaryPayload,
};

pub(super) fn build_history_summary() -> HistorySummaryPayload {
    let generated_at = Utc::now();

    HistorySummaryPayload {
        history: HistorySummary {
            from_date: generated_at.date_naive().to_string(),
            to_date: generated_at.date_naive().to_string(),
            average_duration_ms: None,
            timeout_count: 0,
            spawn_count: 0,
        },
        bottleneck: BottleneckSnapshot {
            generated_at,
            slow_threads: Vec::new(),
            longest_wait_ms: None,
        },
    }
}
