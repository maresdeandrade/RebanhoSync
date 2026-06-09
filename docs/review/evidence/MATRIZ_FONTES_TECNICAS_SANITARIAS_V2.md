# Matriz de Fontes Técnicas Sanitárias v2

Atualizado em: 2026-06-09
Fase: 12D3 — Extração curatorial de protocolos candidatos
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## Decisão

Fontes abaixo são as fontes identificadas ou inferidas durante a leitura do guideline curatorial.

**Nenhuma fonte foi inventada.** Onde a fonte é mencionada no guideline mas não é localizável/confirmada no workspace, foi marcada como `PRECISA_VALIDAR`. Onde a fonte é um placeholder ou referência incompleta, não foi elevada a fonte forte.

---

## Legenda de campos

- **source_id**: identificador estável da fonte
- **kind**: tipo da fonte (norma_oficial, bula, registro_produto, bibliografia, guideline_apoio)
- **title**: título da fonte
- **issuer**: emissor da fonte
- **reference_location**: localização da referência (URL, número de IN, etc.)
- **field_keys**: campos que a fonte cobre
- **strength**: força da fonte (forte, apoio, fraca)
- **evidence_status**: status de evidência (SIM_BULA, SIM_NORMA, PRECISA_VALIDAR, NAO_AUTORIZADO, EXTRAPOLADO)
- **limitations**: limitações conhecidas da fonte
- **uso_no_modelo**: como usar esta fonte no modelo canônico v2

---

## Tabela de Fontes Técnicas

| source_id | kind | title | issuer | reference_location | field_keys | strength | evidence_status | limitations | uso_no_modelo |
|---|---|---|---|---|---|---|---|---|---|
| `guideline_vacinacao_imunizacao_v1_1` | `guideline_apoio` | Guideline Atualizado de Vacinação, Imunização e Controle Parasitário de Bovinos e Bubalinos | RebanhoSync / Comitê Técnico-Veterinário | `docs/review/evidence/Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.md` | dose, via, carencia, species_authorization, legal_status, eligibility_rule, operational_window, product_requirement | `apoio` | `PRECISA_VALIDAR` | Guideline de apoio; não substitui bula, norma oficial, registro MAPA ou decisão do MV responsável; não pode ser fonte forte isolada para campo crítico; versão 1.1.0 de 2026-06-07 | Fonte curatorial de casos e estrutura; nunca fonte forte para dose, via, carência, espécie ou obrigatoriedade legal |
| `mapa_pnefa_portaria_665_2024` | `norma_oficial` | Portaria MAPA 665/2024 — Programa Nacional de Erradicação e Prevenção da Febre Aftosa (PNEFA) | MAPA — Ministério da Agricultura, Pecuária e Abastecimento | PRECISA_VALIDAR — portaria citada no guideline; não localizada no workspace | legal_status, species_authorization, operational_window, eligibility_rule | `forte` (candidata — precisa confirmação) | `PRECISA_VALIDAR` | Texto completo não disponível no workspace; lista exata de UFs por zona (livre sem vacinação vs com vacinação) precisa confirmação; data de edição pode ter atualizações | Fonte forte candidata para legal_status de aftosa; bloqueio de uso em zonas livres; calendário de campanhas; exige confirmação do texto vigente |
| `mapa_in_48_2020` | `norma_oficial` | Instrução Normativa MAPA 48/2020 — Eliminação de Carência para Febre Aftosa | MAPA — Ministério da Agricultura, Pecuária e Abastecimento | PRECISA_VALIDAR — IN citada no guideline; não localizada no workspace | carencia | `forte` (candidata — precisa confirmação) | `PRECISA_VALIDAR` | Texto completo não disponível no workspace; aplicabilidade ao campo de carência de febre aftosa precisa ser confirmada por leitura direta da IN | Fonte forte candidata para carência zero de aftosa; exige localização e leitura da IN vigente antes de seed |
| `mapa_pncebt_in_21_2008` | `norma_oficial` | PNCEBT — Programa Nacional de Controle e Erradicação da Brucelose e da Tuberculose / IN-21/2008 | MAPA — Ministério da Agricultura, Pecuária e Abastecimento | PRECISA_VALIDAR — PNCEBT e IN citadas no guideline; não localizadas no workspace | legal_status, eligibility_rule, species_authorization, operational_window | `forte` (candidata — precisa confirmação) | `PRECISA_VALIDAR` | Texto completo não disponível no workspace; aplicabilidade a bubalinos varia por UF e pode ter atualizações posteriores à IN original | Fonte forte candidata para legal_status de brucelose B19; faixa etária e obrigatoriedade; exige confirmação vigente por UF |
| `mapa_pncrh` | `norma_oficial` | PNCRH — Programa Nacional de Controle da Raiva dos Herbívoros | MAPA — Ministério da Agricultura, Pecuária e Abastecimento | PRECISA_VALIDAR — PNCRH citado no guideline; não localizado no workspace | legal_status, eligibility_rule, operational_window | `forte` (candidata — precisa confirmação) | `PRECISA_VALIDAR` | Texto completo não disponível no workspace; programas estaduais podem variar; raiva é condicional por zona | Fonte forte candidata para legal_status de raiva em áreas de risco; exige confirmação por programa estadual aplicável |
| `norma_estadual_sp_leptospirose` | `norma_oficial` | Portaria Estadual SP — Obrigatoriedade de Vacinação contra Leptospirose | Secretaria de Agricultura e Abastecimento do Estado de São Paulo | PRECISA_VALIDAR — guideline cita "SP obriga leptospirose" com referência "Portaria XXX" sem número completo | legal_status, eligibility_rule, operational_window | `forte` (candidata — PRECISA_VALIDAR) | `PRECISA_VALIDAR` | Referência incompleta no guideline ("Portaria XXX"); número exato da portaria não citado; outras UFs podem ter portarias similares | Fonte forte candidata para obrigatoriedade estadual de leptospirose em SP; exige número completo e texto vigente |
| `bula_fabricante_vacina_clostridioses_generica` | `bula` | Bulas de Vacinas Clostridiais Multivalentes (7V ou 8V) — Fabricantes Registrados MAPA | Múltiplos fabricantes registrados no MAPA | PRECISA_VALIDAR — bulas citadas genericamente no guideline; produto específico não definido | dose, via, carencia, species_authorization, withdrawal | `forte` (por produto específico, quando disponível) | `PRECISA_VALIDAR` | Produto específico não definido; bula varia por fabricante (Pfizer, MSD, Merial, Ourofino, etc.); carência zero precisa confirmação por bula específica | Exige curadoria de produtos específicos com bulas vigentes antes de seed; carência zero candidata por classe |
| `bula_fabricante_leptospirose_generica` | `bula` | Bulas de Bacterinas contra Leptospirose (5–6 sorogrupos) — Fabricantes Registrados MAPA | Múltiplos fabricantes registrados no MAPA | PRECISA_VALIDAR — bulas citadas genericamente; carência varia muito por produto | dose, via, carencia, withdrawal, species_authorization | `forte` (por produto específico, quando disponível) | `PRECISA_VALIDAR` | Carência altamente variável (carne 14–21d, leite 0–72h por produto e sorogrupo); produto específico não definido | Fonte mais crítica desta matriz por variabilidade; exige bula de cada produto específico antes de qualquer seed |
| `bula_bovilis_rb51` | `bula` | Bula Bovilis® RB-51 | MSD Animal Health (inferido — NÃO CONFIRMAR fabricante sem verificação) | PRECISA_VALIDAR — citada no guideline como "Bovilis® RB-51 indica apenas bovinos"; texto da bula não disponível no workspace | species_authorization, withdrawal, eligibility_rule | `forte` (candidata — produto específico identificado no guideline) | `PRECISA_VALIDAR` | Texto da bula não disponível no workspace; fabricante inferido (não confirmado); registro MAPA não disponível; carência não explicitamente citada na bula | Fonte forte candidata para NAO_AUTORIZADO de bubalinos no RB51; exige localização e leitura da bula vigente |
| `bula_eprinomectina_pour_on` | `bula` | Bula de Produto Eprinomectina 0,5% Pour-On para Carência Zero | Fabricante não definido (ex: Merial/Boehringer para Eprinex — inferido) | PRECISA_VALIDAR — guideline cita "carência zero carne e leite — seguir bula"; produto específico não definido | carencia, withdrawal, species_authorization, dose, via | `forte` (por produto específico, quando disponível) | `PRECISA_VALIDAR` | Produto específico não definido; "Eprinex" no guideline pode ser referência ao princípio ativo, não ao produto; fabricante inferido; bula não disponível | Fonte crítica para carência zero candidata de eprinomectina; EXIGE bula explícita — carência zero não é inferida |
| `bula_ivermectina_1pct_injetavel` | `bula` | Bulas de Ivermectina 1% Injetável — Fabricantes Registrados MAPA | Múltiplos fabricantes registrados no MAPA | PRECISA_VALIDAR — citada genericamente no guideline | dose, via, carencia, withdrawal, species_authorization | `forte` (por produto específico, quando disponível) | `PRECISA_VALIDAR` | Produto específico não definido; carência 35d carne e leite NÃO_AUTORIZADO por guideline — confirmar por bula | Fonte para carência de endectocida injetável; proibição em lactantes por guideline candidata para confirmação |
| `bula_ivermectina_pour_on` | `bula` | Bulas de Ivermectina 0,5% Pour-On — Fabricantes Registrados MAPA | Múltiplos fabricantes registrados no MAPA | PRECISA_VALIDAR | dose, via, carencia, withdrawal | `forte` (por produto específico, quando disponível) | `PRECISA_VALIDAR` | Produto específico não definido; carência leite zero candidata por guideline — confirmar bula | Confirmar carência carne 28d e leite 0d por bula específica |
| `bula_albendazol_10pct` | `bula` | Bulas de Albendazol 10% — Fabricantes Registrados MAPA | Múltiplos fabricantes registrados no MAPA | PRECISA_VALIDAR | dose, via, carencia, withdrawal, eligibility_rule (contraindicação em gestantes) | `forte` (por produto específico, quando disponível) | `PRECISA_VALIDAR` | Produto específico não definido; carência 14d carne e 72h leite candidata por guideline — confirmar bula; hepatotóxico: contraindicação em gestantes | Fonte para dose oral, carência e contraindicação em gestantes |
| `mapa_in_21_2008_brucelose` | `norma_oficial` | IN MAPA 28/2005 — Inclusão de Bubalinos no Controle da Brucelose | MAPA — Ministério da Agricultura, Pecuária e Abastecimento | PRECISA_VALIDAR — guideline cita "IN 28/2005 incluiu bubalinos sob controle da brucelose" | legal_status, species_authorization, eligibility_rule | `forte` (candidata — precisa confirmação) | `PRECISA_VALIDAR` | Texto completo não disponível no workspace; aplicabilidade varia por UF; atualização posterior possível | Fonte candidata para status de bubalinos no PNCEBT; exige localização e leitura vigente |
| `literatura_veterinaria_bubalinos` | `bibliografia` | Literatura Veterinária Geral sobre Bubalinos — Estudos e Publicações | Diversos autores e universidades | PRECISA_VALIDAR — guideline cita "pouca literatura específica; ensaios de eficácia locais recomendados" | species_authorization, eligibility_rule | `fraca` | `PRECISA_VALIDAR` | Literatura escassa; evidências empíricas; guideline alerta para extrapolação com cautela; não substitui bula ou norma | Fonte fraca para contexto de bubalinos; apenas apoio para PRECISA_VALIDAR; nunca fonte forte |
| `mv_responsavel_fazenda_especifico` | `mv_responsavel` | Decisão do Médico-Veterinário Responsável — Escopo da Fazenda | MV responsável pela fazenda | Auditável por fazenda — escopo = fazenda | species_authorization (EXTRAPOLADO), eligibility_rule, dose (off-label) | `forte` (por decisão auditável) | `EXTRAPOLADO` | Válida apenas para a fazenda específica; exige registro auditável; não substitui norma ou bula para campos críticos gerais; limita automação | Para casos EXTRAPOLADO: uso off-label autorizado por MV; exige requiresMvResponsavel=true no item do protocolo |

---

## Resumo de força por campo crítico

| Campo crítico | Fonte forte disponível no workspace | Fonte forte candidata no guideline | Ação necessária |
|---|---|---|---|
| `legal_status` (aftosa) | Não | Portaria 665/2024 + PNEFA (PRECISA_VALIDAR) | Localizar e ler portaria vigente |
| `legal_status` (brucelose B19) | Não | PNCEBT + IN-21/2008 (PRECISA_VALIDAR) | Localizar e ler IN vigente |
| `legal_status` (raiva) | Não | PNCRH + normas estaduais (PRECISA_VALIDAR) | Localizar programa estadual por UF |
| `species_authorization` (bovino) | Não | Bulas dos produtos (PRECISA_VALIDAR) | Curadoria de bulas por produto |
| `species_authorization` (bubalino) | Não (exceto RB51 bloqueado) | IN 28/2005 MAPA + normas estaduais (PRECISA_VALIDAR) | Localizar IN 28/2005 vigente |
| `dose` | Não | Guideline (apoio apenas) | Bula do produto específico |
| `via` | Não | Guideline (apoio apenas) | Bula do produto específico |
| `carencia` (carne) | Não | Guideline (apoio); IN-48/2020 para aftosa | Bula por produto; IN-48/2020 para aftosa |
| `carencia` (leite) | Não | Guideline (apoio); eprinomectina: zero candidato | Bula por produto específico |
| `carencia_zero` (eprinomectina) | Não | Guideline cita zero com bula | Bula do produto específico vigente |
| `carencia_zero` (aftosa) | Não | IN-48/2020 (citada no guideline) | Localizar e ler IN-48/2020 vigente |
| `eligibility_rule` | Não | Guideline (apoio) | Norma/bula por protocolo específico |

---

## Fontes ausentes (lacunas sistêmicas)

Estas fontes são necessárias para o modelo mas não estão disponíveis no workspace nem no guideline de forma completa:

1. **Portaria MAPA 665/2024 completa** — lista atual de UFs por zona (aftosa)
2. **IN-48/2020 completa** — confirmação de carência zero para aftosa
3. **PNCEBT/IN-21/2008 completa** — obrigatoriedade brucelose e situação de bubalinos
4. **IN MAPA 28/2005 completa** — inclusão de bubalinos no controle de brucelose
5. **PNCRH atual e programas estaduais de raiva** — por UF com risco de morcego vampiro
6. **Portaria estadual SP (número completo)** — obrigatoriedade de leptospirose
7. **Bulas individuais por produto** — fabricante, registro, dose exata, carência exata, espécie autorizada
8. **Bula Bovilis® RB-51 vigente** — confirmação de NAO_AUTORIZADO para bubalinos

---

_Versão: 12D3 | Fontes para revisão | PRECISA_VALIDAR prevalece | Não são fontes fortes finais_
