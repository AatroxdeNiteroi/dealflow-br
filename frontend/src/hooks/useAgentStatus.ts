import { useEffect, useState } from "react";
import { subscribeAgents, type AgentName, type AgentState } from "../api/client";

const ALL_AGENTS: AgentName[] = [
  "matcher", "estimator", "archetypist",
  "designer", "frontend", "backend",
  "archivist", "auditor",
];

export function useAgentStatus(): Record<AgentName, AgentState> {
  const [statuses, setStatuses] = useState<Record<AgentName, AgentState>>(
    () => Object.fromEntries(ALL_AGENTS.map((a) => [a, "idle"])) as Record<AgentName, AgentState>,
  );

  useEffect(() => {
    const unsub = subscribeAgents((ev) => {
      setStatuses((prev) => ({ ...prev, [ev.agent]: ev.state }));
    });
    return unsub;
  }, []);

  return statuses;
}
