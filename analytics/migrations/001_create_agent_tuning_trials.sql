-- ============================================================
-- CLOSET.OS Hyperparameter Trial Management — DB Migration 001
-- ============================================================

-- Agent tuning trials: stores every Optuna trial result
CREATE TABLE IF NOT EXISTS agent_tuning_trials (
    trial_id          SERIAL PRIMARY KEY,
    agent_name        VARCHAR(50) NOT NULL,              -- 'garment_vision' | 'stylist' | 'gap_analyst'
    hyperparameters   JSONB       NOT NULL,              -- { temperature, top_p, confidence_threshold, ... }
    f1_score          FLOAT       NOT NULL,
    latency_ms        FLOAT       NOT NULL,
    user_approval_rate FLOAT      DEFAULT NULL,          -- populated post-deploy from A/B feedback
    sample_count      INTEGER     NOT NULL DEFAULT 0,    -- number of validation samples used
    deployed          BOOLEAN     NOT NULL DEFAULT FALSE,
    deployed_at       TIMESTAMP   DEFAULT NULL,
    rollback_reason   TEXT        DEFAULT NULL,
    created_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Confirmed baselines (Lucy Low confirmed 2026-03-01)
CREATE TABLE IF NOT EXISTS agent_baselines (
    agent_name        VARCHAR(50) PRIMARY KEY,
    baseline_f1       FLOAT  NOT NULL,
    baseline_latency_ms FLOAT NOT NULL,
    promotion_threshold FLOAT NOT NULL DEFAULT 0.05,    -- 5% improvement required
    max_latency_ms    FLOAT  NOT NULL,                  -- hard ceiling for promotion
    min_sample_count  INTEGER NOT NULL DEFAULT 100,
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed confirmed baselines
INSERT INTO agent_baselines (agent_name, baseline_f1, baseline_latency_ms, max_latency_ms) VALUES
    ('garment_vision', 0.72, 2800, 2500),
    ('stylist',        0.68, 3000, 3000),
    ('gap_analyst',    0.65, 2000, 2000)
ON CONFLICT (agent_name) DO UPDATE
    SET baseline_f1          = EXCLUDED.baseline_f1,
        baseline_latency_ms  = EXCLUDED.baseline_latency_ms,
        max_latency_ms       = EXCLUDED.max_latency_ms,
        updated_at           = NOW();

-- A/B traffic routing: tracks which trial is live per agent
CREATE TABLE IF NOT EXISTS agent_live_deployments (
    agent_name        VARCHAR(50) PRIMARY KEY,
    trial_id          INTEGER REFERENCES agent_tuning_trials(trial_id),
    traffic_pct       FLOAT  NOT NULL DEFAULT 10.0,     -- % of traffic to new params
    deployed_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    deployed_by       VARCHAR(100) DEFAULT 'system'
);

-- Monitoring snapshots: hourly user_approval_rate per deployed trial
CREATE TABLE IF NOT EXISTS trial_monitoring_snapshots (
    snapshot_id       SERIAL PRIMARY KEY,
    trial_id          INTEGER REFERENCES agent_tuning_trials(trial_id),
    agent_name        VARCHAR(50) NOT NULL,
    user_approval_rate FLOAT NOT NULL,
    sample_count      INTEGER NOT NULL,
    snapshot_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_trials_agent_name    ON agent_tuning_trials(agent_name);
CREATE INDEX IF NOT EXISTS idx_trials_deployed      ON agent_tuning_trials(agent_name, deployed);
CREATE INDEX IF NOT EXISTS idx_trials_f1            ON agent_tuning_trials(agent_name, f1_score DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_trial     ON trial_monitoring_snapshots(trial_id, snapshot_at DESC);
