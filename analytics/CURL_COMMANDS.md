# CLOSET.OS — Hyperparameter Trial Management API
## Sample cURL Commands

Base URL: `http://localhost:8000`

---

### Health Check
```bash
curl -s http://localhost:8000/health | jq
```

---

### 1. Log a New Trial (POST /trials/create)
```bash
curl -s -X POST http://localhost:8000/trials/create \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "garment_vision",
    "hyperparameters": {
      "temperature": 0.3,
      "top_p": 0.9,
      "confidence_threshold": 0.75,
      "max_tokens": 512
    },
    "f1_score": 0.81,
    "latency_ms": 2100,
    "sample_count": 150
  }' | jq
```

---

### 2. Get Best Trial for Agent (GET /trials/best/{agent_name})
```bash
# Garment Vision
curl -s http://localhost:8000/trials/best/garment_vision | jq

# Stylist
curl -s http://localhost:8000/trials/best/stylist | jq

# Gap Analyst
curl -s http://localhost:8000/trials/best/gap_analyst | jq
```

---

### 3. Promote Best Trial (POST /trials/promote)
```bash
# Promote garment_vision — 10% traffic split
curl -s -X POST "http://localhost:8000/trials/promote?agent_name=garment_vision&traffic_pct=10" | jq

# Promote stylist — 20% traffic split
curl -s -X POST "http://localhost:8000/trials/promote?agent_name=stylist&traffic_pct=20" | jq
```

---

### 4. Rollback a Deployed Trial (POST /trials/rollback)
```bash
curl -s -X POST http://localhost:8000/trials/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "garment_vision",
    "reason": "User approval rate dropped 4.2% in 24h — auto-rollback threshold exceeded"
  }' | jq
```

---

### 5. Ingest Monitoring Snapshot (POST /trials/monitor)
```bash
curl -s -X POST http://localhost:8000/trials/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "trial_id": 1,
    "agent_name": "garment_vision",
    "user_approval_rate": 0.87,
    "sample_count": 320
  }'
# Returns 204 No Content on success
```

---

### 6. List Trials (GET /trials/)
```bash
# All trials for garment_vision
curl -s "http://localhost:8000/trials/?agent_name=garment_vision&limit=20" | jq

# Only deployed trials
curl -s "http://localhost:8000/trials/?deployed_only=true" | jq
```

---

### 7. Get Specific Trial (GET /trials/{trial_id})
```bash
curl -s http://localhost:8000/trials/1 | jq
```

---

## Promotion Eligibility Rules (confirmed 2026-03-01)

| Agent | Baseline F1 | Min F1 for Promotion (+5%) | Max Latency |
|---|---|---|---|
| garment_vision | 0.72 | **0.756** | 2500ms |
| stylist | 0.68 | **0.714** | 3000ms |
| gap_analyst | 0.65 | **0.683** | 2000ms |

- Minimum **100 validation samples** required for all agents
- Auto-rollback if `user_approval_rate` drops **> 3%** within 24h
- Default A/B traffic split: **10%** to new params
