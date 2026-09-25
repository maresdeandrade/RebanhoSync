# Sanitário v2 — Content Curation C0.1

Atualizado em: 2026-09-23
Baseline: `main@dcece696deb1f7aa81cf5a0941aec9257239c317` (inclui PR #165 e PR #166)
Branch: `feat/sanitario-v2-content-curation-c0`
Status: `READY_FOR_REVIEW`

## Decisão

Este documento é o inventário verificável de fontes, coverage, classes, grupos e consumidores
pedido por C0.1. Ele não é seed, payload publicável nem autorização operacional.

O inventário está completo para o estado atual do repositório e C0.1 está
`READY_FOR_REVIEW`. O escopo original de C0.1 é inventário, classificação, proveniência e
diagnóstico; ele proíbe materialização por inferência. Portanto, a ausência de `source_rows`,
`coverage_rows`, `product_class_rows`, members materializáveis e UUIDs novos é dependência da
fase seguinte, não incompletude deste inventário. Nenhum UUID foi gerado nesta etapa.

## Escopo e fontes de verdade consultadas

- payload vigente: `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`;
- índice de evidências: `docs/review/evidence/ARCHIVE_INDEX_SANITARIO_12F0_12F9.md`;
- schema ativo: migrations `20260608090000`, `20260610203500` e `20260615120000`;
- contrato/normalização: `scripts/codex/sanitario-v2-contract.mjs`;
- publisher incompleto: `scripts/codex/import-sanitario-protocols-v2.mjs`;
- testes: `tests/codex/sanitario-v2-contract.test.mjs`;
- contrato de domínio: `docs/domain/SANITARIO.md`.

`docs/review/evidence/` é um diretório misto. O índice declara 12F0–12F9 como evidência
histórica e declara o payload 12F10, seu decision record e seu import gate como fontes vigentes.
Nada foi movido ou renomeado.

## A. Inventário de fontes `SRC_*`

### A.1 Referências consumidas pelo payload canônico 12F10

`PARTIALLY_VERIFIED` significa que há identificação documental e/ou URL registrada, mas a
fonte não está materializada em `sanitario_fontes_tecnicas_v2`, falta versão/data verificável
ou o conteúdo primário não está preservado no repositório. Coverage abaixo descreve apenas os
campos efetivamente referenciados pelo payload; não transforma referência simbólica em prova.

| source_key | status | tipo esperado | emissor / título identificado | versão/data | URL/origem | consumidores e campos | limitações |
|---|---|---|---|---|---|---|---|
| `SRC_PNCEBT_BRUCELOSE` | `PARTIALLY_VERIFIED` | `norma_oficial` | MAPA / PNCEBT — controle e erradicação da brucelose e tuberculose | não materializada; artefato histórico cita IN 21/2008 | página oficial PNCEBT registrada no mapa 12F0 | `brucelose_b19` / `b19_femeas_3_8_meses`: `eligibility`, `species`, `sex`, `age`, `restrictions` | texto normativo e vigência não estão preservados no payload; fluxo oficial, MV e marcação continuam gaps |
| `SRC_BULA_ABORVAC_B19` | `PARTIALLY_VERIFIED` | `bula` | Aborvac B19; emissor não registrado no payload | não localizada | PDF comercial registrado no mapa 12F0 | `brucelose_b19` / `b19_femeas_3_8_meses`: `dose`, `route`, `recurrence` | bula não materializada; não sustenta carência nem autorização operacional da classe |
| `SRC_MAPA_RAIVA_VACINA` | `PARTIALLY_VERIFIED` | `norma_oficial` | MAPA / página oficial de vacina antirrábica | não localizada | página oficial MAPA registrada no mapa 12F0 | três itens `raiva_*`: `eligibility`; também usada em `species_authorization` | página contextual não resolve overlay regional, foco/perifoco nem produto executado |
| `SRC_PNCRH_RAIVA` | `PARTIALLY_VERIFIED` | `norma_oficial` | MAPA / norma técnica do PNCRH | arquivo nomeado como IN 05/2002 alterada pela IN 41/2020 | PDF oficial registrado no mapa 12F0 | três itens `raiva_*`: `dose`, `route`, `recurrence`, `restrictions` | texto primário não está preservado no repositório; aplicação depende de contexto regional |
| `SRC_BULA_FORTRESS7` | `PARTIALLY_VERIFIED` | `bula` | Zoetis / Fortress 7 — vacina clostridial | acesso registrado em 2026-06-09 | página comercial registrada; conteúdo JS não foi extraído | três itens `clostridial_*`: `dose`, `route`, `recurrence`, `withdrawal`; também `species_authorization` | cobertura é produto-específica e não pode ser generalizada para `vacina_clostridial` |
| `SRC_BULA_LEPTOFERM5` | `VERIFIED` | `bula` | Zoetis / Leptoferm 5 | registro MAPA 5.037, 15/03/1995; OCR registrado em 2026-06-09 | PDF Zoetis identificado na matriz de fontes | três itens `lepto_*`: `dose`, `route`, `recurrence`, `withdrawal`; também `species_authorization` | evidência é exclusiva do produto Leptoferm 5; não valida toda a classe nem bubalinos |
| `SRC_BULA_POLIGUARD` | `PARTIALLY_VERIFIED` | `bula` | MSD Saúde Animal / Poliguard | não localizada | página comercial registrada no mapa 12F0 | dois itens `ibr_bvd_*`: `eligibility`, `dose`, `route`, `recurrence`; também `species_authorization` | composição, esquema, gestação e carência são produto-específicos; bula completa não preservada |
| `SRC_BULA_BOVIGEN` | `PARTIALLY_VERIFIED` | `bula` | Virbac / Bovigen Repro Total SE | não localizada | página comercial registrada no mapa 12F0 | dois itens `ibr_bvd_*`: `restrictions` | referência não sustenta a classe inteira nem autorização bubalina |
| `SRC_EMBRAPA_VERMINOSE` | `PARTIALLY_VERIFIED` | `bibliografia` / `guideline_apoio` | Embrapa / recomendação técnica de controle estratégico de verminose | documento `rectec26.pdf`; data não localizada | Infoteca Embrapa registrada no mapa 12F0 | seis itens antiparasitários: `eligibility`; nos três itens de recria também `recurrence`; usada ainda em `species_authorization` | fonte regional/de apoio; não comprova autorização de produto/espécie, dose, via, carência ou member de grupo |
| `SRC_PNEFA_MAPA` | `PARTIALLY_VERIFIED` | `norma_oficial` | MAPA / PNEFA — febre aftosa | versão/data normativa não materializada | página oficial da campanha registrada no mapa 12F0 | `fmd_historico_contingencia` e `fmd_bloqueio_vacinacao_rotina`: `eligibility`, `restrictions`; também `species_authorization` | sustenta contexto de bloqueio/histórico, não produto, dose, carência ou execução de rotina |

### A.2 Referências fora do payload vigente

Estas referências foram encontradas pela busca global dirigida, mas não integram as dez
referências consumidas pelo payload 12F10.

| source_key | status | onde aparece | decisão C0.1 |
|---|---|---|---|
| `SRC_BULA_EPRIFORT` | `VERIFIED` | artefatos históricos 12F0/12F1 | bula Epriforte identificada e conteúdo resumido como produto-específico; não promover ao payload sem materialização própria |
| `SRC_BULA_SUPRAMEC` | `PARTIALLY_VERIFIED` | artefatos históricos 12F0/12F1 | página comercial identificada, sem conteúdo primário preservado |
| `SRC_BULA_VALBAZEN` | `PARTIALLY_VERIFIED` | artefatos históricos 12F0/12F1 | PDF comercial identificado, sem linha canônica vigente |
| `SRC_MAPA_PRODUTOS_VETERINARIOS` | `PARTIALLY_VERIFIED` | mapa histórico 12F0 | base institucional para futura validação cadastral; não é fonte de dose/carência |
| `SRC_BULA_RAIVACEL_MULTI` | `UNRESOLVED` | item candidato histórico de raiva | existe evidência histórica de produto com outro identificador, mas não há vínculo canônico comprovado com este `source_key` |
| `SRC_BULA_ANTIRRABICA_LABOVET` | `UNRESOLVED` | item candidato histórico de raiva | token não possui registro de fonte correspondente nos artefatos vigentes consultados |
| `SRC_B19` | `INVALID_REFERENCE` | fixture de store offline | chave sintética de teste, não fonte técnica |
| `SRC_TEST_LABEL` | `INVALID_REFERENCE` | fixtures do validator | chave sintética de teste, não fonte técnica |
| `SRC_MISSING` | `INVALID_REFERENCE` | caso negativo do validator | referência deliberadamente inexistente |
| `SRC_LIB_SANITARIO` | `INVALID_REFERENCE` | nome do plano `REBASELINE_SRC_LIB_SANITARIO` | falso positivo lexical da busca `SRC_*`; não é referência técnica |

### A.3 Coverage admissível nesta etapa

Os únicos `field_key` observados no payload vigente são `eligibility`, `species`, `sex`,
`age`, `dose`, `route`, `recurrence`, `withdrawal` e `restrictions`. O schema aceita texto não
vazio, mas esta etapa não cria categorias adicionais.

- `covers`: somente o conteúdo produto-específico registrado para
  `SRC_BULA_LEPTOFERM5` (`dose`, `route`, `recurrence`, `withdrawal` para Leptoferm 5).
- `partially_covers`: todos os demais pares fonte/campo da tabela A.1, pois a fonte não está
  materializada ou o escopo é produto/região/contexto específico.
- `does_not_cover`: `SRC_EMBRAPA_VERMINOSE` não cobre autorização de produto/espécie, dose,
  via ou carência; bulas produto-específicas não cobrem toda a `product_class`.

Não foi criada linha em `sanitario_fonte_cobertura_campos_v2`: os IDs estáveis de fonte e de
coverage ainda não existem e o contrato proíbe UUID artificial.

## B. Inventário de Product Classes

Foram encontradas nove candidatas no payload vigente: cinco usadas diretamente por itens e
quatro citadas nos 16 members rejeitados. `VALID_CLASS` significa apenas que o conceito tem
granularidade de classe técnica; não significa aprovação, autorização por espécie, dose,
carência ou execução.

| class_key | label/conceito atual | uso e protocolos dependentes | grupo | status | evidência e ambiguidade |
|---|---|---|---|---|---|
| `vacina_brucelose_b19` | vacina contra brucelose, cepa B19 | item `b19_femeas_3_8_meses` / `brucelose_b19` | — | `VALID_CLASS` | classe técnica distinta; produto, registro, espécie, dose e carência continuam produto/norma-específicos |
| `vacina_clostridial` | vacina clostridial | três itens `clostridial_*` / `clostridioses` | — | `VALID_CLASS` | conceito de classe válido, mas valências, indicação, esquema e carência não são generalizáveis |
| `vacina_raiva_herbivoros` | vacina contra raiva dos herbívoros | três itens `raiva_*` / `raiva_herbivoros` | — | `VALID_CLASS` | classe válida; overlay regional e produto real permanecem obrigatórios |
| `vacina_leptospirose` | vacina/bacterina contra leptospirose | três itens `lepto_*` / `leptospirose` | — | `VALID_CLASS` | sorovares, esquema, gestação e carência variam por produto |
| `vacina_ibr_bvd` | vacina combinada IBR/BVD | dois itens `ibr_bvd_*` / `ibr_bvd` | — | `TOO_BROAD` | o nome não distingue composição, tecnologia vacinal, antígenos adicionais ou restrições; não escolher rename sem decisão técnica |
| `lactonas_macrociclicas` | classe farmacológica antiparasitária | candidata em quatro grupos | quatro grupos antiparasitários | `VALID_CLASS` | classe técnica plausível; linha canônica, identidade e fontes por campo ausentes |
| `benzimidazois` | classe farmacológica antiparasitária | candidata em quatro grupos | quatro grupos antiparasitários | `VALID_CLASS` | classe técnica plausível; linha canônica, identidade e fontes por campo ausentes |
| `imidazotiazoleis` | classe farmacológica antiparasitária | candidata em quatro grupos | quatro grupos antiparasitários | `VALID_CLASS` | classe técnica plausível; linha canônica, identidade e fontes por campo ausentes |
| `associacoes_antiparasitarias` | combinações de classes/princípios ativos | candidata em quatro grupos | quatro grupos antiparasitários | `NOT_A_CLASS` | categoria de combinação, não uma classe técnica única; exige modelagem/decisão posterior |

Contagem: `VALID_CLASS=7`, `NEEDS_RENAME=0`, `TOO_BROAD=1`, `NOT_A_CLASS=1`,
`BLOCKED=0`.

Revisão de enquadramento: as sete `VALID_CLASS` representam classes técnicas, não nomes
comerciais, princípios ativos isolados, indicações, grupos ou protocolos. A classificação
`TOO_BROAD` de `vacina_ibr_bvd` é defensável porque a chave agrega composições e restrições
produto-específicas distintas. A classificação `NOT_A_CLASS` de
`associacoes_antiparasitarias` é defensável porque descreve uma combinação variável, não uma
classe técnica única. Não há evidência para promover, renomear ou bloquear silenciosamente
qualquer uma das nove candidatas.

## C. ProductClassGroup members

O payload contém quatro grupos, mas zero members materializáveis. As 16 relações estão em
`rejections.sanitario_product_class_group_members_v2` com
`PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.

| grupo | `lactonas_macrociclicas` | `benzimidazois` | `imidazotiazoleis` | `associacoes_antiparasitarias` |
|---|---|---|---|---|
| `pcg_antiparasitarios_recria_estrategicos` | `AMBIGUOUS` | `AMBIGUOUS` | `AMBIGUOUS` | `UNSUPPORTED` |
| `pcg_antiparasitarios_bezerros_pre_desmama` | `AMBIGUOUS` | `AMBIGUOUS` | `AMBIGUOUS` | `UNSUPPORTED` |
| `pcg_antiparasitarios_pre_confinamento` | `AMBIGUOUS` | `AMBIGUOUS` | `AMBIGUOUS` | `UNSUPPORTED` |
| `pcg_antiparasitarios_matrizes_pre_parto` | `AMBIGUOUS` | `AMBIGUOUS` | `AMBIGUOUS` | `UNSUPPORTED` |

Contagem: `PROVEN=0`, `AMBIGUOUS=12`, `UNSUPPORTED=4`.

As doze relações farmacologicamente plausíveis continuam ambíguas porque não há
`product_class_rows`, `class_id`, fonte de membership nem restrições produto/contexto
materializadas. As quatro relações com `associacoes_antiparasitarias` são não suportadas
porque a candidata não representa uma classe técnica única.

## D. Consumidores e fluxo atual

- o payload 12F10 é lido por `scripts/codex/import-sanitario-protocols-v2.mjs`;
- o importer foi limitado a grupos, protocolos e itens, mantém
  `PUBLISHER_COMPLETE=false` e rejeita members sem `class_id`; no baseline atual, seu modo
  `--validate` falha antes de gerar plano porque o payload não satisfaz o contrato canônico;
- o runtime lê `sanitario_protocolos_v2`, `sanitario_protocolo_itens_versions_v2` e
  `sanitario_product_class_groups_v2` em modo catálogo read-only;
- execução/correção consultam os catálogos locais de fontes e coverage por ID, mas o payload
  12F10 não os alimenta;
- nenhum consumidor autoriza usar classe/grupo como prova de produto executado, dose,
  carência ou aptidão operacional.

## Classificação do validator em C0.1

O `--validate` do importer é `EXPECTED_FAIL` nesta fase: o validator canônico exige linhas e
UUIDs materializados que C0.1 não estava autorizado a criar. A falha preserva corretamente o
gate de publicação e não invalida o inventário. O validator não foi relaxado nem alterado.

## C0.2A — auditoria read-only de estratégia de identidade

O contrato vigente exige UUID explícito e estável em todas as coleções canônicas e rejeita
conflito `natural key ↔ UUID`. O import gate também proíbe UUID artificial.

### Padrões reais encontrados

| padrão | natural key / namespace | estabilidade e idempotência | colisão / conflito | classificação para fontes e classes canônicas |
|---|---|---|---|---|
| categorias financeiras default: SHA-256 em TypeScript e SQL | `(fazenda_id, slug)`; domínio é implícito na função e no separador | mesmo vetor fixo no cliente e no Postgres; retry mantém o ID | unicidade `(fazenda_id, slug)`, PK e migração de referências; não há registro explícito de colisão criptográfica | `REUSABLE_WITH_CONSTRAINTS`: algoritmo e paridade são reutilizáveis, mas o modelo atual é tenant-scoped e precisa de domínio/namespace global explícito por tipo de entidade |
| importação v2: hash determinístico próprio | strings com tipo, fazenda e identidade importada | estável no cliente e testado por fazenda | não há paridade SQL nem contrato canônico global demonstrado | `NOT_APPLICABLE`: resolve identidade de importação operacional, não catálogo global entre ambientes |
| Sanitário custom: `deterministicUuidFromText` | texto normalizado do item lógico | estável apenas na implementação TypeScript consultada | hash próprio, sem paridade SQL ou política de colisão; IDs físicos continuam aleatórios | `UNSAFE` para PK canônica de fonte/classe |
| catálogo Sanitário oficial atual | preserva ID existente; novos registros físicos usam `crypto.randomUUID()` | estável somente depois de persistido no mesmo ambiente | natural keys ajudam lookup, mas não produzem o mesmo ID entre ambientes | `UNSAFE` para a exigência cross-environment desta fase |
| validator/importer Sanitário v2 | `source_key`, `class_key`, `group_key`, `family_code` e identidade lógica do item | exige UUID explícito e preserva `natural key ↔ UUID` em reexecução | rejeita UUID duplicado, chave simbólica duplicada e `IDENTITY_CONFLICT` | `REUSABLE_WITH_CONSTRAINTS`: mecanismo de enforcement reutilizável; não deriva IDs novos |
| seeds por natural key (`ON CONFLICT` / `WHERE NOT EXISTS`) | slug, código ou nome conforme o catálogo | idempotente no mesmo banco | evita duplicação lógica local, mas IDs default aleatórios divergem entre ambientes | `NOT_APPLICABLE` para UUID canônico cross-environment |
| `gen_random_uuid()` e UUID randômico do runtime | sem natural key incorporada | único por criação, não reproduzível | PK protege colisão local | `UNSAFE` para fontes/classes canônicas que exigem o mesmo ID em todos os ambientes |
| ADR de dedup Sanitário | chave estruturada de deduplicação operacional | paridade TypeScript/SQL prevista para dedup | evita colisão semântica de agenda, não define PK | `NOT_APPLICABLE` à geração de UUID, mas confirma que nomes de exibição não devem compor identidade |

Não foi encontrada implementação ativa de UUID v5 padronizado com namespace explícito nem
registro versionado de UUIDs estáticos para essas entidades. O padrão financeiro marca o
nibble como versão 5, mas usa SHA-256 e domínio textual próprio; não deve ser descrito como
UUID v5 RFC por namespace.

### Compatibilidade com o schema Sanitário

- `sanitario_product_classes_v2` possui natural key persistida e unicidade por `class_key`
  no escopo global, além de `(fazenda_id, class_key)` no escopo tenant;
- `sanitario_fontes_tecnicas_v2` não possui coluna `source_key` nem constraint natural
  equivalente, embora o contrato canônico exija `source_key` em `source_rows`;
- coverage já tem unicidade `(source_id, field_key)` e pode depender do ID estável da fonte;
- não há tratamento explícito de tombstone/recriação para uma mesma natural key canônica;
- o importer preserva IDs existentes e rejeita conflito, mas não resolve bootstrap idêntico
  em bancos independentes.

### Decisão de C0.2A

`IDENTITY_STRATEGY = EXISTING_PATTERN_WITH_ADAPTATION`

O padrão financeiro é a base reutilizável mais forte porque tem derivação determinística nos
dois lados, vetor fixo de paridade, natural key única e comportamento idempotente. Para o
catálogo Sanitário global, a adaptação futura precisa definir antes de materializar:

1. namespace/domínio canônico, versionado e explícito;
2. entrada distinta por tipo de entidade, por exemplo fonte versus classe;
3. normalização imutável das natural keys `source_key` e `class_key`;
4. paridade TypeScript/Postgres com vetores fixos;
5. política de conflito, tombstone e recriação;
6. suporte persistido para `source_key`, hoje ausente no schema de fontes.

Esta decisão seleciona uma direção arquitetural; não autoriza implementar o gerador, alterar
schema, gerar UUIDs ou materializar entidades nesta execução.

O payload 12F10 usa lookups por `family_code` e `group_key` e depende de registros previamente
existentes para obter IDs. Isso preserva IDs existentes no importer parcial, mas não resolve a
materialização canônica de fontes, coverage, classes ou members entre ambientes.

## Gaps pós-C0.1 para materialização

1. não há `source_rows` nem `coverage_rows` canônicos;
2. não há `product_class_rows` canônicos para as nove candidatas;
3. a adaptação da estratégia determinística ainda precisa ser especificada e aprovada antes
   de gerar UUIDs novos;
4. 16 members não possuem `class_id`; doze são ambíguos e quatro não são suportados;
5. somente Leptoferm 5 e Epriforte possuem evidência registrada suficiente para
   `VERIFIED`; as demais referências exigem fonte primária/versionada ou vínculo canônico;
6. o schema persistido de fontes não possui a natural key `source_key` exigida pelo contrato;
7. o validator canônico estrito e o modo `--validate` do importer rejeitam o payload vigente
   por identidades e referências não materializadas (`EXPECTED_FAIL` para C0.1);
8. nenhuma fonte consultada autoriza inferir produto comercial, dose de classe, carência de
   classe, autorização bubalina genérica ou agenda automática.

## Guardrails preservados

- `execute_import=false`, `import_real_authorized=false`, `allows_operational_release=false`;
- `agenda_allowed=false` e `approved_for_catalog=false` permanecem inalterados;
- nenhum produto comercial, dose, carência, autorização por espécie ou protocolo novo foi
  criado;
- nenhuma migration, publicação, Supabase, sync/recovery ou F24.4A foi alterada;
- Agenda continua intenção, Evento continua fato, `state_*` continua read model e Protocolo
  continua regra/configuração.
