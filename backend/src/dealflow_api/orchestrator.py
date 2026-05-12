"""Orquestrador — coordena execução dos agentes do motor + emite eventos pro SSE.

Placeholder; em iteração futura, este módulo:
  1. Recebe um trigger (refresh dataset, recalcular range, etc.)
  2. Dispara agentes na ordem: MATCHER → ESTIMATOR → ARCHETYPIST
  3. A cada transição de estado, publica evento numa queue lida pelo SSE.
"""

from __future__ import annotations

import asyncio
from typing import AsyncGenerator

from .agents.archetypist import Archetypist
from .agents.base import AgentEvent
from .agents.estimator import Estimator
from .agents.matcher import Matcher


async def run_pipeline() -> AsyncGenerator[AgentEvent, None]:
    for agent in (Matcher(), Estimator(), Archetypist()):
        ev = await agent.run()
        yield ev
        await asyncio.sleep(0)
