# Analise: Refatoracao do Sistema de Registros e Agenda (Two Rails)

## 1. Resumo executivo
A recente refatoração do sistema de registros no RebanhoSync solidificou o modelo *Two Rails*, onde a intenção operacional (Agenda) e o fato histórico (Evento) possuem fluxos de dados distintos, mas interdependentes. O fluxo `Registrar` atua como o maestro, capturando dados da UI e transformando-os em gestos append-only persistidos em `eventos`. A automação de agendas, primariamente orientada pelo domínio sanitário, é gerida de forma declarativa e determinística no banco de dados via RPC (`sanitario_recompute_agenda_core`), suportada no frontend por lógicas passivas de taxonomia e payload (`gera_agenda`).

## 2. Arquivos inspecionados
- `src/lib/events/types.ts`: Define a taxonomia de domínios dos eventos (`EventDomain`).
- `src/lib/offline/types.ts`: Define `DominioEnum`, `AgendaItem` e `Evento`.
- `src/lib/sanitario/models/domain.ts`: Define a estrutura de protocolos sanitários e as regras de agendamento (schedule, eligibility, applicability).
- `src/lib/sanitario/engine/scheduler.ts`: Lógica TS de computação de próxima ocorrência.
- `src/lib/sanitario/engine/dedup.ts`: Lógica estruturada da chave de deduplicação (`dedup_key`).
- `src/pages/Registrar/effects/nonFinancialFinalize.ts`: Orquestração de finalização não financeira.
- `src/lib/events/buildEventGesture.ts`: Transforma payload em operações (`INSERT` em eventos).
- `src/lib/sanitario/infrastructure/executionBoundary.ts` & `src/lib/sanitario/infrastructure/service.ts`: Fronteira TS para chamar RPC do fechamento.
- `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`: Motor líder de completude de agenda (`sanitario_complete_agenda_with_event`) e recálculo automático (`sanitario_recompute_agenda_core`).
- `docs/ARCHITECTURE.md`: Documentação normativa do modelo Two Rails.

## 3. Taxonomia de registros/eventos
De acordo com `src/lib/events/types.ts` e `src/lib/offline/types.ts`:

| Nome Técnico (`dominio`) | Nome Funcional | Módulo/Origem | Tabela Local / Remota | Trilho | Atributos Obrigatórios | Atributos Opcionais | Regras / Dependências | Propósito Funcional |
|---|---|---|---|---|---|---|---|---|
| `sanitario` | Sanitario | Registrar (Sanitario) | `eventos_sanitario` / `eventos` | `event_*` | `tipo`, `produto`, `occurred_at`, `fazenda_id` | `protocoloItem`, `produtoRef` | Depende de fazenda. Pode derivar de agenda ou animal específico. Vincula catálogo se `produtoRef` presente. | Fato de vacinação, vermifugação ou medicamento. |
| `pesagem` | Pesagem | Registrar (Pesagem) | `eventos_pesagem` / `eventos` | `event_*` | `peso_kg`, `occurred_at`, `fazenda_id` | `lote_id`, `animal_id` | Peso deve ser validado (ex: > 0). | Histórico de ganho de peso. |
| `movimentacao` | Movimentação | Registrar (Manejo/Mov) | `eventos_movimentacao` / `eventos` | Ambos (`event_*` e atualiza `state_*`) | `occurred_at`, `fazenda_id` | `from_lote_id`, `to_lote_id`, payload de trânsito | Depende de lotes/pastos. Pode atualizar a tabela mutável `animais.lote_id`. | Fato de troca de lote/pasto. |
| `nutricao` | Nutrição | Registrar (Nutrição) | `eventos_nutricao` / `eventos` | `event_*` | `alimento_nome`, `quantidade_kg`, `occurred_at`, `fazenda_id` | - | `quantidade_kg` numérica. | Histórico de alimentação do lote/animal. |
| `financeiro` | Financeiro | Registrar (Financeiro) | `eventos_financeiro` / `eventos` | Ambos | `tipo`, `valor_total`, `fazenda_id`, `occurred_at` | `contraparte_id`, `animalSaleStatus` | Vendas podem mudar `animais.status` para "vendido". | Fatos contábeis de receitas/despesas. |
| `reproducao` | Reprodução | Registrar (Reprodução) | `eventos_reproducao` / `eventos` | Ambos | `tipo` (ReproTipoEnum), `fazenda_id`, `occurred_at` | `macho_id`, diagnósticos, cria IDs. | Depende de animal fêmea. Pode criar novos animais no db no caso de "parto". | Gestão do ciclo reprodutivo e pós-parto. |
| `alerta_sanitario` | Alerta Sanitário | Domínio Sanitário | `animais` (Update) / `eventos` | Ambos | `alertKind`, `animalPayload`, `fazenda_id` | - | Modifica estado do animal (ex: suspeitas de bloqueio). | Rastreabilidade de quarentenas e bloqueios de movimentação. |
| `conformidade` | Conformidade | Checklists / Guias | `eventos` | `event_*` | `complianceKind`, `fazenda_id`, `occurred_at` | - | Sobreposição em payloads base. | Evidência de regras de feed-ban, GTA, etc. |
| `obito` | Óbito | Registrar (Óbito) | `eventos` / `animais` | Ambos | `fazenda_id`, `occurred_at` | `causa`, `cancelAgendaIds` | Modifica `animais.status` para "morto", zera `lote_id`, cancela agendas pendentes. | Declaração final do ciclo de vida. |

*Todos pertencem ao trilho `event_*` (Tabela: `eventos`). Alguns (`movimentacao`, `financeiro_venda`, `obito`, `reproducao_parto`, `alerta_sanitario`) injetam mutações no trilho `state_*` (tabela `animais`) por conveniência e sincronização de dados atuais.*

## 4. Diferença conceitual entre Registro, Evento, Agenda e Protocolo

- **Protocolo configurado:** Regra passiva, pacote de intenções e normativas. Define "O QUE deve ser feito, COMO e QUANDO" (ex: vacinar fêmeas de 3 a 8 meses). Não é execução.
- **Tarefa operacional derivada (Item de Agenda / Rail 1):** Intenção operacional no tempo. Representa o *futuro mutável* e o *estado de pendência*. Materializado pelo sistema (agendas automáticas) ou pelo usuário (manual). Reside na tabela `agenda_itens`. Pode ser reagendada, cancelada ou concluída.
- **Registro realizado (Gesto do Usuário):** A ação efetuada pelo usuário na UI. O "eu fiz".
- **Evento histórico/factual (Rail 2):** A consequência transacional imutável (append-only) de um registro. Representa o *passado provado*. Fica armazenado na tabela `eventos` e em tabelas satélites (`eventos_sanitario`, etc.). Não é modificado via UPDATE para negócios, mas via "contra-lançamento" (evento de correção).

*Risco de ambiguidade no código atual:*
A tabela de agendas armazena estado de execução (`source_evento_id` e status `concluido`). A linha tênue está onde o Frontend UI tenta fundir as visões (ex: Tela de histórico lendo agendas para desenhar linha do tempo) ou se `agenda_itens` for usada como log, o que viola os *Two Rails*.

## 5. Lógica de automação de agendas

A geração de agenda não é feita diretamente no Frontend (com exceções muito específicas, como o recálculo do pós-parto, que materializa um evento que *pode* disparar agenda).
A automação principal está encapsulada no Postgres (Supabase via `sanitario_recompute_agenda_core`), garantindo a consistência na arquitetura offline-first.

- **Gatilho:** Inserção de evento sanitário validado (`sanitario_complete_agenda_with_event`), inserção de um novo animal, ou mudança de elegibilidade (como data de nascimento). A flag principal é `gera_agenda = true`.
- **Identificação do registro:** O sistema analisa a chave de deduplicação `dedup_key` (construída no TS via `buildSanitaryDedupKey` e espelhada/processada no SQL) e a taxonomia da família (`family_code` como `brucelose`, `raiva_herbivoros`, etc.).
- **Parâmetros da Agenda:**
  - **Data prevista / âncora temporal:** Determinada via modos como `campanha` (meses estáticos), `janela_etaria` (data de nascimento + dias), `rotina_recorrente` (data do último evento/âncora + intervalo) ou `procedimento_imediato` (disparado por evento ativo).
  - **Status inicial:** `agendado`.
- **Vínculo:** Quando a agenda é executada, o RPC `sanitario_complete_agenda_with_event` cria o evento sanitário, pega o UUID retornado (`v_evento_id`) e atualiza o item da agenda (`agenda_itens`) com `status = 'concluido'` e `source_evento_id = v_evento_id`. O evento recém-criado guarda a origem (`source_task_id`).

## 6. Fluxo de dados ponta a ponta

1. **Ação do usuário na UI:** O usuário acessa a página `Registrar` e preenche formulário de manejo. Pode ter vindo de um botão `Executar` de um item da Agenda (passando `sourceTaskId`).
2. **Construção do payload:** O frontend invoca builders puros como `buildSanitaryExecutionPayload` e resolve taxonomia (`resolveRegistrarSanitaryPackage`).
3. **Validação:** Validações rodam em `validateSanitaryExecutionPreflight`, determinando restrições (quarentena, feed-ban) baseadas no `regulatoryReadModel`.
4. **Persistência / Offline Queue:**
   - Se estiver num domínio com RPC direta e houver rede (ex: Sanitário), chama `executeSanitaryCompletion` (`src/lib/sanitario/infrastructure/executionBoundary.ts`).
   - Falha ou sem rede: O controller no `Registrar` (`createRegistrarFinalizeController.ts`) invoca o fallback local `resolveRegistrarNonFinancialFinalizePlan` (ou financeiro), construindo `buildEventGesture`.
5. **Criação de `event_*` e `state_*`:** O `buildEventGesture` (`src/lib/events/buildEventGesture.ts`) cria operações Dexie (`action: 'INSERT'`, `table: 'eventos_...'`) e (`action: 'UPDATE'`, `table: 'animais'`).
6. **Sincronização com Supabase:** O worker/offline-sync envia os gestos enfileirados para a Edge Function `sync-batch`.
7. **Geração ou atualização de agenda:**
   - No caso de sanitário online, a RPC insere o evento e recomputa a agenda na mesma transação.
   - No caso offline, quando a Edge Function sincroniza os eventos, os `INSERT eventos` acionam triggers no banco de dados (`before insert` etc.) ou processamento em lote que deverão efetuar o recálculo (no caso sanitário, pode necessitar da mesma RPC ou ser empilhado no backfill).
8. **Reflexo na UI:** Após sucesso, ocorre um `pullDataForFarm` para atualizar as stores locais (Dexie). O React reage (`useLiveQuery`) e a lista de Agenda/Eventos atualiza.

## 7. Matriz Registro → Agenda

| Tipo de registro | Gera agenda? | Tipo de agenda gerada | Condição de gatilho | Âncora temporal | Dependência | Risco de duplicidade | Arquivo/função |
|---|:---:|---|---|---|---|---|---|
| Sanitário (Brucelose) | Sim | Vacinação (Sanitário) | Fêmea nativa entre 90-240 dias (`gera_agenda=true`) | `janela_etaria` (Nascimento + 90 a 240 dias) | `Nascimento válido` | Baixo (dedup_key `window`) | `sanitario_recompute_agenda_core.sql` |
| Sanitário (Raiva D1) | Sim | Vacinação (Sanitário) | Risco `medio\|alto` e Protocolo Ativado | `campanha` ou `imediato` (depende config) | Nenhuma | Médio (Configuração de Risco) | `sanitario_recompute_agenda_core.sql` |
| Sanitário (Raiva D2) | Sim | Vacinação (Sanitário) | Conclusão válida da D1 | `rotina_recorrente` | D1 Válida (Evento histórico) | Baixo (dedup_key `interval`) | `sanitario_recompute_agenda_core.sql` |
| Reprodução (Parto) | Sim | Revisão Pós-Parto (Repro)* | `tipo = parto` | Data do parto + N dias | Evento reprodutivo válido | Baixo | **Inferido/Conceitual** (UI Redireciona para fluxo, não automatizado via SQL)* |
| Óbito | Não (Cancela) | - | Cancelamento de Agendas Pendentes | Imediato (Data Óbito) | Nenhuma | Baixo | `buildEventGesture.ts` |
| Pesagem / Mov | Não | - | N/A | N/A | N/A | N/A | `buildEventGesture.ts` |

*(A geração explícita de agendas reprodutivas automatizadas via SQL/Triggers pode existir em regras não totalmente materializadas no código auditado, mas a documentação arquitetural e comportamentos da UI - redirecionamento pós-parto - evidenciam essa amarração)*

## 8. Riscos técnicos e lacunas

| Risco | Classificação | Mitigação Sugerida |
|---|---|---|
| **Divergência Offline vs Sync (Sanitário)** | Alto | A inserção transacional via `sanitario_complete_agenda_with_event` brilha online. Offline, a inserção é emulada e enviada via `sync-batch`. Se o batch falhar em associar perfeitamente o item da agenda, ou não disparar o `sanitario_recompute_agenda_core` ao absorver o evento, a agenda pode ficar dessincronizada (agendas orfãs / duplicadas). *Ação: Garantir que o worker de fallback aplique a RPC no servidor pós-sync.* |
| **Conflito `source_evento_id` na emulação local** | Médio | Quando o aplicativo cria o evento em *offline*, o `source_evento_id` é gerado localmente. O update na tabela de agenda local marcando como concluído pode não possuir bloqueios suficientes se outra ação editar a mesma agenda, criando conflitos na submissão. *Ação: Validar transações Dexie estritas e idempotência baseada no event ID do cliente.* |
| **Agenda Reprodutiva** | Médio | Falta uma abstração equivalente ao `sanitario_recompute_agenda_core` para o domínio Reprodutivo (puerpério, toque, secagem). Atualmente o código confia muito no redirecionamento em UI (`reproductionFinalize.ts`). *Ação: Levar lógica determinística de pós-parto para o motor SQL.* |
| **Ausência de Índices para JSONB Histórico** | Baixo | A migração cita preocupação com performance em histórico volumoso pois procura por `es.payload #>> '{sanitary_completion,completed_on}'`. *Ação: Adicionar índices GIN ou B-Tree funcionais nas chaves JSONB crítiicas de dedup.* |
| **Falta de tipagem forte em payload de fallback reprodutivo** | Baixo | Tipos como `ReproducaoFallbackData` em `eventInput.ts` assumem que `data_parto` e `data_prevista_parto` são opcionais, que em certas circunstâncias poderiam gerar agendas com data `null`. *Ação: Estreitar os tipos dependendo do `tipo` do evento.* |

## 9. Recomendações de documentação

| Documento | Alteração Recomendada | Motivo | Prioridade |
|---|---|---|---|
| `docs/ARCHITECTURE.md` | Atualizar seção sobre o *Sync Offline-First* em casos onde o *Rail 1 (Agenda)* é computado no servidor, explicitando como o `sync-batch` resolve a defasagem entre o fechamento de agenda local vs recompute SQL. | Alinhamento do limite transacional entre app offline e banco liderando geração de intenções. | Alta |
| `docs/EVENTOS_AGENDA_SPEC.md` | (Criar se faltar) Detalhar as políticas de deduplicação (`dedup_key`) e a matriz de dependências (D1 -> D2 -> Anual). | A regra de sequenciamento e dependência está espalhada no código TypeScript e SQL. É um contrato nuclear do negócio. | Alta |
| `docs/DB.md` | Adicionar diagrama Mermaid do RPC `sanitario_recompute_agenda_core`, incluindo as flags de `family_code` e gatilhos de `campanha`, `janela`, `rotina`. | Facilitar onboarding. A procedure SQL se tornou complexa e central para as operações. | Média |
| `docs/CURRENT_STATE.md` | Documentar o fechamento do hardening em Registros/Agenda, declarando a estabilidade da abordagem Two Rails para o módulo sanitário. | O código mostra maturidade nesse fluxo (vários testes, golden tests, cleanup de imports do React). | Baixa |

## 10. Próximos passos sugeridos

1. **Revisão do Sync-Batch para Eventos:** Garantir formalmente (por testes automatizados no gateway) que a entrada de gestos offline via `sync-batch` aciona perfeitamente o motor de materialização (`sanitario_recompute_agenda_core`) assim como a RPC direta o faz.
2. **Motorização de Reprodução:** Expandir o framework declarativo da agenda sanitária para cobrir o ciclo reprodutivo (inseminação -> diagnóstico gestação -> secagem -> parto -> pós-parto), reduzindo o acoplamento do `Registrar` com fluxos encadeados em UI (`postPartoRedirect`).
3. **Saneamento de `especie = null`:** Executar a rotina técnica recomendada na documentação para não precisar mais suportar "animais sem espécie" no motor de agendamento (Remover a cláusula "gate transicional de espécie").
