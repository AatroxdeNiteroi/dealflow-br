import { useMemo } from "react";
import { useTopEmpresas } from "../../hooks/useStats";
import type { Empresa } from "../../api/client";
import { fmtBrlCompact, tickerSym } from "../../utils/labels";

interface Props {
  onClickEmpresa?: (e: Empresa) => void;
}

export default function Ticker({ onClickEmpresa }: Props) {
  const top = useTopEmpresas(40);
  const doubled = useMemo(() => [...top, ...top], [top]);

  return (
    <div className="ticker" role="region" aria-label="Top empresas do universo">
      <div className="ticker-label">DEALFLOW · TOP</div>
      <div className="ticker-rail">
        {top.length > 0 && (
          <div className="ticker-track">
            {doubled.map((e, i) => (
              <span
                key={`${e.cnpj}-${i}`}
                className="ticker-item"
                onClick={() => onClickEmpresa?.(e)}
                role="button"
                tabIndex={0}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onClickEmpresa?.(e);
                  }
                }}
              >
                <span className="sym">{tickerSym(e.razao_social)}</span>
                <span className="val">{fmtBrlCompact(e.receita_point_brl)}</span>
                <span className="sub">{e.headcount.toLocaleString("pt-BR")}f</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
