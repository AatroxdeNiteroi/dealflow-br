import type { AgentName, AgentStatusEvent } from "../../types/api";

interface Props {
  agent: AgentName;
  state: AgentStatusEvent["state"];
}

const PERSONAS: Record<AgentName, string> = {
  matcher: "🕵️",
  estimator: "🧮",
  archetypist: "🦉",
  designer: "🎨",
  frontend: "🔨",
  backend: "🔧",
  archivist: "📚",
  auditor: "📋",
};

export default function AgentSprite({ agent, state }: Props) {
  // TODO: substituir emoji por <img src={`/sprites/${agent}/${state}.png`} /> quando DESIGNER entregar.
  return (
    <div className={`agent agent--${state}`} title={`${agent}: ${state}`}>
      <div className="agent-icon">{PERSONAS[agent]}</div>
      <div className="agent-name">{agent}</div>
      <div className="agent-state">{state}</div>
    </div>
  );
}
