import { useEffect, useRef, useState } from "react";

interface Props {
  min: number;
  max: number;
  step?: number;
  valueMin?: number;
  valueMax?: number;
  format?: (v: number) => string;
  onChange: (min: number | undefined, max: number | undefined) => void;
  scale?: "linear" | "log";
}

function defaultFmt(v: number) {
  return v.toLocaleString("pt-BR");
}

/* Mapeamento linear ↔ log para suportar receita (R$ 0 - bilhões em escala log) */
function toScale(v: number, min: number, max: number, scale: "linear" | "log"): number {
  if (scale === "linear") return (v - min) / (max - min);
  const lmin = Math.log10(Math.max(min, 1));
  const lmax = Math.log10(Math.max(max, 1));
  return (Math.log10(Math.max(v, 1)) - lmin) / (lmax - lmin);
}
function fromScale(t: number, min: number, max: number, scale: "linear" | "log"): number {
  if (scale === "linear") return min + t * (max - min);
  const lmin = Math.log10(Math.max(min, 1));
  const lmax = Math.log10(Math.max(max, 1));
  return Math.pow(10, lmin + t * (lmax - lmin));
}

export default function DualRangeSlider({
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  format = defaultFmt,
  onChange,
  scale = "linear",
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"lo" | "hi" | null>(null);
  const lo = valueMin ?? min;
  const hi = valueMax ?? max;

  const tLo = Math.max(0, Math.min(1, toScale(lo, min, max, scale)));
  const tHi = Math.max(0, Math.min(1, toScale(hi, min, max, scale)));

  function handleDown(which: "lo" | "hi") {
    return (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(which);
    };
  }

  useEffect(() => {
    if (!dragging) return;
    function move(e: PointerEvent) {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      let v = fromScale(t, min, max, scale);
      if (step > 0) v = Math.round(v / step) * step;
      v = Math.max(min, Math.min(max, v));
      if (dragging === "lo") onChange(v >= hi ? hi : v, valueMax);
      else onChange(valueMin, v <= lo ? lo : v);
    }
    function up() { setDragging(null); }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, min, max, step, scale, lo, hi, valueMax, valueMin, onChange]);

  function reset() {
    onChange(undefined, undefined);
  }

  const isActive = valueMin !== undefined || valueMax !== undefined;

  return (
    <div className="dual-slider">
      <div className="dual-slider-values">
        <span className="dual-slider-val">{format(lo)}</span>
        <span className="dual-slider-sep">↔</span>
        <span className="dual-slider-val">{format(hi)}</span>
        {isActive && (
          <button className="dual-slider-clear" onClick={reset} title="limpar">
            ×
          </button>
        )}
      </div>
      <div className="dual-slider-track" ref={trackRef}>
        <div
          className="dual-slider-fill"
          style={{ left: `${tLo * 100}%`, right: `${(1 - tHi) * 100}%` }}
        />
        <div
          className="dual-slider-thumb"
          style={{ left: `${tLo * 100}%` }}
          onPointerDown={handleDown("lo")}
          data-dragging={dragging === "lo"}
        />
        <div
          className="dual-slider-thumb"
          style={{ left: `${tHi * 100}%` }}
          onPointerDown={handleDown("hi")}
          data-dragging={dragging === "hi"}
        />
      </div>
    </div>
  );
}
