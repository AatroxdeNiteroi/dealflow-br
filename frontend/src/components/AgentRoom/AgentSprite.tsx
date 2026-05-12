import { motion } from "framer-motion";
import type { AgentName, AgentState } from "../../api/client";

const PERSONAS: Record<AgentName, { icon: string; role: string }> = {
  matcher:    { icon: "🕵️", role: "match · §4.2 + §4.4" },
  estimator:  { icon: "🧮", role: "fórmula · §6.1" },
  archetypist:{ icon: "🦉", role: "classifica · §6.5" },
  designer:   { icon: "🎨", role: "ui · sprites" },
  frontend:   { icon: "🔨", role: "react · ts" },
  backend:    { icon: "🔧", role: "fastapi · sse" },
  archivist:  { icon: "📚", role: "docs · adrs" },
  auditor:    { icon: "📋", role: "qa · validation" },
};

interface Props {
  agent: AgentName;
  state: AgentState;
  index: number;
}

export default function AgentSprite({ agent, state, index }: Props) {
  const persona = PERSONAS[agent];
  const anim =
    state === "working"
      ? { scale: [1, 1.06, 1], transition: { duration: 0.7, repeat: Infinity, ease: "easeInOut" } }
      : { y: [0, -2, 0], transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } };
  return (
    <motion.div
      className="agent-tile"
      data-state={state}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
    >
      <motion.div className="icon" animate={anim as any}>{persona.icon}</motion.div>
      <div className="info">
        <div className="name">{agent}</div>
        <div className="role">{persona.role}</div>
      </div>
      <div className="state">{state}</div>
    </motion.div>
  );
}
