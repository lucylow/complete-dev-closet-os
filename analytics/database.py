"""
CLOSET.OS — Hyperparameter Trial Management: Async DB Layer (asyncpg)
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import asyncpg
from asyncpg import Pool

# ── Connection pool singleton ────────────────────────────────────────────────
_pool: Optional[Pool] = None


def _dsn() -> str:
    """Build DSN from environment variables."""
    return (
        f"postgresql://{os.getenv('DB_USER', 'postgres')}"
        f":{os.getenv('DB_PASSWORD', 'postgres')}"
        f"@{os.getenv('DB_HOST', 'localhost')}"
        f":{os.getenv('DB_PORT', '5432')}"
        f"/{os.getenv('DB_NAME', 'closetos')}"
    )


async def init_pool(min_size: int = 5, max_size: int = 20) -> Pool:
    """Initialize the asyncpg connection pool (call once at startup)."""
    global _pool
    _pool = await asyncpg.create_pool(dsn=_dsn(), min_size=min_size, max_size=max_size)
    return _pool


async def close_pool() -> None:
    """Gracefully close the pool (call on shutdown)."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> Pool:
    """Return the active pool; raises if not initialized."""
    if _pool is None:
        raise RuntimeError("DB pool not initialized. Call init_pool() first.")
    return _pool


@asynccontextmanager
async def acquire() -> AsyncGenerator[asyncpg.Connection, None]:
    """Context manager that acquires a connection from the pool."""
    async with get_pool().acquire() as conn:
        yield conn


async def run_migration(sql_path: str) -> None:
    """Execute a SQL migration file against the DB."""
    with open(sql_path, "r") as f:
        sql = f.read()
    async with acquire() as conn:
        await conn.execute(sql)
