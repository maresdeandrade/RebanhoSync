# Mapa Oficial de Fluxos e Contratos — RebanhoSync

Status: **BASELINE OFICIAL CANDIDATO**
Code baseline original: `main@9db4bb9ffeb0bc4d1bc07305cde48132cd638721`
Functional state: baseline original + consolidated validated patches
Document source: `docs/review/evidence/MAPA_FLUXOS_CONTRATOS_REBANHOSYNC_VALIDADO.md`

> Quando existir um commit contendo código e documentação, o status e o hash poderão ser atualizados para esse commit final. Até lá, os patches validados pertencem ao candidate worktree e não recebem hash próprio.

## 1. Status e baseline

Este documento é o contrato arquitetural canônico para evolução dos fluxos operacionais. A evidência detalhada, inclusive causas e divergências históricas, permanece no mapa validado indicado no cabeçalho.

Distinção obrigatória:

- **Code baseline original:** `main@9db4bb9ffeb0bc4d1bc07305cde48132cd638721`;
- **Candidate worktree:** baseline original + P1 de convergência factual + P2 bulk + P2 de cobertura da exclusão;
- **Document revision:** working tree até existir commit de oficialização.

O candidate worktree foi aprovado em gate consolidado. Nenhum hash deve ser inventado para mudanças não commitadas.

## 2. Princípios fundamentais

| Conceito | Papel |
|---|---|
| Agenda | Intenção ou tarefa futura. |
| Evento | Fato executado e auditável. |
| `state_*` | Estado atual/read model; não substitui Evento. |
| Protocolo | Regra ou configuração; não comprova execução. |
| Tags, sinais e insights | Auxiliares de UX e consulta; não são fonte crítica. |

## 3. Invariantes arquiteturais

1. Agenda não é histórico.
2. Evento é fato executado.
3. `state_*` não substitui Evento.
4. Protocolo não prova execução.
5. Não criar writer paralelo.
6. Não reconstruir contrato canônico manualmente.
7. Não reenviar operação `APPLIED`.
8. `APPLIED_ALTERED` exige convergência.
9. Não apagar evidência `REJECTED` antes da política de retenção.
10. Não quebrar isolamento por `fazenda_id`.
11. Não transformar sucesso parcial em falha global.
12. Não transformar seleção em quantidade processada.
13. Não escrever em `animais_sociedade`.
14. Não usar tags ou insights como regra crítica.
15. Não calcular carência sem fato e fonte técnica.
16. Venda factual não significa aptidão.
17. Não usar UI como fronteira única de autorização.
18. Writes de domínio não usam `db.*.put` diretamente.
19. Retry do mesmo comando preserva identidade.
20. Correção factual recebe nova identidade quando aplicável.
21. Tombstone remoto não pode ressuscitar entidade operacional.
22. Detail factual necessário ao read model precisa de caminho explícito de convergência.

## 4. Pipeline operacional comum

```txt
UI
→ validação
→ builder/command
→ createGesture
→ transação Dexie
→ queue_gestures + queue_ops
→ sync
→ resultado por operação
→ reconcile/pull
→ read model
→ consumidor
→ reload
```

Camadas inexistentes em um fluxo devem ser registradas como `NÃO APLICÁVEL`. Pull, reconcile e materialização interna podem escrever diretamente em stores Dexie porque não são writers de domínio originados pela UI.

## 5. Fontes de verdade

| Pergunta | Fonte |
|---|---|
| O que aconteceu? | `eventos` + detail factual aplicável. |
| Qual é o estado atual? | `state_*` correspondente. |
| O que está pendente? | Agenda aberta/read model de agenda. |
| Qual regra está configurada? | Protocolo/configuração. |
| A operação sincronizou? | Gesture, op e resultado técnico de sync. |
| O fato é apto para decisão crítica? | Evento + detail + fonte técnica explícita, conforme domínio. |

Status técnico de sync não transforma intenção em fato nem comprova aptidão operacional.

## 6. Animais

`state_animais` contém identidade e estado operacional corrente. Criação, edição, importação e transições usam operações sobre a tabela remota `animais`, materializadas localmente em `state_animais`.

Mudanças factuais de movimentação, compra, venda, pesagem, ECC, reprodução ou sanidade exigem Evento e detail quando o contrato do domínio assim determinar. Retry não pode duplicar identidade. Toda leitura operacional deve confirmar `fazenda_id`.

## 7. Lotes

`state_lotes` representa lote corrente e seus vínculos operacionais. Cadastro e edição usam o writer canônico. Mudanças de ocupação por animais são fatos de movimentação; não devem ser simuladas apenas por edição silenciosa do lote ou do animal.

Exclusão de lote: `NÃO APLICÁVEL` no código atual.

## 8. Pastos

`state_pastos` representa o cadastro e estado atual do pasto. O vínculo atual lote–pasto pertence ao read model, enquanto a mudança física usa fato de movimentação quando prevista pelo fluxo.

Exclusão de pasto: `NÃO APLICÁVEL` no código atual.

## 9. Movimentações

Movimentação interna usa `buildEventGesture` e produz:

- Evento-base em `event_eventos`;
- detail em `event_eventos_movimentacao`;
- atualização do estado atual do animal ou lote;
- uma gesture agregada quando a ação é coletiva.

Origem e destino devem ser explícitos. O Evento preserva o fato; `state_*` responde apenas onde o animal/lote está agora.

## 10. Occupancy

Pipeline obrigatório:

```txt
buildAnimalOccupancyTimeline
→ AnimalOccupancyPeriod
→ buildWeightGainForOccupancy
→ buildEccMetricsForOccupancy
→ buildLoteOccupancyMetrics / buildPastoOccupancyMetrics
```

Fontes:

- estado atual de animais, lotes e pastos;
- movimentações factuais;
- pesagens;
- ECC.

`AnimalOccupancyPeriod` exige `weightStatus` e `eccStatus`. Os estados `empty`, `partial`, `complete` e `bloqueado` não podem ser substituídos por zero factual. É proibida uma reconstrução manual parcial equivalente em consumidores.

## 11. Agenda

Agenda representa intenção futura. Fechamento, cancelamento ou dispensa são estados administrativos e não criam fato por si mesmos.

Execução só é histórica quando existe Evento compatível e seus details obrigatórios. Agenda concluída sem Evento não alimenta KPI factual.

## 12. Sanidade

Execução sanitária usa Evento, detail sanitário e relações factuais aplicáveis. Agenda sanitária permanece intenção. Estoque e carência dependem do fato executado e de fonte técnica explícita.

Correções são novos fatos conforme o contrato sanitário; não reescrevem silenciosamente o histórico. Conformidade é read model derivado e não fonte primária.

## 13. Reprodução

Reprodução factual usa Evento e `eventos_reproducao`. O estado derivado não substitui o episódio factual.

`eventos_reproducao` possui caminho especializado por `pullReproductionDiagnosisState`, incluindo cursor, proteção de pendência e refresh pós-sync para os tipos sincronizados. Não deve ser presumido equivalente ao pull genérico.

## 14. Sociedade pecuária

Writers atuais usam `sociedades_pecuarias` e `sociedade_animais`. `animais_sociedade` é superfície legada somente para compatibilidade de replay/rollback.

Novos writes em `animais_sociedade` são proibidos.

## 15. Comercial

Compra e venda usam comando composto canônico:

- uma gesture;
- uma operação remota `commercial_operation_v2`;
- um Evento comercial por operação;
- snapshot/IDs de animais congelados;
- aplicação atômica no contrato composto.

Compra cria os animais previstos. Venda individual ou em lote atualiza estado e preserva um fato comercial. Não há sucesso parcial por animal dentro do comando composto. Conflito preserva comando/evidência; retry reutiliza identidade.

Venda factual não declara aptidão sanitária, regulatória ou comercial.

## 16. Financeiro

O fluxo financeiro factual usa `eventos` + `eventos_financeiro`. Compra/venda financeira pode também produzir alterações de animais e pesagens, conforme o plano construído.

`finance_transactions` é outro read model financeiro; não substitui `eventos_financeiro` nem é escrito automaticamente por todo fato comercial.

`eventos_financeiro` integra o pull padrão, o refresh pós-sync e a proteção de pending por `evento_id`.

## 17. ECC, pesagem e nutrição

ECC, pesagem e nutrição são fatos distintos e não devem ser presumidos equivalentes.

| Superfície | Pull atual | Refresh pós-sync | Proteção de pending | Chave factual |
|---|---|---|---|---|
| `eventos` | PADRÃO | quando Evento/agenda relacionada é tocado | sim | `id` |
| `eventos_movimentacao` | NÃO APLICÁVEL ao pull direto localizado | não localizado para o detail | não localizada nesse pipeline | `evento_id` |
| `eventos_nutricao` | PADRÃO | não integra a lista padrão de details de refresh | não explícita no helper factual atual | `evento_id` |
| `eventos_comercial` | PADRÃO; também converge no fluxo comercial composto | sim no fluxo comercial | sim | `evento_id` |
| `eventos_ecc` | PADRÃO | sim | sim | `event_id` |
| `eventos_pesagem` | PADRÃO | sim | sim | `evento_id` |
| `eventos_financeiro` | PADRÃO | sim | sim | `evento_id` |
| `eventos_reproducao` | ESPECIALIZADO | especializado | especializada | `evento_id` |
| `eventos_animais` | ESPECIALIZADO no cutover sanitário v2 | especializado | sim | `evento_id` |

`eventos_ecc`, `eventos_pesagem` e `eventos_financeiro` foram corrigidos no candidate worktree. `APPLIED` e `APPLIED_ALTERED` convergem para os stores locais correspondentes, sem sobrescrever detalhe local pendente e sem atravessar fazendas.

A ausência de `eventos_movimentacao` no `DEFAULT_REMOTE_TABLES` não é classificada automaticamente como defeito; é limitação conhecida que exige análise própria antes de qualquer mudança.

## 18. Importação

Import V2 usa:

```txt
preview determinístico
→ linhas válidas/rejeitadas/conflitantes
→ chunks de até 100
→ persistImportV2Preview
→ createGesture por chunk
→ op por linha válida
```

Animais, lotes e pastos não criam Evento durante importação cadastral. IDs de gesture/op são determinísticos por fazenda, importação, chunk e linha. Falha de um chunk não desfaz chunks aplicados; retry reutiliza identidade.

## 19. Operações bulk

Contrato obrigatório do bulk:

```txt
selected
→ revalidate
→ processed
→ operations
→ feedback(processed)
```

Quantidades distintas:

- selecionado;
- elegível;
- processado/enfileirado;
- aplicado remotamente;
- rejeitado.

Em `AdicionarAnimaisLote`, `processedAnimalIds` é preenchido somente para animais que geram as operações canônicas. O feedback usa `processedAnimalIds.length`. Zero processados não gera sucesso. Descartados não geram Evento, detail nem atualização de animal.

## 20. Exclusões

### Animal

```txt
AnimalEditar.handleDelete
→ confirmação
→ createGesture
→ OperationInput DELETE animais
→ before_snapshot
→ deleted_at otimista
→ remoção física de state_animais pela UI
→ queue
→ DELETE remoto materializado como tombstone
→ reconcile/pull
```

`REJECTED` restaura o snapshot e mantém evidência técnica. `APPLIED` consome a op. Pull de tombstone não pode ressuscitar o animal como ativo. Reload offline mantém a ausência operacional e a fila pendente.

Proteções normativas: `AnimalEditarDelete.test.tsx` e `animalDeletionFlow.test.ts`.

### Lote e pasto

- excluir lote: `NÃO APLICÁVEL`;
- excluir pasto: `NÃO APLICÁVEL`.

## 21. Offline, sync e retry

### Reload no mesmo dispositivo

Dexie e queue sobrevivem ao reload. Estado otimista e operações pendentes permanecem disponíveis.

### Instalação limpa ou outro dispositivo

Reconstrução depende das superfícies incluídas em pull padrão ou especializado. Não presumir que todo store Dexie possui convergência remota equivalente.

### Resultados

| Resultado | Contrato |
|---|---|
| `APPLIED` | Confirmado, removido da fila e nunca revertido por rejeição de outra op. |
| `APPLIED_ALTERED` | Confirmado com forma canônica alterada; exige pull/convergência. |
| `RETRYABLE` | Transitório; preserva identidade. |
| `REJECTED` | Terminal; rollback somente do não aplicado e evidência retida pela política vigente. |
| `CONFLICT` | Terminal conforme o domínio. |
| `BLOCKED_DEPENDENCY` | Terminal apenas quando a dependência concreta é terminal. |

Retry do mesmo comando preserva `client_tx_id` e `client_op_id`. Correção factual usa nova identidade quando o domínio exige novo fato.

## 22. Writers canônicos

| Writer/compositor | Uso |
|---|---|
| `createGesture` | Writer local-first genérico, fila e aplicação otimista. |
| `buildEventGesture` | Composição canônica de Evento-base, detail e estado aplicável. |
| `persistImportV2Preview` | Orquestra chunks determinísticos sobre `createGesture`. |
| `buildCommercialOperationGesture` | Comando comercial composto e atômico. |
| comandos sanitários v2 | Agenda, execução factual e fechamento com papéis separados. |

Componentes React podem orquestrar, mas não criar um writer paralelo. Escrita direta em Dexie só é válida para infraestrutura interna de pull, reconcile, rollback, cutover ou materialização prevista.

## 23. Read models, selectors e builders

Read models respondem estado ou agregação, nunca reescrevem o fato:

- occupancy usa timeline, peso e ECC canônicos;
- conformidade sanitária deriva de fatos e regras;
- peso atual confiável exige fonte factual explícita;
- estado comercial do animal não substitui Evento comercial;
- selectors devem respeitar fazenda ativa e tombstones.

Builders canônicos devem ser reutilizados. Consumidores não podem duplicar parcialmente a mesma regra para obter resultado “equivalente”.

## 24. Contratos legados

- `animais_sociedade`: compatibilidade de replay/rollback; novos writes proibidos;
- campos e fallbacks legados podem ser lidos apenas onde o contrato atual prevê;
- compatibilidade não autoriza criar nova fonte de verdade;
- código arquivado e migrations legadas não são contrato operacional atual.

## 25. Matriz Writer → Truth → Reader

| Fluxo | Writer | Truth factual | Estado/read model | Readers principais |
|---|---|---|---|---|
| Cadastro animal | `createGesture` | NÃO APLICÁVEL | `state_animais` | Animais, detalhes, seletores |
| Movimentação | `buildEventGesture` + `createGesture` | Evento + `eventos_movimentacao` | animal/lote/pasto corrente | detalhes e occupancy |
| ECC | `buildEventGesture` + `createGesture` | Evento + `eventos_ecc` | métricas derivadas | AnimalDetalhe e occupancy |
| Pesagem | `buildEventGesture` + `createGesture` | Evento + `eventos_pesagem` | peso/GMD derivados | detalhes, relatórios e occupancy |
| Nutrição | Evento + consumo opcional | Evento + `eventos_nutricao` | estoque quando aplicável | Eventos e Insumos |
| Financeiro | plano financeiro + `createGesture` | Evento + `eventos_financeiro` | animais/read models financeiros | Financeiro, Eventos, relatórios |
| Comercial | comando composto | Evento + `eventos_comercial` | `state_animais` | animais e histórico comercial |
| Sanidade | comandos/builders sanitários | Evento + detail sanitário | conformidade/estoque/carência | Central, detalhes e agenda |
| Reprodução | builder/comando reprodutivo | Evento + `eventos_reproducao` | estado derivado | detalhes e dashboards |
| Import V2 | `persistImportV2Preview` | NÃO APLICÁVEL | stores cadastrais | listas e detalhes |

## 26. Testes como contrato

| Invariante | Testes que protegem |
|---|---|
| Pull e pending de ECC/pesagem/financeiro | `factualDetailsPull.test.ts` |
| Refresh após `APPLIED`/`APPLIED_ALTERED` | `factualDetailsSyncRefresh.test.ts` |
| Bulk selecionado ≠ processado | `AdicionarAnimaisLote.test.tsx` |
| Handler de exclusão | `AnimalEditarDelete.test.tsx` |
| Delete, reload, rollback, pull e retry | `animalDeletionFlow.test.ts` |
| Sucesso parcial e identidade | `syncPartialBatch.test.ts` |
| Isolamento em detalhes | `detailFarmIsolation.test.ts` |
| Timeline, peso e ECC de occupancy | `src/features/occupancy/__tests__/*` |
| Import V2 | `importV2.test.ts`, `importV2Persistence.test.ts`, `importV2CreateGesture.test.ts` e E2Es das três telas |
| Comercial composto | `commercialOperationCommandV2.test.ts`, `commercialPurchaseSyncWorker.test.ts`, `commercialPurchasePull.test.ts` |
| Reprodução | testes de `remoteSync`, registro, correção e finalização reprodutiva |
| Sanitário | testes de execução, agenda v2, pull, compliance, estoque e carência |

Testes são proteção executável do contrato, não substitutos da fonte de verdade implementada.

## 27. Divergências conhecidas ativas

No escopo do mapa oficial candidato:

- P0: 0;
- P1: 0;
- P2: 0;
- P3: 0.

Limitações conhecidas, sem classificação automática como defeito:

- `eventos_movimentacao` não possui caminho direto no pull padrão observado;
- superfícies especializadas não devem ser tratadas como equivalentes ao pull genérico;
- `queue_rejections` é evidência operacional temporária e segue política de retenção.

Warnings de React Router, Browserslist, chunks e import dinâmico não são divergências operacionais deste mapa.

## 28. Invariantes para novos patches

Antes de alterar um fluxo:

1. identificar writer, truth, read model, consumidores e caminho de reload;
2. declarar unidade de gesture, op e Evento;
3. preservar sucesso parcial e rollback seletivo;
4. demonstrar idempotência e identidade de retry;
5. demonstrar isolamento por fazenda;
6. indicar pull padrão, especializado ou `NÃO APLICÁVEL`;
7. proteger pending local quando houver convergência remota;
8. incluir teste específico do invariável alterado;
9. não ampliar contrato por inferência;
10. registrar limitação quando uma camada não existir.

## 29. Regras para atualização deste documento

- Código e migrations ativas têm precedência factual.
- Atualizar este contrato somente após delta funcional/arquitetural validado.
- Preservar a auditoria detalhada no documento-fonte; não copiar toda a narrativa para cá.
- Registrar separadamente code baseline, candidate worktree e document revision.
- Não atribuir hash a worktree não commitado.
- Mudança durável de fonte de verdade, sync, RLS/RPC ou writer pode exigir ADR.
- Executar ao menos `git diff --check` e `pnpm run gates:docs`.
- Alterações funcionais exigem testes proporcionais ao risco antes de atualizar o status.
