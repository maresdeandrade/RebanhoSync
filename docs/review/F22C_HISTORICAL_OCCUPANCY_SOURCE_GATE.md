# F22C — Historical Occupancy Source Gate

Atualizado em: 2026-09-06
Baseline: `main@4e9d71b69c0e41c2aec26f900b83e083eb98d920`
Branch: `feat/f22c-historical-occupancy-gate`

## Decisão

```ini
F22C_SOURCE_GATE = READY_WITH_CAVEATS
F22C_HISTORICAL_LOT_SOURCE = READY
F22C_HISTORICAL_PASTURE_SOURCE = READY
F22C_LOT_OCCUPANCY_READ_MODEL = IMPLEMENTED
F22C_LOT_DURATION = IMPLEMENTED
F22C_PASTURE_OCCUPANCY_READ_MODEL = IMPLEMENTED
F22C_PASTURE_DURATION = IMPLEMENTED
F22C_QUALIFIED_DURATION = IMPLEMENTED
F22C_OCCUPANCY_AGGREGATION = IMPLEMENTED
F22C_OCCUPANCY_PERFORMANCE = IMPLEMENTED
F22C_DURATION_ADOPTION = IMPLEMENTED
F22C = CLOSED
```

As duas relações possuem fatos históricos datados e convergentes: `animal → lote` em `eventos` + `eventos_movimentacao` e `lote → pasto` no mesmo par de tabelas, com um Evento de movimentação próprio para o lote inteiro. Isso é suficiente para iniciar um read model que produza intervalos factuais e coverage explícita.

`READY` qualifica a **fonte e o próximo contrato**, não promete histórico completo para todo animal ou período. Cadastros podem nascer com `lote_id` e lotes podem nascer com `pasto_id` sem Evento de movimentação inicial; além disso, não há um fato canônico geral e durável `lote A → null`. Cada reconstrução deverá, portanto, resultar em `NO_HISTORY`, `PARTIAL_HISTORY`, `CONTIGUOUS_HISTORY` ou `CONFLICTED_HISTORY`, sem preencher lacunas com `state_*`.

No fechamento deste source gate ainda não havia cálculo de permanência, lotação ou produtividade; a atualização F22C.3 abaixo registra a implementação posterior de duração qualificada.

## Atualização F22C.1 — Historical Lot Occupancy Read Model

`selectHistoricalLotOccupancy` implementa uma leitura pura sobre coleções já carregadas de `eventos` e `eventos_movimentacao`. A função filtra animal e fazenda, ordena por `occurred_at`, deduplica cópias idênticas e produz intervalos `[enteredAt, leftAt)` sem consultar `state_*`, banco ou relógio global.

O contrato preserva `LEFT_BOUND_UNKNOWN`, `OPEN_RIGHT_BOUND` e `RIGHT_BOUND_UNKNOWN`; expõe `READY`, `PARTIAL`, `NO_HISTORY` e `CONFLICT`; e interrompe a cadeia diante de empate temporal, origem incompatível, identidade divergente ou correção sem resolvedor canônico. Detail ausente, tombstone, data inválida e `A → null` não canônico permanecem limitações explícitas. Movimentos exclusivos de pasto não participam.

O read model não contém duração, dias, pasto, peso, GMD, lotação ou estado atual.

## Atualização F22C.2 — Historical Pasture Occupancy Composition

`selectHistoricalLotPastureOccupancy` reconstrói a cadeia factual lote→pasto apenas quando o Evento identifica `animal_id = null`, `lote_id = L` e o detail mantém `from_lote_id = to_lote_id = L`, com origem/destino em `from_pasto_id`/`to_pasto_id`. O selector preserva boundaries, deduplicação, limitações e conflitos equivalentes aos da cadeia animal→lote.

`selectHistoricalPastureOccupancy` reutiliza `selectHistoricalLotOccupancy` e compõe cada intervalo animal→pasto somente pela interseção temporal com um intervalo lote→pasto do mesmo lote e fazenda. A saída mantém separadamente `lotOccupancySourceEventIds` e `pastureSourceEventIds`, não consolida segmentos com provenance distinta e expõe trechos sem suporte simultâneo como `PASTURE_UNKNOWN`.

Coverage e conflitos das duas fontes são propagados conservadoramente: a composição não promove `LEFT_BOUND_UNKNOWN`, `RIGHT_BOUND_UNKNOWN`, `PARTIAL_HISTORY` ou `CONFLICTED_HISTORY`. Estado atual não completa gaps. Nenhuma duração, métrica, UI, infraestrutura ou writer foi adicionado. O próximo incremento elegível é F22C.3 — Qualified Occupancy Duration.

## Atualização F22C.3 — Qualified Occupancy Metrics

`qualifiedOccupancyDuration` consome exclusivamente `HistoricalLotOccupancyResult` ou `HistoricalPastureOccupancyResult`. Intervalos fechados usam diferença temporal real; intervalos abertos exigem `referenceDate` explícita e não transformam essa referência em saída factual. `LEFT_BOUND_UNKNOWN`, `RIGHT_BOUND_UNKNOWN` e boundaries afetadas por conflito retornam `NOT_CALCULATED`. Recortes usam a interseção com `[from, to)`, sem arredondamento interno e sem converter ausência em zero.

`occupancyAggregation` produz duração conhecida, média, máximo, contagem de intervalos conhecidos/desconhecidos, coverage, limitações e conflitos por animal, lote e pasto. Builders, cards e a parcela de permanência dos cockpits passaram a consumir esses agregados. Naquele incremento, `buildWeightGainForOccupancy`, GMD, UA e taxa de lotação continuavam separados por dependerem de contratos adicionais.

## Fechamento F22C — Observed Occupancy Performance

`buildObservedOccupancyPerformance` consome exclusivamente os intervalos históricos qualificados e a evidência factual F22A de `eventos` + `eventos_pesagem`. Para cada intervalo, a primeira e a última observação válida contida formam a janela observada; duas datas distintas permitem calcular delta e GMD sem arredondamento interno. O contrato declara `OBSERVED_WITHIN_OCCUPANCY`, `reliability = UNCLASSIFIED` e `operationalUse = NOT_AUTHORIZED`.

Coverage de peso distingue `FULL_BOUNDARY_COVERAGE`, `PARTIAL_WEIGHT_COVERAGE`, `INSUFFICIENT_WEIGHT_EVIDENCE` e `CONFLICT`. Coverage completa exige coincidência factual exata com os dois limites da ocupação. Occupancy parcial pode sustentar somente a janela observada interna; ausência e conflito permanecem `null`, sem fallback zero, tolerância temporal ou peso atual. Builders, cards e cockpits de lote/pasto consomem o agregado qualificado, e `buildWeightGainForOccupancy` deixou de ser fonte de consumidores produtivos.

## Integração de entrada — PR #116

Fatos confirmados antes da abertura deste gate:

- head esperado e integrado: `87606379ae71bda6c92d4aab472abc9d8e55a00d`;
- `Validate repository`: `SUCCESS`;
- `Vercel`: `SUCCESS`;
- required check falhando: nenhum;
- merge por merge commit: `4e9d71b69c0e41c2aec26f900b83e083eb98d920`;
- `main` resultante: `4e9d71b69c0e41c2aec26f900b83e083eb98d920`;
- `87606379` ancestral da nova baseline: sim;
- worktree limpa antes da criação da branch: sim.

## Fontes factuais confirmadas

| Conceito | Fonte real | Campo/identidade | Classificação e limite |
| --- | --- | --- | --- |
| evento factual | `eventos` | `id`, `dominio = movimentacao` | factual; o Evento pai contém o instante e o escopo |
| animal | `eventos` | `animal_id` | factual para movimento individual; `null` no movimento do lote inteiro |
| fazenda | `eventos` e `eventos_movimentacao` | `fazenda_id` | factual e protegido por FKs compostas/RLS; ambos devem coincidir |
| instante factual | `eventos` | `occurred_at` (`timestamptz`) | timestamp de negócio; datas de gravação/recepção não o substituem |
| lote origem | `eventos_movimentacao` | `from_lote_id` | factual quando preenchido; pode ser `null` |
| lote destino | `eventos_movimentacao` | `to_lote_id` | factual quando preenchido |
| pasto origem | `eventos_movimentacao` | `from_pasto_id` | factual quando preenchido; pode ser `null` |
| pasto destino | `eventos_movimentacao` | `to_pasto_id` | factual; `null` é significativo somente no movimento explícito de remoção do lote de um pasto |
| tipo de movimento | `eventos.payload` + forma do Evento/detail | `tipo_movimentacao = lote_pasto` no fluxo atual | não existe coluna tipada; o payload não deve ser presumido em dados antigos |
| identificador do evento | `eventos` | `id` | chave do fato pai |
| detalhe de movimentação | `eventos_movimentacao` | `evento_id` | PK e FK composta para `(eventos.id, fazenda_id)` |
| idempotência | pai e detail | `client_op_id`, `client_tx_id`; PK `id`/`evento_id` | índices únicos de `client_op_id`; replay remoto comprovado sem duplicação |
| correção | `eventos` | `corrige_evento_id` | vínculo genérico disponível; não há resolvedor canônico específico de movimentação |
| cancelamento/reversão | — | `NÃO DISPONÍVEL` como tipo próprio de movimentação | não inferir reversão a partir de edição ou tombstone |
| tombstone | pai e detail | `deleted_at` | fato tombstonado não participa; pai e detail devem ser avaliados juntos |
| proveniência auxiliar | `eventos` | `source_task_id`, `source_tx_id`, `source_client_op_id` | não substitui identidade ou instante do fato |

Limite de tipagem confirmado: a tabela remota possui `eventos_movimentacao.client_op_id`, mas a interface TypeScript `EventoMovimentacao` não o declara. O read model pode usar `evento_id` e a identidade do pai para deduplicação; não deve depender desse campo ausente na superfície tipada sem um incremento específico.

## Fontes que não provam histórico

| Fonte/consumidor | Uso permitido neste gate | Motivo |
| --- | --- | --- |
| `state_animais.lote_id` | comparação do último resultado | estado atual; não prova quando começou uma ocupação |
| `state_lotes.pasto_id` | diagnóstico de convergência | não pode ser aplicado retroativamente ao lote |
| `state_pasto_ocupacoes` / `pasto_ocupacoes` | read model auxiliar e diagnóstico | é escrito junto ao gesto, mas não substitui o Evento + detail como fonte primária |
| `buildAnimalOccupancyTimeline` | inventário legado | calcula duração, não exige fazenda, ignora conflitos e usa `to_pasto_id` do movimento individual sem compor a história do lote |
| `buildWeightGainForOccupancy` | consumidor legado | não prova ocupação nem autoriza GMD por lote/pasto |
| `buildLoteOccupancyMetrics` / `buildPastoOccupancyMetrics` | consumidores legados | misturam períodos com estado atual e já calculam métricas fora deste gate |

## Semântica factual encontrada

### Animal e lote

| Operação | O que o fato encerra | O que inicia | Timestamp factual | Origem/destino |
| --- | --- | --- | --- | --- |
| entrada inicial por cadastro/compra/importação | não demonstrado por movimento | somente estado atual inicial | há datas cadastrais/comerciais, mas não um Evento de movimentação obrigatório | `lote_id` pode nascer direto no registro; boundary histórica desconhecida |
| troca de lote `A → B` | ocupação conhecida em A, se a cadeia anterior for compatível | ocupação em B | `eventos.occurred_at` | `from_lote_id = A`, `to_lote_id = B` |
| entrada `null → B` | nenhuma ocupação de lote factual anterior | ocupação em B | `eventos.occurred_at` | origem nula, destino B |
| retirada geral `A → null` | pretendida pelo builder local | não define destino | — | não é contrato remoto durável: a constraint exige `to_lote_id` ou `to_pasto_id` não nulo |
| venda | estado atual do animal é limpo no fluxo comercial | não abre lote | Evento comercial próprio | não é detail de movimentação; futura composição precisa preservar escopo individual/bulk |
| óbito | estado atual do animal é limpo | não abre lote | Evento de óbito (`occurred_at`/data do óbito) | não é detail de movimentação; pode ser boundary terminal somente por regra explícita futura |
| transferência entre fazendas | `NÃO DISPONÍVEL` como movimento histórico canônico auditado | `NÃO DISPONÍVEL` | `NÃO DISPONÍVEL` | não inferir de alteração cadastral |
| correção/reversão de movimento | vínculo genérico de correção pode existir | sem regra específica de precedência | novo `eventos.occurred_at` | tratar cadeia não resolvida como conflito, não sobrescrever o fato original |

O cadastro de animal persiste `lote_id` diretamente e o cadastro de lote persiste `pasto_id` diretamente. Esses caminhos explicam `LEFT_BOUND_UNKNOWN`: o primeiro movimento conhecido prova seu destino a partir do instante do fato, mas não cria uma data fictícia para a ocupação anterior.

### Lote e pasto

O fluxo `MudarPastoLote` cria atomicamente:

```text
Evento movimentacao (animal_id = null, lote_id = lote)
+ eventos_movimentacao
  from_lote_id = lote
  to_lote_id = lote
  from_pasto_id = origem
  to_pasto_id = destino
+ atualização do estado atual do lote
```

O lote inteiro muda de pasto sem emitir um movimento por animal. Portanto, histórico de animal em pasto exige a interseção temporal de duas cadeias independentes:

```text
animal ↔ lote, factual e datada
+ lote ↔ pasto, factual e datada
= animal ↔ pasto somente onde ambas possuem coverage
```

Quando o gesto registra `pasto X → null`, `to_lote_id` permanece igual ao lote e satisfaz a constraint de destino. Nesse caso específico, o fato prova que o lote ficou sem pasto a partir de `occurred_at`. Isso não autoriza interpretar ausência de dados como ausência de pasto.

## Contrato temporal para F22C.1

- Intervalos usam `[enteredAt, leftAt)`: entrada inclusiva e saída exclusiva.
- O instante é `eventos.occurred_at`, comparado como timestamp absoluto; timezone serve para apresentação ou agregação civil futura, não para reordenar fatos.
- Coleção fisicamente embaralhada deve produzir a mesma ordem temporal.
- Evento exatamente no início do período pertence ao novo intervalo; exatamente no fim inicia o intervalo seguinte, fora do anterior.
- Intervalo ainda aberto pode terminar conceitualmente em `referenceDate`, desde que a entrada seja factual, `referenceDate` seja explícita, não haja fato terminal/conflito posterior e o estado atual não seja usado para inventar a entrada.
- Evento inválido ou posterior a `referenceDate` não participa silenciosamente: gera limitação/conflito conforme afete a cadeia.
- Primeiro fato `A → B` em T prova B desde T. A ocupação anterior em A mantém `LEFT_BOUND_UNKNOWN`.

Contrato conceitual mínimo do próximo read model:

```text
animalId
fazendaId
loteId
enteredAt
leftAt | null
boundaryStatus
coverage
conflicts
```

## Conflitos, gaps e convergência

| Caso | Resultado obrigatório |
| --- | --- |
| dois destinos distintos no mesmo instante | `CONFLICTED_HISTORY`; nenhum desempate por ordem física |
| `A → B`, depois `C → D` | `BROKEN_CHAIN`; não reescrever C como B |
| primeiro fato sem entrada anterior comprovada | `LEFT_BOUND_UNKNOWN` |
| último destino sem fato posterior, com referência controlada | intervalo aberto até `referenceDate` |
| Evento/detail de outro animal | excluído |
| Evento/detail de outra fazenda ou fazendas divergentes | excluído e/ou conflito de tenant; nunca vaza para a cadeia |
| duplicata idêntica do mesmo Evento | uma observação factual |
| mesmo identificador com payload divergente | `CONFLICTED_HISTORY` |
| Evento sem detail ou detail sem pai | coverage parcial; não inventar transição |
| pai ou detail tombstonado | não participa; divergência entre tombstones é gap |
| correção ramificada ou sem semântica resolvida | conflito explícito |
| data inválida ou futura | excluída com limitação; conflito se impedir continuidade |
| histórico reconstruído termina em B, estado atual mostra C | `CONVERGENCE_GAP`; não criar `B → C` |

Coverage por animal/relação:

- `NO_HISTORY`: nenhum fato utilizável;
- `PARTIAL_HISTORY`: existe trecho provado, mas há boundary desconhecida, detail ausente ou cadeia incompleta;
- `CONTIGUOUS_HISTORY`: cadeia compatível e sem lacuna no intervalo solicitado;
- `CONFLICTED_HISTORY`: fatos concorrentes, divergentes ou cadeia incompatível impedem conclusão única.

## B4 / sync

A evidência [B4_REMOTE_MOVEMENT_CONVERGENCE_20260829.md](./evidence/B4_REMOTE_MOVEMENT_CONVERGENCE_20260829.md) é suficiente para o source gate:

- Evento pai + detail participam do pull padrão;
- Device A → staging → Device B e reinstall limpo foram comprovados;
- replay com as mesmas identidades permaneceu idempotente;
- pendência local não foi sobrescrita pelo pull;
- isolamento cross-farm foi comprovado;
- pai/detail convergiram e o estado atual coincidiu com o último destino no cenário validado.

O E2E remoto não foi repetido nesta branch.

## Matriz de readiness

| Capacidade | Fonte | Status | Bloqueio/condição |
| --- | --- | --- | --- |
| histórico animal → lote | `eventos` + `eventos_movimentacao` | `READY` | coverage varia por animal/período; nunca completar pelo estado atual |
| entrada em lote | `to_lote_id` + `occurred_at` | `READY` | cadastro inicial com lote não cria movimento; pode gerar `LEFT_BOUND_UNKNOWN` |
| saída de lote | próximo movimento factual; fatos terminais exigem composição | `PARTIAL` | `A → null` geral não satisfaz o contrato remoto atual |
| intervalo aberto atual | último destino factual + `referenceDate` | `READY` | somente sem conflito ou fato terminal posterior |
| conflitos temporais | identidades, timestamps e pares from/to | `READY_FOR_IMPLEMENTATION` | resolvedor ainda não implementado |
| histórico lote → pasto | Evento/detail `lote_pasto` | `READY` | vínculo inicial de lote com pasto pode não ter Evento |
| histórico animal → pasto | composição temporal das duas cadeias | `READY` | retorna parcial/desconhecido onde qualquer cadeia não tiver coverage |
| dias em lote | read model factual F22C.1 | `IMPLEMENTED_QUALIFIED` | apenas boundaries suficientes; ausência permanece indisponível |
| dias em pasto | composição factual F22C.2 | `IMPLEMENTED_QUALIFIED` | somente interseções demonstráveis; gaps permanecem gaps |

## Fatos, inferências e recomendações

### FATO CONFIRMADO

- Há fatos remotos, multi-tenant, datados e idempotentes para troca de lote do animal.
- Há fatos próprios para mudança do lote inteiro entre pastos, inclusive remoção explícita de um pasto.
- Cadastro inicial pode preencher `animal.lote_id` e `lote.pasto_id` sem Evento de movimentação.
- O legado de occupancy não implementa o contrato de coverage/conflitos necessário e não é fonte canônica.

### INFERÊNCIA CONTROLADA

- A interseção de dois intervalos factuais pode demonstrar o pasto do animal somente no trecho comum coberto.
- A cadeia pode terminar em `referenceDate` apenas sob as condições temporais acima; isso não transforma o último estado em fato atual absoluto.

### RECOMENDAÇÃO

F22C está fechado. Novo incremento deve introduzir capacidade de produto explicitamente autorizada, sem promover coverage parcial nem tratar GMD observado como desempenho confiável, ganho integral da permanência, UA ou rentabilidade.

## Escopo preservado

Não foram alterados writer, Evento, migration, RPC/RLS, trigger, Dexie, sync ou queue. Foram implementadas duração, agregação e performance observada factual, com apresentação qualificada nos consumidores compatíveis. Não foram implementados UA, UA/ha, @/ha, taxa de lotação nova, ganho por área, ranking, alerta ou recomendação.
