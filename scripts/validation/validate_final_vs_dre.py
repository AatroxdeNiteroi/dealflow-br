"""Validação estimates_final vs DRE pública (n=100). Output: nome + erro %."""

from __future__ import annotations

import sys
from dataclasses import dataclass

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from google.cloud import bigquery


@dataclass(frozen=True, slots=True)
class DRECase:
    nome_busca: str
    receita_brl: float  # bruta operacional estimada (BRL)


# 100 candidatas single-plant industriais SP/RJ.
# DREs: mistura de DFP confirmadas, releases públicos, e estimativas setoriais.
CASES: tuple[DRECase, ...] = (
    DRECase("HAGA S/A INDUSTRIA",                    62_000_000),
    DRECase("VIDROPORTO",                           850_000_000),
    DRECase("THYSSENKRUPP METALURGICA CAMPO LIMPO", 2_200_000_000),
    DRECase("JOHNSON & JOHNSON INDUSTRIAL",         7_000_000_000),
    DRECase("MWM INDUSTRIA DE MOTORES",             5_000_000_000),
    DRECase("CONTINENTAL AUTOMOTIVE DO BRASIL",     5_000_000_000),
    DRECase("ROBERT BOSCH DIRECAO AUTOMOTIVA",      1_500_000_000),
    DRECase("HITACHI ASTEMO CAMPINAS",              1_500_000_000),
    DRECase("GERDAU SUMMIT ACOS",                   1_000_000_000),
    DRECase("OJI PAPEIS ESPECIAIS",                 1_300_000_000),
    DRECase("CHRIS CINTOS DE SEGURANCA",            1_800_000_000),
    DRECase("MARCHESAN IMPLEMENTOS",                1_500_000_000),
    DRECase("AVIBRAS DIVISAO AEREA",                  700_000_000),
    DRECase("NORTEC QUIMICA",                         700_000_000),
    DRECase("NSK BRASIL",                             750_000_000),
    DRECase("EDSCHA DO BRASIL",                       500_000_000),
    DRECase("STANLEY ELECTRIC DO BRASIL",             550_000_000),
    DRECase("HWASHIN FABRICANTE",                     900_000_000),
    DRECase("PETROCOQUE",                             900_000_000),
    DRECase("PRENSAS SCHULER",                        450_000_000),

    # Agro / álcool / alimentos
    DRECase("USINA ALTA MOGIANA",                  3_000_000_000),
    DRECase("ALCOESTE BIOENERGIA",                 2_000_000_000),
    DRECase("DESTILARIA GENERALCO",                1_300_000_000),
    DRECase("SCARPIM ALIMENTOS",                     800_000_000),
    DRECase("MEZZANI ALIMENTOS",                     700_000_000),
    DRECase("JAMPAC INDUSTRIA E COMERCIO DE ALIMENTOS", 400_000_000),
    DRECase("SIOL ALIMENTOS",                        300_000_000),
    DRECase("DEKEL AGRO",                            400_000_000),
    DRECase("FRIGORIFICO ANGELELLI",                 700_000_000),
    DRECase("CITROMIL ARARAS",                        50_000_000),
    DRECase("CENTRAL ISLAMICA BRASILEIRA",           500_000_000),

    # Farmacêutica / química
    DRECase("SUPERA FARMA LABORATORIOS",           2_000_000_000),
    DRECase("ANOVIS INDUSTRIAL FARMACEUTICA",      1_300_000_000),
    DRECase("ITACEL FARMOQUIMICA",                 1_100_000_000),
    DRECase("THERASKIN FARMACEUTICA",                450_000_000),
    DRECase("UNIAO QUIMICA INTERNACIONAL",           450_000_000),
    DRECase("UMICORE SHOKUBAI BRASIL",               400_000_000),
    DRECase("MIRACEMA NUODEX",                       500_000_000),
    DRECase("FLINT GROUP TINTAS",                    400_000_000),
    DRECase("UNIPAR CARBOCLORO",                   3_000_000_000),

    # Auto/peças
    DRECase("AMSTED-MAXION FUNDICAO",              1_500_000_000),
    DRECase("KNORR BREMSE SISTEMAS",               1_200_000_000),
    DRECase("GESTAMP SOROCABA",                    1_100_000_000),
    DRECase("TOWER AUTOMOTIVE DO BRASIL",            800_000_000),
    DRECase("MINEBEA ACCESSSOLUTIONS",               800_000_000),
    DRECase("NAL DO BRASIL",                         700_000_000),
    DRECase("SEG AUTOMOTIVE COMPONENTS",              700_000_000),
    DRECase("MA AUTOMOTIVE BRASIL",                  600_000_000),
    DRECase("SP RESINAS",                            600_000_000),
    DRECase("FAREVA DESENVOLVIMENTO",                700_000_000),
    DRECase("HITACHI ASTEMO",                      1_500_000_000),

    # Papel / celulose
    DRECase("SCHWEITZER-MAUDUIT DO BRASIL",          700_000_000),
    DRECase("DAMAPEL INDUSTRIA",                     700_000_000),
    DRECase("FERNANDEZ SOCIEDADE ANONIMA INDUSTRIA DE PAPEL", 800_000_000),
    DRECase("CARTONAGEM JAUENSE",                    400_000_000),
    DRECase("KLABIN PIRACICABA",                   2_000_000_000),

    # Industrial pesada / equipamentos
    DRECase("KEPLER WEBER",                        1_500_000_000),
    DRECase("KHS INDUSTRIA DE MAQUINAS",             400_000_000),
    DRECase("FERRAZ MAQUINAS",                       500_000_000),
    DRECase("CALDEMA EQUIPAMENTOS",                  400_000_000),
    DRECase("HYSTER-YALE BRASIL",                    500_000_000),
    DRECase("AVIBRAS INDUSTRIA AEROESPACIAL",        700_000_000),
    DRECase("PROVIDER INDUSTRIA",                  1_000_000_000),
    DRECase("PEDERTRACTOR INDUSTRIA",              1_200_000_000),

    # Plásticos / componentes
    DRECase("GLOBOPLAST INDUSTRIA",                  500_000_000),
    DRECase("JOMARCA INDUSTRIAL DE PARAFUSOS",       500_000_000),
    DRECase("EMICOL ELETRO ELETRONICA",              700_000_000),
    DRECase("HPB SISTEMAS DE ENERGIA",               800_000_000),
    DRECase("CAS TECNOLOGIA",                        400_000_000),
    DRECase("ITALBRONZE",                            400_000_000),
    DRECase("ALLIANCE INDUSTRIA MECANICA",           400_000_000),
    DRECase("TEXA ALUMINIO",                         400_000_000),
    DRECase("TREFILACAO UNIAO DE METAIS",            400_000_000),
    DRECase("TUPER",                                 500_000_000),
    DRECase("LEONARDI CONSTRUCAO INDUSTRIALIZADA",   500_000_000),
    DRECase("CLIPTECH INDUSTRIA",                  1_500_000_000),
    DRECase("MARJAN INDUSTRIA",                    2_000_000_000),
    DRECase("IMPACTA S A INDUSTRIA",                2_000_000_000),
    DRECase("B GROB DO BRASIL",                    1_800_000_000),
    DRECase("ADS CONEXAO",                         1_500_000_000),
    DRECase("GV DO BRASIL INDUSTRIA",              1_400_000_000),
    DRECase("ARIM COMPONENTES",                      450_000_000),
    DRECase("MINERVA DAWN FARMS",                    600_000_000),
    DRECase("PROMINER PROJETOS",                      35_000_000),
    DRECase("INDUSTRIAS DE COLCHOES CASTOR",         500_000_000),
    DRECase("GUARANY INDUSTRIA",                     500_000_000),
    DRECase("AGROMIX-INDUSTRIA",                     100_000_000),
    DRECase("UMICORE SHOKUBAI INDUSTRIAL",           400_000_000),
    DRECase("METALFRIO SOLUTIONS",                   800_000_000),
    DRECase("CAMBUCI",                               400_000_000),
    DRECase("VICUNHA TEXTIL",                      1_000_000_000),
    DRECase("CHOCOLATES GAROTO",                   1_500_000_000),
    DRECase("ELEKEIROZ",                             500_000_000),
    DRECase("KOMATSU BRASIL",                      2_000_000_000),
    DRECase("AGCO DO BRASIL",                      5_000_000_000),
    DRECase("CRISTALIA PRODUTOS QUIMICOS",         1_500_000_000),
    DRECase("LABORATORIO TEUTO",                     500_000_000),
    DRECase("INDUMAK",                               200_000_000),
    DRECase("AETHRA SISTEMAS AUTOMOTIVOS",            1_000_000_000),
    DRECase("ROHM AND HAAS QUIMICA",                 500_000_000),
    DRECase("LANXESS BRASIL",                        800_000_000),

    # Single-plants pequenos para diversificar amostra
    DRECase("HIDROCHAGAS COMPRESSORES",               30_000_000),
    DRECase("GEROMIX ENGENHARIA",                     20_000_000),
    DRECase("ROMIOTTO INDUSTRIA",                     50_000_000),
)


def main() -> int:
    client = bigquery.Client(project="the-dumbers")
    rows: list[tuple[str, float | None]] = []
    for case in CASES:
        sql = """
        SELECT receita_point_brl
        FROM `the-dumbers.dealflow.estimates_final`
        WHERE UPPER(razao_social) LIKE @pat
        ORDER BY receita_point_brl DESC NULLS LAST
        LIMIT 1
        """
        results = list(client.query(
            sql, job_config=bigquery.QueryJobConfig(query_parameters=[
                bigquery.ScalarQueryParameter("pat", "STRING", f"%{case.nome_busca.upper()}%")
            ])
        ).result())
        if not results or results[0]["receita_point_brl"] is None:
            rows.append((case.nome_busca, None))
            continue
        est = results[0]["receita_point_brl"]
        erro = (est - case.receita_brl) / case.receita_brl * 100
        rows.append((case.nome_busca, erro))

    rows.sort(key=lambda r: (r[1] is None, abs(r[1] or 0)))

    for nome, erro in rows:
        if erro is None:
            print(f"{nome:<42}  não encontrado")
        else:
            sign = "+" if erro >= 0 else ""
            print(f"{nome:<42}  {sign}{erro:.1f}%")

    # Resumo
    found = [e for _, e in rows if e is not None]
    if not found:
        return 0
    abs_e = [abs(e) for e in found]
    in_25 = sum(1 for e in abs_e if e <= 25)
    in_25_50 = sum(1 for e in abs_e if 25 < e <= 50)
    fora_50 = sum(1 for e in abs_e if e > 50)
    n = len(found)
    print()
    print(f"Total amostra:       {len(CASES)} candidatas")
    print(f"Encontrados:         {n}")
    print(f"Dentro de ±25%:      {in_25}/{n} ({in_25*100//n}%)")
    print(f"Entre 25% e 50%:     {in_25_50}/{n} ({in_25_50*100//n}%)")
    print(f"Acima de 50%:        {fora_50}/{n} ({fora_50*100//n}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
