"""
CLOSET.OS — Hyperparameter Trial Management: Pydantic Models
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, validator


# ── Agent names enum ────────────────────────────────────────────────────────
VALID_AGENTS = {"garment_vision", "stylist", "gap_analyst"}


class TrialCreate(BaseModel):
    """Payload for logging a new Optuna trial result."""
    agent_name: str = Field(..., description="One of: garment_vision, stylist, gap_analyst")
    hyperparameters: Dict[str, Any] = Field(..., description="Key-value of tuned params")
    f1_score: float = Field(..., ge=0.0, le=1.0)
    latency_ms: float = Field(..., gt=0)
    sample_count: int = Field(..., ge=1)
    user_approval_rate: Optional[float] = Field(None, ge=0.0, le=1.0)

    @validator("agent_name")
    def validate_agent(cls, v: str) -> str:
        if v not in VALID_AGENTS:
            raise ValueError(f"agent_name must be one of {VALID_AGENTS}")
        return v


class TrialResponse(BaseModel):
    """Full trial record returned from DB."""
    trial_id: int
    agent_name: str
    hyperparameters: Dict[str, Any]
    f1_score: float
    latency_ms: float
    user_approval_rate: Optional[float]
    sample_count: int
    deployed: bool
    deployed_at: Optional[datetime]
    rollback_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BestTrialResponse(BaseModel):
    """Top-performing trial for a given agent."""
    trial_id: int
    agent_name: str
    hyperparameters: Dict[str, Any]
    f1_score: float
    latency_ms: float
    sample_count: int
    improvement_over_baseline: float  # percentage points e.g. 0.12 = +12%
    eligible_for_promotion: bool


class PromotionResult(BaseModel):
    """Result of a promotion attempt."""
    success: bool
    trial_id: Optional[int]
    agent_name: str
    message: str
    previous_f1: Optional[float]
    new_f1: Optional[float]
    improvement_pct: Optional[float]
    traffic_pct: float = 10.0  # default A/B split


class RollbackRequest(BaseModel):
    """Request body for rolling back a deployed trial."""
    agent_name: str
    reason: str = Field(..., min_length=5, description="Human-readable rollback reason")

    @validator("agent_name")
    def validate_agent(cls, v: str) -> str:
        if v not in VALID_AGENTS:
            raise ValueError(f"agent_name must be one of {VALID_AGENTS}")
        return v


class RollbackResult(BaseModel):
    """Result of a rollback operation."""
    success: bool
    agent_name: str
    rolled_back_trial_id: Optional[int]
    message: str


class MonitoringSnapshot(BaseModel):
    """Hourly approval-rate snapshot posted by monitoring cron."""
    trial_id: int
    agent_name: str
    user_approval_rate: float = Field(..., ge=0.0, le=1.0)
    sample_count: int = Field(..., ge=1)
