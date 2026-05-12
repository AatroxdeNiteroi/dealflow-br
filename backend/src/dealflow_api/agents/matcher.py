"""🕵️ MATCHER — Match RAIS §4.2 (Tier 1 chave única) + cascata §4.4 (Tier 2).

Hoje o trabalho real do MATCHER vive em SQL (scripts/sql/03_matches.sql +
11_matches_tier2.sql). Este módulo expõe um adaptador Python pra mostrar
status no SSE quando o pipeline rodar.
"""

from __future__ import annotations

from .base import AgentBase, AgentEvent, AgentStatus


class Matcher(AgentBase):
    name = "matcher"
    persona = "🕵️"

    async def run(self) -> AgentEvent:
        # TODO: integrar com scripts/sql/03_matches.sql + 11_matches_tier2.sql
        return AgentEvent(agent=self.name, state=AgentStatus.DONE)
