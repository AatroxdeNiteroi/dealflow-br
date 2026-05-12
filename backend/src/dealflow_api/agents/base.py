"""Base de agente: status enum + AgentBase abstrato."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class AgentStatus(str, Enum):
    IDLE = "idle"
    WORKING = "working"
    DONE = "done"
    ERROR = "error"


@dataclass(frozen=True, slots=True)
class AgentEvent:
    agent: str
    state: AgentStatus
    detail: str | None = None


class AgentBase:
    """Contrato mínimo de um agente do motor."""

    name: str = ""
    persona: str = ""  # emoji ou ID do sprite (DESIGNER preenche depois)

    async def run(self) -> AgentEvent:
        raise NotImplementedError
