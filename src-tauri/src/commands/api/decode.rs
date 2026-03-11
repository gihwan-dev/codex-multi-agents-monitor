use chrono::{DateTime, Utc};

use crate::commands::error::CommandError;
use crate::domain::models::SessionStatus;

pub(super) fn parse_timestamp(value: Option<String>) -> Option<DateTime<Utc>> {
    value.and_then(|value| {
        DateTime::parse_from_rfc3339(&value)
            .ok()
            .map(|parsed| parsed.with_timezone(&Utc))
    })
}

pub(super) fn parse_status(value: &str) -> SessionStatus {
    match value {
        "completed" => SessionStatus::Completed,
        "failed" => SessionStatus::Failed,
        _ => SessionStatus::Inflight,
    }
}

pub(super) fn parse_required_timestamp(value: String) -> Result<DateTime<Utc>, CommandError> {
    DateTime::parse_from_rfc3339(&value)
        .map(|parsed| parsed.with_timezone(&Utc))
        .map_err(|error| CommandError::Internal(error.to_string()))
}

pub(super) fn parse_duration(value: Option<i64>) -> Option<u64> {
    value.and_then(|value| u64::try_from(value).ok())
}
