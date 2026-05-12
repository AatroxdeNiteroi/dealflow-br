"""SSE — stream de status dos agentes pro AgentRoom no frontend."""

from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

router = APIRouter(tags=["events"])


async def _agent_events() -> AsyncGenerator[dict, None]:
    """Placeholder: emite eventos fake até integração com orchestrator."""
    agents = ["matcher", "estimator", "archetypist"]
    states = ["idle", "working", "done"]
    for agent in agents:
        for state in states:
            yield {"event": "agent_status", "data": json.dumps({"agent": agent, "state": state})}
            await asyncio.sleep(0.5)


@router.get("/agents/stream")
async def agents_stream() -> EventSourceResponse:
    return EventSourceResponse(_agent_events())
