"""
CLOSET.OS — Monitoring Hooks

Dispatches webhooks to:
  - Slack (SLACK_WEBHOOK_URL)
  - Internal channel endpoint (ANALYTICS_WEBHOOK_URL)

Events:
  - trial_promoted
  - trial_rolled_back
  - approval_rate_alert
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict

import httpx

logger = logging.getLogger("analytics.monitoring")

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
ANALYTICS_WEBHOOK_URL = os.getenv("ANALYTICS_WEBHOOK_URL", "")

# Emoji map per event type
_EMOJI: Dict[str, str] = {
    "trial_promoted": "🚀",
    "trial_rolled_back": "⏪",
    "approval_rate_alert": "🚨",
}


def _slack_blocks(event: str, payload: Dict[str, Any]) -> dict:
    """Build Slack Block Kit message."""
    emoji = _EMOJI.get(event, "📊")
    title = event.replace("_", " ").title()
    lines = "\n".join(f"• *{k}*: `{v}`" for k, v in payload.items())
    return {
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{emoji} *CLOSET.OS Analytics — {title}*\n{lines}",
                },
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"🕐 {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} | dev-analytics channel",
                    }
                ],
            },
        ]
    }


async def dispatch_webhook(event: str, payload: Dict[str, Any]) -> None:
    """Send event to Slack and/or internal analytics webhook (non-blocking)."""
    full_payload = {"event": event, "timestamp": datetime.utcnow().isoformat(), **payload}

    async with httpx.AsyncClient(timeout=5.0) as client:
        # Slack notification
        if SLACK_WEBHOOK_URL:
            try:
                await client.post(SLACK_WEBHOOK_URL, json=_slack_blocks(event, payload))
                logger.debug("Slack webhook dispatched: %s", event)
            except Exception as exc:
                logger.warning("Slack webhook failed: %s", exc)

        # Internal analytics endpoint
        if ANALYTICS_WEBHOOK_URL:
            try:
                await client.post(ANALYTICS_WEBHOOK_URL, json=full_payload)
                logger.debug("Analytics webhook dispatched: %s", event)
            except Exception as exc:
                logger.warning("Analytics webhook failed: %s", exc)

    # Always log to structured JSON log
    logger.info(json.dumps({"type": "analytics_event", **full_payload}))
