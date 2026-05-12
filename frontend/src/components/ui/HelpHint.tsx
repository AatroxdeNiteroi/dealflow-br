import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
}

const POPOVER_WIDTH = 280;
const MARGIN = 12;
const GAP = 10; // distância entre trigger e popover

interface Pos {
  top: number;
  left: number;
  arrow: { side: "top" | "bottom"; x: number };
}

export default function HelpHint({ title, children }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);

  const reposition = useCallback(() => {
    const triggerEl = wrapRef.current;
    const popEl = popRef.current;
    if (!triggerEl || !popEl) return;

    const trig = triggerEl.getBoundingClientRect();
    const popH = popEl.offsetHeight || 80;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: tenta centralizar no trigger; clamp para caber no viewport
    const triggerCenterX = trig.left + trig.width / 2;
    let left = triggerCenterX - POPOVER_WIDTH / 2;
    left = Math.max(MARGIN, Math.min(left, vw - POPOVER_WIDTH - MARGIN));

    // Vertical: prefere abaixo; se não couber, fica acima
    const spaceBelow = vh - trig.bottom - MARGIN;
    const spaceAbove = trig.top - MARGIN;
    const side: "top" | "bottom" = spaceBelow >= popH + GAP || spaceBelow >= spaceAbove ? "bottom" : "top";
    const top = side === "bottom" ? trig.bottom + GAP : trig.top - popH - GAP;

    // Arrow: aponta para o centro do trigger
    const arrowX = Math.max(12, Math.min(triggerCenterX - left, POPOVER_WIDTH - 12));

    setPos({ top, left, arrow: { side, x: arrowX } });
  }, []);

  // Reposiciona após render do popover (precisa de offsetHeight real)
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScrollResize = () => reposition();
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open, reposition]);

  return (
    <span
      ref={wrapRef}
      className="help-hint"
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span className="help-icon" aria-hidden="true">?</span>
      {open && (
        <span
          ref={popRef}
          className={`help-popover help-popover--fixed help-popover--v-${pos?.arrow.side === "bottom" ? "down" : "up"}`}
          role="tooltip"
          style={
            pos
              ? {
                  top: pos.top,
                  left: pos.left,
                  // expõe arrow x via custom property
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ["--arrow-x" as any]: `${pos.arrow.x}px`,
                }
              : { visibility: "hidden" }
          }
        >
          {title && <div className="hp-title">{title}</div>}
          {children}
        </span>
      )}
    </span>
  );
}
