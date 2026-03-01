"""
CLOSET.OS — Hyperparameter Trial Management API
FastAPI entry point with lifespan DB pool management.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from analytics.database import close_pool, init_pool, run_migration
from analytics.router import router

# ── Logging (JSON to /logs/) ─────────────────────────────────────────────────
LOG_DIR = Path(os.getenv(
    "LOG_DIR",
    "/mnt/efs/spaces/09ac86bc-ec9e-4572-ab99-cfd9d18ccd5d/34dcfa13-9bb4-4832-bd2b-cb9e2d8824ef/logs"
))
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "msg": %(message)s}',
    handlers=[
        logging.FileHandler(LOG_DIR / "analytics_api.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("analytics.main")


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info('"Starting CLOSET.OS Analytics API — initializing DB pool"')
    await init_pool()

    # Run migration on startup (idempotent IF NOT EXISTS)
    migration_path = Path(__file__).parent / "migrations" / "001_create_agent_tuning_trials.sql"
    if migration_path.exists():
        await run_migration(str(migration_path))
        logger.info('"DB migration 001 applied"')

    yield  # ← app is live here

    logger.info('"Shutting down — closing DB pool"')
    await close_pool()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CLOSET.OS Hyperparameter Trial Management",
    description=(
        "Stores, evaluates, and auto-promotes hyperparameter trials for "
        "Garment Vision, Stylist, and Gap Analyst agents. "
        "Auto-rollback triggers if user approval rate drops >3% in 24h."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics-trial-management"}
