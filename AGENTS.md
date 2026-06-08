# AGENTS

## Mission
Build and maintain the Genesis Conductor Seismic Command console: a unified, user-ready interface for S-ToT metrics,
procedural visualization, and assistant integrations.

## Core Loops
- Keep the seismic dashboard responsive and live.
- Preserve the liquid/procedural aesthetic.
- Maintain integration endpoints for OpenAI and Anthropic with safe defaults.

## Key Files
- `app/main.py` — FastAPI server + API endpoints
- `app/data_sources.py` — local + live seismic providers
- `app/chat_providers.py` — OpenAI + Anthropic connectors
- `app/static/index.html` — UI shell
- `app/static/app.js` — UI logic + canvas
- `app/static/styles.css` — design system

## Operational Notes
- Use `DATA_SOURCE` env var to set the default data mode (`auto`, `live`, `local`).
- Set `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` for assistant calls.
- `REMOTE_SEISMIC_BASE` controls live API routing.
