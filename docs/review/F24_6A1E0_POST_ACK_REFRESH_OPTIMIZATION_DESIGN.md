# F24.6A1-E0 — Post-ACK Refresh Optimization Design

Atualizado em: 2026-10-10

`F24_6A1_E0 = READY_FOR_IMPLEMENTATION` exclusivamente para **C + D no UPDATE genérico simples de observacoes de um animal**. Esta decisão aprova o desenho limitado, não executa nem certifica o patch. Agrupamento geral, supressão de refresh, alterações de scheduler e generalização para outros writers permanecem fora do desenho autorizado.

`READ_AMPLIFICATION = BOTTLENECK_CONFIRMED`; `ORIGINAL_ACK_FAILURE = LIMIT_NOT_PROVEN`; `RECONNECT_1K = NOT_CERTIFIED`. Nenhuma dessas classificações é alterada por esta análise.

## Baseline e escopo

Fetch/prune realizado; branch `codex/f24-6a0-benchmark`; HEAD e origin/main `3b3bc96db331c2917167cf8370024332f505d9f7`. Worktree `C:/Users/mares/.codex/worktrees/f24-6a0-benchmark/GestaoAgro`; staged vazio. Documentos/harness anteriores não commitados, artifacts e worktrees concorrentes preservados. Execução principal DIAGNOSIS, seguida de DOCUMENTATION; nenhum patch funcional, benchmark novo, commit, push, merge, deploy ou migration.

Evidência quantitativa permanece na [F24.6A1-D](./F24_6A1D_ACK_AND_READ_AMPLIFICATION_DIAGNOSIS.md): 836 pulls inline, 1672 consultas, 344.58 MiB e 99.8% das linhas equivalentes entre snapshots comparáveis. A causa foi localizada, não inferida a partir do advisor ou do volume hipotético.

## Fluxo atual e fonte de verdade

1. createGesture persiste identidades e operações; applyOpLocal captura expected_revision do snapshot existente, uma vez, e mantém before_snapshot. A revisão não é incrementada ficticiamente no cliente (`ops.ts:495`).
2. processGesture obtém claim PENDING→SYNCING e envia operações com identidades persistidas. Edge valida CAS para animais, protege writers canônicos e retorna resultado por op. Receipt APPLIED não carrega a representação completa do animal atualizado.
3. No allApplied, são derivados scopes/tabelas. Na mesma transação Dexie são persistidas obrigações, removidas ops aceitas e instalado estado terminal/auditoria do gesto (`syncWorker.ts:1983`). Falha de persistência aborta essa fronteira. O campo diagnóstico ack_installed_at é posterior e não substitui essa autoridade.
4. Ainda dentro de processGesture, ocorre pullDataForFarm das tabelas derivadas (linha 2040); outros scopes especializados mantêm suas chamadas. A farm ativa usa replace; outras usam merge. O pull consulta por fazenda, busca todas as respostas antes de instalar em uma única transação, protege pending e inclui tombstones. O refresh genérico inline não apaga a obrigação factual.
5. O drain obtém lock, lê a geração persistida, executa a reconciliação, registra conclusão e remove somente a geração capturada. Novo ACK cria geração nova/união de tabelas, que um drain antigo não pode apagar (`reconciliationObligations.ts`). A instalação do pull e a remoção genérica da obrigação são transações separadas: crash entre elas deixa trabalho repetível, não uma conclusão fictícia.
6. runOwnedSyncWork faz pull inicial/ownership, drena a fazenda ativa e recupera ERROR transitório/auth e SYNCING órfão; o tick processa a fila e drena novamente a ativa. Online wake-up reabre falhas transitórias e processa pending. Não há drain automático geral de todas as fazendas nessa implementação. Farm não ativa pode ser drenada explicitamente; sua obrigação continua até voltar a ser atendida. Não prometer convergence imediata de toda farm inativa após restart.

ACK remoto = resultado recebido; ACK local = commit da fila + obrigação; convergência = snapshot remoto instalado e obrigação satisfeita. DONE nunca será reclassificado como convergência completa apenas porque a resposta foi APPLIED.

## Tabelas e efeitos server-side

| Operação/caminho | Refresh atual a preservar |
|---|---|
| UPDATE genérico de animais | animais para revision CAS; agenda_itens quando animais foi tocada |
| Compra/comercial canônico | animais, eventos, eventos_comercial; derivados de agenda e scopes aplicáveis |
| eventos/eventos_sanitario/agenda_itens | agenda_itens, eventos, eventos_sanitario; detalhes factuais touched |
| Protocolos/config sanitária | protocolos_sanitarios, protocolos_sanitarios_itens, agenda_itens, fazenda_sanidade_config |
| insumo_movimentacoes | insumo_lotes e insumo_movimentacoes |
| Reprodução factual sincronizada | tabelas touched + pullReproductionDiagnosisState especializado |
| Agenda v2/sanitário v2 | scopes/cutover especializados, sem substituir por pull genérico |
| Animal→Lote movement_v1 | writer e reconciliação especializados; observações dirigidas + merge já existentes |

Migrations ativas relevantes: `20260927120000_f24_4c_animais_state_revision.sql` incrementa revision em UPDATE; baseline aplica updated_at; `20260526000100_recompute_on_animal_mutation.sql` recalcula agenda quando sexo/data_nascimento/especie/status mudam, não por observacoes isolado. Guards de movimento permanecem em `20261001200402...`. Leitura dos triggers não autoriza generalizar a seleção para outras alterações ou futuras migrations.

A Edge descarta a representação retornada pela mutação para compor o resultado genérico; a revisão efetiva/snapshot completo não é instalação automática do receipt. Outra versão/dispositivo pode alterar o mesmo animal antes do refresh: buscar o snapshot atual do ID preserva essa observação e o CAS; não fazer merge de campos, recalcular expected_revision já persistido ou usar timestamp como vencedor.

## Alternativas

| Alternativa | Ganho potencial | Risco / decisão |
|---|---|---|
| A — agrupar refreshs após ACKs | Menos leituras completas | Exige fronteira durável, barriers de dependência, consideração de enqueue durante o ciclo e todas as fazendas. Fim de loop em memória não basta. Não escolhida. |
| B — refresh ao final da geração durável | Reutiliza union/generation existente | Geração é chave farm/scope mutável, não batch finito. Drain automático só ativo; próximo gesto pode precisar da revisão/estado server-side. Remover inline indiscriminadamente não está demonstrado seguro. Não escolhida. |
| C — IDs + merge seguro | Elimina retransmissão dos outros 499 animais no caso medido | Só para classe fechada; nunca replace parcial, não completar obrigação completa por resultado dirigido. Escolhida com instalação transacional conjunta e fallback. |
| D — imediato nos fluxos dependentes | Conserva revisão/derivados antes da próxima intenção | Não reduz sozinho o volume. Com C, mantém imediato inclusive para animal alvo; demais escritores mantêm comportamento integral. |

## Desenho escolhido e patch mínimo provável

Seleção pura, fechada no caller allApplied: **uma única operação UPDATE animais**, resultado individual exatamente APPLIED, chave UUID da mesma farm/gesto, expected_revision inteiro válido, apenas campo de negócio observacoes além de id e metadados existentes de sync. Excluir INSERT/DELETE, APPLIED_ALTERED, resultados mistos/rejeitados, comercial, movement_v1, sanitário/reprodução, payload/fields desconhecidos e operações adicionais. Ausência de metadado/revisão ou shape antigo não reconhecido → refresh integral existente. Não reclassificar regras de domínio para entrar no caminho rápido.

Manter derivação e persistência de obrigações e toda a transação do ACK intactas. Manter chamada imediata do refresh e tabela agenda_itens completa. Filtrar **somente animais** por id, também com filtro fazenda_id. Usar a capacidade existente de observations, já exercida pelo writer movement_v1; não reutilizar seu algoritmo de conclusão nem ampliar o writer.

Para preservar a fronteira fetch-all→install-all, fazer **uma chamada de pull, com todas as tabelas originais**. O pequeno ajuste de pull deve permitir modo explícito por tabela: tabela filtrada resolve exclusivamente para merge; tabelas não filtradas mantêm getReconciliationPullMode. Validar o plano antes de consultar/instalar. Nenhuma tabela filtrada pode chegar a writeFarmPullStore com replace, mesmo quando a farm é ativa. O modo global/default só vale para tabelas completas; não considerar a presença de observations como autorização para replace parcial. Teste negativo obrigatório.

Esse ajuste precisa resolver o modo por tabela também na coleta/proteção de pending e instalação, preservando pending das duas fazendas e uma única transação. Não dividir animais/agenda em duas instalações independentes e não mudar o modo de agenda de replace para merge por conveniência.

Validar cobertura do único ID no resultado remoto bruto: ID/farm corretos, revision válida, tombstone incluído. Resposta vazia/incompleta ou erro não prova convergência e não remove obrigação; conservar tratamento de erro pós-ACK e recuperação integral existente. Se for necessária nova semântica para ausência/hard-delete, interromper a ampliação e documentar antes de implementá-la. Não criar retry próprio, backoff novo ou ledger de IDs.

O refresh dirigido não pode limpar a obrigação factual completa, nem avançar cursor de snapshot completo. O drain integral por farm/scopes/generation continua cobrindo alterações de outros dispositivos em outros IDs e todos os efeitos preservados. Para farm inativa, atualização imediata do alvo continua merge; cobertura integral permanece como obrigação durável até drain explícito/atendimento da farm. A diferença de frescor é explícita: os outros animais deixam de ser atualizados incidentalmente a cada gesto. Não existe SLO imediato demonstrado para esse efeito incidental; não prometer equivalência de snapshots completos no fast path.

Arquivos funcionais prováveis: `src/lib/offline/syncWorker.ts` (selector e plano de refresh) e `src/lib/offline/pull.ts` (modos por tabela/validação de cobertura, proteção de pending e atomicidade). Sem alteração em ops, schema Dexie, scheduler, reconciliação persistida, Edge, SQL/RLS ou writers canônicos. Testes diretamente afetados: pull, farmSwitchReplace, reconciliationObligations; seletor poderá ter teste localizado. Se implementação exigir mudar uma dessas fronteiras excluídas, voltar ao desenho, não ampliar silenciosamente.

## Edge cases e critérios

| Cenário | Proteção exigida pelo desenho |
|---|---|
| Crash após ACK, antes do refresh | Obrigação integral já persistida; startup/drain ativo ou atendimento da farm inativa repete reconciliação; nunca recriar operação aceita. |
| Crash durante instalação | Uma transação para todas as tabelas; rollback local ou instalação inteira; obrigação permanece até drain por geração. |
| Intermitência/auth expirada | Falha de fetch não apaga estado local; DONE/obrigação preservados; retomada pelos mecanismos atuais, sem novo retry automático. |
| Retry/replay/lost ACK | Mesmas tx/op/expected_revision; ACK abortado mantém ops; replay não incrementa revisão artificialmente. |
| Mesmo animal em vários gestos | Snapshot server-side imediato mantido quando não protegido por pending; intenções já enfileiradas mantêm revisão capturada. Conflito preexistente não pode virar auto-merge/rebase. |
| Operações dependentes/mistas | Caminho integral especializado existente; nenhuma inferência geral de independência pelo nome da tabela. |
| Farm-switch/farm inativa | ID AND fazenda, merge da tabela parcial, modo original das completas, pending isolado; obrigação inativa não é consumida pela farm ativa. |
| Outro dispositivo altera alvo | Refresh busca snapshot atual, preserva CAS/conflito; pending impede sobrescrita de intenção local. Não usar receipt como nova fonte de verdade. |
| Outro dispositivo altera outro ID | Merge parcial não apaga/substitui o outro ID; obrigação completa permanece e drain recupera snapshot integral. Frescor incidental reduzido, explicitamente fora de garantia imediata. |
| Erro parcial/APPLIED_ALTERED | Inelegível; mesma política/fallback já implementado. |
| Clientes antigos/fila pendente | Mesmo schema/envelope/retries; shapes não reconhecidos usam caminho integral. Nenhuma migração local ou invalidação de queue. |

Critérios do **desenho**, não resultados de patch inexistente: ACK_DURABILITY e RECONCILIATION_RECOVERY PRESERVED pela fronteira original intacta; NO_PARTIAL_REPLACE VERIFIED no plano obrigatório de modos por tabela; CROSS_FARM_ISOLATION PRESERVED pelo filtro e proteção; SERVER_SIDE_EFFECTS ACCOUNTED_FOR pela seleção restrita + agenda integral + full obligation; MULTI_DEVICE_SAFETY ACCOUNTED_FOR pelo CAS/merge/pending + drain integral; OLD_CLIENT_COMPATIBILITY PRESERVED por shape/contratos inalterados e fallback. A execução futura só poderá declarar PASS após os testes abaixo. Não há autorização de generalização a outras operações.

## Regressão específica necessária

1. Seletor: APPLIED único observacoes elegível; todos os caminhos fora do allowlist continuam full. IDs/farm/revisão inválidos e legado ficam fora.
2. Farm ativa com parcial: request ID+farm; animais merge, agenda completa replace; outros 499 animais intactos; uma única transação e falha de qualquer fetch sem instalação parcial. Plano replace para tabela filtrada rejeitado antes de write.
3. Pending da mesma farm/outro animal/outro gesto e da outra farm protegidos; não avançar revision esperada persistida nem falsear conclusão se linha alvo é protegida.
4. ACK+obrigação atômicos; quota/clone/ACK failure mantém ops; crash depois de ACK e durante merge; close/reopen preserva obrigação e drain completo. Nova geração durante drain não apagada.
5. Mesmo animal com gesto criado após refresh observa revisão remota; dois gestos já offline podem conflitar conforme contrato anterior, nunca auto-merge. Alterações simultâneas no alvo e em outro ID exercitadas com dois clientes reais.
6. Farm-switch A→B→A, execução de gesto A enquanto B ativa e restart atendendo A; drain de A não completa B. Soft tombstone, resposta vazia/incompleta e ownership/auth expirada sem deleção local.
7. Fallbacks de movimento, compra, eventos/agenda/protocolos/reprodução/sanitário e resultados mistos preservam seus snapshots/efeitos/receipts; testes de canonical writer genérico Animal→Lote BLOCKED inalterados.

Base já lida: atomic ACK, obligations/generation/upgrade, recovery, concurrency/claim/replay, farm-switch e generic retry. Os testes de obligations usam mocks de pull: não comprovam merge parcial nem desempenho. O teste denominado crash/restart em obligations invoca drain explícito; não equivale a kill físico completo. Multi-device deve ter prova de backend local real no patch, além de mocks de concorrência.

## Benchmark antes/depois proposto

Baseline funcional `3b3bc96db331c2917167cf8370024332f505d9f7`; controle com fontes originais e variante com somente o patch validado. Atualizar guard do harness para admitir exatamente o intervalo/arquivos do patch aprovado; não remover sua proteção nem transformar a transformação observacional em implementação de benchmark. Hashes, versões e diff incluídos nos artifacts.

Mesmo provisionador de 60 migrations, configuração, ports e versão Edge/PG/Chromium; fixtures novas com o mesmo shape, duas fazendas, um UPDATE observacoes por animal, mesmas proporções/ordem. Sem outras ferramentas concorrentes. Manter identidade de ambiente estável dentro de cada série e registrar ciclo/reset de workers apenas no backend próprio, para não comparar warm acumulado de uma variante contra fresh de outra. Seed/cleanup fora do tempo; logging/telemetry/instrumentação iguais.

Provas pequenas funcionais antes da medição. Depois comparar 100 gestos, cinco runs por variante sequenciais, e somente se todos os gates passarem, 1k com orçamento aprovado previamente. Orçamento de 240s do diagnóstico não deve ser aumentado retrospectivamente; se amostra original exceder, comparar prefixos determinísticos equivalentes e registrar censura, sem estimar tempo final. 10k permanece fora deste plano.

Separar runs sem instrumentação (tempo total/heap/requests/payload/gates) de runs instrumentados pareados (spans/ACK/instalação/pending/custos do observador). Comparar mediana/min-max/MAD, bytes/linhas/pulls por gesto, backlog final 0, obrigação final 0, contagens/isolamento/cleanup. Não usar 836/240s contra 1000 completo como ganho percentual. Não contar linha recebida como animal distinto. Quantificar full drains residuais, agenda mantida e custos de seleção/proteção da fila.

Hipótese estrutural, não resultado: cada gesto elegível passa de N_animais_da_farm linhas para um alvo; consultas de agenda e drains completos permanecem. Não prometer redução de número de requests nem economia igual a 54.72% do tempo: custos de servidor, fila, observador e reconcile continuam presentes. Sem SLO retroativo e sem reclassificar ACK original ou certificar 1k por desenho.

## Validações e riscos

Execução focada da baseline nesta etapa: seis arquivos Vitest (reconciliationObligations, syncWorkerAtomicAck, syncWorkerRecovery, farmSwitchReplace, syncWorkerConcurrency, syncWorkerGenericRetry), **58/58 PASS**. São evidências do contrato vigente, não do patch proposto. Nenhum teste novo nem regressão global/build/load remoto.

Riscos residuais: futura seleção pode entrar em classe não coberta por mudança de shape/trigger, devendo falhar fechada; modo por tabela precisa conservar atomicidade e pending; cobertura integral de farm inativa depende do atendimento atual, não de novo scheduler geral. Propostas A/B amplas, cache de revisão, supressão de agenda e remoção de obrigação após partial continuam não autorizadas.
