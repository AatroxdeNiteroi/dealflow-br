/** Catálogo de termos do produto — cada um vira modal premium ao clicar.
 *  Tom: enigmático, confiável, M&A boutique. Sem revelar fontes específicas
 *  nem fórmulas internas. */
import type { ReactNode } from "react";

export interface TermCriterion {
  label: string;
  value: ReactNode;
}

export interface TermDef {
  /** Título display (Playfair italic) */
  title: string;
  /** Tag sutil acima (mono caps), opcional */
  eyebrow?: string;
  /** Parágrafo principal — apresentação enigmática mas precisa */
  intro: ReactNode;
  /** Critérios objetivos (pares label/valor) */
  criteria?: TermCriterion[];
  /** Contexto de uso M&A — quando esse termo importa */
  context?: ReactNode;
  /** Avisos / limitações honestas */
  warning?: ReactNode;
}

/* ───────────────────── ARCHETYPES ──────────────────────── */

export const ARCHETYPE_DEFS: Record<string, TermDef> = {
  family_mature_sweet_spot: {
    eyebrow: "Archetype · Magic Filter",
    title: "Family Mature",
    intro: (
      <>
        Perfil canônico de <strong>sucessão familiar em curso</strong>. Empresa de
        segunda ou terceira geração com porte operacional consolidado, possível
        cansaço dos sócios fundadores e potencial latente de profissionalização —
        primeiro filtro de qualquer search fund ou boutique M&amp;A.
      </>
    ),
    criteria: [
      { label: "Sócios pessoa física", value: "2 a 4" },
      { label: "Idade da empresa", value: "≥ 10 anos" },
      { label: "Vínculos ativos", value: "20 a 200" },
      { label: "Sem sócio PJ", value: "(holding excluída)" },
    ],
    context: (
      <>
        São empresas com massa operacional real, histórico estabelecido e quadro
        societário enxuto o suficiente para uma transação viável. Tipicamente
        Ltdas industriais, varejistas ou serviços B2B em RJ/SP.
      </>
    ),
  },

  labor_intensive_midcap: {
    eyebrow: "Archetype · Operacional",
    title: "Labor Mid-Cap",
    intro: (
      <>
        Indústria ou serviço de <strong>mão de obra intensiva</strong> em escala de
        médio porte. Margem operacional tipicamente apertada, baixa intensidade de
        capital, foco em volume e eficiência.
      </>
    ),
    criteria: [
      { label: "Capital por funcionário", value: "< R$ 30 k" },
      { label: "Vínculos ativos", value: "50 a 500" },
      { label: "Setor típico", value: "B · C · F · G" },
    ],
    context: (
      <>
        Frigoríficos, têxtil/confecção, terceirização (segurança, limpeza),
        construção, varejo de massa. A reconstrução de receita aqui é
        especialmente confiável — a folha é o principal custo.
      </>
    ),
  },

  capital_intensive: {
    eyebrow: "Archetype · Estrutural",
    title: "Capital Intensive",
    intro: (
      <>
        Indústria pesada com <strong>alta intensidade de capital por funcionário</strong>.
        Tipicamente química, siderurgia, máquinas industriais, agro de larga escala.
        Receita por funcionário muito acima da média setorial.
      </>
    ),
    criteria: [
      { label: "Capital por funcionário", value: "> R$ 200 k" },
      { label: "Vínculos ativos", value: "> 50" },
      { label: "Setor típico", value: "B · C · D" },
    ],
    warning: (
      <>
        O modelo carrega viés residual para midcaps em setores dominados por
        grandes players capital-intensivos. Use a estimativa como ordem de
        magnitude, não como valor pontual.
      </>
    ),
  },

  holding_structure: {
    eyebrow: "Archetype · Estrutura de Controle",
    title: "Holding",
    intro: (
      <>
        Empresa cuja função primária é <strong>controlar outras empresas</strong>,
        não operar diretamente. Sinalizada por sócio pessoa jurídica no quadro e
        quadro societário reduzido.
      </>
    ),
    criteria: [
      { label: "Sócios PJ", value: "≥ 1" },
      { label: "Total de sócios", value: "≤ 3" },
      { label: "Vínculos ativos", value: "Tipicamente baixo" },
    ],
    warning: (
      <>
        A reconstrução via sinais operacionais <strong>não é apropriada</strong>{" "}
        para holdings — a receita real vem de dividendos das controladas, não da
        operação própria. Use o filtro para mapear estruturas societárias, não
        para triagem direta.
      </>
    ),
  },

  recent_startup: {
    eyebrow: "Archetype · Maturidade",
    title: "Startup",
    intro: (
      <>
        Empresa <strong>recém-criada</strong> (menos de 3 anos). O modelo é
        calibrado para empresas estabelecidas — para startups jovens, opera fora
        da zona de validade estatística plena.
      </>
    ),
    criteria: [
      { label: "Idade da empresa", value: "< 3 anos" },
    ],
    warning: (
      <>
        Capital subscrito frequentemente desproporcional ao headcount real
        (rondas de captação). Estimativa frágil — sugerido excluir do funil
        principal a menos que o foco da tese seja early-stage.
      </>
    ),
  },

  partnership_heavy_services: {
    eyebrow: "Archetype · Serviços Profissionais",
    title: "Partnership",
    intro: (
      <>
        Sociedade de <strong>serviços profissionais</strong> — advocacia,
        consultoria, engenharia, escritórios de TI boutique. Estrutura societária
        densa em relação ao headcount CLT.
      </>
    ),
    criteria: [
      { label: "Ratio sócios/funcionários", value: "> 0.1" },
      { label: "Setor (CNAE seção)", value: "M · J · K" },
    ],
    warning: (
      <>
        A reconstrução via vínculos CLT <strong>subestima sistematicamente</strong>{" "}
        — boa parte da remuneração nesses setores ocorre fora do regime CLT
        e não entra no modelo. Use a estimativa como piso, não como ponto.
      </>
    ),
  },

  financeiro_out_scope: {
    eyebrow: "Archetype · Fora do Escopo",
    title: "Financeiro",
    intro: (
      <>
        CNAE da seção K — atividades financeiras, de seguros e serviços relacionados.
        <strong> Fora do escopo</strong> das pesquisas estruturais que sustentam o
        modelo.
      </>
    ),
    criteria: [
      { label: "Setor (CNAE seção)", value: "K · Financeiro" },
    ],
    warning: (
      <>
        Razão aplicada é a de fallback por seção, com granularidade ampla.
        Bancos, seguradoras, corretoras e fintechs têm dinâmica financeira
        totalmente distinta da indústria/comércio — recomendado excluir do funil.
      </>
    ),
  },

  standard: {
    eyebrow: "Archetype · Default",
    title: "Standard",
    intro: (
      <>
        Empresa que <strong>não se encaixa</strong> em nenhum dos 7 padrões
        estruturais específicos. Maior parte do universo cai aqui — Ltdas
        operacionais sem sinal específico de holding, startup ou partnership.
      </>
    ),
    context: (
      <>
        Aplicar o filtro <em>Standard</em> isolado é equivalente a remover holdings,
        startups, financeiro e profissional do recorte. Útil para limpar o funil
        sem comprometer-se com archetype específico.
      </>
    ),
  },
};

/* ───────────────────── CONFIANÇA ──────────────────────── */

export const CONFIDENCE_DEFS: Record<string, TermDef> = {
  alta: {
    eyebrow: "Confiança · Tier Premium",
    title: "Alta",
    intro: (
      <>
        Estimativa com <strong>três sinais convergentes de qualidade</strong>:
        identidade confirmada em Tier primário, benchmark setorial robusto e
        razão aplicada em granularidade fina.
      </>
    ),
    criteria: [
      { label: "Identidade", value: "Tier 1 — única" },
      { label: "Benchmark", value: "≥ 100 vínculos no segmento × território" },
      { label: "Granularidade", value: "Fina por classe industrial" },
    ],
    context: (
      <>
        Margem de erro típica: ±15%. Adequado para construção de funil M&amp;A
        sem necessidade de validação adicional.
      </>
    ),
  },
  media: {
    eyebrow: "Confiança · Tier Padrão",
    title: "Média",
    intro: (
      <>
        Identidade confirmada e estimativa calibrada, com pelo menos um dos
        sinais em granularidade intermediária — benchmark setorial moderado ou
        razão em agrupamento intermediário.
      </>
    ),
    criteria: [
      { label: "Identidade", value: "Tier 1 ou Tier 2 score 3/3" },
      { label: "Benchmark", value: "30 a 100 vínculos" },
      { label: "Granularidade", value: "Agrupamento intermediário" },
    ],
    context: (
      <>
        Margem de erro típica: ±25 a 30%. Recomendado validar pontualmente
        empresas selecionadas antes de aprofundar análise.
      </>
    ),
  },
  baixa: {
    eyebrow: "Confiança · Tier Restrito",
    title: "Baixa",
    intro: (
      <>
        Pelo menos um sinal estrutural compromete a estimativa. Use o número como
        ordem de magnitude — não como ponto.
      </>
    ),
    criteria: [
      { label: "Acionado por", value: "Setor com remuneração fora do CLT · razão de fallback · benchmark < 30 vínculos" },
    ],
    warning: (
      <>
        Setores com remuneração predominantemente fora do regime CLT (TI,
        financeiro, consultoria) têm estrutura de folha que o modelo não capta
        diretamente.
      </>
    ),
  },
  sem_benchmark: {
    eyebrow: "Confiança · Sem Amostra",
    title: "Sem Benchmark",
    intro: (
      <>
        Município sem amostra estatisticamente suficiente no segmento específico
        da empresa. Sem benchmark, o modelo não emite estimativa numérica.
      </>
    ),
    context: (
      <>
        Tipicamente cidades pequenas em segmentos muito específicos. A empresa
        permanece no produto para visibilidade, mas sem estimativa numérica.
      </>
    ),
  },
};

/* ───────────────────── TIER ──────────────────────── */

export const TIER_DEFS: Record<string, TermDef> = {
  tier1: {
    eyebrow: "Identificação · Tier Primário",
    title: "Tier 1",
    intro: (
      <>
        Identidade da empresa <strong>confirmada por unicidade da chave
        composta</strong>: exatamente um candidato corresponde à linha de
        registro operacional via combinação multi-atributo (localização +
        segmento + natureza jurídica + território).
      </>
    ),
    criteria: [
      { label: "Candidatos na chave", value: "Exatamente 1" },
      { label: "Margem de identidade", value: "Nula — identidade matemática" },
    ],
    context: (
      <>
        Núcleo do produto. ~73 mil empresas identificadas com este nível de
        rigor — equivalente a uma due diligence de identidade formal.
      </>
    ),
  },
  tier2: {
    eyebrow: "Identificação · Desempate",
    title: "Tier 2 · Cascata Cruzada",
    intro: (
      <>
        Chaves com 2 a 5 candidatos por linha de registro, desempatadas por{" "}
        <strong>cascata de coerência cruzada</strong>: porte declarado, idade
        anterior ao ano-base, regime tributário.
      </>
    ),
    criteria: [
      { label: "Candidatos por chave", value: "2 a 5" },
      { label: "Critérios de desempate", value: "Porte + temporal + regime" },
      { label: "Confirmação", value: "Score ≥ 2 com top único" },
    ],
    context: (
      <>
        96% dos matches Tier 2 obtêm score 3/3 — qualidade comparável ao Tier 1.
        Se a cascata não desempata com clareza, a chave é descartada (não
        forçamos match ruim).
      </>
    ),
  },
};

/* ───────────────────── GÊNEROS (agregam várias espécies) ──────────────────────── */

export interface GenusDef {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  species: TermDef[];
  closing?: ReactNode;
}

export const ARCHETYPE_GENUS: GenusDef = {
  eyebrow: "Classificação · 8 perfis estruturais",
  title: "Archetypes",
  intro: (
    <>
      Cada empresa do universo é classificada em um dos 8 archetypes derivados
      de sinais estruturais públicos — composição societária, capital, idade,
      capital por funcionário, setor. <strong>Archetype não é fator no cálculo
      de receita</strong>; é filtro de produto para guiar a tese M&amp;A e
      separar o sinal do ruído estatístico.
    </>
  ),
  species: [
    ARCHETYPE_DEFS.family_mature_sweet_spot,
    ARCHETYPE_DEFS.labor_intensive_midcap,
    ARCHETYPE_DEFS.capital_intensive,
    ARCHETYPE_DEFS.holding_structure,
    ARCHETYPE_DEFS.partnership_heavy_services,
    ARCHETYPE_DEFS.recent_startup,
    ARCHETYPE_DEFS.financeiro_out_scope,
    ARCHETYPE_DEFS.standard,
  ],
  closing: (
    <>
      Os archetypes Family Mature, Labor Mid-Cap e Capital Intensive concentram
      a maior parte dos leads acionáveis para M&amp;A médio porte. Holding,
      Partnership, Financeiro e Startup carregam avisos honestos de limitação do
      modelo — devem ser tratados como contexto, não como targets.
    </>
  ),
};

export const CONFIDENCE_GENUS: GenusDef = {
  eyebrow: "Qualidade · 4 níveis de confiança",
  title: "Confiança",
  intro: (
    <>
      Cada estimativa é entregue com <strong>score qualitativo de confiança</strong>{" "}
      que combina três fatores objetivos: rigor da identidade, robustez do
      benchmark setorial e granularidade do modelo. O score permite filtrar o
      universo para o nível de certeza apropriado à tese.
    </>
  ),
  species: [
    CONFIDENCE_DEFS.alta,
    CONFIDENCE_DEFS.media,
    CONFIDENCE_DEFS.baixa,
    CONFIDENCE_DEFS.sem_benchmark,
  ],
  closing: (
    <>
      Para construção de funil M&amp;A inicial, recomendamos filtrar por{" "}
      <em>alta + média</em>. Para due diligence pontual, restrinja a{" "}
      <em>alta</em>. Para mapeamento de mercado amplo, todas se mantêm úteis
      enquanto a confiança for transparente ao usuário.
    </>
  ),
};

export const PRECISION_DEFS: Record<string, TermDef> = {
  alta: {
    eyebrow: "Granularidade · Fina",
    title: "Alta",
    intro: (
      <>
        Razão setorial aplicada em <strong>granularidade fina por classe
        industrial</strong>. Cobertura aproximada de 265 segmentos industriais
        com amostragem estatística robusta.
      </>
    ),
    criteria: [
      { label: "Granularidade", value: "Classe industrial específica" },
      { label: "Cobertura", value: "~265 segmentos" },
      { label: "Setores típicos", value: "Indústria (B · C)" },
    ],
    context: (
      <>
        Habilita confiança alta na estimativa final. Cada empresa recebe a
        razão específica do seu sub-setor, com ajuste adicional por faixa de
        pessoal ocupado.
      </>
    ),
  },
  media: {
    eyebrow: "Granularidade · Intermediária",
    title: "Média",
    intro: (
      <>
        Razão setorial aplicada em <strong>agrupamento intermediário</strong>{" "}
        do modelo (~44 categorias de serviços, ~49 de comércio). Não é a
        granularidade fina — empresas em sub-segmentos distintos podem
        compartilhar a mesma razão.
      </>
    ),
    criteria: [
      { label: "Granularidade", value: "Agrupamento intermediário" },
      { label: "Cobertura", value: "Comércio · Serviços (G–N)" },
    ],
    warning: (
      <>
        Limitação amostral nesses setores impede granularidade mais fina.
        Empresas em sub-segmentos distintos podem compartilhar a mesma razão
        setorial.
      </>
    ),
  },
  baixa: {
    eyebrow: "Granularidade · Fallback",
    title: "Baixa",
    intro: (
      <>
        Razão aplicada vem do <strong>fallback por seção CNAE</strong> (A–U),
        usado quando o setor da empresa não está coberto por cobertura
        estatística com granularidade adequada.
      </>
    ),
    criteria: [
      { label: "Granularidade", value: "Seção CNAE (letra A–U)" },
      { label: "Cobertura", value: "Construção (F) · Energia (D) · etc." },
    ],
    warning: (
      <>
        Estimativa carrega menor garantia. Empresas em granularidade baixa são
        automaticamente classificadas com confiança baixa na estimativa final.
      </>
    ),
  },
};

export const PRECISION_GENUS: GenusDef = {
  eyebrow: "Metodologia · Granularidade",
  title: "Granularidade do Modelo",
  intro: (
    <>
      O modelo proprietário converte sinais operacionais em receita usando
      razões setoriais oficiais. <strong>A granularidade dessas razões</strong>{" "}
      varia conforme o setor de atividade e a disponibilidade estatística do
      segmento.
    </>
  ),
  species: [
    PRECISION_DEFS.alta,
    PRECISION_DEFS.media,
    PRECISION_DEFS.baixa,
  ],
  closing: (
    <>
      A granularidade entra como teto no score de confiança final. Uma empresa
      em granularidade baixa não atinge confiança alta, mesmo com identidade e
      benchmark robustos.
    </>
  ),
};

export const TIER_GENUS: GenusDef = {
  eyebrow: "Identificação · 2 caminhos",
  title: "Tier de Identificação",
  intro: (
    <>
      Cada empresa do produto passou por um dos dois processos rigorosos de
      identificação cruzada entre registros oficiais. Ambos exigem{" "}
      <strong>coerência estatística absoluta</strong>; quando a cascata não
      desempata, a empresa é descartada — preferimos cobrir menos com certeza a
      cobrir mais com ruído.
    </>
  ),
  species: [
    TIER_DEFS.tier1,
    TIER_DEFS.tier2,
  ],
};

export const METRIC_DEFS: Record<string, TermDef> = {
  vinculos_ativos: {
    eyebrow: "Métrica · Operação",
    title: "Vínculos Ativos",
    intro: (
      <>
        Total de <strong>vínculos trabalhistas CLT ativos</strong> declarados
        pela empresa nos registros operacionais oficiais.
      </>
    ),
    criteria: [
      { label: "Regime", value: "CLT urbano + por prazo determinado" },
      { label: "Não inclui", value: "Pró-labore · estagiário · autônomo · PJ" },
    ],
    warning: (
      <>
        Em setores com forte componente de remuneração fora do CLT (TI,
        financeiro, advocacia), o número de vínculos ativos pode subestimar a
        operação real.
      </>
    ),
  },
  receita_estimada: {
    eyebrow: "Métrica · Faturamento",
    title: "Receita Estimada",
    intro: (
      <>
        Receita bruta operacional anual reconstruída pelo modelo proprietário a
        partir de sinais operacionais oficiais cruzados.
      </>
    ),
    criteria: [
      { label: "Unidade", value: "BRL anual · receita bruta" },
      { label: "Range de produto", value: "≤ R$ 250 milhões" },
      { label: "Fontes", value: "Múltiplas bases públicas oficiais" },
    ],
    context: (
      <>
        Cada estimativa é entregue com intervalo low/high e nível de confiança
        contextual.
      </>
    ),
  },
};
