import { motion } from "framer-motion";
import { useAgentStatus } from "../../hooks/useAgentStatus";
import type { AgentName } from "../../api/client";
import AgentSprite from "./AgentSprite";

const AGENTS: AgentName[] = [
  "matcher", "estimator", "archetypist",
  "designer", "frontend", "backend",
  "archivist", "auditor",
];

export default function AgentRoom() {
  const statuses = useAgentStatus();
  return (
    <motion.div
      className="agent-room-grid"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      {AGENTS.map((a, i) => (
        <AgentSprite key={a} agent={a} state={statuses[a]} index={i} />
      ))}
    </motion.div>
  );
}
