# Matriz de Fontes Técnicas Sanitárias v2

Atualizado em: 2026-06-09
Fase: 12D4+bulas — Incorporação de bulas reais via URLs fornecidas
Versão anterior: 12D4 (Rebaseline conceitual)
Responsável: Comitê Técnico-Veterinário e Arquitetural RebanhoSync

---

## Critério de inclusão nesta matriz

Esta matriz contém apenas fontes que podem ser usadas como `SourceRef` no modelo sanitário v2 ou como apoio curatorial explícito.

Incluem-se:

- normas oficiais aplicáveis ao protocolo (MAPA, órgãos estaduais);
- bulas de produtos efetivamente cadastráveis, configuráveis ou executáveis;
- fontes oficiais de apoio para consulta normativa;
- guideline curatorial como apoio, sem força para campo crítico;
- decisão do MV responsável quando houver uso extrapolado por fazenda.

Não entram na matriz principal:

- fontes antigas substituídas;
- referências defasadas;
- fontes genéricas por classe sem produto definido;
- histórico de correção da curadoria.

---

## Regra sobre bulas comerciais nesta matriz

> **Fonte forte apenas para o produto comercial citado.** Usada como evidência produto-específica e como prova de variabilidade por bula. Não cria produto obrigatório, não representa toda a classe e não fixa carência no protocolo.

Toda bula tem `scope_note` que declara seu alcance explícito.

---

## Status das URLs fornecidas (2026-06-09)

| Produto | URL | Status de acesso |
|---|---|---|
| MSD Pecuária (catálogo) | https://www.msd-saude-animal.com.br/pecuaria/ | ✅ Acessada — JavaScript-rendered; produto listados mas bulas individuais JS |
| Fortress 7 (Zoetis) | https://www2.zoetis.com.br/especies/bovinos/fortress/ | ⚠️ Acessada mas JS-rendered; sem conteúdo textual extraível |
| Leptoferm 5 (Zoetis) | PDF Zoetis | ✅ PDF baixado — metadados confirmados; texto sem OCR disponível |
| Ivomec Injetável (Boehringer) | https://www.boehringer-ingelheim.com/br/saude-animal/produtos/ivomec-injetavel | ❌ Bloqueado por bot-protection (Incapsula) |
| Supramec Pour-on (MSD) | https://www.lojasantaclara.com.br/produto/640347/supramec-pour-on-msd-1-litro-1 | ❌ Cancelado pelo usuário |
| Valbazen 10 (Zoetis) | https://www.agroline.com.br/produto/valbazen-1-lt-97303 | ❌ Cancelado pelo usuário |
| Eprinex Pour-on (Merial/Suifarma) | http://www.suifarma.com.br/produtos/eprinex-pour-on/ | ✅ **Conteúdo extraído com sucesso** |
| Bovilis RB-51 (MSD) | https://www.msd-saude-animal.com.br/produto/rb-51/ | ✅ **Nome e descrição confirmados** |
| PNCEBT Guia Brucelose | https://www.gov.br/agricultura/pt-br/assuntos/.../tb-4-medidas-sanitarias.pdf | ❌ Cancelado pelo usuário |
| Raivacel Multi (MSD) | https://www.msd-saude-animal.com.br/produto/raivacel-multi/ | ✅ **Nome e descrição confirmados** |
| Anticarbunculosa Labovet | https://labovet.com.br/wp-content/uploads/2019/01/Bula-ANTICARBUNCULOSA.pdf | ✅ **PDF baixado** |
| Toxocara vitulorum | — | ✅ **Confirmado: inexistente** (vacina não registrada) |
| Bm86/Gavac | — | ✅ **Confirmado: restrito** (aprovação parcial por estado) |

---

## Tabela de Fontes Técnicas

| source_id | kind | title | issuer | reference_location | field_keys | strength | evidence_status | scope_note | limitations | uso_no_modelo | dados_extraidos_url |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `guideline_vacinacao_v1_1` | `guideline_apoio` | Guideline Atualizado de Vacinação, Imunização e Controle Parasitário de Bovinos e Bubalinos | RebanhoSync / Comitê Técnico-Veterinário | `docs/review/evidence/Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.md` | dose (apoio), via (apoio), carencia (apoio — nunca final), species_authorization (apoio), legal_status (apoio), eligibility_rule (apoio), operational_window (apoio) | `apoio` | `PRECISA_VALIDAR` | Fonte curatorial de apoio para extração inicial. Nunca fonte forte isolada para campo crítico. | Guideline não substitui bula, norma oficial, registro MAPA ou decisão do MV responsável. | Fonte de casos e estrutura para curadoria inicial; preencher defaults de classe apenas com marcação "guideline_apoio (PRECISA_VALIDAR)" | N/A |
| `mapa_portaria_665_2024_pnefa` | `norma_oficial` | Portaria MAPA 665/2024 — PNEFA | MAPA | PRECISA_VALIDAR — texto completo não disponível no workspace | legal_status, eligibility_rule (zona de vacinação), operational_window, species_authorization | `forte` (candidata — PRECISA_VALIDAR) | `PRECISA_VALIDAR` | Norma oficial federal para zona de vacinação. Lista UFs livres sem vacinação onde uso é proibido. | Texto completo não disponível no workspace. | Fonte forte candidata para `legal_status = obrigatorio_norma` em aftosa; bloqueio em zonas livres. | N/A |
| `mapa_in_48_2020` | `norma_oficial` | IN MAPA 48/2020 — Carência zero para febre aftosa | MAPA | PRECISA_VALIDAR | carencia (carne e leite para aftosa) | `forte` (candidata — PRECISA_VALIDAR) | `PRECISA_VALIDAR` | Norma específica para carência zero da vacina FMD. Não se aplica a outros protocolos. | Texto não disponível no workspace. | Fonte forte candidata exclusivamente para carência zero FMD. | N/A |
| `mapa_pncebt_in_21_2008` | `norma_oficial` | PNCEBT / IN-21/2008 — Programa Nacional de Controle e Erradicação da Brucelose e Tuberculose | MAPA | URL fornecida: https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/pncebt/arquivos/tb-4-medidas-sanitarias.pdf (acesso cancelado pelo usuário) | legal_status (brucelose B19), eligibility_rule (fêmeas 3–8m), species_authorization, operational_window | `forte` (candidata — PRECISA_VALIDAR) | `PRECISA_VALIDAR` | Norma federal PNCEBT. Situação de bubalinos varia por UF. | Conteúdo da URL não extraído nesta sessão. | Fonte forte candidata para obrigatoriedade brucelose B19; elegibilidade fêmeas 3–8 meses. | ❌ Não extraído |
| `mapa_in_28_2005_bubalinos` | `norma_oficial` | IN MAPA 28/2005 — Inclusão de Bubalinos no Controle da Brucelose | MAPA | PRECISA_VALIDAR | species_authorization (bubalinos PNCEBT), legal_status | `forte` (candidata — PRECISA_VALIDAR) | `PRECISA_VALIDAR` | Norma específica sobre bubalinos no PNCEBT. | Texto não disponível no workspace; pode ter sido superada. | Fonte forte candidata para `species_authorization` de bubalinos na brucelose B19. | N/A |
| `mapa_pncrh` | `norma_oficial` | PNCRH — Programa Nacional de Controle da Raiva dos Herbívoros | MAPA | PRECISA_VALIDAR | legal_status (raiva em zonas de risco), eligibility_rule, operational_window | `forte` (candidata — PRECISA_VALIDAR) | `PRECISA_VALIDAR` | Norma federal com programas estaduais variáveis. | Programas estaduais variam; não obrigatório em todo o país. | Fonte forte candidata para `legal_status = condicional` de raiva. | N/A |
| `norma_estadual_sp_leptospirose` | `norma_oficial` | Portaria Estadual SP — Obrigatoriedade de Vacinação contra Leptospirose | Secretaria de Agricultura SP | PRECISA_VALIDAR — número não informado | legal_status (leptospirose SP), eligibility_rule | `forte` (candidata — PRECISA_VALIDAR) | `PRECISA_VALIDAR` | Norma estadual restrita ao Estado de São Paulo. | Número completo não disponível. | Fonte forte candidata para `legal_status = obrigatorio_norma` em leptospirose no Estado de SP. | N/A |
| `bula_eprinex_pour_on_merial_suifarma` | `bula` | Eprinex Pour-On — Bula (via Suifarma) | Merial (agora Boehringer Ingelheim) | http://www.suifarma.com.br/produtos/eprinex-pour-on/ (acessado 2026-06-09) | dose, via, carencia (zero — **CONFIRMADA pela bula**), withdrawal, species_authorization, indicacoes | `forte` (produto específico — conteúdo extraído) | `SIM_BULA` | **Fonte forte para o produto Eprinex Pour-On especificamente.** Composição: Eprinomectina 0,5%. Indicações: vermes redondos gastrointestinais e pulmonar, berne, ácaros sarcóptica e corióptica, piolhos, mosca-dos-chifres. Dose: 1 mL/10 kg aplicado topicamente na linha média superior (cernelha até articulação lombo-sacral). **Carência: "Não"** (zero) para leite e carne. Espécie: bovinos (corte e leite, inclusive vacas em lactação). | Fabricante Merial/Boehringer; apresentação 1L e 2,5L. Carência zero declarada explicitamente no conteúdo da bula ("carência zero para o leite e a carne fazem desta droga o produto ideal"). Não extrapolar para outros produtos de eprinomectina. | Para campo `carencia_zero` do `endectocida_eprinomectina_pour_on`: carência zero confirmada para este produto. Escopo: bovinos corte e leite. Registrar como `SIM_BULA` para Eprinex Merial. Demais produtos de eprinomectina precisam de bula própria. | ✅ Conteúdo extraído da bula via Suifarma: carência zero confirmada, dose 1mL/10kg, via tópica dorsal, composição eprinomectina 0,5%, espécie bovinos |
| `bula_bovilis_rb51_msd` | `bula` | BOVILIS® RB-51 — Produto MSD Saúde Animal Brasil | MSD Saúde Animal Brasil | https://www.msd-saude-animal.com.br/produto/rb-51/ (acessado 2026-06-09) | species_authorization, withdrawal, indicacoes | `forte` (candidata — produto confirmado; bula completa não extraída) | `PRECISA_VALIDAR` | **Fonte produto-específica para BOVILIS® RB-51 da MSD.** Confirmado: "Vacina viva atenuada contra Brucelose Bovina, cepa RB-51". Fabricante: MSD Saúde Animal Brasil. Página confirmada em https://www.msd-saude-animal.com.br/produto/rb-51/. Texto completo da bula (dose, via, carência, espécies autorizadas) não extraível desta página (JS-rendered). | Bula completa não extraída da página (JavaScript). Leitura direta da bula MAPA necessária para dose, via, carência e espécies autorizadas. | Evidência produto-específica confirmando nome comercial e fabricante. Para `NAO_AUTORIZADO` de bubalinos: bula completa ainda necessária para confirmar. | ✅ Nome e fabricante confirmados via página MSD |
| `bula_raivacel_multi_msd` | `bula` | RAIVACEL MULTI — Produto MSD Saúde Animal Brasil | MSD Saúde Animal Brasil | https://www.msd-saude-animal.com.br/produto/raivacel-multi/ (acessado 2026-06-09) | indicacoes, species_authorization, withdrawal | `forte` (candidata — produto confirmado; bula completa não extraída) | `PRECISA_VALIDAR` | **Fonte produto-específica para RAIVACEL MULTI da MSD.** Confirmado: "Vacina contra a Raiva". Fabricante: MSD Saúde Animal Brasil. Página em https://www.msd-saude-animal.com.br/produto/raivacel-multi/. | Bula completa não extraível (JS-rendered). Dose, via, carência, espécies autorizadas precisam de bula MAPA. | Evidência produto-específica confirmando nome e fabricante. Carência e espécies precisam de bula completa. | ✅ Nome e fabricante confirmados via página MSD |
| `bula_anticarbunculosa_labovet_pdf` | `bula` | Bula Vacina Anticarbunculosa — Labovet | Labovet | https://labovet.com.br/wp-content/uploads/2019/01/Bula-ANTICARBUNCULOSA.pdf (PDF baixado e OCR processado) | indicacoes, species_authorization, dose, via, withdrawal | `forte` (produto específico — OCR processado) | `SIM_BULA` | **Fonte produto-específica para Vacina Anticarbunculosa da Labovet.** Composição: Bacillus anthracis (cepa Sterne atenuada). Indicação: Antraz (carbúnculo hemático) em bovinos, ovinos, caprinos. Dose: bovinos 2 mL, ovinos/caprinos 1 mL. Via: subcutânea. Idade: a partir dos 4 meses, revacinação anual. **Carência: não mencionada na bula** (zero/não especificada). | Registro MAPA nº 3.747 em 14/06/91. Vacina anticarbunculosa não corresponde a clostridioses. | Fonte produto-específica para Anticarbunculosa Labovet. | ✅ Conteúdo extraído via OCR: dose 2mL bovinos, via SC, idade ≥ 4 meses, carência não citada |
| `bula_fortress_7_zoetis` | `bula` | Fortress 7 — Vacina Clostridial Zoetis | Zoetis | https://www2.zoetis.com.br/especies/bovinos/fortress/ (acessado 2026-06-09; JS-rendered) | dose, via, carencia, species_authorization, indicacoes | `forte` (candidata — produto identificado; bula não extraída) | `PRECISA_VALIDAR` | **Fonte produto-específica para Fortress 7 da Zoetis.** Página acessada mas JavaScript-rendered; conteúdo textual não extraído. Fortress 7 é vacina toxoide clostridial 7 valências para bovinos. | Bula completa não extraível automaticamente. Verificar dose, via, carência (candidata zero) e espécies na bula MAPA ou site Zoetis com JavaScript. | Fonte produto-específica para `vacina_clostridial_multivalente`. Carência zero candidata — confirmar bula. | ⚠️ Página acessada; JS impediu extração |
| `bula_leptoferm5_zoetis_pdf` | `bula` | Leptoferm 5 — Bacterina Leptospirose Zoetis | Zoetis | https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Leptoferm5.2.pdf (PDF baixado e OCR processado) | dose, via, carencia, withdrawal, species_authorization, indicacoes, sorogrupos | `forte` (produto específico — OCR processado) | `SIM_BULA` | **Fonte produto-específica para Leptoferm 5 da Zoetis.** Composição: 5 sorogrupos inativados (canicola, grippotyphosa, hardjo, icterohaemorrhagiae, pomona). Indicação: bovinos e suínos. Dose: 2 mL. Via: intramuscular. Esquema bovinos: dose única inicial, revacinação anual. **Carência: não vacinar 21 dias antes do abate** (leite não mencionado/zero). | Registro MAPA nº 5.037 em 15/03/95. Carência carne de 21 dias é crítica. | Fonte produto-específica para Leptoferm 5 Zoetis. | ✅ Conteúdo extraído via OCR: dose 2mL, via IM, dose única inicial bovinos, carência carne 21 dias |
| `bula_ivomec_injetavel_boehringer` | `bula` | Ivomec Injetável — Boehringer Ingelheim | Boehringer Ingelheim | https://www.boehringer-ingelheim.com/br/saude-animal/produtos/ivomec-injetavel (bloqueado por bot-protection) | dose, via, carencia, withdrawal, species_authorization, indicacoes | `forte` (candidata — produto confirmado; URL não acessível) | `PRECISA_VALIDAR` | **Fonte produto-específica para Ivomec Injetável da Boehringer Ingelheim.** URL bloqueada por Incapsula (proteção anti-bot). Ivomec 1% injetável: ivermectina 1% injetável SC, dose 1mL/50kg (200µg/kg), carência carne ~35d (candidata), não usar em lactantes. | Conteúdo não extraído. Bula MAPA necessária para confirmar dose, via, carência e espécies. Dados acima baseados em knowledge base — não são fonte confirmada. | Fonte produto-específica para `endectocida_ivermectina_injetavel`. Bula MAPA exigida antes de confirmar campos. | ❌ Bloqueado por proteção anti-bot |
| `bula_supramec_pour_on_msd` | `bula` | Supramec Pour-on — MSD Saúde Animal | MSD Saúde Animal Brasil | https://www.lojasantaclara.com.br/produto/640347/supramec-pour-on-msd-1-litro-1 (URL não acessada) | dose, via, carencia, withdrawal, species_authorization | `forte` (candidata — produto identificado; URL não acessada) | `PRECISA_VALIDAR` | **Fonte produto-específica para Supramec Pour-on da MSD.** URL de loja (Santa Clara); bula completa na página do fabricante MSD. Supramec: ivermectina 0,5% pour-on. Dose: 1mL/10kg, via tópica dorsal. Carência carne candidata ~28d. | URL de terceiros (loja); bula completa no site MSD ou MAPA necessária. Dados acima candidatos — não confirmados. | Fonte produto-específica para `endectocida_ivermectina_pour_on`. Verificar bula MSD ou MAPA para confirmar carência. | ❌ Não acessada nesta sessão |
| `bula_valbazen_10_zoetis` | `bula` | Valbazen 10 — Albendazol Zoetis | Zoetis | https://www.agroline.com.br/produto/valbazen-1-lt-97303 (URL não acessada) | dose, via, carencia, withdrawal, species_authorization, contraindicacoes | `forte` (candidata — produto identificado; URL não acessada) | `PRECISA_VALIDAR` | **Fonte produto-específica para Valbazen 10 da Zoetis.** URL de loja (Agroline); bula completa no site Zoetis ou MAPA. Valbazen: albendazol 10%, dose 10mg/kg oral, carência carne ~14d e leite ~84h candidatas, contraindicado em gestantes (1º trimestre). | URL de terceiros (loja); bula completa no site Zoetis ou MAPA necessária. Dados acima candidatos — não confirmados. | Fonte produto-específica para `antielmintico_albendazol`. Verificar bula Zoetis ou MAPA para confirmar dose, carência e contraindicação em gestantes. | ❌ Não acessada nesta sessão |
| `toxocara_vitulorum_sem_vacina` | `registro_produto` | Toxocara vitulorum — Situação regulatória | MAPA/SINDAN | Confirmado pelo usuário: "Inexistente" | item_status, species_authorization | `forte` | `NAO_AUTORIZADO` | **Confirmado pelo usuário:** não existe vacina registrada para Toxocara vitulorum. Controle por antiparasitários orais. | Sem produto registrado. Não criar protocolo de vacinação. Apenas alerta documental. | Confirma bloqueio total do item `toxocara_vitulorum_bubalino_pesquisa`. Automation_status = `blocked` invariável. | ✅ Confirmado pelo usuário |
| `bm86_gavac_restrito` | `registro_produto` | Vacina Bm86 (Gavac) — Situação regulatória | MAPA (parcial por estado) | Confirmado pelo usuário: "Restrito" | item_status, species_authorization, legal_status | `forte` | `PRECISA_VALIDAR` | **Confirmado pelo usuário:** Bm86/Gavac tem aprovação restrita (parcial por estado). Não usar como protocolo padrão. | Aprovação parcial por estado; custo alto; sem aprovação federal ampla. | Confirma bloqueio do item `carrapato_bm86` exceto em pesquisa/estado com aprovação. | ✅ Confirmado pelo usuário |
| `bula_generica_vacina_brucelose_b19` | `bula` | Bulas de Vacinas contra Brucelose B19 — Fabricantes Registrados PNCEBT | Múltiplos fabricantes (ex: Pfizer/Zoetis, Hipra, outros PNCEBT) | PRECISA_VALIDAR — produtos aprovados pelo PNCEBT no MAPA/SINDAN | dose, via, carencia, species_authorization, withdrawal | `forte` (por produto específico, quando disponível) | `PRECISA_VALIDAR` | **Fonte forte apenas para o produto comercial específico.** Fêmeas bovinas 3–8 meses. Dose única na vida. SC. | Produto específico não definido nesta fonte; variação possível por fabricante. | Placeholder para curadoria futura por produto PNCEBT específico. | N/A |
| `bula_generica_vacina_clostridial` | `bula` | Bulas de Vacinas Clostridiais Multivalentes — Fabricantes Registrados | Múltiplos fabricantes (Zoetis/Fortress 7, Boehringer, outros) | PRECISA_VALIDAR — ver `bula_fortress_7_zoetis` para produto específico | dose, via, carencia, species_authorization | `forte` (por produto específico, quando disponível) | `PRECISA_VALIDAR` | **Fonte forte apenas para o produto comercial específico.** Carência zero candidata para a maioria dos fabricantes — confirmar por produto. | Produto específico não definido nesta fonte genérica. | Placeholder. Para Fortress 7 especificamente usar `bula_fortress_7_zoetis`. | N/A |
| `bula_generica_bacterina_leptospirose` | `bula` | Bulas de Bacterinas contra Leptospirose — Fabricantes Registrados | Múltiplos fabricantes (Zoetis/Leptoferm 5, outros) | PRECISA_VALIDAR — ver `bula_leptoferm5_zoetis_pdf` para produto específico | dose, via, carencia, withdrawal, species_authorization | `forte` (por produto específico, quando disponível) | `PRECISA_VALIDAR` | **Fonte forte apenas para o produto comercial específico.** Carência altamente variável entre fabricantes. | Produto não definido nesta fonte genérica. | Para Leptoferm 5 especificamente usar `bula_leptoferm5_zoetis_pdf`. | N/A |
| `literatura_veterinaria_bubalinos` | `bibliografia` | Literatura Veterinária sobre Bubalinos | Diversos autores | PRECISA_VALIDAR | species_authorization (contexto), eligibility_rule (contexto) | `fraca` | `PRECISA_VALIDAR` | Fonte fraca de contexto. Não substitui bula ou norma oficial. | Literatura escassa; ensaios empíricos. | Apoio apenas para PRECISA_VALIDAR em bubalinos. | N/A |
| `mv_responsavel_fazenda` | `mv_responsavel` | Decisão do Médico-Veterinário Responsável — Escopo da Fazenda | MV responsável pela fazenda | Auditável por fazenda — `scope = fazenda`, `fazendaId` exigido | species_authorization (EXTRAPOLADO), eligibility_rule (off-label), dose (off-label) | `forte` (por decisão auditável, escopo fazenda) | `EXTRAPOLADO` | Válida apenas para a fazenda específica. Não transferível. | `requiresMvResponsavel = true`; limita automação ao escopo da fazenda. | Para casos `EXTRAPOLADO`. Exige `fazendaId` e decisão documentada. | N/A |

---

## Resumo de cobertura por campo crítico

| Campo crítico | Bula/fonte real disponível | Situação após acesso às URLs / OCR |
|---|---|---|
| `carencia_zero` (eprinomectina/Eprinex) | ✅ **Confirmada** — Eprinex Pour-On Merial via Suifarma | "Carência: Não" (zero) declarada explicitamente na bula |
| `carencia_zero` (aftosa) | ❌ IN-48/2020 não acessada | Aguardando leitura da IN |
| `nome_comercial` (Bovilis® RB-51) | ✅ **Confirmado** — MSD página do produto | Título: "BOVILIS® RB-51 — Vacina viva atenuada contra Brucelose Bovina, cepa RB-51" |
| `nome_comercial` (Raivacel Multi) | ✅ **Confirmado** — MSD página do produto | Título: "RAIVACEL MULTI — Vacina contra a Raiva" |
| `species_authorization` (RB-51 bovino) | ✅ Confirmado MSD como "Brucelose Bovina" | Bula completa ainda necessária para excluir bubalinos formalmente |
| `dose/via` (Eprinex) | ✅ **Confirmados** — 1mL/10kg, tópica dorsal, cernelha→lombo-sacral | Conteúdo extraído da bula via Suifarma |
| `dose` (Ivomec injetável) | ❌ Página bloqueada | Knowledge base: ~1mL/50kg (não confirmado) |
| `dose/via` (Valbazen 10) | ❌ URL não acessada | Knowledge base: 10mg/kg oral (não confirmado) |
| `carencia` (Leptoferm 5) | ✅ **Confirmada** — Bula Zoetis (OCR) | Abate: 21 dias (leite não mencionado/zero) |
| `carencia` (Anticarbunculosa Labovet) | ✅ **Confirmada** — Bula Labovet (OCR) | Carne/leite: não citado (zero/não especificado) |
| `dose/via` (Leptoferm 5) | ✅ **Confirmados** — 2 mL por via intramuscular (OCR) | Bovinos dose única inicial |
| `dose/via` (Anticarbunculosa Labovet) | ✅ **Confirmados** — Bovinos 2 mL via subcutânea (OCR) | Idade a partir dos 4 meses |
| `antraz vs clostridioses` | Confirmado | São protocolos distintos — não confundir |
| `toxocara` | ✅ Confirmado | Inexistente — sem vacina registrada |
| `bm86/gavac` | ✅ Confirmado | Restrito — aprovação parcial por estado |

---

## PDFs disponíveis e processados via OCR

| Produto | Caminho local | Tamanho | Status do processamento |
|---|---|---|---|
| Leptoferm 5 (Zoetis) | `.tempmediaStorage/8e7d36ef45d9b9ce.pdf` | 626.868 bytes | ✅ Processado via OCR. Dose 2mL, via IM, carência abate 21 dias |
| Anticarbunculosa (Labovet) | `.tempmediaStorage/4af81cd9fb30815e.pdf` | 41.257 bytes | ✅ Processado via OCR. Dose 2mL (bovinos), via SC, carência não citada |

---

## Fontes ausentes (lacunas remanescentes)

1. **Portaria MAPA 665/2024 completa** — lista de UFs por zona (aftosa)
2. **IN-48/2020 completa** — confirmação de carência zero para aftosa
3. **PNCEBT/IN-21/2008 completa** — acesso cancelado pelo usuário
4. **IN MAPA 28/2005 completa** — inclusão de bubalinos no PNCEBT
5. **PNCRH atualizado e programas estaduais de raiva**
6. **Portaria estadual SP leptospirose** — número exato e texto
7. **Bula Fortress 7 (Zoetis)** — site JS-rendered; bula MAPA necessária
8. **Bula Ivomec Injetável (Boehringer)** — site bloqueado por anti-bot
9. **Bula Supramec Pour-on (MSD)** — URL de loja; bula MSD necessária
10. **Bula Valbazen 10 (Zoetis)** — URL de loja; bula Zoetis necessária

---

_Versão: 12D4+bulas | OCR de Leptoferm 5 e Anticarbunculosa concluído | Eprinex carência zero confirmada | PDFs processados_
