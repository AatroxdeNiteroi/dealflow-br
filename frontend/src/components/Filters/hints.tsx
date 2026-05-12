/* Dicionário de explicações curtas para cada filtro e seus valores. */
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
    body: "Estado onde a matriz da empresa está registrada na Receita Federal. O motor cobre apenas RJ e SP no MVP.",
  },
  confidence: {
    title: "Confiança da estimativa",
    body: (
      <>
        Score qualitativo combinando match RAIS, amostra do benchmark e
        precisão da razão folha/receita. <strong>Alta</strong>: ±15% típico.{" "}
        <strong>Média</strong>: ±30%. <strong>Baixa</strong>: setor low-CLT
        ou razão default.
      </>
    ),
  },
  archetype: {
    title: "Archetype · perfil estrutural",
    body: "Classificação derivada de sinais da Receita (sócios, capital, idade, headcount). Filtro de produto — não afeta o cálculo de receita.",
  },
  cnae: {
    title: "Seção CNAE",
    body: "Classificação setorial oficial (A-U). Letra indica a seção da Classificação Nacional de Atividades Econômicas do IBGE.",
  },
  receita: {
    title: "Receita estimada anual",
    body: (
      <>
        Receita bruta operacional estimada via fórmula §6.1:{" "}
        <em>folha × encargos ÷ razão folha/receita do CNAE</em>. Escopo do
        produto limitado a R$ 250M.
      </>
    ),
  },
  headcount: {
    title: "Vínculos Ativos · CLT",
    body: "Total de vínculos trabalhistas ativos declarados pela empresa na RAIS Estabelecimentos 2024. Considera apenas CLT — não inclui pessoa jurídica, autônomo ou pró-labore.",
  },
  idade: {
    title: "Idade da empresa",
    body: "Anos desde data_inicio_atividade no cadastro da Receita Federal. Não considera mudanças de razão social/CNPJ ao longo da história.",
  },
  capital: {
    title: "Capital social",
    body: "Capital social subscrito registrado na Receita. Atenção: muitas empresas têm capital desatualizado (anos sem alteração) — use como referência relativa, não absoluta.",
  },
  socios: {
    title: "Quadro societário",
    body: "Total de sócios registrados na base Receita.socios (pessoa física + pessoa jurídica + estrangeiros).",
  },
  socios_pj: {
    title: "Sócios pessoa jurídica",
    body: "Mínimo de sócios PJ. Empresas com >0 sócios PJ tipicamente são parte de uma estrutura de grupo ou holding.",
  },
  tier: {
    title: "Tier de identificação",
    body: (
      <>
        <strong>Tier 1</strong>: match único pela chave composta §4.2
        (CEP+CNAE+natureza+município). <strong>Tier 2</strong>: desempate via
        cascata §4.4 (porte + temporal + Simples).
      </>
    ),
  },
  razao_precision: {
    title: "Precisão da razão folha/receita",
    body: (
      <>
        Granularidade da razão setorial usada na fórmula.{" "}
        <strong>Alta</strong>: PIA classe 4d real (~265 classes industriais).{" "}
        <strong>Média</strong>: PAS/PAC sub-agrupamento (comércio/serviços
        2d). <strong>Baixa</strong>: fallback por seção.
      </>
    ),
  },
};

export const ARCHETYPE_HINTS: Record<string, ReactNode> = {
  family_mature_sweet_spot: (
    <>2-4 sócios PF · idade ≥10 anos · 20-200 funcionários. <strong>Perfil canônico de sucessão familiar</strong> — alvo principal de search funds e boutiques M&A.</>
  ),
  labor_intensive_midcap: (
    <>Capital/funcionário baixo · 50-500 funcs. Indústria ou serviço de mão de obra intensiva. Margem operacional tipicamente apertada.</>
  ),
  capital_intensive: (
    <>Capital/funcionário &gt; R$ 200 mil · headcount &gt; 50. Indústria pesada, química, agro. <em>Atenção</em>: PIA estratifica até 500 funcs, viés residual possível.</>
  ),
  holding_structure: (
    <>Tem sócio PJ + poucos sócios totais (≤3). Geralmente não opera diretamente — controla outras empresas. Receita estimada via headcount pode subestimar.</>
  ),
  recent_startup: (
    <>Empresa com menos de 3 anos. Razões setoriais ainda imaturas, capital alto vs receita real. Estimativa frágil.</>
  ),
  partnership_heavy_services: (
    <>Muitos sócios em serviços profissionais (M/J/K). Faturamento sistematicamente subestimado — receita via folha CLT ignora pró-labore.</>
  ),
  financeiro_out_scope: (
    <>CNAE seção K — financeiro e seguros. <strong>Fora do escopo</strong> PIA/PAS/PAC do IBGE. Estimativa de baixa confiança.</>
  ),
  standard: <>Sem padrão estrutural específico identificado. Maior parte do universo.</>,
};

export const CONFIDENCE_HINTS: Record<string, ReactNode> = {
  alta: <>Match único + benchmark com ≥100 vínculos + razão folha/receita de PIA 4d.</>,
  media: <>Match confirmado + razão setorial agregada ou benchmark com 30-100 vínculos.</>,
  baixa: <>Match com proxy OU setor low-CLT (TI, financeiro, profissional) OU razão default.</>,
  sem_benchmark: <>Município sem amostra salarial suficiente no CNAE específico.</>,
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
