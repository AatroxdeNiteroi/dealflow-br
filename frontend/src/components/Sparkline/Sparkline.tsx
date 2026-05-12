import { useMemo } from "react";

/** Sparkline ornamental — gerada a partir de um seed (CNPJ ou similar).
 *  NÃO representa série temporal real — é decorativa.
 */
interface Props {
  seed: string;
  width?: number;
  height?: number;
  color?: string;
  points?: number;
}

export default function Sparkline({ seed, width = 100, height = 24, color, points = 20 }: Props) {
  const { path, isUp } = useMemo(() => {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    const rng = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    let v = 50;
    const ys: number[] = [];
    for (let i = 0; i < points; i++) {
      v += (rng() - 0.48) * 14;
      ys.push(v);
    }
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const range = max - min || 1;
    const stepX = width / (points - 1);
    const path = ys
      .map((y, i) => {
        const x = i * stepX;
        const yPx = height - 2 - ((y - min) / range) * (height - 4);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yPx.toFixed(1)}`;
      })
      .join(" ");
    const isUp = ys[ys.length - 1] >= ys[0];
    return { path, isUp };
  }, [seed, width, height, points]);

  const stroke = color ?? (isUp ? "#2d6a4f" : "#9d2c2c");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.25" />
    </svg>
  );
}
