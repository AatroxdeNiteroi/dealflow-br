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
    const id = window.setTimeout(() => setHint(false), 4000);
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

      {/* notificação de entrada — dica de scroll grande, some sozinha */}
      <div className={hint ? "lp-hint is-shown" : "lp-hint"} role="status">
        <span className="lp-hint__corner lp-hint__corner--tl" aria-hidden="true" />
        <span className="lp-hint__corner lp-hint__corner--tr" aria-hidden="true" />
        <span className="lp-hint__corner lp-hint__corner--bl" aria-hidden="true" />
        <span className="lp-hint__corner lp-hint__corner--br" aria-hidden="true" />
        <svg className="lp-hint__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7l8 7 8-7M4 13l8 7 8-7" />
        </svg>
        <span className="lp-hint__title">Role para baixo</span>
        <span className="lp-hint__sub">
          A jornada segue pelo scroll — até o fim da página.
        </span>
      </div>
    </>
  );
}
