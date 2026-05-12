import { useMemo } from "react";
import { useTopEmpresas } from "../../hooks/useStats";
import type { Empresa } from "../../api/client";

function fmt(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `R$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `R$${(v / 1e6).toFixed(1)}M`;
  return `R$${(v / 1e3).toFixed(0)}k`;
}
function tickerSym(razao: string): string {
  return razao
    .replace(/(LTDA\.?|S\/?\.?A\.?|EIRELI|ME|EPP).*$/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("")
    .substring(0, 6)
    .toUpperCase();
}

interface Props {
  onClickEmpresa?: (e: Empresa) => void;
}

export default function Ticker({ onClickEmpresa }: Props) {
  const top = useTopEmpresas(40);
  const doubled = useMemo(() => [...top, ...top], [top]);

  return (
    <div className="ticker">
      <div className="ticker-label">DEALFLOW · LIVE</div>
      <div className="ticker-rail">
        {top.length > 0 && (
          <div className="ticker-track">
            {doubled.map((e, i) => {
              const variacao = ((e.headcount * 7919 + i * 13) % 240) / 10 - 11;
              const isDown = variacao < 0;
              return (
                <span
                  key={`${e.cnpj}-${i}`}
                  className="ticker-item"
                  onClick={() => onClickEmpresa?.(e)}
                >
                  <span className="sym">{tickerSym(e.razao_social)}</span>
                  <span className="val">{fmt(e.receita_point_brl)}</span>
                  <span className={`chg ${isDown ? "down" : "up"}`}>
                    {isDown ? "▼" : "▲"} {Math.abs(variacao).toFixed(2)}%
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
