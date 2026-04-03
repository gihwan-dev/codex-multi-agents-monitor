use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ScorecardAxis {
    Outcome,
    Trust,
    Efficiency,
    Process,
}

pub(crate) const ALL_SCORECARD_AXES: [ScorecardAxis; 4] = [
    ScorecardAxis::Outcome,
    ScorecardAxis::Trust,
    ScorecardAxis::Efficiency,
    ScorecardAxis::Process,
];
