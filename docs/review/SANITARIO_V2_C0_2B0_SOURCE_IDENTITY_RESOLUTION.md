# Sanitário v2 — C0.2B0 Source Identity Resolution

Atualizado em: 2026-09-24
Baseline: `dcece696deb1f7aa81cf5a0941aec9257239c317`
Branch: `feat/sanitario-v2-content-curation-c0`
Status: `READY_FOR_REVIEW`

## Decisão

```text
C0.2B0_STATUS = READY_FOR_REVIEW
SOURCES_EVALUATED = 10
MATERIALIZATION_ELIGIBLE = 10
BLOCKED = 0
SOURCE_KEYS_CORRECTED = 4
```

As dez referências consumidas pelo payload canônico ativo foram individualizadas contra
origens primárias. A elegibilidade registrada aqui é somente de identidade documental: não
cria UUID, `source_row`, coverage, produto, classe, member, protocolo ou autorização
operacional.

Quatro chaves foram corrigidas antes do congelamento `source_key ↔ UUID` porque descreviam
um programa ou tema amplo, omitiam o identificador documental ou chamavam uma página de
produto de bula. As correções foram aplicadas atomicamente no payload ativo 12F10. Artefatos
históricos 12F0–12F9 preservam as chaves da época e não são consumidores vigentes.

## Local schema preflight

Consulta read-only executada diretamente no PostgreSQL local em 2026-09-24:

```text
source_key column: PROVEN — text, nullable YES, default NULL
check regex: PROVEN — source_key IS NULL OR ^SRC_[A-Z0-9_]+$
global unique: PROVEN — ux_sanitario_fontes_v2_global_source_key_identity
farm unique: PROVEN — ux_sanitario_fontes_v2_farm_source_key_identity
class tombstone unique: PROVEN — índices global e tenant sem filtro deleted_at
SOURCE_SCOPE_SCHEMA_INVARIANT = PROVEN
```

O schema observado contém `sanitario_fontes_tecnicas_v2_scope_chk`, que exige
`scope='global'` com `fazenda_id IS NULL` ou `scope='fazenda'` com `fazenda_id IS NOT NULL`.
`sanitario_product_classes_v2_fazenda_chk` mantém a regra equivalente para `global` e
`tenant`. Nenhuma migration foi criada ou reaplicada.

## Fonte de escopo e separação de coverage

O conjunto vigente foi derivado de
`docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`, não da lista
histórica. Após as quatro correções, permanecem dez chaves distintas.

`PROVEN` abaixo significa somente que uma entidade documental única, emitida por fonte
primária, foi encontrada. Não significa que a entidade sustente automaticamente os campos
que atualmente a referenciam. A avaliação de coverage permanece separada e nenhuma linha de
coverage foi materializada.

## Source identity matrix

### `SRC_PNCEBT_BRUCELOSE`

```text
previous status: PARTIALLY_VERIFIED
identity status: PROVEN
key decision: KEEP
kind: norma_oficial (categoria disponível; o objeto exato é página institucional de programa)
issuer: Ministério da Agricultura e Pecuária — MAPA
exact source: Programa Nacional de Controle e Erradicação da Brucelose e da Tuberculose Animal - PNCEBT
document identifier: página institucional PNCEBT; cita a IN 10, de 03/03/2017
official origin: https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/pncebt/controle-e-erradicacao-da-brucelose-e-tuberculose-pncebt
version/date: publicada 2017-01-05; atualizada 2025-10-21; sem versão formal
consumers: protocolo brucelose_b19; item b19_femeas_3_8_meses; eligibility, species, sex, age, restrictions e species_authorization
materialization eligibility: YES
proposed evidence_status: PRECISA_VALIDAR
proposed strength: apoio
remaining limitations: página dinâmica, não é o ato normativo; identidade não prova coverage dos campos nem vigência de cada regra citada
```

### `SRC_BULA_ABORVAC_B19`

```text
previous status: PARTIALLY_VERIFIED
identity status: PROVEN
key decision: KEEP
kind: bula
issuer: Zoetis Indústria de Produtos Veterinários Ltda.
exact source: Abor-Vac — Vacina contra Brucelose
document identifier: licença MAPA nº 0523, 11/10/1977; artwork 40039374 / GQ-047
official origin: https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Abor-Vac.pdf
version/date: version 1, 2022-07-01; PDF modificado 2023-04-20
consumers: protocolo brucelose_b19; item b19_femeas_3_8_meses; dose, route e recurrence
materialization eligibility: YES
proposed evidence_status: SIM_BULA
proposed strength: forte
remaining limitations: evidência exclusiva do produto Abor-Vac; não generalizar para a classe B19 nem para execução sem produto
```

### `SRC_MAPA_RAIVA_VACINA`

```text
previous status: PARTIALLY_VERIFIED
identity status: PROVEN
key decision: KEEP
kind: norma_oficial (categoria disponível; o objeto exato é página institucional temática)
issuer: Ministério da Agricultura e Pecuária — MAPA
exact source: Vacina Antirrábica
document identifier: página do PNCRH sobre vacina antirrábica
official origin: https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/raiva-dos-herbivoros-e-eeb/vacina-antirrabica
version/date: publicada 2022-11-03; atualizada 2023-03-28; sem versão formal
consumers: protocolo raiva_herbivoros; itens raiva_primovac_dose1, raiva_primovac_reforco_30d e raiva_reforco_anual_area_risco; eligibility e species_authorization
materialization eligibility: YES
proposed evidence_status: PRECISA_VALIDAR
proposed strength: apoio
remaining limitations: página contextual, não é bula nem ato normativo; não prova produto, carência ou overlay regional
```

### `SRC_MAPA_IN_05_2002_RAIVA_HERBIVOROS`

```text
previous key/status: SRC_PNCRH_RAIVA / PARTIALLY_VERIFIED
identity status: PROVEN
key decision: CORRECT_BEFORE_UUID — corrected
kind: norma_oficial
issuer: Ministério da Agricultura, Pecuária e Abastecimento — MAPA
exact source: Instrução Normativa nº 5, de 1º de março de 2002 — Normas Técnicas para o Controle da Raiva dos Herbívoros Domésticos
document identifier: IN nº 5/2002, Processo nº 21000.009298/2001-82, alterada pela IN nº 41/2020
official origin: https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/qualidade-dos-servicos-veterinarios/arquivos/pncrh/in_05_2002_alt__n_41_2020_norma_tecnica_controle_rh.pdf
version/date: 2002-03-01; consolidação incorpora alteração de 2020-06-19
consumers: protocolo raiva_herbivoros; três itens raiva_*; dose, route, recurrence e restrictions
materialization eligibility: YES
proposed evidence_status: SIM_NORMA
proposed strength: forte
remaining limitations: coverage deve ser vinculada aos artigos aplicáveis; norma não substitui bula do produto executado
```

### `SRC_BULA_FORTRESS7`

```text
previous status: PARTIALLY_VERIFIED
identity status: PROVEN
key decision: KEEP
kind: bula
issuer: Zoetis
exact source: Fortress 7 — Bacterina Toxoide contra Carbúnculo Sintomático, Gangrena Gasosa e Enterotoxemia dos Bovinos
document identifier: PDF oficial Fortress-7.pdf
official origin: https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Fortress-7.pdf
version/date: PDF criado 2013-09-10 e modificado 2014-01-21; sem versão formal impressa localizada
consumers: protocolo clostridioses; itens clostridial_primovac_dose1, clostridial_primovac_dose2 e clostridial_reforco_anual; dose, route, recurrence, withdrawal e species_authorization
materialization eligibility: YES
proposed evidence_status: SIM_BULA
proposed strength: forte
remaining limitations: evidência produto-específica; não cobre genericamente vacina_clostridial nem bubalinos
```

### `SRC_BULA_LEPTOFERM5`

```text
previous status: VERIFIED
identity status: PROVEN
key decision: KEEP
kind: bula
issuer: Zoetis Inc.; representante no Brasil Zoetis Indústria de Produtos Veterinários Ltda.
exact source: Leptoferm 5/2 mL — Vacina Inativada Contra Leptospirose Bovina e Suína
document identifier: licença MAPA nº 5.037, 15/03/1995; artwork 40040644
official origin: https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Leptoferm5.2.pdf
version/date: v2; PDF criado e modificado 2023-01-06
consumers: protocolo leptospirose; itens lepto_primovac_dose1, lepto_primovac_dose2 e lepto_reforco_anual_semestral; dose, route, recurrence, withdrawal e species_authorization
materialization eligibility: YES
proposed evidence_status: SIM_BULA
proposed strength: forte
remaining limitations: evidência exclusiva de Leptoferm 5/2 mL; não valida segunda dose genérica, classe inteira ou bubalinos
```

### `SRC_BULA_POLIGUARD`

```text
previous status: PARTIALLY_VERIFIED
identity status: PROVEN
key decision: KEEP
kind: bula
issuer: MSD Saúde Animal Brasil
exact source: Resumo da Bula — POLIGUARD
document identifier: página oficial de produto, seção “Resumo da Bula”
official origin: https://www.msd-saude-animal.com.br/produto/poliguard/
version/date: página modificada 2024-10-16; bula integral, número de registro e versão não localizados
consumers: protocolo ibr_bvd; itens ibr_bvd_primovac_dose1 e ibr_bvd_primovac_dose2; eligibility, dose, route, recurrence e species_authorization
materialization eligibility: YES
proposed evidence_status: PRECISA_VALIDAR
proposed strength: apoio
remaining limitations: trata-se de resumo oficial, não de cópia versionada da bula integral; coverage crítica exige validação do documento integral
```

### `SRC_VIRBAC_BOVIGEN_REPRO_TOTAL_SE_PAGE`

```text
previous key/status: SRC_BULA_BOVIGEN / PARTIALLY_VERIFIED
identity status: PROVEN
key decision: CORRECT_BEFORE_UUID — corrected
kind: bibliografia (categoria disponível; o objeto exato é página oficial de produto)
issuer: Virbac Brasil
exact source: Bovigen® Repro Total SE
document identifier: página oficial do produto Bovigen Repro Total SE
official origin: https://br.virbac.com/products/biologicos/bovigen-repro-total-se
version/date: sem versão ou data formal localizada; acessada em 2026-09-24
consumers: protocolo ibr_bvd; itens ibr_bvd_primovac_dose1 e ibr_bvd_primovac_dose2; restrictions
materialization eligibility: YES
proposed evidence_status: PRECISA_VALIDAR
proposed strength: apoio
remaining limitations: página não se identifica como bula e “Bovigen” nomeia uma família de produtos; bula integral, registro e revisão permanecem pendentes
```

### `SRC_EMBRAPA_REC_TEC_26_VERMINOSE_DF`

```text
previous key/status: SRC_EMBRAPA_VERMINOSE / PARTIALLY_VERIFIED
identity status: PROVEN
key decision: CORRECT_BEFORE_UUID — corrected
kind: guideline_apoio
issuer: Embrapa Cerrados
exact source: Controle Estratégico da Verminose Bovina em Propriedades Rurais no Distrito Federal
document identifier: Recomendação Técnica 26, Embrapa Cerrados
official origin: https://www.infoteca.cnptia.embrapa.br/bitstream/doc/562842/1/rectec26.pdf
version/date: 1ª edição e 1ª impressão; junho de 2001
consumers: protocolos controle_parasitario_recria_5_7_9, vermifugacao_pre_desmama, vermifugacao_pre_confinamento_pasto_vedado e matrizes_pre_parto; seis itens; eligibility, recurrence e species_authorization
materialization eligibility: YES
proposed evidence_status: PRECISA_VALIDAR
proposed strength: apoio
remaining limitations: recomendação regional para DF/Cerrado; não é autorização de produto, dose, via, carência ou espécie por bula
```

### `SRC_MAPA_PNEFA_DADOS_VACINACAO`

```text
previous key/status: SRC_PNEFA_MAPA / PARTIALLY_VERIFIED
identity status: PROVEN
key decision: CORRECT_BEFORE_UUID — corrected
kind: norma_oficial (categoria disponível; o objeto exato é página institucional de dados)
issuer: Ministério da Agricultura e Pecuária — MAPA
exact source: Quantitativo de rebanho e dados sobre vacinação
document identifier: página do PNEFA sobre vacinação; cita a Portaria MAPA nº 678, de 30/04/2024
official origin: https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/febre-aftosa/campanha-febre-aftosa
version/date: publicada 2020-02-04; atualizada 2025-10-15; sem versão formal
consumers: protocolo febre_aftosa; itens fmd_historico_contingencia e fmd_bloqueio_vacinacao_rotina; eligibility, restrictions e species_authorization
materialization eligibility: YES
proposed evidence_status: PRECISA_VALIDAR
proposed strength: apoio
remaining limitations: página dinâmica, não é a Portaria 678/2024 nem prova de futura contingência; uso rotineiro continua bloqueado
```

## Key corrections

| old key | new key | motivo objetivo | consumers updated |
|---|---|---|---|
| `SRC_PNCRH_RAIVA` | `SRC_MAPA_IN_05_2002_RAIVA_HERBIVOROS` | a entidade é a IN 5/2002 consolidada, não o programa PNCRH em abstrato | snapshot do protocolo `raiva_herbivoros` e dose/route/recurrence/restrictions dos três itens `raiva_*` |
| `SRC_PNEFA_MAPA` | `SRC_MAPA_PNEFA_DADOS_VACINACAO` | a origem selecionada é a página específica “Quantitativo de rebanho e dados sobre vacinação”, não todo o PNEFA | snapshot de `febre_aftosa` e eligibility/restrictions/species_authorization dos dois itens `fmd_*` |
| `SRC_BULA_BOVIGEN` | `SRC_VIRBAC_BOVIGEN_REPRO_TOTAL_SE_PAGE` | a origem é página de produto e “Bovigen” sozinho identifica uma linha com múltiplos produtos | snapshot de `ibr_bvd` e restrictions dos dois itens `ibr_bvd_*` |
| `SRC_EMBRAPA_VERMINOSE` | `SRC_EMBRAPA_REC_TEC_26_VERMINOSE_DF` | a referência exata é a Recomendação Técnica 26, regional para DF/Cerrado, não “verminose Embrapa” genericamente | snapshots dos quatro protocolos antiparasitários e eligibility/recurrence/species_authorization dos seis itens consumidores |

Nenhum UUID foi associado às chaves novas ou preservadas.

## Materialization candidates

Todos os candidatos permanecem sem `id`:

| source_key | kind | scope / fazenda_id | title | issuer | version / published_at | accessed_at | evidence_status / strength | metadata documental |
|---|---|---|---|---|---|---|---|---|
| `SRC_PNCEBT_BRUCELOSE` | `norma_oficial` | `global` / `null` | Programa Nacional de Controle e Erradicação da Brucelose e da Tuberculose Animal - PNCEBT | MAPA | `null` / `2017-01-05` | `2026-09-24` | `PRECISA_VALIDAR` / `apoio` | `document_type=institutional_program_page`, updated `2025-10-21` |
| `SRC_BULA_ABORVAC_B19` | `bula` | `global` / `null` | Abor-Vac — Vacina contra Brucelose | Zoetis | `GQ-047/version 1/2022-07-01` / `null` | `2026-09-24` | `SIM_BULA` / `forte` | licença MAPA 0523; `document_type=manufacturer_label_pdf` |
| `SRC_MAPA_RAIVA_VACINA` | `norma_oficial` | `global` / `null` | Vacina Antirrábica | MAPA | `null` / `2022-11-03` | `2026-09-24` | `PRECISA_VALIDAR` / `apoio` | `document_type=institutional_topic_page`, updated `2023-03-28` |
| `SRC_MAPA_IN_05_2002_RAIVA_HERBIVOROS` | `norma_oficial` | `global` / `null` | Instrução Normativa nº 5/2002 — Normas Técnicas para o Controle da Raiva dos Herbívoros Domésticos | MAPA | `alterada pela IN 41/2020` / `2002-03-01` | `2026-09-24` | `SIM_NORMA` / `forte` | `document_type=consolidated_norm_pdf` |
| `SRC_BULA_FORTRESS7` | `bula` | `global` / `null` | Fortress 7 — Bacterina Toxoide contra Carbúnculo Sintomático, Gangrena Gasosa e Enterotoxemia dos Bovinos | Zoetis | `null` / `null` | `2026-09-24` | `SIM_BULA` / `forte` | `document_type=manufacturer_label_pdf`, PDF modified `2014-01-21` |
| `SRC_BULA_LEPTOFERM5` | `bula` | `global` / `null` | Leptoferm 5/2 mL — Vacina Inativada Contra Leptospirose Bovina e Suína | Zoetis | `v2` / `null` | `2026-09-24` | `SIM_BULA` / `forte` | licença MAPA 5.037; `document_type=manufacturer_label_pdf` |
| `SRC_BULA_POLIGUARD` | `bula` | `global` / `null` | Resumo da Bula — POLIGUARD | MSD Saúde Animal Brasil | `null` / `null` | `2026-09-24` | `PRECISA_VALIDAR` / `apoio` | `document_type=manufacturer_bula_summary_page`, modified `2024-10-16` |
| `SRC_VIRBAC_BOVIGEN_REPRO_TOTAL_SE_PAGE` | `bibliografia` | `global` / `null` | Bovigen® Repro Total SE | Virbac Brasil | `null` / `null` | `2026-09-24` | `PRECISA_VALIDAR` / `apoio` | `document_type=manufacturer_product_page` |
| `SRC_EMBRAPA_REC_TEC_26_VERMINOSE_DF` | `guideline_apoio` | `global` / `null` | Controle Estratégico da Verminose Bovina em Propriedades Rurais no Distrito Federal | Embrapa Cerrados | `Recomendação Técnica 26, 1ª edição` / `null` | `2026-09-24` | `PRECISA_VALIDAR` / `apoio` | publicação informada como junho/2001; `document_type=technical_recommendation_pdf` |
| `SRC_MAPA_PNEFA_DADOS_VACINACAO` | `norma_oficial` | `global` / `null` | Quantitativo de rebanho e dados sobre vacinação | MAPA | `null` / `2020-02-04` | `2026-09-24` | `PRECISA_VALIDAR` / `apoio` | `document_type=institutional_data_page`, updated `2025-10-15` |

Para todos os candidatos: `jurisdiction_country='BR'`, `jurisdiction_uf=null` e
`jurisdiction_zone=null`. As URLs são as origens oficiais registradas na matriz. Os valores
`null` são deliberados: não foi inferida versão ou data ausente.

## Blocked sources

```text
AMBIGUOUS = 0
UNRESOLVED = 0
INVALID = 0
```

As limitações remanescentes afetam coverage, força probatória ou representação fina do tipo
documental; não impedem individualizar as dez entidades. Páginas institucionais e páginas de
produto foram mantidas com `PRECISA_VALIDAR`/`apoio`, sem promovê-las a bula ou norma.

## Coverage

```text
coverage materialized = 0
```

Identidade documental não foi usada como prova automática de `species_authorization`,
`indication`, `dose`, `withdrawal`, `age`, `route`, `schedule`, requisito regulatório ou
`product_class`. Bulas permanecem produto-específicas; páginas institucionais permanecem
contextuais; a recomendação Embrapa permanece apoio regional.

## Guardrails preservados

- UUID allocation: não executada;
- source rows definitivas: 0;
- coverage rows: 0;
- classes e members: 0;
- backfill: não executado;
- publisher: inalterado e incompleto;
- migration local/remota: nenhuma criada ou aplicada nesta fase;
- sync/recovery/F24.4A: não alterados;
- publicação, commit, push, merge, PR e deploy: não executados.

## Validation status

- o payload permanece JSON válido e contém exatamente dez `SRC_*` canônicas;
- as quatro chaves antigas não permanecem no payload ativo;
- as 50 referências consumidoras das quatro chaves foram atualizadas;
- todas as chaves vigentes satisfazem `^SRC_[A-Z0-9_]+$`;
- os 68 testes focados do contrato canônico passaram;
- `import-sanitario-protocols-v2.mjs --validate` continua bloqueado, como esperado antes de
  C0.2B, pela ausência deliberada de UUIDs, `source_rows` e `product_class_rows`; a execução
  observada não reportou chave com formato inválido;
- `git diff --check` e o whitespace check dos dois arquivos C0.2B0 passaram.
