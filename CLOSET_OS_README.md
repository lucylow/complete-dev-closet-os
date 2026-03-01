# CLOSET.OS — AI Wardrobe Operating System

Live demo: https://c9jgfp3s.run.complete.dev

## Structure
```
closet-os/
├── main.py          # FastAPI app + static serving
├── agents.py        # Deploy AI callers (demo mode fallback)
├── database.py      # Async SQLAlchemy (SQLite default)
├── models.py        # ORM models
├── jobs.py          # Async job/run store
├── requirements.txt
├── static/
│   ├── index.html   # Marketing landing page
│   ├── demo.html    # Interactive demo UI
│   └── pitch.html   # Reveal.js pitch deck
└── marketing/
    ├── press_release.md
    └── email_sequences.md
```

## Quick Start
```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 3004
```

## Environment Variables
```
DEMO_MODE=true          # Use mock agent responses
CLIENT_ID=              # Deploy AI client ID
CLIENT_SECRET=          # Deploy AI client secret
GARMENT_VISION_AGENT_ID=
WEATHER_CALENDAR_AGENT_ID=
STYLIST_AGENT_ID=
GAP_ANALYST_AGENT_ID=
SUSTAINABILITY_AGENT_ID=
DATABASE_URL=sqlite+aiosqlite:///./closet_os.db
PORT=3004
```
