from __future__ import annotations

from datetime import date
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _stringify_id(value: object) -> str | None:
    if value is None:
        return None
    return str(value)


WorkoutAnalyticsRange = Literal["4w", "8w", "12w", "24w", "all"]
WorkoutAnalyticsHistoryStatusFilter = Literal["all", "in_progress", "completed", "abandoned"]
WorkoutAnalyticsCalendarWeekStatus = Literal["none", "in_progress", "completed", "abandoned"]
RepRangeColorToken = Literal["navy", "sky", "emerald", "amber", "rose", "violet"]


class RepRangeBucketBase(BaseModel):
    min_reps: int = Field(ge=1)
    max_reps: Optional[int] = Field(default=None, ge=1)


class RepRangeBucketUpsert(RepRangeBucketBase):
    model_config = ConfigDict(extra="forbid")

    id: Optional[str] = Field(default=None, min_length=1, max_length=50)
    label: Optional[str] = Field(default=None, min_length=1, max_length=50)
    color_token: Optional[RepRangeColorToken] = None


class RepRangeBucketResponse(RepRangeBucketBase):
    id: str
    label: str
    color_token: RepRangeColorToken


class WorkoutAnalyticsPreferencesResponse(BaseModel):
    rep_ranges: List[RepRangeBucketResponse] = Field(default_factory=list)


class WorkoutAnalyticsPreferencesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rep_ranges: List[RepRangeBucketUpsert]


class WorkoutAnalyticsSummaryResponse(BaseModel):
    total_sessions: int = 0
    sessions_in_range: int = 0
    active_days: int = 0
    total_volume_kg: float = 0.0
    avg_duration_minutes: float = 0.0


class RepRangeChartPointResponse(BaseModel):
    week_start: date
    totals: Dict[str, float] = Field(default_factory=dict)


class ExerciseTrendSummaryResponse(BaseModel):
    exercise_id: str
    exercise_name: str
    sessions_count: int = 0
    last_performed_on: Optional[date] = None
    latest_best_weight_kg: Optional[float] = None
    best_weight_delta_kg: Optional[float] = None
    sparkline_points: List[float] = Field(default_factory=list)

    @field_validator("exercise_id", mode="before")
    @classmethod
    def serialize_exercise_id(cls, value: object) -> str | None:
        return _stringify_id(value)


class RecentWorkoutHistoryItemResponse(BaseModel):
    workout_log_id: str
    training_day_name: str
    performed_on_date: date
    duration_minutes: Optional[float] = None
    exercises_count: int = 0
    volume_kg: float = 0.0
    status: str

    @field_validator("workout_log_id", mode="before")
    @classmethod
    def serialize_workout_log_id(cls, value: object) -> str | None:
        return _stringify_id(value)


class WorkoutAnalyticsHistoryPageResponse(BaseModel):
    total: int = 0
    items: List[RecentWorkoutHistoryItemResponse] = Field(default_factory=list)


class WorkoutAnalyticsCalendarWeekDayResponse(BaseModel):
    date: date
    status: WorkoutAnalyticsCalendarWeekStatus = "none"
    sessions_count: int = 0
    is_today: bool = False


class WorkoutAnalyticsDashboardResponse(BaseModel):
    summary: WorkoutAnalyticsSummaryResponse
    calendar_week: List[WorkoutAnalyticsCalendarWeekDayResponse] = Field(default_factory=list)
    rep_range_chart: List[RepRangeChartPointResponse] = Field(default_factory=list)
    exercise_summaries: List[ExerciseTrendSummaryResponse] = Field(default_factory=list)
    recent_history: List[RecentWorkoutHistoryItemResponse] = Field(default_factory=list)
    preferences: WorkoutAnalyticsPreferencesResponse


class ExerciseTrendPointResponse(BaseModel):
    performed_on_date: date
    best_weight_kg: Optional[float] = None
    volume_kg: float = 0.0
    reps_bucket_id: Optional[str] = None


class ExerciseTrendDetailSummaryResponse(BaseModel):
    personal_best_kg: Optional[float] = None
    total_sessions: int = 0
    first_logged_at: Optional[date] = None
    last_logged_at: Optional[date] = None


class ExerciseTrendDetailResponse(BaseModel):
    exercise_id: str
    exercise_name: str
    summary: ExerciseTrendDetailSummaryResponse
    series: List[ExerciseTrendPointResponse] = Field(default_factory=list)
    preferences: WorkoutAnalyticsPreferencesResponse

    @field_validator("exercise_id", mode="before")
    @classmethod
    def serialize_exercise_id(cls, value: object) -> str | None:
        return _stringify_id(value)
