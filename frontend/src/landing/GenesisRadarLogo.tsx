/* ============================================================
   GenesisRadarLogo — a logo do produto, replicada nativamente.

   Emblema em SVG vetorial (espiral de radar + agulha de varredura
   + faíscas) e o letreiro em tipografia real (Playfair). Sem
   imagem rasterizada — nítido em qualquer escala, transparente,
   integra-se ao campo sem recorte. v3 (WP5): o letreiro usa a
   marcação do motor de glifos (camada de palavra + camada de
   glifos) e a régua termina numa gota redonda, não num losango.

   O emblema É o radar (G2, "a logo é o radar"): a agulha espelha
   o feixe do campo (mesmo sentido, mesmo bearing) e a espiral tem
   um alvo de morph pré-calculado — o MESMO enrolamento, todas as
   voltas no raio externo (r = 46) — então cada ponto da espiral
   desliza só radialmente até virar o anel[0] do campo.
   ============================================================ */

/** Geometria do emblema em unidades do viewBox (fonte única p/ o Gateway). */
export const GRL_GEOMETRY = Object.freeze({
  /** viewBox "34 32 132 134" */
  vbX: 34,
  vbY: 32,
  vbW: 132,
  vbH: 134,
  /** hub (pivô da agulha, centro da espiral) */
  cx: 100,
  cy: 100,
  /** raio externo da espiral = raio do anel-alvo do morph */
  spiralR: 46,
  /** traços de repouso (CSS) — o Gateway compensa a escala do mergulho */
  spiralStroke: 1.5,
  needleStroke: 3,
  hubR: 4.6,
  tipR: 2.3,
});

const { cx: CX, cy: CY } = GRL_GEOMETRY;

const TURNS = 4;
const R0 = 3.6;
const STEPS = 280;

// espiral de radar — winding contínuo do centro para fora. Com r0 = r1 o
// mesmo traçado vira o anel enrolado TURNS vezes: mesma contagem de pontos,
// mesmo ângulo por ponto → o morph é puramente radial (as voltas abrem).
function buildSpiral(turns: number, r0: number, r1: number, steps: number): string {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2 - Math.PI / 2; // começa no topo
    const r = r0 + (r1 - r0) * t;
    const x = CX + Math.cos(a) * r;
    const y = CY + Math.sin(a) * r;
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2);
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

const SPIRAL = buildSpiral(TURNS, R0, GRL_GEOMETRY.spiralR, STEPS);
/** Alvo do MorphSVG da saída: o anel r = 46 (mesmo enrolamento da espiral). */
export const GRL_RING_PATH = buildSpiral(TURNS, GRL_GEOMETRY.spiralR, GRL_GEOMETRY.spiralR, STEPS);

const SPARKS = [
  buildSpark(100, 47, 5),
  buildSpark(64, 67, 3.3),
  buildSpark(50, 110, 4.2),
  buildSpark(80, 151, 2.9),
  buildSpark(153, 105, 3.5),
  buildSpark(139, 147, 4.4),
];

export function GenesisRadarLogo({ className }: { className?: string }) {
  const { vbX, vbY, vbW, vbH, hubR, tipR } = GRL_GEOMETRY;
  return (
    <div className={className ? "grl " + className : "grl"}>
      {/* halo quente — gold-as-light em box-shadow (paper-safe), atrás de tudo */}
      <div className="grl__bloom" aria-hidden="true" />

      <svg className="grl__emblem" viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} aria-hidden="true">
        <path className="grl__spiral" d={SPIRAL} />
        {SPARKS.map((d, i) => (
          <path key={i} className="grl__spark" d={d} />
        ))}
        {/* agulha de varredura — pivota sobre o hub (100,100 em user-units) */}
        <g className="grl__sweep">
          <line className="grl__needle" x1={CX} y1={CY} x2="136" y2="68" />
          <circle className="grl__tip" cx="136" cy="68" r={tipR} />
          <circle className="grl__hub" cx={CX} cy={CY} r={hubR} />
        </g>
      </svg>

      {/* letreiro — v3: sem janela de máscara. Cada palavra tem a camada de
          palavra (legível, em fluxo) e a camada de glifos que o motor de
          glifos (cinema/type/glyphs.ts) preenche nas posições com kerning,
          para o derramamento INK glifo a glifo do boot (Gateway.tsx). */}
      <span className="grl__word">
        <span className="grl__word-g">
          <span className="grl__word-i cx-mw__i">
            <span className="cx-mw__w">Genesis</span>
            <span className="cx-mw__g" aria-hidden="true" />
          </span>
        </span>
        <span className="grl__word-r">
          <span className="grl__word-i cx-mw__i">
            <span className="cx-mw__w">Radar</span>
            <span className="cx-mw__g" aria-hidden="true" />
          </span>
        </span>
      </span>

      {/* régua — dois fios e uma gota redonda de 5 px no centro (era um losango) */}
      <div className="grl__rule" aria-hidden="true">
        <span className="grl__rule-seg" />
        <span className="grl__rule-dot" />
        <span className="grl__rule-seg" />
      </div>
    </div>
  );
}
