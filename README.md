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


## Closet.OS Website ( Brown Color Landing Page) 
https://c9jgfp3s.run.complete.dev

## Complete.Dev Generated Pitchdeck 
https://c9jgfp3s.run.complete.dev/pitch

## Closet.OS Final Demo 
https://c9jgfp3s.run.complete.dev/demo

## Rule Engine 
https://6yh1fypu.run.complete.dev/?_gl=1*1pb4kn6*_gcl_au*MjAzNDgyMjExOS4xNzcyMTE0MTY5LjUzNzU1MDYyOS4xNzcyMzMwNzI3LjE3NzIzMzA3Nzk.*_ga*MTI1OTU1MDczNS4xNzcyMTE0MTgw*_ga_1T2V9CPT2Q*czE3NzIzMzAzMTgkbzEkZzEkdDE3NzIzMzA3NzkkajckbDAkaDE0OTA2NDY0NTQ.

## AI Model 
https://gtje6wpw.run.complete.dev/?_gl=1*1ik6ini*_gcl_au*MjAzNDgyMjExOS4xNzcyMTE0MTY5LjEwMzAxMzEyMDguMTc3MjM4MjY1OS4xNzcyMzgzNzA4*_ga*MTI1OTU1MDczNS4xNzcyMTE0MTgw*_ga_1T2V9CPT2Q*czE3NzIzODI2NTkkbzUkZzEkdDE3NzIzODM3MDgkajYwJGwwJGgxNzYyMjU5MTY4

## Marketing Website (alternative) White Background
https://nr9gh2v1.run.complete.dev/?_gl=1*dk69wl*_gcl_au*NTY2NzExODY1LjE3NzIxNTk0NTUuMTQ1MjU5OTE3NC4xNzcyMjMyMzgyLjE3NzIyMzIzODI.*_ga*MTY4NDIzNDQ5OS4xNzcyMTU5NDU1*_ga_1T2V9CPT2Q*czE3NzIyMzIzODIkbzMkZzAkdDE3NzIyMzIzODIkajYwJGwwJGg1NDg3NjgyNjY.

## API Calls
https://c9jgfp3s.run.complete.dev/api/v1/docs

## Natively Mobile App ( ran out of tokens) 
https://natively.dev/project/9a85dbbf-ddbb-42af-a109-ae8a52fe1280
