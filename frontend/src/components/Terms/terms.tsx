/** Catálogo de termos do produto — cada um vira modal premium ao clicar no `?` */
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
        São empresas com massa operacional real (CLT ativo), histórico estabelecido
        e quadro societário enxuto o suficiente para uma transação viável. Tipicamente
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
      { label: "Capital por funcionário", value: "< R$ 30k" },
      { label: "Vínculos ativos", value: "50 a 500" },
      { label: "Setor típico", value: "B · C · F · G" },
    ],
    context: (
      <>
        Frigoríficos, têxtil/confecção, terceirização (segurança, limpeza),
        construção, varejo de massa. A receita estimada via folha aqui é
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
      { label: "Capital por funcionário", value: "> R$ 200k" },
      { label: "Vínculos ativos", value: "> 50" },
      { label: "Setor típico", value: "B · C · D" },
    ],
    warning: (
      <>
        A razão folha/receita do IBGE PIA estratifica apenas até 500 funcionários.
        Para midcaps em CNAEs dominados por gigantes capital-intensivos, persiste
        viés residual de +35 a +40% sobre o valor real. Use a estimativa como
        ordem de magnitude, não como valor pontual.
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
        A estimativa via folha de pagamento <strong>não é apropriada</strong> para
        holdings — a receita real vem de dividendos das controladas, não da operação
        própria. Use o filtro apenas para mapear estruturas societárias, não para
        triagem direta.
      </>
    ),
  },

  recent_startup: {
    eyebrow: "Archetype · Maturidade",
    title: "Startup",
    intro: (
      <>
        Empresa <strong>recém-criada</strong> (menos de 3 anos). Razões setoriais do
        IBGE são calibradas em empresas estabelecidas — para startups jovens, o
        modelo opera fora de sua zona de validade estatística.
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
        A receita estimada via folha CLT <strong>subestima sistematicamente</strong> —
        boa parte da remuneração nesses setores é pró-labore, não CLT, e não aparece
        na RAIS. Use a estimativa como piso, não como ponto.
      </>
    ),
  },

  financeiro_out_scope: {
    eyebrow: "Archetype · Fora do Escopo",
    title: "Financeiro",
    intro: (
      <>
        CNAE da seção K — atividades financeiras, de seguros e serviços relacionados.
        <strong> Fora do escopo</strong> das pesquisas estruturais do IBGE
        (PIA · PAS · PAC) usadas como base da razão folha/receita.
      </>
    ),
    criteria: [
      { label: "Setor (CNAE seção)", value: "K · Financeiro" },
    ],
    warning: (
      <>
        Razão folha/receita usada é o fallback default por seção, com precisão baixa.
        Bancos, seguradoras, corretoras e fintechs têm dinâmica financeira totalmente
        distinta da indústria/comércio — recomendado excluir do funil.
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
        match único na chave composta, benchmark salarial robusto e razão folha/receita
        de fonte direta (não interpolada).
      </>
    ),
    criteria: [
      { label: "Match RAIS", value: "Tier 1 único" },
      { label: "Amostra de salário", value: "≥ 100 vínculos no CNAE × município" },
      { label: "Razão folha/receita", value: "PIA classe 4d real" },
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
        Match identificado e estimativa calibrada, com pelo menos um dos sinais em
        granularidade intermediária — benchmark salarial moderado ou razão setorial
        agregada.
      </>
    ),
    criteria: [
      { label: "Match RAIS", value: "Tier 1 ou Tier 2 com score 3/3" },
      { label: "Amostra de salário", value: "30 a 100 vínculos" },
      { label: "Razão folha/receita", value: "PAS/PAC sub-agrupamento" },
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
      { label: "Acionado por", value: "Setor low-CLT (J/K/M com poucos funcs) OU razão default OU amostra benchmark <30" },
    ],
    warning: (
      <>
        Setores com remuneração via pró-labore (TI, financeiro, consultoria) têm
        estrutura de folha não-CLT que o modelo não capta diretamente.
      </>
    ),
  },
  sem_benchmark: {
    eyebrow: "Confiança · Sem Amostra",
    title: "Sem Benchmark",
    intro: (
      <>
        Município sem amostra salarial suficiente no CNAE específico da empresa.
        Sem benchmark, não há fórmula §6.1 aplicável.
      </>
    ),
    context: (
      <>
        Tipicamente cidades pequenas em CNAEs muito específicos. A empresa
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
        Identidade da empresa <strong>confirmada por unicidade da chave composta</strong>:
        exatamente um CNPJ Receita corresponde à linha RAIS via combinação
        CEP + CNAE + natureza jurídica + município.
      </>
    ),
    criteria: [
      { label: "Candidatos na chave", value: "Exatamente 1" },
      { label: "Margem de identidade", value: "Nula — identidade matemática" },
    ],
    context: (
      <>
        Núcleo do produto. ~73 mil empresas identificadas com este nível de rigor —
        equivalente a uma due diligence de identidade formal.
      </>
    ),
  },
  tier2: {
    eyebrow: "Identificação · Desempate",
    title: "Tier 2 · Cascata §4.4",
    intro: (
      <>
        Chaves com 2 a 5 candidatos Receita por linha RAIS, desempatadas por
        <strong> cascata de coerência cruzada</strong>: porte declarado · idade
        anterior ao ano-base · regime tributário.
      </>
    ),
    criteria: [
      { label: "Candidatos por chave", value: "2 a 5" },
      { label: "Critérios de desempate", value: "Coerência de porte + temporal + Simples Nacional" },
      { label: "Confirmação", value: "Score ≥ 2 com top único" },
    ],
    context: (
      <>
        96% dos matches Tier 2 obtêm score 3/3 — qualidade comparável ao Tier 1.
        Se a cascata não desempata com clareza, a chave é descartada (não força
        match ruim).
      </>
    ),
  },
};

/* ───────────────────── KPIs / MÉTRICAS ──────────────────────── */

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
      Cada empresa do universo é classificada em um dos 8 archetypes derivados de
      sinais públicos da Receita Federal — quadro societário, capital social,
      idade, capital por funcionário, setor. <strong>Archetype não é fator no
      cálculo de receita</strong>; é filtro de produto para guiar a tese M&amp;A e
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
      Os archetypes Family Mature, Labor Mid-Cap e Capital Intensive concentram a
      maior parte dos leads acionáveis para M&amp;A médio porte. Holding,
      Partnership, Financeiro e Startup têm avisos honestos de limitação do
      modelo — devem ser tratados como contexto, não como targets.
    </>
  ),
};

export const CONFIDENCE_GENUS: GenusDef = {
  eyebrow: "Qualidade · 4 níveis de confiança",
  title: "Confiança",
  intro: (
    <>
      Cada estimativa é entregue com <strong>score qualitativo de confiança</strong>
      que combina três fatores objetivos: rigor do match RAIS, robustez do
      benchmark salarial usado, e precisão da razão folha/receita aplicada. O
      score permite filtrar o universo para o nível de certeza apropriado à tese.
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
      Para construção de funil M&amp;A inicial, recomendamos filtrar por
      <em> alta + média</em>. Para due diligence pontual, restrinja a
      <em> alta</em>. Para mapeamento de mercado amplo, todas se mantêm úteis
      enquanto a confiança for transparente ao usuário.
    </>
  ),
};

export const PRECISION_DEFS: Record<string, TermDef> = {
  alta: {
    eyebrow: "Precisão · Granularidade Fina",
    title: "Alta",
    intro: (
      <>
        Razão folha/receita vem da <strong>PIA · Pesquisa Industrial Anual</strong> do
        IBGE em classe CNAE de 4 dígitos. Cobertura de aproximadamente 265 classes
        industriais (seções B e C), com amostra estatística robusta por classe.
      </>
    ),
    criteria: [
      { label: "Fonte", value: "IBGE PIA tabelas 7241/7242" },
      { label: "Granularidade", value: "CNAE classe 4d (real)" },
      { label: "Cobertura", value: "~265 classes industriais" },
    ],
    context: (
      <>
        Habilita confiança alta na estimativa final. Cada empresa cai numa razão
        específica do seu sub-setor industrial, com ajuste adicional por faixa de
        pessoal ocupado (PIA tabela 1839).
      </>
    ),
  },
  media: {
    eyebrow: "Precisão · Granularidade Média",
    title: "Média",
    intro: (
      <>
        Razão vem das pesquisas <strong>PAS · Serviços</strong> e <strong>PAC ·
        Comércio</strong> do IBGE, em sub-agrupamentos custom (~44 e ~49 categorias
        respectivamente). Não é CNAE 4d real — é uma classificação setorial própria
        do IBGE com agregação a 2 dígitos.
      </>
    ),
    criteria: [
      { label: "Fontes", value: "PAS 2577 · PAC 1418" },
      { label: "Granularidade", value: "Sub-agrupamento IBGE (CNAE 2d)" },
      { label: "Cobertura", value: "Comércio · Serviços (G–N)" },
    ],
    warning: (
      <>
        IBGE não publica essas pesquisas em CNAE 4d real por limitação amostral.
        Como resultado, empresas em sub-setores distintos podem compartilhar a
        mesma razão setorial.
      </>
    ),
  },
  baixa: {
    eyebrow: "Precisão · Fallback",
    title: "Baixa",
    intro: (
      <>
        Razão folha/receita aplicada vem do <strong>default por seção CNAE</strong>
        (A–U), usado quando o setor da empresa não está coberto por PIA/PAS/PAC
        com granularidade adequada.
      </>
    ),
    criteria: [
      { label: "Fonte", value: "DEFAULT_SECAO (hardcoded)" },
      { label: "Granularidade", value: "Seção CNAE (letra A–U)" },
      { label: "Cobertura", value: "Construção (F) · Energia (D) · etc." },
    ],
    warning: (
      <>
        Estimativa carrega menor garantia. Empresas com razão precision = baixa
        são automaticamente classificadas com confiança baixa na estimativa final.
      </>
    ),
  },
};

export const PRECISION_GENUS: GenusDef = {
  eyebrow: "Metodologia · Razão folha/receita",
  title: "Precisão da Razão",
  intro: (
    <>
      A fórmula §6.1 converte folha de pagamento em receita usando uma razão
      setorial publicada pelo IBGE. <strong>A precisão dessa razão</strong> varia
      conforme o setor de atividade e a disponibilidade estatística da pesquisa
      estrutural que cobre aquele segmento.
    </>
  ),
  species: [
    PRECISION_DEFS.alta,
    PRECISION_DEFS.media,
    PRECISION_DEFS.baixa,
  ],
  closing: (
    <>
      A precisão da razão entra como teto no score de confiança final. Uma empresa
      com razão de precisão baixa não pode atingir confiança alta, mesmo com match
      e benchmark robustos.
    </>
  ),
};

export const TIER_GENUS: GenusDef = {
  eyebrow: "Identificação · 2 caminhos",
  title: "Tier de Identificação",
  intro: (
    <>
      Cada empresa do produto passou por um dos dois processos rigorosos de
      identificação cruzada entre Receita Federal e RAIS. Ambos exigem
      <strong> coerência estatística absoluta</strong>; quando a cascata não
      desempata, a empresa é descartada — preferimos cobrir menos com certeza
      a cobrir mais com ruído.
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
        Total de <strong>vínculos trabalhistas CLT ativos</strong> declarados pela
        empresa na RAIS Estabelecimentos do ano-base mais recente.
      </>
    ),
    criteria: [
      { label: "Fonte primária", value: "RAIS Estabelecimentos 2024 (MTE)" },
      { label: "Inclui", value: "CLT urbano + por prazo determinado" },
      { label: "Não inclui", value: "Pró-labore · estagiário · autônomo · PJ" },
    ],
    warning: (
      <>
        Em setores com forte componente de pró-labore (TI, financeiro, advocacia),
        o número de vínculos ativos pode subestimar a operação real.
      </>
    ),
  },
  receita_estimada: {
    eyebrow: "Métrica · Faturamento",
    title: "Receita Estimada",
    intro: (
      <>
        Receita bruta operacional anual reconstruída pelo modelo §6.1:
        <em> vínculos × salário médio local × 12 × encargos / razão folha-receita</em>.
        Cada componente vem de fonte pública oficial e auditável.
      </>
    ),
    criteria: [
      { label: "Unidade", value: "BRL anual · receita bruta" },
      { label: "Range de produto", value: "≤ R$ 250 milhões" },
      { label: "Fontes", value: "RAIS · IBGE PIA/PAC/PAS · Receita Federal" },
    ],
    context: (
      <>
        Cada estimativa é entregue com intervalo low/high (variação dos encargos
        setoriais) e nível de confiança contextual.
      </>
    ),
  },
};
