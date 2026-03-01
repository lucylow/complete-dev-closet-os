"""
CLOSET.OS — Hyperparameter Trial Management: FastAPI Router

Endpoints:
  POST /trials/create          — Log a new Optuna trial
  GET  /trials/best/{agent}    — Fetch top-performing eligible trial
  POST /trials/promote         — Auto-promote best eligible trial
  POST /trials/rollback        — Rollback deployed trial
  POST /trials/monitor         — Ingest hourly monitoring snapshot
  GET  /trials/{trial_id}      — Get a specific trial by ID
  GET  /trials/                — List trials for an agent
"""
from __future__ import annotations

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from analytics.database import acquire
from analytics.models import (
    BestTrialResponse,
    MonitoringSnapshot,
    PromotionResult,
    RollbackRequest,
    RollbackResult,
    TrialCreate,
    TrialResponse,
)
from analytics.promotion import promote_best_trial, rollback_trial

logger = logging.getLogger("analytics.router")
router = APIRouter(prefix="/trials", tags=["Hyperparameter Trials"])


# ── POST /trials/create ──────────────────────────────────────────────────────
@router.post("/create", response_model=TrialResponse, status_code=201)
async def create_trial(body: TrialCreate) -> TrialResponse:
    """Log a new hyperparameter trial result from Optuna."""
    async with acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO agent_tuning_trials
                (agent_name, hyperparameters, f1_score, latency_ms, user_approval_rate, sample_count)
            VALUES ($1, $2::jsonb, $3, $4, $5, $6)
            RETURNING *
            """,
            body.agent_name,
            json.dumps(body.hyperparameters),
            body.f1_score,
            body.latency_ms,
            body.user_approval_rate,
            body.sample_count,
        )
    return TrialResponse(**dict(row))


# ── GET /trials/best/{agent_name} ────────────────────────────────────────────
@router.get("/best/{agent_name}", response_model=BestTrialResponse)
async def get_best_trial(agent_name: str) -> BestTrialResponse:
    """Return the top-performing trial for an agent with promotion eligibility."""
    async with acquire() as conn:
        baseline = await conn.fetchrow(
            "SELECT * FROM agent_baselines WHERE agent_name=$1", agent_name
        )
        if not baseline:
            raise HTTPException(status_code=404, detail=f"No baseline for agent '{agent_name}'")

        trial = await conn.fetchrow(
            """
            SELECT * FROM agent_tuning_trials
            WHERE agent_name=$1 AND rollback_reason IS NULL
            ORDER BY f1_score DESC LIMIT 1
            """,
            agent_name,
        )
        if not trial:
            raise HTTPException(status_code=404, detail=f"No trials found for agent '{agent_name}'")

    baseline_f1 = baseline["baseline_f1"]
    min_f1 = baseline_f1 * (1 + baseline["promotion_threshold"])
    improvement = (trial["f1_score"] - baseline_f1) / baseline_f1

    eligible = (
        trial["f1_score"] >= min_f1
        and trial["latency_ms"] <= baseline["max_latency_ms"]
        and trial["sample_count"] >= baseline["min_sample_count"]
        and not trial["deployed"]
    )

    return BestTrialResponse(
        trial_id=trial["trial_id"],
        agent_name=agent_name,
        hyperparameters=json.loads(trial["hyperparameters"]) if isinstance(trial["hyperparameters"], str) else dict(trial["hyperparameters"]),
        f1_score=trial["f1_score"],
        latency_ms=trial["latency_ms"],
        sample_count=trial["sample_count"],
        improvement_over_baseline=round(improvement, 4),
        eligible_for_promotion=eligible,
    )


# ── POST /trials/promote ─────────────────────────────────────────────────────
@router.post("/promote", response_model=PromotionResult)
async def promote_trial(
    agent_name: str = Query(..., description="Agent to promote"),
    traffic_pct: float = Query(10.0, ge=1.0, le=100.0, description="% traffic to route to new params"),
) -> PromotionResult:
    """Find and promote the best eligible trial. Dispatches Slack + webhook alerts."""
    try:
        result = await promote_best_trial(agent_name, traffic_pct=traffic_pct)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return result


# ── POST /trials/rollback ────────────────────────────────────────────────────
@router.post("/rollback", response_model=RollbackResult)
async def rollback(body: RollbackRequest) -> RollbackResult:
    """Rollback the currently deployed trial for an agent."""
    result = await rollback_trial(body.agent_name, body.reason)
    if not result.success:
        raise HTTPException(status_code=404, detail=result.message)
    return result


# ── POST /trials/monitor ─────────────────────────────────────────────────────
@router.post("/monitor", status_code=204)
async def ingest_monitoring_snapshot(body: MonitoringSnapshot) -> None:
    """
    Ingest an hourly approval-rate snapshot and trigger auto-rollback check.
    Called by monitoring cron job.
    """
    from analytics.promotion import check_auto_rollback

    async with acquire() as conn:
        await conn.execute(
            """
            INSERT INTO trial_monitoring_snapshots
                (trial_id, agent_name, user_approval_rate, sample_count)
            VALUES ($1, $2, $3, $4)
            """,
            body.trial_id, body.agent_name, body.user_approval_rate, body.sample_count,
        )
        # Also update the trial record's approval rate with latest reading
        await conn.execute(
            "UPDATE agent_tuning_trials SET user_approval_rate=$1, updated_at=NOW() WHERE trial_id=$2",
            body.user_approval_rate, body.trial_id,
        )

    # Check if auto-rollback should be triggered
    await check_auto_rollback(body.agent_name)


# ── GET /trials/{trial_id} ───────────────────────────────────────────────────
@router.get("/{trial_id}", response_model=TrialResponse)
async def get_trial(trial_id: int) -> TrialResponse:
    """Fetch a specific trial by ID."""
    async with acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM agent_tuning_trials WHERE trial_id=$1", trial_id
        )
    if not row:
        raise HTTPException(status_code=404, detail=f"Trial {trial_id} not found")
    return TrialResponse(**dict(row))


# ── GET /trials/ ─────────────────────────────────────────────────────────────
@router.get("/", response_model=List[TrialResponse])
async def list_trials(
    agent_name: Optional[str] = Query(None),
    deployed_only: bool = Query(False),
    limit: int = Query(50, le=200),
) -> List[TrialResponse]:
    """List trials with optional agent and deployment filters."""
    conditions = ["1=1"]
    params: list = []
    idx = 1

    if agent_name:
        conditions.append(f"agent_name=${idx}")
        params.append(agent_name)
        idx += 1
    if deployed_only:
        conditions.append(f"deployed=TRUE")

    where = " AND ".join(conditions)
    params.append(limit)

    async with acquire() as conn:
        rows = await conn.fetch(
            f"SELECT * FROM agent_tuning_trials WHERE {where} ORDER BY f1_score DESC LIMIT ${idx}",
            *params,
        )
    return [TrialResponse(**dict(r)) for r in rows]
