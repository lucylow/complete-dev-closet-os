"""
CLOSET.OS — Hyperparameter Promotion Engine

Promotion rules (confirmed 2026-03-01):
  - F1 improvement >= 5% over confirmed baseline
  - Latency <= max_latency_ms for that agent
  - Minimum 100 validation samples
  - Auto-rollback if user_approval_rate drops > 3% within 24h
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from analytics.database import acquire
from analytics.models import PromotionResult, RollbackResult
from analytics.monitoring import dispatch_webhook

logger = logging.getLogger("analytics.promotion")


async def get_baseline(agent_name: str) -> dict:
    """Fetch confirmed baseline metrics from DB."""
    async with acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM agent_baselines WHERE agent_name = $1", agent_name
        )
        if not row:
            raise ValueError(f"No baseline found for agent '{agent_name}'")
        return dict(row)


async def promote_best_trial(agent_name: str, traffic_pct: float = 10.0) -> PromotionResult:
    """
    Find the best eligible trial and promote it.
    Eligibility: f1 >= baseline*(1+threshold), latency <= max, sample_count >= min.
    """
    baseline = await get_baseline(agent_name)
    min_f1 = baseline["baseline_f1"] * (1 + baseline["promotion_threshold"])

    async with acquire() as conn:
        # Find best eligible trial (not yet deployed)
        trial = await conn.fetchrow(
            """
            SELECT t.*
            FROM agent_tuning_trials t
            WHERE t.agent_name = $1
              AND t.f1_score >= $2
              AND t.latency_ms <= $3
              AND t.sample_count >= $4
              AND t.deployed = FALSE
              AND t.rollback_reason IS NULL
            ORDER BY t.f1_score DESC
            LIMIT 1
            """,
            agent_name,
            min_f1,
            baseline["max_latency_ms"],
            baseline["min_sample_count"],
        )

        if not trial:
            return PromotionResult(
                success=False,
                trial_id=None,
                agent_name=agent_name,
                message=f"No eligible trial found (need F1 >= {min_f1:.4f}, "
                        f"latency <= {baseline['max_latency_ms']}ms, "
                        f"samples >= {baseline['min_sample_count']})",
                previous_f1=baseline["baseline_f1"],
                new_f1=None,
                improvement_pct=None,
            )

        trial_id = trial["trial_id"]
        new_f1 = trial["f1_score"]
        improvement_pct = (new_f1 - baseline["baseline_f1"]) / baseline["baseline_f1"] * 100

        # Mark as deployed
        await conn.execute(
            "UPDATE agent_tuning_trials SET deployed=TRUE, deployed_at=NOW(), updated_at=NOW() WHERE trial_id=$1",
            trial_id,
        )

        # Upsert live deployment record
        await conn.execute(
            """
            INSERT INTO agent_live_deployments (agent_name, trial_id, traffic_pct, deployed_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (agent_name)
            DO UPDATE SET trial_id=$2, traffic_pct=$3, deployed_at=NOW(), deployed_by='auto-promotion'
            """,
            agent_name, trial_id, traffic_pct,
        )

    result = PromotionResult(
        success=True,
        trial_id=trial_id,
        agent_name=agent_name,
        message=f"Trial {trial_id} promoted with +{improvement_pct:.1f}% F1 improvement. "
                f"A/B traffic: {traffic_pct}%.",
        previous_f1=baseline["baseline_f1"],
        new_f1=new_f1,
        improvement_pct=improvement_pct,
        traffic_pct=traffic_pct,
    )

    # Fire monitoring webhook
    await dispatch_webhook(
        event="trial_promoted",
        payload={
            "agent": agent_name,
            "trial_id": trial_id,
            "f1_before": baseline["baseline_f1"],
            "f1_after": new_f1,
            "improvement_pct": round(improvement_pct, 2),
            "traffic_pct": traffic_pct,
        },
    )

    logger.info("Promoted trial %d for %s (+%.1f%% F1)", trial_id, agent_name, improvement_pct)
    return result


async def rollback_trial(agent_name: str, reason: str) -> RollbackResult:
    """Rollback the currently deployed trial for an agent."""
    async with acquire() as conn:
        live = await conn.fetchrow(
            "SELECT trial_id FROM agent_live_deployments WHERE agent_name = $1", agent_name
        )
        if not live:
            return RollbackResult(
                success=False,
                agent_name=agent_name,
                rolled_back_trial_id=None,
                message="No active deployment found to roll back.",
            )

        trial_id = live["trial_id"]

        # Mark trial as rolled back
        await conn.execute(
            """
            UPDATE agent_tuning_trials
            SET deployed=FALSE, rollback_reason=$2, updated_at=NOW()
            WHERE trial_id=$1
            """,
            trial_id, reason,
        )

        # Remove live deployment record
        await conn.execute(
            "DELETE FROM agent_live_deployments WHERE agent_name = $1", agent_name
        )

    await dispatch_webhook(
        event="trial_rolled_back",
        payload={"agent": agent_name, "trial_id": trial_id, "reason": reason},
    )

    logger.warning("Rolled back trial %d for %s — reason: %s", trial_id, agent_name, reason)
    return RollbackResult(
        success=True,
        agent_name=agent_name,
        rolled_back_trial_id=trial_id,
        message=f"Trial {trial_id} rolled back: {reason}",
    )


async def check_auto_rollback(agent_name: str, lookback_hours: int = 24) -> None:
    """
    Compare current 24h approval-rate against the rate at deployment time.
    Auto-rollback if drop > 3%.
    """
    async with acquire() as conn:
        live = await conn.fetchrow(
            """
            SELECT ald.trial_id, ald.deployed_at
            FROM agent_live_deployments ald
            WHERE ald.agent_name = $1
            """,
            agent_name,
        )
        if not live:
            return  # nothing deployed

        trial_id = live["trial_id"]
        deployed_at: datetime = live["deployed_at"]

        # Baseline approval at deployment (first snapshot after deploy)
        baseline_snap = await conn.fetchrow(
            """
            SELECT user_approval_rate FROM trial_monitoring_snapshots
            WHERE trial_id=$1 AND snapshot_at >= $2
            ORDER BY snapshot_at ASC LIMIT 1
            """,
            trial_id, deployed_at,
        )
        # Latest approval rate (last snapshot)
        latest_snap = await conn.fetchrow(
            """
            SELECT user_approval_rate FROM trial_monitoring_snapshots
            WHERE trial_id=$1
            ORDER BY snapshot_at DESC LIMIT 1
            """,
            trial_id,
        )

    if not baseline_snap or not latest_snap:
        return  # not enough data yet

    baseline_rate = baseline_snap["user_approval_rate"]
    current_rate = latest_snap["user_approval_rate"]
    drop = baseline_rate - current_rate

    if drop >= 0.03:  # 3% absolute drop triggers rollback
        logger.warning(
            "Auto-rollback triggered for %s: approval dropped %.1f%% (%.2f → %.2f)",
            agent_name, drop * 100, baseline_rate, current_rate,
        )
        await rollback_trial(
            agent_name,
            reason=f"Auto-rollback: approval_rate dropped {drop*100:.1f}% in {lookback_hours}h "
                   f"({baseline_rate:.3f} → {current_rate:.3f})",
        )
