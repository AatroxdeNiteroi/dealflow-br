/* ============================================================
   App — raiz da landing Genesis Radar.

   O radar (Landing) existe desde o primeiro frame — é o fundo
   vivo do portal. O Gateway é uma camada por cima. Entrar não
   troca de tela: o portal sai e a jornada do MESMO campo começa.
   Transição sem emenda.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { Gateway } from "./Gateway";
import { Landing } from "./Landing";

type Phase = "gateway" | "entering" | "radar";

export function App() {
  const [phase, setPhase] = useState<Phase>("gateway");
  // dica de scroll — surge ao entrar e se esvai sozinha
  const [hint, setHint] = useState(false);

  const enter = useCallback(() => {
    setPhase("entering");
    setHint(true);
  }, []);
  const settled = useCallback(() => setPhase("radar"), []);

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(false), 5000);
    return () => window.clearTimeout(id);
  }, [hint]);

  return (
    <>
      {/* a cromática do radar só se revela quando o portal terminou de
          sair (fase "radar") — nunca sobreposta ao zoom de saída */}
      <Landing phase={phase} />
      {phase !== "radar" && (
        <Gateway leaving={phase === "entering"} onEnter={enter} onLeft={settled} />
      )}

      {/* notificação de entrada — dica de scroll, some sozinha */}
      <div className={hint ? "lp-hint is-shown" : "lp-hint"} role="status">
        <svg className="lp-hint__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 9l7 7 7-7" />
        </svg>
        <span>Role para baixo e mergulhe no radar.</span>
      </div>
    </>
  );
}
