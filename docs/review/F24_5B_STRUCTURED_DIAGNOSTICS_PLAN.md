# F24.5B — Structured Diagnostics / Abertura lógica

Atualizado em: 2026-10-06
Tipo: proposta documental de escopo; nenhuma implementação iniciada.
Status: `F24_5B = NEXT`; `F24_5B = READY_TO_START` lógico.

Nota de continuidade (2026-10-06): a abertura abaixo preserva a proposta e o
baseline histórico do closeout A. A implementação autorizada de B, baseada no
merge F24.5A `32f629df9f49c7f1a14253a771c5f206e7b8982d` (PR #182), está registrada
na [evidência F24.5B](./F24_5B_STRUCTURED_DIAGNOSTICS.md). Os estados e afirmações
de ausência de implementação abaixo descrevem a abertura, não o patch atual.

## Decisão e baseline

Tornar reconstruível, com IDs já existentes, a sequência operacional crítica
sem criar uma nova fonte de verdade de domínio. Proposta derivada exclusivamente
do [inventário F24.5A](./F24_5A_OBSERVABILITY_BASELINE.md), cujo review documental
é APPROVED e `OBSERVABILITY_BASELINE = ESTABLISHED`.

| Campo | Evidência de entrada |
| --- | --- |
| origin/main / HEAD após switch | `3da8c89a5dd8c2d793d8d34af749a68c9c81f59a` |
| Integração F24.4/F24.4F | PR #181 MERGED; candidate e7fc3b5 com árvore idêntica ao merge |
| Branch local de closeout A | `codex/f24-5a-doc-closeout`, baseada em origin/main |
| Worktree antes do closeout | Somente relatório F24.5A untracked; tracked/staged limpos |
| Pacote pós-F24.5A | Documental, revisado, ainda sem commit/merge; não há SHA integrado pós-A |
| F24.5A | READY_FOR_REVIEW; review APPROVED; pacote READY_FOR_COMMIT; sem CLOSED |

Não se deve confundir a base Git limpa com o pacote documental ainda pendente.
READY_TO_START é prontidão lógica para uma próxima execução com escopo de implementação
explícito e novo rebaseline; não autoriza executar B nesta entrega nem reutilizar
a branch antiga F24.4F. Nenhum comportamento futuro descrito abaixo está implementado.

## Escopo e atribuição de gaps

| Prioridade | Gap | Escopo proposto em B |
| --- | --- | --- |
| P1 | G02 | Preservar causa e resultado de tentativa de drain para diagnóstico após restart; distinguir pendente, falhou e instalação concluída |
| P1 | G01 | Correlacionar transições críticas tentativa/ACK/reconcile com op/tx/farm e obligation/generation existentes; não criar ID novo |
| P2 | G06 | Contexto mínimo de pausa por ownership/sessão e fazenda, sem tornar diagnóstico mecanismo de autorização |
| P2 | G08 | Baseline diagnóstico correto, exportação minimizada e política explícita de retenção; aproveitar export/superfícies existentes |

Fora do escopo B: G03 (entrega/cursor remoto) e G04 (backlog multi-farm) pertencem à
F24.5C; G07 (série completa de retries/classes, contagens e exhaustion) também à C;
G05 (health UI) à D. G09/G10 permanecem NOT_PROVEN para E, sem novo probe nesta
entrega. B pode dar a base de correlação para C, mas não implementar telemetria
completa, corrigir flush/backlog ou alterar dashboards antecipadamente.

Também excluídos: mudança de contratos F24.4, dedup/merge, writers, algoritmo de
retry/replay, RLS, RPC, Edge, migrations remotas, tracing/SDK/framework, novos IDs
ou nova fonte factual. Proposta de formato não é aprovação de store/schema.

## Fontes de verdade existentes

| Necessidade | Fonte existente | Limite a respeitar |
| --- | --- | --- |
| Intenção/operação local | queue_gestures e queue_ops (types.ts/db.ts/ops.ts) | IDs e expected_revision persistidos; diagnóstico não reescreve intenção ou snapshot |
| ACK e resultado por operação | operation_results, queue_rejections e resposta validada do sync-batch | Audit atual não é histórico completo de tentativas; ACK não significa reconcile concluído |
| Trabalho de reconciliação | sync_reconcile_obligations, farm/scope/key/generation/tables | Obligation pode agregar várias ops; generation muda com ACK novo; não fabricar relação 1:1 |
| Progresso de pull/instalação | sync_pull_cursors e transação local de instalação | Cursor não comprova cada tentativa nem toda convergência |
| Fato e Movement | Eventos/details, receipt original, decisão efetiva e state autoritativo remoto | Diagnóstico apenas referencia; Evento continua fonte histórica, state continua read model |
| Ownership/farm | local_ownership, decisão da sessão e farm da intenção | Owner da base não é histórico de cada op; farm ativa não substitui farm original |
| Export/telemetria existente | rejections.ts e metrics_events | DLQ/export e métricas têm limites próprios; não tornar flush confirmação de ACK/reconcile |

A escolha de reutilizar metadados existentes ou propor evolução local fica para a
implementação autorizada. Não adotar fonte paralela de recovery: fila e obligations
continuam determinando trabalho; informação diagnóstica não libera nem terminaliza op.

## Dados mínimos necessários — proposta

Registrar apenas o necessário para explicar transições críticas e falha do drain:

- Fase/transição observada e resultado: tentativa iniciada, resultado recebido,
  ACK instalado localmente, drain falhou ou instalação local concluída. ACK recebido
  e commit local são observações distintas; não sintetizar sucesso antes do commit.
- `fazenda_id` original; `client_tx_id`, `client_op_id` e event identity quando
  conhecidos; `source_task_id`, domain_op_id e digest somente se já disponíveis e úteis.
- Obligation `key`, `scope`, `generation_id` e tables; ligação às ops que realmente
  originaram o trabalho quando comprovável. Se ausente, marcar correlação parcial;
  várias origens devem ser mantidas sem atribuir todo resultado a uma única op.
- Momento da observação e contexto de versão/baseline verificável. Relógio local
  é diagnóstico/scheduling; não decide vencedor factual ou ordem causal remota.
- Código/tipo técnico e mensagem sanitizada de falha; contador/prazo existentes
  quando disponíveis, sem prometer histórico completo de retry em B.
- Estado de ownership/sessão observado e farm ativa somente quando necessários
  para explicar a pausa. Não inventar owner da op usando proprietário atual da base.

Não persistir request/response integral, JWT, token, headers auth, segredo, URL com
credencial, record, before_snapshot ou payload de domínio por rotina. Valores
desconhecidos permanecem desconhecidos; nenhum correlation ID novo é necessário.

## Retenção e privacidade/minimização

RECOMMENDATION: adotar uma janela explícita e limitada para histórico diagnóstico,
com ponto de partida de sete dias para transições concluídas, alinhado à janela
atual da DLQ, sujeito a revisão antes do patch. Definir limite de tamanho/volume e
compactação de falhas repetidas antes de escolher persistência; números de capacidade
não foram medidos na F24.5A e não devem ser apresentados como requisito certificado.

Enquanto existir obligation pendente, preservar ao menos último erro sanitizado,
tempo e contexto correlacionável, mesmo se o histórico antigo for compactado. Ao
concluir, reter o resumo diagnóstico pela janela aprovada sem manter a obligation
funcional artificialmente aberta. Retenção não pode remover pendentes, reabrir
conflito ou apagar Evento/receipt. Qualquer garantia de retenção exige storage
preservado; reset/eviction não permite promessa de diagnóstico posterior.

Exportação deve indicar schema/formato, momento, baseline/versão verificável,
fazenda e filtros/janela, além das limitações de cobertura. Evitar default de SHA
antigo como se fosse baseline atual; se versão não disponível, declarar desconhecida.
Export deve ser explícito, filtrado e minimizado, sem leitura cross-owner/cross-farm
nem upload automático. Redaction deve ocorrer antes de persistir/exportar erro.

## Compatibilidade Dexie, restart e concorrência

RECOMMENDATION: primeiro avaliar shape/metadados e APIs existentes. Nenhuma store
nova foi escolhida ou criada. Caso evolução Dexie seja indispensável, apresentar
antes shape, versão/upgrade e compatibilidade com clientes offline/operações antigas;
não fazer backfill que invente tentativas, ACKs ou erros históricos.

O diagnóstico deve ser legível após reabertura lógica da mesma base, inclusive se
ACK já terminalizou o gesto e ops foram consumidas. A falha de drain deve manter
causa após restart; drain bem-sucedido deve deixar evidência de conclusão sem
substituir o resultado factual nem interferir com conditional delete por generation.
ACK novo durante drain antigo precisa preservar contexto da geração nova.

Tratar campos legados ausentes explicitamente. Diagnóstico não pode impedir commit
factual/ACK seguro, perder obligation, duplicar fato ou provocar reenvio; definir
seu comportamento sob falha de persistência antes do patch e verificar ambos os
resultados: safety do pipeline e declaração de cobertura diagnóstica incompleta.
Não prometer sobrevivência a kill físico nesta etapa: G10 continua NOT_PROVEN.

## Multi-farm e ownership

Toda consulta/export diagnóstica deve usar farm da intenção, mesmo com outra farm
ativa. Evitar misturar contagens de farms; corrigir métrica de backlog continua C.
Drain explícito de A com B ativa deve permitir correlacionar A sem expor ou alterar
B. Respeitar owner compatível e autorização de acesso já existentes; diagnóstico
não pode contornar gate para “mostrar o motivo” ou liberar leitura em MISMATCH/UNKNOWN.

Uma pausa observada sem sessão utilizável pode ser explicada de forma minimizada,
sem expor dados tenant-sensitive e sem fabricar erro por op que não foi processada.
Nenhuma decisão de autorização pode depender do novo dado diagnóstico.

## Critérios de aceite para a execução futura

1. G02: erro injetado de drain preserva causa sanitizada/obligation após reabertura;
   conclusão deixa resultado diagnóstico, sem apagar geração nova criada durante drain.
2. G01: cenário crítico correlaciona op/tx/farm existentes, ACK e reconcile, com
   distinção entre commit remoto desconhecido, ACK local e instalação concluída;
   lost ACK não vira sucesso presumido. Corrida/agregação não fabrica join 1:1.
3. G06: pausa por ownership/sessão e farm-switch mantém isolamento e contexto
   suficiente, sem exposição cross-owner e sem usar farm ativa como origem da op.
4. G08: export traz baseline real ou desconhecido declarado, farm/janela/cobertura,
   sem tokens ou payloads desnecessários; retenção limitada e documentada, sem purge
   de trabalho pendente ou histórico factual.
5. Legado/restart: campos ausentes são tolerados, IDs/retry/replay continuam iguais;
   falha do mecanismo diagnóstico não modifica correctness do pipeline e é reportada
   como cobertura incompleta. Validar upgrade somente se schema realmente mudar.
6. Escopo: G03/G04/G05/G07 não implementados em B; contratos F24.4 e writers
   preservados. Selecionar testes focados na próxima execução, sem regressão global
   por rotina. Nenhum desses testes foi executado nesta proposta.

## Validação deste closeout e limites

| Validação executada | Resultado observado |
| --- | --- |
| `pnpm run gates:docs` | Exit 0: headers/baselines, continuidade Fase 24 e data contract aprovados |
| `git diff --check` | Exit 0, sem diagnóstico de whitespace |
| Diff tracked/staged/untracked | Seis documentos tracked modificados; dois documentos untracked; staged vazio; src/supabase/e2e sem delta |
| Inspeção do diff | Somente status/continuidade, integração F24.4F, review A e proposta B; histórico preservado como superseded |
| Verificação local dos arquivos novos e links | Sem whitespace final ou conflict markers nos dois novos; 120 links locais conferidos nos oito documentos, nenhum destino ausente |

Comparações `git diff --no-index --check` dos dois arquivos novos contra NUL não
emitiram diagnóstico de whitespace e retornaram 1; não foram contadas como exit 0.
A checagem explícita de whitespace/markers e links acima retornou exit 0.
Vitest, Playwright, build e runners Supabase não executados, conforme escopo documental.
Gates não certificam runtime nem as propostas de critérios de aceite futuros.

Riscos: (1) formato/persistência/limites de retenção ainda precisam decisão de desenho;
(2) entrega remota e kill físico continuam NOT_PROVEN; (3) pacote documental ainda
sem SHA pós-A, exigindo novo rebaseline antes de implementação.

`F24_5A = READY_FOR_COMMIT`; `F24_5B = READY_TO_START` lógico.
Sem commit, push, PR, merge, deploy ou implementação nesta execução.
