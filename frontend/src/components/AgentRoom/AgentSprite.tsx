import { motion } from "framer-motion";
import type { AgentName, AgentState } from "../../api/client";

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

interface Props {
  agent: AgentName;
  state: AgentState;
  index: number;
}

const idleFloat = {
  y: [0, -3, 0],
  transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
};

const workingPulse = {
  scale: [1, 1.08, 1],
  transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
};

export default function AgentSprite({ agent, state, index }: Props) {
  const anim = state === "working" ? workingPulse : idleFloat;
  return (
    <motion.div
      className="agent-card"
      data-state={state}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: "easeOut" }}
      whileHover={{ scale: 1.04 }}
    >
      <motion.div className="agent-icon" animate={anim as any}>
        {PERSONAS[agent]}
      </motion.div>
      <div className="agent-name">{agent}</div>
      <div className="agent-state">{state}</div>
    </motion.div>
  );
}
