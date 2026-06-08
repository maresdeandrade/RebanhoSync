# Comitê Técnico Global — Fase 12D0

## Modelo canônico de Protocolo Sanitário v2, Produto e Fonte Técnica

Atualizado em: 2026-06-07

## Decisão

`PROSSEGUIR COM ESCOPO REDUZIDO`

A 12D0 é documental/contratual. Não há SQL, Dexie, sync-batch, UI, seed, carga curatorial completa, agenda, evento, estoque ou cálculo de carência nesta subfase.

Motivo: implementar offline/sync agora cristalizaria payloads de `agenda_intent`, handlers e snapshots antes de estabilizar o contrato canônico de produto, protocolo, fonte técnica, espécie, bubalino e carência.

## Diagnóstico local

### Estado Git

- HEAD observado no início da rodada: `9d38e78`.
- Branch: `main...origin/main`.
- Worktree: limpo.
- Staged: vazio.
- Untracked: vazio.
- 12B preservada no histórico: sim, commit `555662b`.
- 12C preservada no histórico: sim, commit `06bdf82`.
- `git diff --check`: sem erros.
- `git diff --cached --check`: sem erros.

### Estado documental

- Docs ativos ainda apontavam a próxima fase como offline/sync da Agenda Sanitária v2.
- A decisão 12C criou a fundação SQL/RLS da Agenda Sanitária v2, mas não estabilizou o modelo persistido de protocolo/produto/fonte.
- A nova decisão desta subfase insere 12D0 antes de qualquer sync amplo.

### Estado técnico

- `supabase/migrations/20260606090000_sanitario_agenda_v2_clean_foundation.sql` criou `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2`.
- A Agenda v2 já preserva `protocol_item_snapshot` e `produto_snapshot`, mas ainda sem contrato canônico persistido para o conteúdo técnico desses snapshots.
- `src/lib/sanitario/rules/sanitaryProtocolRule.ts` já define contratos puros para `SourceRef`, `SanitaryProduct`, `WithdrawalRule`, `SanitaryProtocolRule` e `WithdrawalSnapshotOnEvent`.
- Esses contratos puros bloqueiam guideline isolado para campo crítico, exigem fonte forte para dose/via/apresentação/carência e mantêm carência no produto executado.
- Lacunas confirmadas: não há schema v2 persistido para fonte técnica, versão de protocolo, versão de item, autorização por espécie, status regulatório por campo, vínculo produto-regra e snapshot técnico completo de agenda/evento.

## Guideline usado como fonte

Fonte localizada:

- `docs/review/evidence/Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.md`.

Inconsistência confirmada:

- O prompt informou um PDF em `docs/review/evidence/Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.pdf`, mas o workspace contém a versão Markdown equivalente. O PDF não foi localizado.

Uso permitido nesta subfase:

- fonte de curadoria;
- fonte de casos reais;
- fonte para validar campos estruturais;
- fonte de classificação preliminar;
- base para matriz de validação.

Uso proibido:

- seed final;
- protocolo automático final;
- fonte única para dose, via, carência, espécie autorizada ou uso off-label;
- autorização de venda, abate ou aptidão;
- substituto de bula, norma oficial, registro MAPA ou decisão do médico-veterinário responsável.

## Limites de uso do guideline

- Guideline pode apoiar classificação como obrigatório, recomendado, condicional, experimental ou alerta.
- Guideline não valida sozinho dose/via crítica.
- Guideline não valida sozinho carência.
- Guideline não autoriza bubalino quando a bula ou norma não menciona bubalinos.
- Guideline não transforma item experimental em protocolo.
- Guideline não transforma produto planejado em produto executado.

## Modelo canônico proposto

### `SourceRef`

Representa uma fonte técnica persistível ou serializável em snapshot.

Campos mínimos:

- `id` ou identificador externo;
- `kind`: `norma_oficial`, `bula`, `registro_produto`, `bibliografia`, `guideline_apoio`, `mv_responsavel`;
- `title`;
- `issuer`;
- `version`;
- `published_at`;
- `accessed_at`;
- `url` ou referência bibliográfica;
- `jurisdiction`: país, UF, zona sanitária ou órgão;
- `field_keys`: campos que a fonte cobre;
- `strength`: `forte`, `apoio`, `fraca`;
- `limitations`;
- `evidence_status`: `SIM_BULA`, `SIM_NORMA`, `PRECISA_VALIDAR`, `NAO_AUTORIZADO`, `EXTRAPOLADO`.

Regra: campo crítico só passa com fonte forte cobrindo o `field_key` específico.

### `SanitaryProduct`

Representa produto veterinário curado.

Campos obrigatórios:

- identidade: `id`, `nome_comercial`, `fabricante`, `registro_orgao`, `registro_numero`;
- classificação: `classe`, `principio_ativo`, `tipo_produto`;
- espécie: autorização explícita por `bovino`, `bubalino` e outras espécies;
- categoria/aptidão: corte, leite, mista, idade mínima, sexo, lactação, gestação;
- dose: quantidade, unidade, base (`animal`, `kg_peso_vivo`, `dose`);
- via: SC, IM, PO, tópica, intramamária ou outra;
- apresentação;
- regras de carência;
- contraindicações e limitações;
- `source_refs`;
- status curatorial: `ativo`, `precisa_validar`, `bloqueado`, `arquivado`.

### `WithdrawalRule`

Representa carência como propriedade primária do produto executado.

Campos:

- `product_id`;
- `species`;
- `aptitude`: `corte`, `leite`, `mista`;
- `route`;
- `dose_basis`;
- `meat_days`;
- `milk_days`;
- `milk_hours`;
- `applicability`: `period`, `zero`, `not_applicable`, `unknown`, `not_permitted`;
- `zero_requires_explicit_source`: sempre verdadeiro para carência zero;
- `source_refs`;
- `limitations`;
- validade/versionamento da regra.

Regras:

- `zero` exige fonte explícita, nunca ausência de carência.
- `unknown` bloqueia leitura de livre de carência.
- `not_applicable` exige motivo técnico.
- `not_permitted` bloqueia uso para o contexto declarado.

### `SanitaryProtocol`

Representa regra operacional versionada.

Campos:

- `id`;
- `family_code`;
- `name`;
- `scope`: global, pack, fazenda;
- `species_scope`;
- `jurisdiction_scope`;
- `legal_status`: `obrigatorio_norma`, `recomendado_tecnico`, `condicional`, `estrategico`, `experimental_alerta`, `bloqueado`;
- `version`;
- `status`: draft, active, retired;
- `source_refs`;
- `created_by` e trilha de aprovação quando customizado.

### `SanitaryProtocolItemVersion`

Representa a versão física imutável do item de protocolo.

Campos:

- `id`;
- `protocol_id`;
- `logical_item_key`;
- `version`;
- `item_status`: `obrigatorio`, `recomendado`, `condicional`, `estrategico`, `somente_alerta`, `bloqueado`;
- `action_type`: vacinação, vermifugação, tratamento, exame;
- `product_requirement`: produto específico, classe de produto ou nenhum;
- `product_id` opcional;
- `product_class`;
- `eligibility_rule`;
- `operational_window_rule`;
- `dose_rule`;
- `route_rule`;
- `booster_rule`;
- `species_authorization`;
- `source_refs_by_field`;
- `limitations`;
- `snapshot_template`.

Mudança semântica cria nova versão física. Agenda e evento preservam a versão/snapshot usada na época.

### `EligibilityRule`

Campos:

- espécie;
- categoria;
- sexo;
- idade mínima/máxima;
- aptidão;
- UF/zona;
- eventos âncora;
- histórico necessário;
- limitações quando faltar dado.

### `OperationalWindowRule`

Campos:

- âncora: nascimento, evento, entrada em lote, calendário oficial, manual;
- offset inicial/final;
- janela recomendada;
- janela limite;
- periodicidade/reforço;
- calendário por UF/zona;
- fonte técnica por campo.

### `AgendaTechnicalSnapshot`

Snapshot levado para `sanitario_agenda_v2`.

Campos mínimos:

- `schema_version`;
- `protocol_id`;
- `protocol_version`;
- `protocol_item_version_id`;
- `logical_item_key`;
- `item_version`;
- `action_type`;
- `item_status`;
- `legal_status`;
- `species_scope`;
- `bubalino_authorization_status`;
- `product_requirement`;
- `planned_product_id`;
- `planned_product_snapshot`;
- `eligibility_rule_snapshot`;
- `operational_window_snapshot`;
- `source_refs`;
- `field_source_status`;
- `limitations`.

Regra: snapshot de agenda documenta intenção técnica planejada, não execução e não carência ativa.

### `EventTechnicalSnapshot`

Snapshot levado para evento sanitário executado.

Campos mínimos:

- `schema_version`;
- `event_id`;
- `executed_product_id`;
- `executed_product_snapshot`;
- `executed_dose`;
- `executed_route`;
- `protocol_id`;
- `protocol_item_version_id`;
- `protocol_item_snapshot`;
- `withdrawal_snapshot`;
- `source_refs`;
- `mv_responsavel` quando houver decisão extrapolada;
- `limitations`.

Regra: snapshot de evento usa produto executado real; produto planejado não vira produto executado automaticamente.

## Matriz de campos críticos

| Campo | Fonte forte exigida | Guideline como apoio | Observação |
|---|---:|---:|---|
| Obrigatoriedade legal | Sim, norma oficial | Sim | UF/zona precisa estar explícita |
| Espécie autorizada | Sim, bula/norma | Sim | Bubalino sem fonte explícita fica limitado/bloqueado |
| Dose | Sim, bula/norma/produto | Não isolado | Guideline pode indicar necessidade de campo |
| Via | Sim, bula/norma/produto | Não isolado | Não inferir por classe |
| Carência carne/leite | Sim, bula/norma/produto | Não isolado | Carência zero também exige fonte |
| Produto específico | Sim | Sim | Classe pode ser usada para planejamento, não execução |
| Janela operacional | Sim para obrigação legal; apoio técnico para recomendação | Sim | Calendário por UF/zona exige norma |
| Reforço/intervalo | Sim para campo crítico | Sim | Atraso/reaplicação exige fonte |
| Experimental/alerta | Sim para bloquear automatização | Sim | Nunca entra como protocolo automático |
| Decisão MV | Registro auditável | Sim | Não substitui bula/norma para liberação crítica |

## Matriz de fonte mínima por campo

| Campo | Fonte mínima |
|---|---|
| `legal_status=obrigatorio_norma` | norma oficial vigente |
| `legal_status=condicional` por UF/zona | norma oficial ou overlay estadual curado |
| `species_authorization=SIM_BULA` | bula/registro do produto |
| `species_authorization=SIM_NORMA` | norma oficial |
| `species_authorization=EXTRAPOLADO` | decisão MV auditável + limitação explícita |
| `species_authorization=PRECISA_VALIDAR` | guideline ou literatura sem bula/norma suficiente |
| `species_authorization=NAO_AUTORIZADO` | fonte forte ausente ou fonte forte restringe uso |
| dose/via/apresentação | bula/registro do produto |
| carência período/zero | bula/norma/produto executado |
| janela recomendada | guideline técnico pode apoiar; fonte forte se crítico |
| item experimental | guideline/literatura como alerta; não agenda automática |

## Modelo bovino/bubalino

Estados de autorização por espécie:

- `SIM_BULA`: produto cita a espécie na bula/registro.
- `SIM_NORMA`: norma oficial inclui a espécie ou grupo, como bovídeos.
- `PRECISA_VALIDAR`: guideline/literatura sugere uso, mas falta fonte forte.
- `NAO_AUTORIZADO`: bula/norma não autoriza ou restringe.
- `EXTRAPOLADO`: uso fora da bula/norma, exige MV responsável e não libera automação crítica.

Regra: bubalino não herda autorização de bovino por padrão.

## Casos de teste extraídos do guideline

Estes casos validam a estrutura. Eles não são seed final.

| Caso | Tipo | Campos que valida | Limite |
|---|---|---|---|
| Febre aftosa em UF/zona com vacinação | obrigatória/condicional por norma | UF/zona, calendário, proibição em zona livre sem vacinação, bovino/bubalino, carência zero com fonte oficial | precisa curadoria de norma vigente por UF |
| Brucelose B19 em fêmeas 3-8 meses | obrigatória por programa | espécie, sexo, idade, dose única, documentação, versionamento de item | bula/norma devem validar carência e bubalino |
| Raiva dos herbívoros em área de risco | condicionada por UF/zona/risco | requisito regional, janela anual, risco epidemiológico, fonte estadual | não vira protocolo nacional automático |
| Clostridial 7/8V | core/recomendada técnica | item recomendado, primovacinação/reforço, carência zero por bula | não é obrigação legal universal |
| Ivermectina injetável | antiparasitário com carência | dose por peso, via SC, carência carne, leite não permitido | exige bula do produto executado |
| Eprinomectina pour-on | produto com carência zero | carência zero explícita, lactação, via tópica, fonte de bula | zero não é inferido por ausência |
| RB51 em bubalinas | bloqueio/limitação | `NAO_AUTORIZADO` ou `PRECISA_VALIDAR`, espécie, off-label | não automatizar uso bubalino |
| Toxocara vitulorum em bubalinos | experimental/alerta | `somente_alerta`, sem protocolo automático | não agenda e não recomenda execução automática |

## O que vira schema

Recomendado para 12D1:

- tabela/estrutura persistida de fontes técnicas;
- tabela/estrutura de produtos sanitários v2;
- regras de carência por produto/contexto;
- versões de protocolo;
- versões de item de protocolo;
- vínculo produto-regra;
- autorização por espécie;
- status regulatório/curatorial por campo;
- snapshots técnicos em agenda/evento, ao menos como JSONB versionado com contrato.

## O que vira contrato TypeScript

Recomendado antes ou junto da migration:

- enums para `SourceRef.kind`, `source_strength`, `evidence_status`, `legal_status`, `item_status`;
- tipos de `AgendaTechnicalSnapshot` e `EventTechnicalSnapshot`;
- validadores puros para fonte mínima por campo;
- builders de snapshot sem IO;
- testes sentinela com casos do guideline.

## O que permanece documental

- matriz de fontes mínimas;
- política de uso do guideline;
- limites de bubalino/off-label;
- decisão de não automatizar itens experimentais;
- separação entre planejamento, execução e carência.

## O que fica para curadoria posterior

- carga completa de produtos;
- carga completa de protocolos;
- verificação de bulas vigentes;
- overlays por UF/zona;
- revisão com médico-veterinário responsável;
- seeds/demo sanitários v2;
- normalização de catálogos regulatórios avançados.

## Testes sentinela futuros

- guideline isolado não valida carência.
- guideline isolado não valida dose/via crítica.
- produto sem fonte forte não libera campo crítico.
- carência zero exige fonte explícita.
- bubalino sem autorização explícita gera limitação ou bloqueio.
- item experimental não vira protocolo automático.
- alteração de protocolo não altera agenda já criada.
- agenda v2 carrega snapshot técnico.
- evento executado carrega produto real e snapshot de carência.
- produto planejado não vira produto executado automaticamente.
- decisão veterinária responsável fica auditável.
- `NAO_AUTORIZADO` bloqueia agenda automática.
- `PRECISA_VALIDAR` preserva limitação em preview/agenda.
- `EXTRAPOLADO` exige MV responsável e não libera venda/abate.

## Critério de aceite

- guideline usado como fonte de casos e curadoria, sem cópia integral;
- modelo canônico de produto definido;
- modelo canônico de protocolo definido;
- modelo canônico de fonte técnica definido;
- modelo canônico de carência definido;
- regra bovino/bubalino definida;
- itens experimentais/alerta não automatizados;
- snapshot técnico mínimo definido;
- separação clara entre estrutura e carga de dados;
- próxima fase delimitada antes de offline/sync.

## Próxima fase recomendada

`12D1 — Migration/contrato persistido de produto, protocolo e fonte técnica`

Não avançar para offline/sync da Agenda v2 antes de estabilizar schema/contrato persistido de produto, protocolo, fonte técnica e snapshot.

## Checklist final

- [x] Guideline usado como fonte de curadoria, não automação direta.
- [x] Produto executado segue fonte primária de carência.
- [x] Carência sem fonte forte segue bloqueada.
- [x] Bubalino sem fonte explícita segue limitado/bloqueado.
- [x] Itens experimentais não viraram protocolo automático.
- [x] Agenda segue intenção.
- [x] Evento segue fato.
- [x] Snapshot técnico foi especificado.
- [x] Dexie não foi alterado.
- [x] Sync-batch não foi alterado.
- [x] UI não foi alterada.
