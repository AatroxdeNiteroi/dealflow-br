/* Dicionário de explicações curtas para cada filtro e seus valores.
 * Tom: enigmático e premium · não revelar fontes ou fórmulas. */
import type { ReactNode } from "react";

export const HINTS: Record<string, { title: string; body: ReactNode }> = {
  search: {
    title: "Busca rápida",
    body: "Procura por CNPJ (14 dígitos) ou texto na razão social. Ignora capitalização e acentos.",
  },
  presets: {
    title: "Presets de mercado",
    body: "Combinações pré-configuradas. Cada preset aplica vários filtros simultâneos típicos de um perfil de tese M&A.",
  },
  uf: {
    title: "UF · estado da matriz",
    body: "Estado onde a matriz da empresa opera. Cobertura atual do produto: RJ e SP.",
  },
  confidence: {
    title: "Confiança da estimativa",
    body: (
      <>
        Score qualitativo combinando rigor da identidade, robustez do benchmark
        setorial e granularidade do modelo. <strong>Alta</strong>: variação
        típica ±15%. <strong>Média</strong>: ±30%. <strong>Baixa</strong>: setor
        fora da zona de validade plena.
      </>
    ),
  },
  archetype: {
    title: "Archetype · perfil estrutural",
    body: "Classificação derivada de sinais estruturais públicos da empresa. Filtro de produto — orienta a tese sem afetar os números da estimativa.",
  },
  cnae: {
    title: "Seção CNAE",
    body: "Classificação setorial oficial (A–U). Letra indica a seção da Classificação Nacional de Atividades Econômicas.",
  },
  receita: {
    title: "Receita estimada anual",
    body: (
      <>
        Receita bruta operacional anual reconstruída pelo modelo proprietário a
        partir de múltiplas fontes oficiais. Escopo do produto limitado a{" "}
        <em>R$ 250 M</em>.
      </>
    ),
  },
  headcount: {
    title: "Vínculos ativos · CLT",
    body: "Total de vínculos trabalhistas CLT ativos declarados pela empresa. Não inclui sócios, pró-labore, estagiários, autônomos ou prestadores PJ.",
  },
  idade: {
    title: "Idade da empresa",
    body: "Anos desde a abertura oficial. Não considera reorganizações de razão social ou eventos societários ao longo da história.",
  },
  capital: {
    title: "Capital social",
    body: "Capital social subscrito conforme registros oficiais. Atenção: muitas empresas têm capital desatualizado (anos sem alteração) — use como referência relativa, não absoluta.",
  },
  socios: {
    title: "Quadro societário",
    body: "Total de sócios registrados (pessoa física + pessoa jurídica + estrangeiros).",
  },
  socios_pj: {
    title: "Sócios pessoa jurídica",
    body: "Mínimo de sócios PJ no quadro. Empresas com >0 sócios PJ tipicamente integram uma estrutura de grupo empresarial.",
  },
  tier: {
    title: "Tier de identificação",
    body: (
      <>
        <strong>Tier 1</strong>: identidade confirmada por unicidade na chave
        composta multi-atributo. <strong>Tier 2</strong>: identidade desempatada
        via cascata de coerência cruzada (porte · temporal · regime).
      </>
    ),
  },
  razao_precision: {
    title: "Granularidade do modelo",
    body: (
      <>
        Granularidade da razão setorial aplicada pelo modelo.{" "}
        <strong>Alta</strong>: razão fina por classe industrial.{" "}
        <strong>Média</strong>: agrupamento setorial intermediário.{" "}
        <strong>Baixa</strong>: razão de seção (fallback).
      </>
    ),
  },
};

export const ARCHETYPE_HINTS: Record<string, ReactNode> = {
  family_mature_sweet_spot: (
    <>2-4 sócios PF · idade ≥ 10 anos · 20-200 funcionários. <strong>Perfil canônico de sucessão familiar</strong> — alvo principal de search funds e boutiques M&A.</>
  ),
  labor_intensive_midcap: (
    <>Capital/funcionário baixo · 50-500 funcs. Indústria ou serviço de mão de obra intensiva. Margem operacional tipicamente apertada.</>
  ),
  capital_intensive: (
    <>Capital/funcionário &gt; R$ 200 mil · headcount &gt; 50. Indústria pesada, química, agro. <em>Atenção</em>: o modelo carrega viés residual para midcaps em setores dominados por grandes players capital-intensivos.</>
  ),
  recent_startup: (
    <>Empresa com menos de 3 anos. O modelo é calibrado para empresas estabelecidas; em startups jovens opera fora da zona de validade plena.</>
  ),
  partnership_heavy_services: (
    <>Muitos sócios em serviços profissionais (M/J/K). Faturamento sistematicamente subestimado — a remuneração fora do regime CLT não entra na reconstrução.</>
  ),
  financeiro_out_scope: (
    <>CNAE seção K — financeiro e seguros. <strong>Fora do escopo</strong> das pesquisas estruturais que sustentam o modelo. Estimativa de baixa confiança.</>
  ),
  standard: <>Sem padrão estrutural específico identificado. Maior parte do universo.</>,
};

export const CONFIDENCE_HINTS: Record<string, ReactNode> = {
  alta: <>Identidade confirmada, benchmark salarial robusto (≥ 100 vínculos) e granularidade fina no modelo.</>,
  media: <>Identidade confirmada com sinais convergentes em granularidade intermediária.</>,
  baixa: <>Setor com remuneração predominantemente fora do CLT, ou razão setorial em granularidade ampla.</>,
  sem_benchmark: <>Município sem amostra salarial estatisticamente suficiente no setor da empresa.</>,
};

export const CNAE_HINTS: Record<string, string> = {
  A: "Agricultura, pecuária, produção florestal, pesca e aquicultura",
  B: "Indústrias extrativas (mineração, petróleo)",
  C: "Indústrias de transformação (manufatura)",
  D: "Eletricidade e gás",
  E: "Água, esgoto, atividades de gestão de resíduos",
  F: "Construção",
  G: "Comércio (atacadista e varejista)",
  H: "Transporte, armazenagem e correio",
  I: "Alojamento e alimentação",
  J: "Informação e comunicação (TI/telecom)",
  K: "Atividades financeiras, de seguros e serviços relacionados",
  L: "Atividades imobiliárias",
  M: "Atividades profissionais, científicas e técnicas",
  N: "Atividades administrativas e serviços complementares",
  O: "Administração pública, defesa e seguridade social",
  P: "Educação",
  Q: "Saúde humana e serviços sociais",
  R: "Artes, cultura, esporte e recreação",
  S: "Outras atividades de serviços",
  T: "Serviços domésticos",
  U: "Organismos internacionais e outras instituições extraterritoriais",
};
