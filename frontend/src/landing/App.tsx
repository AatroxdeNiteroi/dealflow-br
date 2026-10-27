/* ============================================================
   App — raiz da landing Genesis Radar.

   O radar (Landing) existe desde o primeiro frame — é o fundo
   vivo do portal. O Gateway é uma camada por cima. Entrar não
   troca de tela: o portal sai e a jornada do MESMO campo começa.
   Transição sem emenda.

   Fases: gateway → entering → radar. `quiet` (Ver planos em fila,
   ?auth=plans) é a entrada silenciosa: sem onboarding, a saída do
   Gateway cobre com o véu e o teleporte assume. A dica "Role para
   baixo" agora é o onboarding do dock (cinema/guide), não um toast.
   ============================================================ */

import { useCallback, useState } from "react";
import { Gateway } from "./Gateway";
import { Landing } from "./Landing";
import type { Phase } from "./cinema/types";

export function App() {
  const [phase, setPhase] = useState<Phase>("gateway");
  // entrada silenciosa: destino certo em fila (ex.: teleporte pros planos)
  const [quiet, setQuiet] = useState(false);
  // onboarding ("Role para baixo") nesta entrada — só na entrada normal
  const [onboard, setOnboard] = useState(false);

  const enter = useCallback((q?: boolean) => {
    setPhase("entering");
    setQuiet(!!q);
    setOnboard(!q);
  }, []);
  const settled = useCallback(() => setPhase("radar"), []);
  // item 8: volta à tela de abertura (botão da marca no header). Pura reversão
  // de estado — nunca reload — para o pop-up de login (deep-link ?auth=) NÃO
  // reaparecer. Remontar o Gateway re-toca seu boot (véu + logo); a próxima
  // entrada normal mostra o onboarding de novo.
  const returnHome = useCallback(() => {
    setOnboard(false);
    setPhase("gateway");
  }, []);

  return (
    <>
      {/* a cromática do radar só se revela quando o portal terminou de
          sair (fase "radar") — nunca sobreposta ao zoom de saída */}
      <Landing phase={phase} onEnter={enter} onReturnHome={returnHome} onboard={onboard} />
      {phase !== "radar" && (
        <Gateway leaving={phase === "entering"} quiet={quiet} onEnter={enter} onLeft={settled} />
      )}
    </>
  );
}
