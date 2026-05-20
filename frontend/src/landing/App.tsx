/* ============================================================
   App — raiz da landing Genesis Radar.

   O radar (Landing) existe desde o primeiro frame — é o fundo
   vivo do portal. O Gateway é uma camada por cima. Entrar não
   troca de tela: o portal sai e a jornada do MESMO campo começa.
   Transição sem emenda.
   ============================================================ */

import { useCallback, useState } from "react";
import { Gateway } from "./Gateway";
import { Landing } from "./Landing";

type Phase = "gateway" | "entering" | "radar";

export function App() {
  const [phase, setPhase] = useState<Phase>("gateway");

  const enter = useCallback(() => setPhase("entering"), []);
  const settled = useCallback(() => setPhase("radar"), []);

  return (
    <>
      <Landing revealed={phase !== "gateway"} />
      {phase !== "radar" && (
        <Gateway leaving={phase === "entering"} onEnter={enter} onLeft={settled} />
      )}
    </>
  );
}
