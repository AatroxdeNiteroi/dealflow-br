import { useEffect, useState } from "react";
import { subscribeAgents, type AgentStatusEvent } from "../../api/client";
import type { AgentName } from "../../types/api";
import AgentSprite from "./AgentSprite";

const AGENTS: AgentName[] = [
  "matcher",
  "estimator",
  "archetypist",
  "designer",
  "frontend",
  "backend",
  "archivist",
  "auditor",
];

export default function AgentRoom() {
  const [statuses, setStatuses] = useState<Record<string, AgentStatusEvent["state"]>>({});

  useEffect(() => {
    const unsub = subscribeAgents((ev) => {
      setStatuses((prev) => ({ ...prev, [ev.agent]: ev.state }));
    });
    return unsub;
  }, []);

  return (
    <section className="agent-room">
      <h2>Salinha dos agentes</h2>
      <div className="agent-grid">
        {AGENTS.map((a) => (
          <AgentSprite key={a} agent={a} state={statuses[a] ?? "idle"} />
        ))}
      </div>
    </section>
  );
}
