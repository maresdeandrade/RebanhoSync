# C06 — Dependências, CAS e recuperação

Data: 30/10/2026. Baseline congelada `8de882dff2923033ec14607e2bc82a1ed69acc18`, main com #259 e #260 integrados. Worktree própria `c06-cas`, HEAD detached, inicialmente limpa; alterações anteriores de F6 e outros executores preservadas. **READY_FOR_REVIEW neste recorte**, sem commit, push, merge, deploy ou operação remota. C05 e o incremento heterogêneo #260 permanecem integrados; F24.7 completa permanece NOT_STARTED.

## Contrato observado

A Edge processa o array sequencialmente; cada RPC confirma seu efeito e recibo atomicamente. Não há rollback global da gesture. `reschedule_agenda` consulta recibo antes do CAS, obtém a Agenda com `FOR UPDATE`, compara `expected_revision` e incrementa a revisão no servidor. O batch HTTP retorna 200 com resultados por operação; conflito CAS é `CONFLICT / SANITARIO_AGENDA_REVISION_CONFLICT`, com revisão atual. Não há auto-merge.

O writer permite agrupar criação e reagendamentos com UUID do alvo e revisões explícitos (0→1→2). **NOT_APPLICABLE:** expressão genérica que substitua argumentos pelo resultado de outra operação; esse campo não existe no envelope. A relação causal reutiliza `dependsOnAgenda` do planejamento, sem writer ou regra CAS paralelos.

## Matriz nova executada

Comando: `node tests/codex/sanitario-v2-review.supabase.mjs --c06-cas`, exit 0, **8/8 PROVEN**. Os sete casos C05 e os nove C06 anteriores não foram reexecutados.

| Caso | Evidência observada |
| --- | --- |
| CAS01 Dependência válida | Criação e dois reagendamentos no mesmo gesto; três APPLIED, revisão 2 e gesto DONE. |
| CAS02 Predecessor rejeitado | Criação rejeitada; servidor bloqueia dependentes. Consumidor registra terminalidade com vínculo ao predecessor e não os rearma após drain. Zero Agenda/vínculo/recibo órfão. |
| CAS03 CAS obsoleto após sucesso | Criação irmã permanece aplicada; reagendamento CONFLICT preserva revisão 2 do alvo, com rejeição auditável. |
| CAS04 Concorrência | Dois gestos disputam a mesma revisão; um reagendamento vence e outro conflita. Data final corresponde ao recibo vencedor; revisão incrementada uma vez. |
| CAS05 Retry após conflito | Operação terminal não volta à fila nem altera recibos. Nova intenção usa novos UUIDs e revisão atual; não modifica a intenção obsoleta. |
| CAS06 Lost ACK da cadeia | Commit real seguido de aborto de transporte; reload conserva IndexedDB. Replay dos três UUIDs recupera recibos antes do CAS, sem incrementar novamente as revisões. |
| CAS07 Falha de reconcile | ACK confirmado e pull abortado deixam obrigação durável com os três IDs e TX. Reload/drain resolve a obrigação e instala revisão 2. |
| CAS08 Farm-switch/RLS | Contexto B cria somente sua Agenda; tentativa de reagendar alvo A retorna dependência ausente, sem alterar A. RLS de A/B/outsider e origem da operação preservadas. |

[Artefato consolidado](./evidence/SANITARIO_C06_CAS_DEPENDENCIAS_20261030.json): snapshots antes/depois por caso, respostas HTTP, revisões, UUIDs, gestos/operações/rejeições/obrigações e recibos. São **22 operações: 16 APPLIED, dois CONFLICT, uma REJECTED e três BLOCKED_DEPENDENCY no servidor**. Há 16 recibos únicos e oito Agendas; Eventos, detalhes sanitários e estoque permanecem zero.

No cliente, dois BLOCKED_DEPENDENCY são terminais porque seu predecessor concreto foi rejeitado. A terceira intenção tem alvo invisível em B: fica bloqueada e o drain explícito a rearma como PENDING, com o mesmo UUID e fazenda B. Essa intenção permanece durável no snapshot; não se afirma fila final vazia nem sucesso desse comando. Obrigações finais: zero. Não há critério seguro para inferir que um alvo invisível existe em outra fazenda.

## Defeito e patch mínimo

**MEDIUM — dependente de predecessor terminal continuava recuperável.** A execução sem patch deixou reagendamentos de uma criação rejeitada na fila; drains posteriores os rearmavam. Teste focal RED: dois casos falharam com predecessor REJECTED/CONFLICT; controles retryable e alvo diferente passaram.

O consumidor agora reconhece somente predecessor canônico de criação/reagendamento, da mesma gesture/fazenda/alvo, com IDs de resposta correspondentes e resultado terminal conhecido. Reutiliza a relação de dependência do planejamento. O resultado remoto BLOCKED_DEPENDENCY é preservado na auditoria; a rejeição local inclui `terminal_dependency_client_op_id` e diagnóstico `SYNC_DEPENDENCY_TERMINAL`. Pendência ausente/retryable/não relacionada continua transitória. Sem mudança de RPC, RLS, migration, schema Dexie, IDs ou payloads de operação; não há reconstrução de histórico ou inferência para filas antigas sem predecessor observável.

## Verificações e isolamento

- Worker completo: **16/16**, após RED focal; planejamento existente: **6/6**.
- ESLint nos oito arquivos TS/MJS, sintaxe dos quatro MJS, diff check e gates documentais (incluindo auditoria de agentes): exit 0.
- TypeScript comparativo com overlay dos três arquivos de runtime: **232 baseline / 232 patch / zero novos**, por arquivo/código/mensagem/multiplicidade. A extensão do tipo opcional do diagnóstico não altera o JavaScript exercitado na matriz. O passivo global continua independente.
- Projeto final `sanitary-review-fcdcde16`: API `127.0.0.1:55421`, DB `127.0.0.1:55422`, Vite `127.0.0.1:8181`; quatro usuários sintéticos, duas fazendas, Chromium/IndexedDB e Auth/RLS/Edge/PostgreSQL reais. Adaptador existente exige bind loopback antes do create, rede própria sem masquerade e browser restrito a loopback.
- Flags/gates OFF, browser/Vite/Edge/DB fechados. Auditoria por identidade de projeto confirma **zero containers, redes e volumes próprios** na execução final e nas duas preparatórias. Nenhuma limpeza de recursos compartilhados.

## Cobertura residual e próxima unidade

O recorte cobre planejamento e restart lógico por reload. Não certifica execução factual/estoque/carência, cold start PWA, kill físico, dispositivo móvel ou todas as variantes de dependência/CAS da F24.7. A fila antiga sem predecessor observável permanece conservadora; não há migração ou descarte automático.

Próxima unidade mínima recomendada, após revisão: composição de execução factual sanitária com estoque, rejeição e replay, com aceite próprio. Não iniciar F24.7 completa nem reabrir C05/#260.
