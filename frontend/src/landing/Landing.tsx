/* ============================================================
   Landing — Genesis Radar (a experiência do radar).

   Existe desde o primeiro frame: o campo WebGL é o fundo vivo do
   portal. Enquanto `revealed` é falso, a cromática do radar (nav,
   HUD, cue) fica oculta e o scroll travado — só o campo e o
   hover do cursor rodam. Quando o portal libera, a cromática se
   revela e a jornada de scroll começa, sobre o MESMO campo.
   ============================================================ */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import Lenis from "lenis";
import { PointField } from "./three/PointField";
import { CONTROLADOR } from "../legal/dpo";
import TermosModal from "../components/Modal/TermosModal";
import PrivacidadeModal from "../components/Modal/PrivacidadeModal";
import { hasActiveSub, useAuth } from "../auth/AuthContext";
import {
  AuthApiError,
  checkout,
  portal,
  type BillingCycle,
  type CheckoutPlan,
  type PlanId,
} from "../auth/api";
import {
  lerPlanoPendente,
  limparPlanoPendente,
  salvarPlanoPendente,
  type PendingCheckout,
} from "../auth/pendingCheckout";
import { AuthOverlay, type AuthOverlayMode } from "./AuthOverlay";

gsap.registerPlugin(ScrollTrigger, CustomEase);

// Gramática de movimento única — espelhos GSAP das curvas fílmicas
// (ids NÃO-colidentes: 'expo' colidiria com o Expo nativo do GSAP).
// Regra: usar 'rk-expo' | 'rk-settle' | 'rk-glide' — nunca 'expo.out'.
CustomEase.create("rk-settle", "0.22,1,0.36,1");
CustomEase.create("rk-glide", "0.32,0.72,0,1");
CustomEase.create("rk-expo", "0.16,1,0.3,1");
CustomEase.create("rk-io", "0.65,0,0.35,1");
gsap.defaults({ ease: "rk-settle", duration: 0.6 });

const LABEL_POOL = 4;
const REDACTED = "R$ ███";

const RESPIRO_WORDS: Array<{ t: string; em?: boolean }> = [
  { t: "São" },
  { t: "46.255" },
  { t: "pontos" },
  { t: "neste" },
  { t: "campo." },
  { t: "Cada" },
  { t: "um" },
  { t: "é" },
  { t: "uma" },
  { t: "empresa" },
  { t: "real" },
  { t: "—", em: true },
  { t: "e", em: true },
  { t: "dados", em: true },
  { t: "que", em: true },
  { t: "ninguém", em: true },
  { t: "publicou.", em: true },
];

// Capítulo 2 — fragmentos de dado público que convergem sobre o
// dossiê. São anônimos e tarjados de propósito: vê-se o dado chegar,
// nunca o que ele é. Gerados uma vez, com semente fixa (estáveis).
const CH2_MOTES = (() => {
  let s = 0x9e3779b1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  return Array.from({ length: 26 }, () => {
    const ang = rnd() * Math.PI * 2;
    const rx = 240 + rnd() * 200; // halo largo — o dado ladeia o dossiê
    const ry = 34 + rnd() * 96; // halo baixo — não invade rótulo/desfecho
    const k = 2.4 + rnd() * 1.5; // o quanto o fragmento começa longe
    const drift = (rnd() - 0.5) * 0.6; // leve curva na entrada
    return {
      x0: Math.cos(ang + drift) * rx * k,
      y0: Math.sin(ang + drift) * ry * k,
      x1: Math.cos(ang) * rx,
      y1: Math.sin(ang) * ry,
      w: 20 + Math.round(rnd() * 52),
      o: 0.4 + rnd() * 0.48,
    };
  });
})();

function formatBRL(mi: number): string {
  if (mi < 1) return "R$ " + Math.round(mi * 1000) + " mil";
  return "R$ " + mi.toFixed(1).replace(".", ",") + " mi";
}

// ── Capítulo 5 — Os planos ────────────────────────────────────
// Ciclos de cobrança: quanto mais longo o compromisso, maior o
// desconto progressivo sobre o preço-base mensal.
const CH5_PERIODS = [
  { id: "mensal", label: "Mensal", discount: 0, months: 1 },
  { id: "semestral", label: "Semestral", discount: 0.15, months: 6 },
  { id: "anual", label: "Anual", discount: 0.25, months: 12 },
] as const;
type PeriodId = (typeof CH5_PERIODS)[number]["id"];

// Planos — R$/mês na base, antes do desconto. Sinal (149) e Varredura
// (389) são os preços DECIDIDOS (docs/site-architecture.md, Fase D) e
// devem bater com os preços do Stripe (scripts/stripe_seed.py). Mesa
// (899) é só display — venda assistida, sem checkout; confirmar valor.
// A ordem do array é a ordem visual da esquerda p/ direita (barato →
// caro); `slot` controla a ordem de entrada na animação de revelação.
const CH5_PLANS = [
  {
    id: "sinal" as PlanId,
    slot: "a", // esquerda — mais barato — entra primeiro
    name: "Sinal",
    tagline: "Para o analista que começa a mapear o mercado.",
    monthly: 149,
    featured: false,
    cta: "Começar",
    features: [
      "Estimativa de faturamento de até 50 empresas por mês",
      "Filtros por CNAE, UF e porte",
      "1 usuário",
      "Exportação em CSV",
    ],
  },
  {
    id: "varredura" as PlanId,
    slot: "b", // centro — intermediário, em destaque — entra por último
    name: "Varredura",
    tagline: "Para quem vive de originar negócios.",
    monthly: 389,
    featured: true,
    cta: "Assinar a Varredura",
    features: [
      "Estimativas sem limite de empresas",
      "Histórico e mapa de grupo econômico",
      "Selo de validação cruzada (PIA)",
      "Monitor de saúde fiscal e judicial (PGFN · Datajud)",
      "Até 5 usuários",
    ],
  },
  {
    id: "mesa" as PlanId,
    slot: "c", // direita — mais caro — entra em segundo
    name: "Mesa",
    tagline: "Para o time de M&A operando lado a lado.",
    monthly: 899,
    featured: false,
    cta: "Falar com vendas",
    features: [
      "Tudo da Varredura, sem limite de usuários",
      "Reputação pública sob demanda (Diários Oficiais · protestos)",
      "Acesso à API",
      "Busca de empresas assistida por IA",
      "Suporte dedicado e onboarding",
    ],
  },
] as const;

// preço inteiro em reais — "R$ 1.341"
function brl(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR");
}

// Mesa não tem checkout self-serve — venda assistida por email
const MAILTO_MESA =
  "mailto:contato@genesislabs.com.br?subject=" + encodeURIComponent("Plano Mesa");

// ── Capítulo 6 — Como funciona (infográfico do fluxo) ─────────
// Fontes nomeadas que convergem num instrumento que entrega uma
// faixa. Passa confiabilidade sem expor o método — a fórmula não
// aparece (decisão de design); o NOME das fontes, sim.
const CH6_SOURCES = [
  { acronym: "IBGE", full: "Pesquisa Industrial Anual" },
  { acronym: "RFB", full: "Receita Federal" },
  { acronym: "CVM", full: "Demonstrações financeiras" },
  { acronym: "CAGED", full: "Vínculos formais (MTE)" },
  { acronym: "Portal da Transparência", full: "Contratos federais" },
  { acronym: "Comex Stat", full: "Exposição exportadora" },
];

// ── Capítulo 8 — Perguntas frequentes ─────────────────────────
// FAQ honesto: respostas curtas, ancoradas no docs/methodology.md.
// Itens distribuídos em 2 colunas (3 e 3) — ver landing.css.
const CH8_FAQ = [
  {
    q: "De onde vêm os dados?",
    a: "Somente de bases públicas e oficiais brasileiras — IBGE (Pesquisa Industrial Anual), Receita Federal (CNPJ e CAGED), CVM (Demonstrações Financeiras Padronizadas), Portal da Transparência (contratos federais) e Comex Stat. Nenhum dado cinza, vazado ou comprado entra no cálculo.",
  },
  {
    q: "Como o número se sustenta?",
    a: "Validamos a metodologia contra balanços reais publicados na CVM. No universo do produto, a mediana de erro fica em 12–15% — os arquétipos operacionais ficam abaixo de ±15%. Quando dois métodos independentes convergem, a empresa ganha selo de validação cruzada.",
  },
  {
    q: "Quais empresas estão no escopo?",
    a: "46.255 Sociedades Empresárias Limitadas (LTDAs) brasileiras de capital fechado, com faturamento até R$ 250 mi. Holdings puras e empresas em recuperação judicial ficam fora — a relação folha/receita não reflete a realidade nesses casos.",
  },
  {
    q: "Por que um intervalo, e não um valor único?",
    a: "Cravar um valor único quando existe incerteza real é mentir sobre a precisão. Entregamos faixa honesta (mínimo · estimativa · máximo) que carrega a margem real do setor. O analista decide onde ancorar dentro do intervalo — com a margem transparente.",
  },
  {
    q: "Dá para integrar com o nosso CRM?",
    a: "Sim, no plano Mesa — com acesso à API e onboarding dedicado. Os planos Sinal e Varredura entregam o mesmo dado via exportação em CSV (e PDF, no Varredura) para uso manual ou ingestão semi-automatizada.",
  },
  {
    q: "Como vocês tratam LGPD?",
    a: "O produto trabalha com dados de pessoas jurídicas (CNPJ). Quando há dados de pessoas físicas (sócios), seguimos as bases legais e o devido processo previstos na LGPD. Política completa, registro de tratamento e contato do DPO no link do rodapé.",
  },
];

// ── Capítulo 7 — Quem usa o radar ─────────────────────────────
// ⚠️ PLACEHOLDER — depoimentos ILUSTRATIVOS, não são de clientes
// reais. Substituir por depoimentos reais e autorizados ANTES de
// publicar: depoimento fabricado em site no ar é publicidade
// enganosa (CDC, art. 37) e contradiz o posicionamento de
// honestidade do produto. Os avatares são as iniciais — trocar por
// foto real só quando houver cliente real que autorize o uso.
const CH7_VOICES = [
  {
    quote:
      "Antes eu estimava o porte de um alvo fechado no olho, pelo número de funcionários — e essa era a melhor referência que eu tinha. Agora chego na reunião com uma faixa que se sustenta, baseada em fonte pública que o comitê consegue checar. Mudou a conversa: paramos de discutir se o número é razoável e passamos a discutir a tese.",
    name: "Marina Tavares",
    role: "Analista de M&A",
    org: "boutique de fusões e aquisições",
    featured: true,
  },
  {
    quote:
      "O que me convenceu foi a procedência do dado: é tudo fonte pública oficial. Defendo a estimativa diante do comitê sem precisar pedir desculpas.",
    name: "Rafael Brandão",
    role: "Sócio",
    org: "fundo de private equity",
    featured: false,
  },
  {
    quote:
      "Mapeei trinta alvos de aquisição de um setor inteiro numa tarde. O radar virou o primeiro filtro de originação do time.",
    name: "Letícia Aragão",
    role: "Head de Originação",
    org: "assessoria de aquisições",
    featured: false,
  },
];

// iniciais para o avatar — "Marina Tavares" → "MT"
function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// CH-02/CH-09 — dígitos em rolos verticais (odômetro). Cada rolo carrega
// a coluna 0-9; --d posiciona o dígito visível (translateY). O valor real
// fica no aria-label do contêiner; os rolos são aria-hidden. Separadores
// ("." / ",") viram dígito estático.
const DIGIT_STRIP = Array.from({ length: 10 }, (_, n) => <b key={n}>{n}</b>);
function Reels({ value }: { value: string }) {
  return (
    <>
      {value.split("").map((ch, i) =>
        ch === "." || ch === "," ? (
          <span className="ch4-dot" key={i} aria-hidden="true">
            {ch}
          </span>
        ) : (
          <span className="ch4-reel" key={i} aria-hidden="true">
            <span className="ch4-reel__col" style={{ "--d": Number(ch) } as CSSProperties}>
              {DIGIT_STRIP}
            </span>
          </span>
        ),
      )}
    </>
  );
}

// CH-05 — título Playfair dividido em palavras mascaradas para a
// revelação "mask-rise" (cada palavra sobe de baixo de uma máscara).
// O texto real fica no aria-label (acessível); as palavras são
// aria-hidden. Espaçamento por margin (evita problemas de whitespace
// colapsado entre inline-blocks).
function Words({ text, className }: { text: string; className: string }) {
  const words = text.split(" ");
  return (
    <h2 className={className} aria-label={text}>
      {words.map((w, i) => (
        <span className="rk-word" key={i} aria-hidden="true">
          <span className="rk-word__i">{w}</span>
        </span>
      ))}
    </h2>
  );
}

export function Landing({
  phase,
  onEnter,
}: {
  phase: "gateway" | "entering" | "radar";
  onEnter?: () => void;
}) {
  const revealed = phase === "radar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const fieldRef = useRef<PointField | null>(null);
  // elemento do emblema (.grl) — consumidor escopado de --sweep-bearing;
  // existe só no gateway/entering, nunca no radar (Gateway desmonta)
  const gateElRef = useRef<HTMLElement | null>(null);
  const revealedRef = useRef(false);
  // Ver planos clicado antes do radar abrir — fica em fila para
  // disparar a rolagem assim que `revealed` ficar verdadeiro
  const pendingScrollRef = useRef(false);
  // Ponto sem retorno: depois que o usuário passa da tela de planos
  // (entra no Cap. 6), travamos o piso de rolagem ali — não dá mais
  // para subir de volta aos planos / capítulos cinematográficos.
  const lockArmedRef = useRef(false);
  // modais legais do footer — abrem sobre toda a landing
  const [showTermos, setShowTermos] = useState(false);
  const [showPriv, setShowPriv] = useState(false);
  // ── conta e acesso — overlay de auth + checkout ──────────────
  const { status, user, config, logout, refresh } = useAuth();
  const [overlay, setOverlay] = useState<{ mode: AuthOverlayMode; token?: string | null } | null>(
    null,
  );
  // plano escolhido antes do email verificar — sobrevive ao reload
  // do link de verificação via localStorage
  const [pendingPlan, setPendingPlanState] = useState<PendingCheckout | null>(() =>
    lerPlanoPendente(),
  );
  // plano com checkout em andamento — trava o CTA correspondente
  const [checkoutBusy, setCheckoutBusy] = useState<CheckoutPlan | null>(null);
  // aviso discreto (checkout cancelado, billing desabilitado etc.)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  // Capítulo 5 — ciclo de cobrança escolhido nos planos
  const [period, setPeriod] = useState<PeriodId>("anual");
  const periodIndex = Math.max(
    0,
    CH5_PERIODS.findIndex((p) => p.id === period),
  );
  const activePeriod = CH5_PERIODS[periodIndex];

  // ── montagem — campo, jornada e interação ligam de imediato ──
  useEffect(() => {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const canvas = canvasRef.current!;
    const labelLayer = labelLayerRef.current!;
    const readout = readoutRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // a coreografia dos planos (Cap. 5) só roda em tela larga; em
    // tela estreita o capítulo vira seção estática (ver landing.css)
    const wideViewport = window.matchMedia("(min-width: 721px)").matches;

    const field = new PointField(canvas, { reducedMotion: reduced });
    fieldRef.current = field;

    const labels: Array<{ el: HTMLDivElement; val: HTMLSpanElement }> = [];
    for (let i = 0; i < LABEL_POOL; i++) {
      const el = document.createElement("div");
      el.className = "lp-label";
      const dot = document.createElement("span");
      dot.className = "lp-label-dot";
      const val = document.createElement("span");
      val.className = "lp-label-val";
      el.append(dot, val);
      labelLayer.append(el);
      labels.push({ el, val });
    }

    field.onFrame = (f) => {
      // etiquetas de valor só dentro do radar — não no portal
      if (!revealedRef.current) {
        for (const lab of labels) lab.el.style.opacity = "0";
      } else {
        const cur = f.cursorLabels;
        for (let i = 0; i < labels.length; i++) {
          const lab = labels[i];
          const c = cur[i];
          if (!c) {
            lab.el.style.opacity = "0";
            continue;
          }
          lab.el.style.opacity = String(Math.min(1, c.strength * 1.4));
          lab.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
          if (c.strength > 0.62) {
            lab.el.classList.remove("is-redacted");
            lab.val.textContent = formatBRL(c.value);
          } else {
            lab.el.classList.add("is-redacted");
            lab.val.textContent = REDACTED;
          }
        }
      }
      readout.textContent =
        "AZ " + String(Math.round(f.sweepBearing)).padStart(3, "0") + "°";
      // o emblema do gateway é um miniradar: a agulha espelha o bearing
      // vivo do campo (escopado ao .grl — nunca :root)
      gateElRef.current?.style.setProperty(
        "--sweep-bearing",
        String(f.sweepBearing | 0),
      );
    };

    const onMove = (e: PointerEvent) => {
      field.setMouse(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1),
      );
    };
    const onLeave = () => field.clearMouse();
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);

    const onResize = () => {
      field.resize();
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize);

    // ── ponto sem retorno (fallback nativo) ─────────────────────────
    // Quando não há Lenis (reduced-motion), o mesmo travamento via
    // rolagem nativa. Quando Lenis está ativo, ele cuida do clamp.
    let lockClampingNative = false;
    const onNativeScroll = () => {
      if (lenisRef.current) return; // Lenis cuida do clamp
      const ch6 = document.querySelector<HTMLElement>(".ch6");
      if (!ch6) return;
      const floor = ch6.offsetTop;
      const pos = window.scrollY;
      if (!lockArmedRef.current) {
        if (pos >= floor - 2) lockArmedRef.current = true;
        return;
      }
      if (pos < floor && !lockClampingNative) {
        lockClampingNative = true;
        window.scrollTo(0, floor);
        lockClampingNative = false;
      }
    };
    window.addEventListener("scroll", onNativeScroll, { passive: true });

    let tick: ((time: number) => void) | null = null;
    let ctx: ReturnType<typeof gsap.context> | null = null;

    if (!reduced) {
      const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      lenisRef.current = lenis;
      lenis.stop(); // travado até "Quero conhecer o produto"
      lenis.on("scroll", ScrollTrigger.update);

      // ── ponto sem retorno (Lenis) ───────────────────────────────
      // Arma quando a rolagem cruza o topo do Cap. 6 (logo após os
      // planos); depois disso, qualquer tentativa de subir abaixo do
      // piso é grudada de volta nele.
      let lockClamping = false;
      lenis.on("scroll", () => {
        const ch6 = document.querySelector<HTMLElement>(".ch6");
        if (!ch6) return;
        const floor = ch6.offsetTop;
        const pos = lenis.scroll;
        if (!lockArmedRef.current) {
          if (pos >= floor - 2) lockArmedRef.current = true;
          return;
        }
        if (pos < floor && !lockClamping) {
          lockClamping = true;
          lenis.scrollTo(floor, { immediate: true, force: true });
          lockClamping = false;
        }
      });

      // velocidade de rolagem amortecida — alimenta o sweep, que reage ao
      // ritmo (sem write per-frame de CSS var: evita invalidação de estilo).
      let velSmooth = 0;
      tick = (time: number) => {
        lenis.raf(time * 1000);
        const v = gsap.utils.clamp(0, 1, Math.abs(lenis.velocity) / 40);
        velSmooth += (v - velSmooth) * 0.1;
        fieldRef.current?.setVel(velSmooth);
      };
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      ctx = gsap.context(() => {
        // ── Capítulo 1 — a jornada: a trilha dirige câmera + texto ──
        const master = gsap.timeline({
          scrollTrigger: {
            trigger: ".lp-scroll",
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
            onUpdate: (self) => field.setJourney(self.progress),
          },
        });
        master
          .to({}, { duration: 1 }, 0)
          .to(".hero__cue", { autoAlpha: 0, duration: 0.08 }, 0)
          .to(".hero__hud", { autoAlpha: 0, duration: 0.12 }, 0.05)
          .to(".hero__frame", { autoAlpha: 0, duration: 0.2 }, 0.42)
          // dentro da esfera, no preto: as palavras surgem num fade
          // suave e escalonado — e só então o interior clareia
          .fromTo(".respiro__copy", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.035 }, 0.82)
          .fromTo(
            ".respiro__w",
            { opacity: 0 },
            { opacity: 1, ease: "power1.inOut", duration: 0.04, stagger: { amount: 0.03 } },
            0.86,
          )
          // o CTA surge quando a esfera clareia (journey ~0.93) e, fixo,
          // acompanha o usuário por todos os capítulos seguintes
          .fromTo(
            ".lp-cta",
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.05, ease: "power2.out" },
            0.93,
          );

        // ── Capítulo 2 — Convergência ───────────────────────────
        // a jornada parou no Interior; o campo desfocado vira pano
        // de fundo. O dado público — anônimo, tarjado — converge
        // sobre o dossiê. O faturamento segue oculto: gancho do Cap. 3.
        const ch2 = gsap.timeline({
          scrollTrigger: {
            trigger: ".ch2-track",
            start: "top bottom",
            end: "bottom bottom",
            scrub: 1,
          },
        });
        ch2
          .to({}, { duration: 1 }, 0)
          // o respiro do Capítulo 1 sai; a cena do dossiê entra
          .to(".respiro__copy", { autoAlpha: 0, duration: 0.05 }, 0)
          .fromTo(".ch2-stage", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.07 }, 0.02)
          .fromTo(
            ".ch2-eyebrow",
            { autoAlpha: 0, y: -12 },
            { autoAlpha: 1, y: 0, duration: 0.07 },
            0.04,
          )
          // a natureza do dado que vai convergir — fonte pública oficial
          .fromTo(
            ".ch2-sources",
            { autoAlpha: 0, y: -8 },
            { autoAlpha: 1, y: 0, duration: 0.06 },
            0.08,
          )
          .fromTo(
            ".ch2-dossier",
            { autoAlpha: 0, scale: 0.92 },
            { autoAlpha: 1, scale: 1, duration: 0.12, ease: "power2.out" },
            0.06,
          )
          // o dado público converge — anônimo e tarjado, de toda parte;
          // posições por mote vêm do JS, sem ordem visível (from random)
          .fromTo(
            ".ch2-mote",
            {
              autoAlpha: 0,
              xPercent: -50,
              yPercent: -50,
              x: (i) => CH2_MOTES[i]!.x0,
              y: (i) => CH2_MOTES[i]!.y0,
            },
            {
              autoAlpha: (i) => CH2_MOTES[i]!.o,
              xPercent: -50,
              yPercent: -50,
              x: (i) => CH2_MOTES[i]!.x1,
              y: (i) => CH2_MOTES[i]!.y1,
              duration: 0.24,
              ease: "power2.out",
              stagger: { amount: 0.4, from: "random" },
            },
            0.12,
          )
          // convergência completa — um pulso dourado marca o número
          // que segue tarjado, e o desfecho entra (gancho do Cap. 3)
          .fromTo(
            ".ch2-dossier__redact",
            { boxShadow: "0 0 0 0 rgba(184, 134, 11, 0)" },
            {
              boxShadow: "0 0 0 3px rgba(184, 134, 11, 0.4)",
              duration: 0.1,
              repeat: 1,
              yoyo: true,
              ease: "power1.inOut",
            },
            0.78,
          )
          .fromTo(
            ".ch2-close",
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.1, ease: "power2.out" },
            0.84,
          );

        // ── Capítulo 3 — A estimativa ───────────────────────────
        // a tarja do faturamento finalmente resolve — mas como
        // intervalo honesto (mínimo · estimativa · máximo), nunca
        // um número cravado. O método (a fórmula) não aparece.
        // CH-01 — agulha e selo disparam UMA vez (não-scrub) para o
        // overshoot back.out/stamp não ser achatado pelo scrub
        let ch3MarkFired = false;
        let ch3SealFired = false;
        const ch3 = gsap.timeline({
          scrollTrigger: {
            trigger: ".ch3-track",
            start: "top bottom",
            end: "bottom bottom",
            scrub: 1,
          },
        });
        ch3
          .to({}, { duration: 1 }, 0)
          // a cena do Capítulo 2 sai; a da estimativa entra
          .to(".ch2-stage", { autoAlpha: 0, duration: 0.06 }, 0)
          .fromTo(".ch3-stage", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.07 }, 0.02)
          .fromTo(
            ".ch3-eyebrow",
            { autoAlpha: 0, y: -12 },
            { autoAlpha: 1, y: 0, duration: 0.07 },
            0.05,
          )
          .fromTo(".ch3-company", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, 0.07)
          .fromTo(
            ".ch3-reveal__label",
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: 0.06 },
            0.09,
          )
          // a resolução — a tarja é VARRIDA por um clip-path da esquerda,
          // deixando o número (já presente por baixo) nítido; o valor
          // entra em foco (blur->0) conforme é descoberto
          .fromTo(
            ".ch3-amount__redact",
            { "--reveal": 0 },
            { "--reveal": 1, duration: 0.14, ease: "rk-io" },
            0.3,
          )
          .fromTo(
            ".ch3-amount__value",
            { filter: "blur(7px)" },
            { filter: "blur(0px)", duration: 0.1 },
            0.31,
          )
          // o intervalo honesto — extremos, régua e a marca da estimativa
          .fromTo(
            ".ch3-range__end",
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, duration: 0.08, stagger: 0.03 },
            0.5,
          )
          .fromTo(
            ".ch3-range__track",
            { scaleX: 0 },
            { scaleX: 1, duration: 0.12, ease: "power2.inOut" },
            0.52,
          )
          // a marca-agulha entra da esquerda e assenta com overshoot
          .call(
            () => {
              if (ch3MarkFired) return;
              ch3MarkFired = true;
              gsap.fromTo(
                ".ch3-range__mark",
                { left: "8%", autoAlpha: 0 },
                { left: "50%", autoAlpha: 1, duration: 0.9, ease: "back.out(1.7)" },
              );
            },
            [],
            0.6,
          )
          // o selo carimba (stamp) a procedência — escala 1.18->1
          .call(
            () => {
              if (ch3SealFired) return;
              ch3SealFired = true;
              gsap.fromTo(
                ".ch3-seal",
                { scale: 1.18, autoAlpha: 0 },
                { scale: 1, autoAlpha: 1, duration: 0.5, ease: "power4.out" },
              );
            },
            [],
            0.72,
          )
          .fromTo(
            ".ch3-close",
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.1, ease: "power2.out" },
            0.8,
          );

        // ── Capítulo 4 — O universo ─────────────────────────────
        // a câmera recua: a empresa do Cap. 3 volta a ser um ponto,
        // um entre 46.255. O campo inteiro se revela. Beat de escala.
        const ch4 = gsap.timeline({
          scrollTrigger: {
            trigger: ".ch4-track",
            start: "top bottom",
            end: "bottom bottom",
            scrub: 1,
            onUpdate: (self) => field.setUniverse(self.progress),
          },
        });
        ch4
          .to({}, { duration: 1 }, 0)
          .to(".ch3-stage", { autoAlpha: 0, duration: 0.06 }, 0)
          .fromTo(".ch4-stage", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.07 }, 0.02)
          .fromTo(
            ".ch4-eyebrow",
            { autoAlpha: 0, y: -12 },
            { autoAlpha: 1, y: 0, duration: 0.07 },
            0.05,
          )
          .fromTo(
            ".ch4-panel",
            { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, duration: 0.1, ease: "power2.out" },
            0.08,
          )
          // (a contagem agora rola num odômetro dedicado, não-scrub — ver
          // ScrollTrigger logo após esta timeline)
          .fromTo(
            ".ch4-close",
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.1, ease: "power2.out" },
            0.74,
          )
          // o conteúdo do universo recua para dar lugar aos planos
          .to(
            [".ch4-eyebrow", ".ch4-panel", ".ch4-close"],
            { autoAlpha: 0, duration: 0.06 },
            0.88,
          )
          // header e footer ressurgem para acompanhar o fim da jornada
          .to(
            [".lp-nav", ".lp-footer"],
            { autoAlpha: 1, duration: 0.08, ease: "power2.out" },
            0.9,
          );

        // CH-02 — odômetro: os rolos começam em 0 (sem flash do número
        // final) e rolam até 4·6·2·5·5 (dígito mais significativo primeiro)
        // com overshoot, num disparo dedicado não-scrub.
        const CH4_TARGET = [4, 6, 2, 5, 5];
        gsap.set(".ch4-reel__col", { "--d": 0 });
        ScrollTrigger.create({
          trigger: ".ch4-track",
          start: "top -120%",
          once: true,
          onEnter: () => {
            gsap.utils
              .toArray<HTMLElement>(".ch4-reel__col")
              .forEach((col, i) =>
                gsap.to(col, {
                  "--d": CH4_TARGET[i],
                  duration: 1.1,
                  ease: "back.out(1.15)",
                  delay: i * 0.09,
                }),
              );
          },
        });

        // ── Capítulo 5 — Os planos ──────────────────────────────
        // O fecho: sobre o campo inteiro, o convite final e três
        // planos que entram de cima. O mais barato e o mais caro
        // ladeiam primeiro, deixando o vão central para o
        // intermediário — em destaque — cair por último. Beat de
        // DOM puro; o PointField fica parado na vista de universo.
        if (wideViewport) {
          const ch5 = gsap.timeline({
            scrollTrigger: {
              trigger: ".ch5-track",
              start: "top bottom",
              end: "bottom bottom",
              scrub: 1,
            },
          });
          ch5
            .to({}, { duration: 1 }, 0)
            .fromTo(".ch5-stage", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, 0.02)
            .fromTo(
              ".ch5-eyebrow",
              { autoAlpha: 0, y: -12 },
              { autoAlpha: 1, y: 0, duration: 0.06 },
              0.05,
            )
            .fromTo(
              ".ch5-lead",
              { autoAlpha: 0, y: 16 },
              { autoAlpha: 1, y: 0, duration: 0.09, ease: "power2.out" },
              0.09,
            )
            .fromTo(
              ".ch5-toggle",
              { autoAlpha: 0, y: 12 },
              { autoAlpha: 1, y: 0, duration: 0.08, ease: "power2.out" },
              0.18,
            )
            // o botão de canto sai de cena — os planos já estão aqui
            .to(".lp-cta", { autoAlpha: 0, duration: 0.06 }, 0.18)
            // os cards caem de cima: o barato e o caro ladeiam primeiro,
            // deixando o vão do meio para o intermediário fechar a cena
            .fromTo(
              ".ch5-card--a",
              { autoAlpha: 0, y: -70 },
              { autoAlpha: 1, y: 0, duration: 0.14, ease: "power3.out" },
              0.28,
            )
            .fromTo(
              ".ch5-card--c",
              { autoAlpha: 0, y: -70 },
              { autoAlpha: 1, y: 0, duration: 0.14, ease: "power3.out" },
              0.44,
            )
            .fromTo(
              ".ch5-card--b",
              { autoAlpha: 0, y: -86 },
              { autoAlpha: 1, y: 0, duration: 0.17, ease: "power3.out" },
              0.6,
            )
            .fromTo(".ch5-note", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0.76)
            // header e footer seguem presentes sobre os planos
            .to([".lp-nav", ".lp-footer"], { autoAlpha: 1, duration: 0.06 }, 0.28);

          // CH-03 — quando o card em destaque aterrissa, uma varredura de
          // luz dourada passa UMA vez (gatilho dedicado, não-scrub, p/ o
          // back/io não ser achatado pelo scrub)
          ScrollTrigger.create({
            trigger: ".ch5-track",
            start: "top -260%",
            once: true,
            onEnter: () => {
              gsap
                .timeline()
                .fromTo(
                  ".ch5-sweep",
                  { backgroundPosition: "130% 0", autoAlpha: 0 },
                  {
                    backgroundPosition: "-30% 0",
                    autoAlpha: 1,
                    duration: 1.0,
                    ease: "rk-io",
                  },
                  0,
                )
                .to(".ch5-sweep", { autoAlpha: 0, duration: 0.35 }, 0.7);
            },
          });
        }

        // ── Capítulos 6, 7 e 8 — seções em fluxo normal ─────────
        // Não são cenas fixas: rolam de verdade entre o header e o
        // footer (que ficam fixos). Cada elemento entra com fade ao
        // chegar à viewport — sem scrub, sem pin. Triggers disparam
        // cedo (top 92%) e once:true para evitar não-disparo em
        // scroll rápido sobre seções altas.
        // CH-05/CH-08 — revelação cinematográfica: sobe + entra em foco
        // (blur->nítido) com a curva expo; clearProps libera o transform
        // para o tilt CSS (CH-08) assumir o repouso depois.
        const revealOnEnter = (trigger: string, targets: string, y: number) =>
          gsap.from(targets, {
            scrollTrigger: { trigger, start: "top 92%", once: true },
            autoAlpha: 0,
            y,
            filter: "blur(6px)",
            duration: 0.7,
            ease: "rk-expo",
            stagger: 0.07,
            clearProps: "transform,filter",
          });
        revealOnEnter(".ch6", ".ch6-head > :not(h2)", 22);
        revealOnEnter(".ch6", ".ch6-stage", 32);
        revealOnEnter(".ch6", ".ch6-link", 0);
        revealOnEnter(".ch6", ".ch6-foot", 16);
        revealOnEnter(".chsig", ".chsig-head > :not(h2)", 22);
        revealOnEnter(".chsig", ".chsig-card", 32);
        revealOnEnter(".chsig", ".chsig-strip", 18);
        revealOnEnter(".chsig", ".chsig-foot", 16);
        revealOnEnter(".ch7", ".ch7-head > :not(h2)", 22);
        revealOnEnter(".ch7", ".ch7-voice", 40);
        revealOnEnter(".ch7", ".ch7-foot", 22);
        revealOnEnter(".ch8", ".ch8-head > :not(h2)", 22);
        revealOnEnter(".ch8", ".ch8-faq", 26);
        revealOnEnter(".ch8", ".ch8-foot", 16);

        // ── BR-01 — colchetes de registro "encaixam" por último em cada
        //    seção em fluxo enquadrada (coerência de instrumento) ──
        const revealBrackets = (sel: string, trig: string) =>
          gsap.fromTo(
            sel,
            { "--draw": 0 },
            {
              "--draw": 1,
              duration: 0.5,
              ease: "rk-settle",
              stagger: 0.05,
              scrollTrigger: { trigger: trig, start: "top 80%", once: true },
            },
          );
        revealBrackets(".ch6-stage__corner", ".ch6");
        revealBrackets(".ch7-voice__corner", ".ch7");

        // ── CH-05 — títulos Playfair sobem palavra a palavra de baixo de
        //    uma máscara, entrando em foco (mask-rise). Disparo dedicado
        //    por título (não no stagger geral do .head). ──
        [".ch6-title", ".chsig-title", ".ch7-title", ".ch8-title"].forEach((sel) => {
          gsap.from(sel + " .rk-word__i", {
            scrollTrigger: { trigger: sel, start: "top 86%", once: true },
            yPercent: 118,
            autoAlpha: 0,
            filter: "blur(6px)",
            duration: 0.9,
            ease: "rk-expo",
            stagger: 0.05,
            clearProps: "transform,filter",
          });
        });

        // CH-07 — as setas conectoras do fluxo do Cap. 6 se DESENHAM ao
        // entrar (stroke-draw): "fonte -> cruzamento -> saída" se monta.
        gsap.utils.toArray<SVGPathElement>(".ch6-link path").forEach((path, i) => {
          const len = path.getTotalLength();
          gsap.fromTo(
            path,
            { strokeDasharray: len, strokeDashoffset: len },
            {
              strokeDashoffset: 0,
              duration: 0.7,
              ease: "rk-io",
              delay: i * 0.12,
              scrollTrigger: { trigger: ".ch6-flow", start: "top 80%", once: true },
            },
          );
        });

        // garante medidas atualizadas após o layout assentar
        requestAnimationFrame(() => ScrollTrigger.refresh());
      });
    }

    return () => {
      ctx?.revert();
      if (tick) gsap.ticker.remove(tick);
      lenisRef.current?.destroy();
      lenisRef.current = null;
      ScrollTrigger.getAll().forEach((t) => t.kill());
      field.dispose();
      fieldRef.current = null;
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onNativeScroll);
      labels.forEach((lab) => lab.el.remove());
    };
  }, []);

  // ── revelação — quando o portal libera a entrada ─────────────
  useEffect(() => {
    if (!revealed) return;
    revealedRef.current = true;
    lenisRef.current?.start();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set([".lp-nav", ".lp-footer", ".lp-stage", ".lp-cta"], { autoAlpha: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      // a cromática do radar (HUD, texto) surge sobre o campo já presente
      gsap.to(".lp-stage", { autoAlpha: 1, duration: 0.7, ease: "power2.out" });
    });
    return () => ctx.revert();
  }, [revealed]);

  // ── emblema do gateway — cacheia o elemento .grl como consumidor do
  //    bearing vivo (escopado); nulo no radar (Gateway desmontado) ──
  useEffect(() => {
    gateElRef.current =
      phase === "radar" ? null : document.querySelector<HTMLElement>(".grl");
  }, [phase]);

  // ── chrome (header + footer) — visível no Gateway, some ao entrar
  //    no radar; o fim do Cap. 4 o traz de volta (timeline do ch4) ──
  useEffect(() => {
    if (phase === "gateway") {
      gsap.to([".lp-nav", ".lp-footer"], { autoAlpha: 1, duration: 0.8, ease: "power2.out" });
    } else if (phase === "entering") {
      gsap.to([".lp-nav", ".lp-footer"], { autoAlpha: 0, duration: 0.5, ease: "power2.in" });
      // o radar "acorda" ao receber a entrada — carrega o campo + flare do sweep
      fieldRef.current?.pulse();
    }
  }, [phase]);

  // ── CR-01 — CTAs magnéticos: a ação principal se atrai ao cursor.
  //    Usa o translate LONGHAND (--mx/--my, números tipados @property),
  //    escopado a ponteiro fino + motion permitido; limpa ao desmontar. ──
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
      const els = gsap.utils.toArray<HTMLElement>(
        ".lp-cta, .ch7-foot__cta, .ch5-card.is-featured .ch5-card__cta",
      );
      const cl = gsap.utils.clamp(-10, 10);
      const cleanups: Array<() => void> = [];
      els.forEach((el) => {
        const mx = gsap.quickTo(el, "--mx", { duration: 0.5, ease: "rk-glide" });
        const my = gsap.quickTo(el, "--my", { duration: 0.5, ease: "rk-glide" });
        const onMove = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          if (Math.hypot(dx, dy) < 120) {
            mx(cl(dx * 0.18));
            my(cl(dy * 0.18));
          } else {
            mx(0);
            my(0);
          }
        };
        const onLeave = () => {
          mx(0);
          my(0);
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", onLeave);
        });
      });
      return () => cleanups.forEach((fn) => fn());
    });
    return () => mm.revert();
  }, []);

  // ── CH-08 — tilt 3D sutil nos cards das seções em fluxo. Dirige
  //    @property --rx/--ry (consumidos no transform CSS); só telas
  //    largas + motion permitido; limpa listeners ao desmontar. ──
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 721px) and (prefers-reduced-motion: no-preference)", () => {
      const cards = gsap.utils.toArray<HTMLElement>(
        ".ch6-stage, .chsig-card, .ch7-voice",
      );
      const cleanups: Array<() => void> = [];
      cards.forEach((card) => {
        const rx = gsap.quickTo(card, "--rx", { duration: 0.5, ease: "power3" });
        const ry = gsap.quickTo(card, "--ry", { duration: 0.5, ease: "power3" });
        const onMove = (e: PointerEvent) => {
          const r = card.getBoundingClientRect();
          rx(((e.clientX - r.left) / r.width - 0.5) * 6);
          ry(-((e.clientY - r.top) / r.height - 0.5) * 5);
        };
        const onLeave = () => {
          rx(0);
          ry(0);
        };
        card.addEventListener("pointermove", onMove);
        card.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          card.removeEventListener("pointermove", onMove);
          card.removeEventListener("pointerleave", onLeave);
        });
      });
      return () => cleanups.forEach((fn) => fn());
    });
    return () => mm.revert();
  }, []);

  // ── CH-06 — accordion de FAQ com altura suave. Mantém o <details>
  //    nativo (a11y) mas intercepta o clique do <summary>: preventDefault
  //    nos dois caminhos (nós controlamos open/close), mede a altura DEPOIS
  //    de abrir, e trava contra duplo-toggle (Enter/Espaço também disparam
  //    click). Sob reduced-motion, toggle instantâneo. ──
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const faqs = gsap.utils.toArray<HTMLDetailsElement>(".ch8-faq");
    const cleanups: Array<() => void> = [];
    faqs.forEach((d) => {
      const summary = d.querySelector<HTMLElement>("summary");
      const a = d.querySelector<HTMLElement>(".ch8-faq__a");
      if (!summary || !a) return;
      const state = d as HTMLDetailsElement & { _anim?: boolean };
      const onClick = (e: Event) => {
        e.preventDefault();
        if (reduced) {
          d.open = !d.open;
          return;
        }
        if (state._anim) return;
        state._anim = true;
        const done = () => {
          a.style.height = "";
          a.style.opacity = "";
          state._anim = false;
        };
        if (d.open) {
          gsap.to(a, {
            height: 0,
            opacity: 0,
            duration: 0.32,
            ease: "rk-io",
            onComplete: () => {
              d.open = false;
              done();
            },
          });
        } else {
          d.open = true; // display:block (CSS) antes de medir
          gsap.fromTo(
            a,
            { height: 0, opacity: 0 },
            { height: "auto", opacity: 1, duration: 0.44, ease: "rk-expo", onComplete: done },
          );
        }
      };
      summary.addEventListener("click", onClick);
      cleanups.push(() => summary.removeEventListener("click", onClick));
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  // ── CH-09 — ao trocar o ciclo de cobrança, o preço/mês "rola" até o
  //    novo valor (count-up). O bloco de preço remonta via key={period},
  //    então o efeito roda a cada troca. Só telas largas + motion ok;
  //    em mobile/reduced o valor apenas atualiza. ──
  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 721px)").matches;
    if (reduced || !wide) return;
    const ctx = gsap.context(() => {
      gsap.from(".ch5-card__val", {
        textContent: 0,
        snap: { textContent: 1 },
        duration: 0.5,
        ease: "rk-settle",
        stagger: 0.04,
      });
    });
    return () => ctx.revert();
  }, [period]);

  // calcula o destino: o Cap. 6 começa logo após o fim do Cap. 5,
  // então um viewport antes dele é a cena dos planos já revelada
  const plansScrollTarget = () => {
    const ch6 = document.querySelector<HTMLElement>(".ch6");
    return ch6
      ? Math.max(0, ch6.offsetTop - window.innerHeight)
      : document.documentElement.scrollHeight;
  };

  const goToPlans = () => {
    // Ponto sem retorno: se o usuário já passou dos planos, não há
    // como voltar — os planos ficam para trás do piso travado.
    if (lockArmedRef.current) {
      const ch6 = document.querySelector<HTMLElement>(".ch6");
      const floor = ch6 ? ch6.offsetTop : 0;
      if (lenisRef.current) lenisRef.current.scrollTo(floor, { immediate: true });
      else window.scrollTo(0, floor);
      return;
    }
    // Ainda no portal: abre o gateway e enfileira a rolagem para
    // quando o radar liberar (useEffect abaixo flusha a fila)
    if (!revealed) {
      pendingScrollRef.current = true;
      onEnter?.();
      return;
    }
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(plansScrollTarget(), { duration: 2.6 });
    } else {
      document
        .querySelector(".ch5-stage")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // flusha a rolagem enfileirada assim que o radar abrir
  useEffect(() => {
    if (!revealed || !pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    // pequeno delay para o lenis e o layout assentarem
    const id = window.setTimeout(() => {
      const lenis = lenisRef.current;
      if (lenis) lenis.scrollTo(plansScrollTarget(), { duration: 2.4 });
    }, 220);
    return () => window.clearTimeout(id);
  }, [revealed]);

  // ── conta e acesso — helpers ─────────────────────────────────

  // estado + localStorage andam juntos (o reload do link de email
  // recupera a pendência de checkout do storage)
  const setPendingPlan = (p: PendingCheckout | null) => {
    setPendingPlanState(p);
    if (p) salvarPlanoPendente(p);
    else limparPlanoPendente();
  };

  const avisar = (msg: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  };
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  // sair — encerra a sessão e reconfere com o servidor; os botões do
  // header voltam ao estado anônimo sem recarregar a página
  const sair = async () => {
    await logout();
    await refresh();
  };

  // assinante gerencia o plano no Customer Portal — não há 2º checkout
  const abrirPortal = async (): Promise<void> => {
    try {
      const { url } = await portal();
      window.location.href = url;
    } catch (err) {
      avisar(
        err instanceof AuthApiError ? err.message : "Não foi possível abrir o portal.",
      );
    }
  };

  // dispara o checkout do Stripe e redireciona para a página hospedada
  const iniciarCheckout = async (plan: CheckoutPlan, cycle: BillingCycle): Promise<void> => {
    setCheckoutBusy(plan);
    try {
      const { url } = await checkout(plan, cycle);
      limparPlanoPendente();
      window.location.href = url;
      // sem reset do busy — a página está saindo
    } catch (err) {
      setCheckoutBusy(null);
      if (err instanceof AuthApiError && err.code === "EMAIL_NAO_VERIFICADO") {
        setOverlay({ mode: "verify-pending" });
        return;
      }
      if (err instanceof AuthApiError && err.code === "NAO_AUTENTICADO") {
        setOverlay({ mode: "login" });
        return;
      }
      if (err instanceof AuthApiError && err.code === "ASSINATURA_JA_ATIVA") {
        // 409: já assina — avisa e encaminha ao portal (cobrança dupla, nunca)
        setPendingPlan(null);
        avisar(err.message);
        void abrirPortal();
        return;
      }
      avisar(
        err instanceof AuthApiError
          ? err.message
          : "Não foi possível abrir o checkout. Tente novamente.",
      );
    }
  };

  // CTA dos cards do Capítulo 5 — o destino depende de quem clica
  const onPlanCta = (planId: PlanId) => {
    // Mesa = venda assistida, sem checkout
    if (planId === "mesa") {
      window.location.href = MAILTO_MESA;
      return;
    }
    // billing desligado neste ambiente — aviso honesto, sem chamar o endpoint
    if (config && !config.billing_enabled) {
      avisar("Pagamento ainda não habilitado neste ambiente — escreva para contato@genesislabs.com.br.");
      return;
    }
    const escolha: PendingCheckout = { plan: planId, period };
    if (status !== "authed" || !user) {
      setPendingPlan(escolha);
      setOverlay({ mode: "signup" });
      return;
    }
    if (!user.is_verified) {
      setPendingPlan(escolha);
      setOverlay({ mode: "verify-pending" });
      return;
    }
    // já assina — o destino certo é o Customer Portal (trocar de plano
    // por lá), nunca um segundo checkout
    if (hasActiveSub(user)) {
      avisar("Você já tem uma assinatura ativa — gerencie seu plano no portal.");
      void abrirPortal();
      return;
    }
    void iniciarCheckout(escolha.plan, escolha.period);
  };

  // ── deep links — ?auth=... | ?checkout=cancelado (e plan/period) ──
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const auth = qs.get("auth");
    const token = qs.get("token");
    const plan = qs.get("plan");
    const periodQ = qs.get("period");
    const checkoutQ = qs.get("checkout");
    if (!auth && !checkoutQ && !plan) return;

    // plano + ciclo pré-selecionados (ex.: ?auth=signup&plan=varredura&period=anual)
    if (plan === "sinal" || plan === "varredura") {
      const ciclo: PeriodId =
        periodQ === "mensal" || periodQ === "semestral" || periodQ === "anual"
          ? periodQ
          : "anual";
      setPeriod(ciclo);
      setPendingPlan({ plan, period: ciclo });
    }

    if (auth === "login" || auth === "signup") setOverlay({ mode: auth });
    else if (auth === "verify") setOverlay({ mode: "verify-confirm", token });
    else if (auth === "reset") setOverlay({ mode: "reset", token });
    else if (auth === "plans") goToPlans();

    if (checkoutQ === "cancelado") {
      avisar("Checkout cancelado — os planos seguem aqui quando você quiser.");
    }

    // limpa a query para o link não re-disparar em refresh/navegação
    window.history.replaceState(null, "", window.location.pathname);
    // roda uma única vez, na montagem — goToPlans/avisar são estáveis o bastante
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="landing">
      <canvas className="lp-canvas" ref={canvasRef} />
      <div className="lp-labels" ref={labelLayerRef} aria-hidden="true" />

      <header className="lp-nav">
        <a
          className="lp-nav__brand"
          href="/landing.html"
          aria-label="Genesis Radar — voltar ao topo"
          onClick={(e) => {
            e.preventDefault();
            // Ponto sem retorno: depois dos planos, o topo fica travado;
            // o destino máximo de subida é o piso (topo do Cap. 6).
            if (lockArmedRef.current) {
              const ch6 = document.querySelector<HTMLElement>(".ch6");
              const floor = ch6 ? ch6.offsetTop : 0;
              if (lenisRef.current) lenisRef.current.scrollTo(floor, { immediate: true });
              else window.scrollTo(0, floor);
              return;
            }
            if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 1.6 });
            else window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <svg className="lp-nav__mark" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9.4" />
            <circle cx="12" cy="12" r="5.4" />
            <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
            <line x1="12" y1="12" x2="20.6" y2="6.6" />
          </svg>
          <span className="lp-nav__name">Genesis Radar</span>
        </a>
        <nav className="lp-nav__btns" aria-label="Conta">
          <button
            type="button"
            className="lp-nav__btn lp-nav__btn--primary"
            onClick={goToPlans}
          >
            <svg className="lp-nav__btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20V10h4v10M10 20V6h4v14M16 20V8h4v12" />
              <path d="M3 20.2h18" />
            </svg>
            <span className="lp-nav__btn-label">Ver planos</span>
          </button>
          <button type="button" className="lp-nav__btn">
            <svg className="lp-nav__btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5.5" width="18" height="13" />
              <path d="M3 6l9 7 9-7" />
            </svg>
            <span className="lp-nav__btn-label">Boletim</span>
          </button>
          <button type="button" className="lp-nav__btn">
            <svg className="lp-nav__btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span className="lp-nav__btn-label">Nossa história</span>
          </button>
          {status === "authed" ? (
            <>
              {/* sessão aberta — conta dá lugar ao acesso direto ao app */}
              <button
                type="button"
                className="lp-nav__btn"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                <svg className="lp-nav__btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9.4" />
                  <circle cx="12" cy="12" r="5.4" />
                  <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
                  <line x1="12" y1="12" x2="20.6" y2="6.6" />
                </svg>
                <span className="lp-nav__btn-label">Abrir o radar</span>
              </button>
              <button type="button" className="lp-nav__btn" onClick={() => void sair()}>
                <svg className="lp-nav__btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 4H6v16h8" />
                  <path d="M10.5 12H21M17 7.5 21.5 12 17 16.5" />
                </svg>
                <span className="lp-nav__btn-label">Sair</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="lp-nav__btn"
                onClick={() => setOverlay({ mode: "signup" })}
              >
                <svg className="lp-nav__btn-icon" viewBox="0 0 26 24" aria-hidden="true">
                  <circle cx="9.6" cy="8" r="3.7" />
                  <path d="M3 20c0-3.9 3-6.4 6.6-6.4 1 0 2 .15 2.9.45" />
                  <path d="M19 12.4v7.2M15.4 16h7.2" />
                </svg>
                <span className="lp-nav__btn-label">Criar conta</span>
              </button>
              <button
                type="button"
                className="lp-nav__btn"
                onClick={() => setOverlay({ mode: "login" })}
              >
                <svg className="lp-nav__btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.7" />
                  <path d="M5.2 20c0-3.9 3-6.4 6.8-6.4s6.8 2.5 6.8 6.4" />
                </svg>
                <span className="lp-nav__btn-label">Fazer login</span>
              </button>
            </>
          )}
        </nav>
      </header>

      <footer className="lp-footer">
        <span className="lp-footer__org">{CONTROLADOR.razao_social}</span>
        <nav className="lp-footer__links" aria-label="Documentos legais">
          <button type="button" className="lp-footer__link" onClick={() => setShowPriv(true)}>
            Política de Privacidade
          </button>
          <span className="lp-footer__sep" aria-hidden="true">
            ·
          </span>
          <button type="button" className="lp-footer__link" onClick={() => setShowTermos(true)}>
            Termos de Uso
          </button>
          <span className="lp-footer__sep" aria-hidden="true">
            ·
          </span>
          <a className="lp-footer__link" href="mailto:contato@genesislabs.com.br?subject=Fale%20conosco">
            Fale conosco
          </a>
        </nav>
      </footer>

      {/* CTA persistente — surge quando a esfera clareia, segue até o fim */}
      <button type="button" className="lp-cta" onClick={goToPlans}>
        Ver planos
        <svg className="lp-cta__arrow" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12h14M12 5.5 18.5 12 12 18.5" />
        </svg>
      </button>

      <div className="lp-stage">
        <div className="hero__frame" aria-hidden="true">
          <span className="hero__corner hero__corner--tl" />
          <span className="hero__corner hero__corner--tr" />
          <span className="hero__corner hero__corner--bl" />
          <span className="hero__corner hero__corner--br" />
        </div>

        <div className="hero__hud">
          <span className="hero__hud-dot" />
          <span className="hero__hud-read" ref={readoutRef}>
            AZ 247&deg;
          </span>
          <span className="hero__hud-label">varredura ativa</span>
        </div>

        <div className="hero__cue">
          role para varrer o campo
          <span className="hero__cue-line" />
        </div>

        <div className="respiro__copy">
          <p className="respiro__line">
            {RESPIRO_WORDS.map((w, i) => (
              <span key={i} className={w.em ? "respiro__w respiro__w--em" : "respiro__w"}>
                {w.t}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="lp-scroll" aria-hidden="true" />

      {/* ── Capítulo 2 — Convergência ────────────────────────────── */}
      <section className="ch2-stage" aria-label="Capítulo 2 — Convergência">
        <span className="ch2-eyebrow">Convergência</span>
        <span className="ch2-sources">Fontes públicas oficiais</span>

        <div className="ch2-scene">
          {CH2_MOTES.map((m, i) => (
            <span className="ch2-mote" key={i} aria-hidden="true" style={{ width: m.w }} />
          ))}

          <article className="ch2-dossier">
            <span className="ch2-dossier__corner ch2-dossier__corner--tl" aria-hidden="true" />
            <span className="ch2-dossier__corner ch2-dossier__corner--tr" aria-hidden="true" />
            <span className="ch2-dossier__corner ch2-dossier__corner--bl" aria-hidden="true" />
            <span className="ch2-dossier__corner ch2-dossier__corner--br" aria-hidden="true" />

            <span className="ch2-dossier__eyebrow">Empresa em análise</span>
            <span className="ch2-dossier__cnpj">CNPJ ██.███.███/0001-██</span>
            <span className="ch2-dossier__desc">
              Fabricação de esquadrias de metal · São Paulo / SP
            </span>

            <span className="ch2-dossier__rule" aria-hidden="true" />

            <span className="ch2-dossier__rev-label">Faturamento anual</span>
            <span className="ch2-dossier__redact" aria-hidden="true" />
            <span className="ch2-dossier__rev-note">valor que nenhuma base pública declara</span>
          </article>
        </div>

        <p className="ch2-close">
          <span className="ch2-close__lead">Nenhuma base pública declara esse faturamento.</span>
          <span className="ch2-close__sub">
            Mas dezenas de fontes públicas oficiais o cercam.
          </span>
        </p>
      </section>
      <div className="ch2-track" aria-hidden="true" />

      {/* ── Capítulo 3 — A estimativa ────────────────────────────── */}
      <section className="ch3-stage" aria-label="Capítulo 3 — A estimativa">
        <span className="ch3-eyebrow">A estimativa</span>

        <div className="ch3-reveal">
          <span className="ch3-company">
            Fabricação de esquadrias de metal · CNPJ ██.███.███/0001-██
          </span>
          <span className="ch3-reveal__label">Faturamento anual estimado</span>
          <span className="ch3-amount">
            <span className="ch3-amount__value">R$ 24,3 mi</span>
            <span className="ch3-amount__redact" aria-hidden="true" />
          </span>
          <div className="ch3-range">
            <span className="ch3-range__end">
              <span className="ch3-range__tag">mínimo</span>
              <span className="ch3-range__num">R$ 20,7 mi</span>
            </span>
            <span className="ch3-range__bar" aria-hidden="true">
              <span className="ch3-range__track" />
              <span className="ch3-range__mark" />
            </span>
            <span className="ch3-range__end">
              <span className="ch3-range__tag">máximo</span>
              <span className="ch3-range__num">R$ 27,9 mi</span>
            </span>
          </div>

          <span className="ch3-seal">
            <svg className="ch3-seal__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
            Fonte pública oficial · auditável
          </span>
        </div>

        <p className="ch3-close">
          <span className="ch3-close__lead">
            A precisão do mercado de elite — só com fonte pública oficial.
          </span>
          <span className="ch3-close__sub">
            Nenhum outro produto reconstrói esse número assim.
          </span>
        </p>
      </section>
      <div className="ch3-track" aria-hidden="true" />

      {/* ── Capítulo 4 — O universo ──────────────────────────────── */}
      <section className="ch4-stage" aria-label="Capítulo 4 — O universo">
        <span className="ch4-eyebrow">O universo</span>

        <div className="ch4-panel">
          <span className="ch4-count" aria-label="46.255">
            <Reels value="46.255" />
          </span>
          <span className="ch4-count__label">empresas de capital fechado no radar</span>
        </div>

        <p className="ch4-close">
          <span className="ch4-close__lead">Você esteve dentro de uma delas.</span>
          <span className="ch4-close__sub">
            As outras 46.254 já estão no radar — cada uma com seu número.
          </span>
        </p>
      </section>
      <div className="ch4-track" aria-hidden="true" />

      {/* ── Capítulo 5 — Os planos ───────────────────────────────── */}
      <section className="ch5-stage" aria-label="Os planos">
        <span className="ch5-eyebrow">Os planos</span>

        <p className="ch5-lead">
          <span className="ch5-lead__line">
            Seu próximo negócio está em um destes 46.255 pontos.
          </span>
          <span className="ch5-lead__sub">
            Escolha o ciclo — quanto mais longo o compromisso, menor o mês.
          </span>
        </p>

        <div className="ch5-toggle" role="group" aria-label="Ciclo de cobrança">
          <span
            className="ch5-toggle__thumb"
            aria-hidden="true"
            style={{ transform: `translateX(${periodIndex * 100}%)` }}
          />
          {CH5_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === period ? "ch5-toggle__opt is-active" : "ch5-toggle__opt"}
              aria-pressed={p.id === period}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
              {p.discount > 0 && (
                <span className="ch5-toggle__save">
                  {`−${Math.round(p.discount * 100)}%`}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* CTAs dos cards — anônimo abre cadastro; verificado vai ao checkout */}
        <div className="ch5-cards">
          {CH5_PLANS.map((plan) => {
            // Mesmo cálculo do seed do Stripe: total = round(base × meses × desconto),
            // garantindo que o valor anunciado bate com o cobrado no checkout.
            const total = Math.round(
              plan.monthly * activePeriod.months * (1 - activePeriod.discount),
            );
            const perMonth = Math.round(total / activePeriod.months);
            const billing =
              activePeriod.months === 1
                ? "cobrado mês a mês"
                : `${brl(total)} ${activePeriod.months === 6 ? "a cada 6 meses" : "por ano"}`;
            return (
              <article
                key={plan.name}
                className={
                  "ch5-card ch5-card--" + plan.slot + (plan.featured ? " is-featured" : "")
                }
              >
                {plan.featured && <span className="ch5-card__badge">Recomendado</span>}
                {plan.featured && <span className="ch5-sweep" aria-hidden="true" />}
                <span className="ch5-card__name">{plan.name}</span>
                <span className="ch5-card__tagline">{plan.tagline}</span>

                <div className="ch5-card__pricing" key={period}>
                  <span className="ch5-card__price">
                    <span className="ch5-card__cur">R$</span>
                    <span className="ch5-card__val">{perMonth.toLocaleString("pt-BR")}</span>
                    <span className="ch5-card__per">/mês</span>
                  </span>
                  <span className="ch5-card__bill">
                    {activePeriod.discount > 0 && (
                      <span className="ch5-card__was">{brl(plan.monthly)}/mês</span>
                    )}
                    <span>{billing}</span>
                  </span>
                </div>

                <span className="ch5-card__rule" aria-hidden="true" />

                <ul className="ch5-card__features">
                  {plan.features.map((feat) => (
                    <li key={feat} className="ch5-card__feat">
                      <svg className="ch5-card__check" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="ch5-card__cta"
                  disabled={checkoutBusy === plan.id}
                  title={
                    plan.id !== "mesa" && config !== null && !config.billing_enabled
                      ? "Pagamento ainda não habilitado neste ambiente."
                      : undefined
                  }
                  onClick={() => onPlanCta(plan.id)}
                >
                  {checkoutBusy === plan.id ? "Abrindo o checkout…" : plan.cta}
                  <svg className="ch5-card__cta-arrow" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12h14M12 5.5 18.5 12 12 18.5" />
                  </svg>
                </button>
              </article>
            );
          })}
        </div>

        <p className="ch5-note">
          Sem fidelidade — mude de plano ou cancele quando quiser.
        </p>
      </section>
      <div className="ch5-track" aria-hidden="true" />

      {/* ── Capítulo 6 — Como funciona ───────────────────────────────
          Infográfico do fluxo: fontes nomeadas → cruzamento → faixa.
          Seção em fluxo normal, rola entre header e footer fixos. */}
      <section className="ch6" aria-label="Como funciona">
        <div className="ch6-head">
          <span className="ch6-eyebrow">Como funciona</span>
          <Words className="ch6-title" text="Do dado público ao número que ninguém publica." />
          <p className="ch6-sub">
            Três passos entre uma fonte oficial e uma estimativa que se sustenta.
          </p>
        </div>

        <div className="ch6-flow" role="presentation">
          {/* 01 — Fontes públicas oficiais */}
          <div className="ch6-stage ch6-stage--sources">
            <span className="ch6-stage__corner ch6-stage__corner--tl" aria-hidden="true" />
            <span className="ch6-stage__corner ch6-stage__corner--tr" aria-hidden="true" />
            <span className="ch6-stage__corner ch6-stage__corner--bl" aria-hidden="true" />
            <span className="ch6-stage__corner ch6-stage__corner--br" aria-hidden="true" />
            <span className="ch6-stage__n">01</span>
            <h3 className="ch6-stage__title">Fontes públicas oficiais</h3>
            <div className="ch6-sources">
              {CH6_SOURCES.map((s) => (
                <div className="ch6-source" key={s.acronym}>
                  <span className="ch6-source__acr">{s.acronym}</span>
                  <span className="ch6-source__full">{s.full}</span>
                </div>
              ))}
            </div>
            <p className="ch6-stage__desc">
              Registros do governo brasileiro — nada de dado cinza, vazado ou comprado.
            </p>
          </div>

          <span className="ch6-link" aria-hidden="true">
            <svg viewBox="0 0 64 16">
              <path d="M0 8h54" />
              <path d="M48 3l6 5-6 5" />
            </svg>
          </span>

          {/* 02 — Cruzamento independente */}
          <div className="ch6-stage ch6-stage--cross">
            <span className="ch6-stage__corner ch6-stage__corner--tl" aria-hidden="true" />
            <span className="ch6-stage__corner ch6-stage__corner--tr" aria-hidden="true" />
            <span className="ch6-stage__corner ch6-stage__corner--bl" aria-hidden="true" />
            <span className="ch6-stage__corner ch6-stage__corner--br" aria-hidden="true" />
            <span className="ch6-stage__n">02</span>
            <h3 className="ch6-stage__title">Cruzamento independente</h3>
            <div className="ch6-instrument" aria-hidden="true">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" />
                <circle cx="60" cy="60" r="34" />
                <circle cx="60" cy="60" r="18" />
                <circle cx="60" cy="60" r="3.5" fill="currentColor" stroke="none" />
                <path d="M60 6v10M60 104v10M6 60h10M104 60h10" />
                <path className="ch6-instrument__sweep" d="M60 60L96 28" />
              </svg>
            </div>
            <p className="ch6-stage__desc">
              Sinais de origens diferentes se cruzam e se conferem — convergência vira selo de confiança.
            </p>
          </div>

          <span className="ch6-link" aria-hidden="true">
            <svg viewBox="0 0 64 16">
              <path d="M0 8h54" />
              <path d="M48 3l6 5-6 5" />
            </svg>
          </span>

          {/* 03 — Estimativa auditável */}
          <div className="ch6-stage ch6-stage--output">
            <span className="ch6-stage__corner ch6-stage__corner--tl" aria-hidden="true" />
            <span className="ch6-stage__corner ch6-stage__corner--tr" aria-hidden="true" />
            <span className="ch6-stage__corner ch6-stage__corner--bl" aria-hidden="true" />
            <span className="ch6-stage__corner ch6-stage__corner--br" aria-hidden="true" />
            <span className="ch6-stage__n">03</span>
            <h3 className="ch6-stage__title">Estimativa auditável</h3>
            <div className="ch6-output">
              <span className="ch6-output__label">Faturamento anual estimado</span>
              <span className="ch6-output__point">R$ 24,3 mi</span>
              <div className="ch6-output__range">
                <span className="ch6-output__end">
                  <span className="ch6-output__tag">mín</span>
                  <span className="ch6-output__num">R$ 20,7</span>
                </span>
                <span className="ch6-output__bar" aria-hidden="true">
                  <span className="ch6-output__track" />
                  <span className="ch6-output__mark" />
                </span>
                <span className="ch6-output__end">
                  <span className="ch6-output__tag">máx</span>
                  <span className="ch6-output__num">R$ 27,9</span>
                </span>
              </div>
              <span className="ch6-output__badge">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
                alta confiança · validado
              </span>
            </div>
            <p className="ch6-stage__desc">
              Intervalo honesto, caso a caso — rastreável de volta até a fonte.
            </p>
          </div>
        </div>

        <p className="ch6-foot">
          Você vê a origem e a margem de cada estimativa — o cálculo fino é o nosso ofício.
        </p>
      </section>

      {/* ── Capítulo 6½ — Inteligência de saúde ──────────────────────
          Seção em fluxo normal (como Cap. 6/7). Enquadra a camada de
          risco SEMPRE pelo lado positivo: é uma capacidade do radar —
          "nós acompanhamos esses sinais por você" — não um alarme. */}
      <section className="chsig" aria-label="Inteligência de saúde empresarial">
        <div className="chsig-head">
          <span className="chsig-eyebrow">Inteligência de saúde</span>
          <Words className="chsig-title" text="O radar também acompanha a solidez de cada empresa." />
          <p className="chsig-sub">
            Além do faturamento, mostramos os sinais públicos que confirmam com
            quem vale a pena conversar — monitorados por você, da fonte oficial.
          </p>
        </div>

        <div className="chsig-cards">
          {/* 01 — Saúde fiscal (PGFN) */}
          <article className="chsig-card">
            <span className="chsig-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3Z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            <h3 className="chsig-card__title">Saúde fiscal</h3>
            <p className="chsig-card__text">
              Cruzamos cada CNPJ com a Dívida Ativa da União. Você reconhece de
              imediato quem está em dia — selo verde automático.
            </p>
            <span className="chsig-card__tag">Fonte: PGFN · oficial</span>
          </article>

          {/* 02 — Estabilidade do setor (Datajud) */}
          <article className="chsig-card">
            <span className="chsig-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 4v16M5 8h14M7 8l-3 6h6l-3-6Zm10 0l-3 6h6l-3-6Z" />
                <path d="M4 20h16" />
              </svg>
            </span>
            <h3 className="chsig-card__title">Estabilidade do setor</h3>
            <p className="chsig-card__text">
              O termômetro de recuperações e falências da região, atualizado pelo
              CNJ. Contexto vivo para ler cada oportunidade com firmeza.
            </p>
            <span className="chsig-card__tag">Fonte: CNJ Datajud · oficial</span>
          </article>

          {/* 03 — Reputação pública (Querido Diário + Protestos) */}
          <article className="chsig-card">
            <span className="chsig-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="M11 7v4l3 2M20 20l-4-4" />
              </svg>
            </span>
            <h3 className="chsig-card__title">Reputação pública</h3>
            <p className="chsig-card__text">
              Acompanhamos menções em Diários Oficiais e protestos em cartório, sob
              demanda — sinais que confirmam a reputação de quem você procura.
            </p>
            <span className="chsig-card__tag">Fonte: Querido Diário · CENPROT</span>
          </article>
        </div>

        {/* Faixa de valor — tudo positivo: já vem incluído */}
        <div className="chsig-strip" role="presentation">
          <span className="chsig-strip__item">
            <strong>Incluído no plano</strong>
            <span>sem custo por consulta</span>
          </span>
          <span className="chsig-strip__sep" aria-hidden="true" />
          <span className="chsig-strip__item">
            <strong>100% fonte pública</strong>
            <span>oficial e rastreável</span>
          </span>
          <span className="chsig-strip__sep" aria-hidden="true" />
          <span className="chsig-strip__item">
            <strong>Auditável até a origem</strong>
            <span>cada sinal com sua fonte</span>
          </span>
        </div>

        <p className="chsig-foot">
          Faturamento, saúde fiscal e reputação — o retrato inteiro de cada
          empresa, num só lugar.
        </p>
      </section>

      {/* ── Capítulo 7 — Quem usa o radar ────────────────────────────
          Depoimentos. Conteúdo PLACEHOLDER — ver aviso em CH7_VOICES. */}
      <section className="ch7" aria-label="Quem usa o radar">
        <div className="ch7-head">
          <span className="ch7-eyebrow">Quem usa o radar</span>
          <Words className="ch7-title" text="Na rotina de quem decide." />
          <p className="ch7-sub">
            Analistas e sócios de M&amp;A que vivem de originar negócios.
          </p>
        </div>

        <ul className="ch7-voices">
          {CH7_VOICES.map((v) => (
            <li
              className={"ch7-voice" + (v.featured ? " ch7-voice--featured" : "")}
              key={v.name}
            >
              <span className="ch7-voice__corner ch7-voice__corner--tl" aria-hidden="true" />
              <span className="ch7-voice__corner ch7-voice__corner--tr" aria-hidden="true" />
              <span className="ch7-voice__corner ch7-voice__corner--bl" aria-hidden="true" />
              <span className="ch7-voice__corner ch7-voice__corner--br" aria-hidden="true" />
              <span className="ch7-voice__mark" aria-hidden="true">
                &ldquo;
              </span>
              <p className="ch7-voice__quote">{v.quote}</p>
              <span className="ch7-voice__rule" aria-hidden="true" />
              <footer className="ch7-voice__by">
                <span className="ch7-voice__avatar" aria-hidden="true">
                  {initials(v.name)}
                </span>
                <span className="ch7-voice__id">
                  <span className="ch7-voice__name">{v.name}</span>
                  <span className="ch7-voice__role">
                    {v.role} · {v.org}
                  </span>
                </span>
              </footer>
            </li>
          ))}
        </ul>

        <div className="ch7-foot">
          <p className="ch7-foot__line">O mercado fechado, no seu radar.</p>
          <button type="button" className="ch7-foot__cta" onClick={goToPlans}>
            Conhecer os planos
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 19.5V5M5.5 11.5 12 5l6.5 6.5" />
            </svg>
          </button>
        </div>
      </section>

      {/* ── Capítulo 8 — Perguntas frequentes ────────────────────────
          FAQ accordion (native <details>) em 2 colunas. */}
      <section className="ch8" aria-label="Perguntas frequentes">
        <div className="ch8-head">
          <span className="ch8-eyebrow">Perguntas frequentes</span>
          <Words className="ch8-title" text="O que costumamos ouvir antes do primeiro número." />
          <p className="ch8-sub">
            Respostas diretas — se a sua dúvida não estiver aqui, fale com a gente.
          </p>
        </div>

        <div className="ch8-faqs">
          {[0, 1].map((col) => (
            <div className="ch8-col" key={col}>
              {CH8_FAQ.slice(col * 3, col * 3 + 3).map((item) => (
                <details className="ch8-faq" key={item.q}>
                  <summary className="ch8-faq__q">
                    <span>{item.q}</span>
                    <svg className="ch8-faq__icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 9l7 7 7-7" />
                    </svg>
                  </summary>
                  <div className="ch8-faq__a">
                    <p>{item.a}</p>
                  </div>
                </details>
              ))}
            </div>
          ))}
        </div>

        <p className="ch8-foot">
          Sua dúvida não está aqui?{" "}
          <a
            className="ch8-foot__link"
            href="mailto:contato@genesislabs.com.br?subject=D%C3%BAvida"
          >
            Fale com a gente
          </a>
          .
        </p>
      </section>

      {/* modais legais — acionados pelos campos do footer */}
      <TermosModal open={showTermos} onClose={() => setShowTermos(false)} />
      <PrivacidadeModal open={showPriv} onClose={() => setShowPriv(false)} />

      {/* overlay de conta — login, cadastro, verificação, reset */}
      {overlay && (
        <AuthOverlay
          mode={overlay.mode}
          token={overlay.token}
          pending={pendingPlan}
          onClose={() => setOverlay(null)}
          onCheckout={iniciarCheckout}
          onGoToPlans={() => {
            setOverlay(null);
            goToPlans();
          }}
        />
      )}

      {/* aviso discreto — checkout cancelado, billing desligado etc. */}
      {toast && (
        <div className="ax-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
