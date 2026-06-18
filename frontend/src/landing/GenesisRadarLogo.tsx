/* ============================================================
   GenesisRadarLogo — a logo do produto, replicada nativamente.

   Emblema em SVG vetorial (espiral de radar + agulha de varredura
   + faíscas) e o letreiro em tipografia real (Playfair). Sem
   imagem rasterizada — nítido em qualquer escala, transparente,
   integra-se ao campo sem recorte.
   ============================================================ */

const CX = 100;
const CY = 100;

// espiral de radar — winding contínuo do centro para fora
function buildSpiral(turns: number, r0: number, r1: number, steps: number): string {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2 - Math.PI / 2; // começa no topo
    const r = r0 + (r1 - r0) * t;
    const x = CX + Math.cos(a) * r;
    const y = CY + Math.sin(a) * r;
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
  }
  return d;
}

// faísca de 4 pontas (estrela côncava)
function buildSpark(x: number, y: number, s: number): string {
  const c = s * 0.17;
  return (
    `M${x},${y - s}` +
    `Q${x + c},${y - c} ${x + s},${y}` +
    `Q${x + c},${y + c} ${x},${y + s}` +
    `Q${x - c},${y + c} ${x - s},${y}` +
    `Q${x - c},${y - c} ${x},${y - s}Z`
  );
}

const SPIRAL = buildSpiral(4, 3.6, 46, 280);
const SPARKS = [
  buildSpark(100, 47, 5),
  buildSpark(64, 67, 3.3),
  buildSpark(50, 110, 4.2),
  buildSpark(80, 151, 2.9),
  buildSpark(153, 105, 3.5),
  buildSpark(139, 147, 4.4),
];

export function GenesisRadarLogo({ className }: { className?: string }) {
  return (
    <div className={className ? "grl " + className : "grl"}>
      {/* halo quente — gold-as-light em box-shadow (paper-safe), atrás de tudo */}
      <div className="grl__bloom" aria-hidden="true" />

      <svg className="grl__emblem" viewBox="34 32 132 134" aria-hidden="true">
        <path className="grl__spiral" d={SPIRAL} />
        {SPARKS.map((d, i) => (
          <path key={i} className="grl__spark" d={d} />
        ))}
        {/* agulha de varredura — pivota sobre o hub (100,100 em user-units) */}
        <g className="grl__sweep">
          <line className="grl__needle" x1={CX} y1={CY} x2="136" y2="68" />
          <circle className="grl__tip" cx="136" cy="68" r="2.3" />
          <circle className="grl__hub" cx={CX} cy={CY} r="4.6" />
        </g>
      </svg>

      {/* letreiro — cada palavra mascarada (outer overflow:hidden, inner sobe) */}
      <span className="grl__word">
        <span className="grl__word-g">
          <span className="grl__word-i">Genesis</span>
        </span>
        <span className="grl__word-r">
          <span className="grl__word-i">Radar</span>
        </span>
      </span>

      <div className="grl__rule" aria-hidden="true">
        <span className="grl__rule-seg" />
        <span className="grl__rule-dia" />
        <span className="grl__rule-seg" />
      </div>
    </div>
  );
}
