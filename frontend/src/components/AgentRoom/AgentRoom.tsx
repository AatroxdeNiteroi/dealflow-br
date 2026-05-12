import { useAgentStatus } from "../../hooks/useAgentStatus";
import type { AgentName } from "../../api/client";
import AgentSprite from "./AgentSprite";

const AGENTS: AgentName[] = [
  "matcher", "estimator", "archetypist", "backend",
  "frontend", "designer", "archivist", "auditor",
];

export default function AgentRoom() {
  const statuses = useAgentStatus();
  return (
    <div className="agent-grid">
      {AGENTS.map((a, i) => (
        <AgentSprite key={a} agent={a} state={statuses[a]} index={i} />
      ))}
    </div>
  );
}
