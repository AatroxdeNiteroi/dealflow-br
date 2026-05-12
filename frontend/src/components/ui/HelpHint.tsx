import { useCallback, useRef, useState, type ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
}

const POPOVER_WIDTH = 280;
const MARGIN = 16;

export default function HelpHint({ title, children }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [placement, setPlacement] = useState<"start" | "end">("start");
  const [vertical, setVertical] = useState<"down" | "up">("down");

  const reposition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // horizontal — se popover crescendo pra direita estouraria, alinha pela direita
    if (rect.left + POPOVER_WIDTH > vw - MARGIN) {
      setPlacement("end");
    } else {
      setPlacement("start");
    }
    // vertical — se há pouco espaço abaixo, abre pra cima
    if (rect.bottom + 200 > vh - MARGIN) {
      setVertical("up");
    } else {
      setVertical("down");
    }
  }, []);

  return (
    <span
      ref={wrapRef}
      className="help-hint"
      tabIndex={0}
      onMouseEnter={reposition}
      onFocus={reposition}
    >
      <span className="help-icon" aria-hidden="true">?</span>
      <span
        className={`help-popover help-popover--h-${placement} help-popover--v-${vertical}`}
        role="tooltip"
      >
        {title && <div className="hp-title">{title}</div>}
        {children}
      </span>
    </span>
  );
}
