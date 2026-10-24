# Sanitário V2 — VF4: Auth, RLS e recuperação server-side — 24/10/2026

**Decisão: `VALIDATED_WITH_CAVEATS`. Gate do patch de testes: `READY WITH CAVEAT`.**

Foram aprovados 16 cenários com GoTrue Auth/JWT, PostgREST, PostgreSQL/RLS e Edge `sync-batch` reais em projeto local exclusivo descartável. O browser utilizou Dexie, writers, worker e pull existentes. Houve evidência server-side de isolamento, idempotência, aceitação parcial e recuperação. Não foi demonstrado defeito novo do produto que exigisse correção de runtime. Não há certificação de produção, deploy ou ativação operacional.

## Baseline e isolamento

- Branch: `codex/sanitario-v2-functional-validation`.
- HEAD observado: `4b43fc10ec9dfd0c19527c22c4d725799d9e7969`.
- Worktree utilizado: `C:/Users/mares/dyad-apps/GestaoAgro`, já existente e sujo, sem staged. Os quatro outros worktrees listados foram preservados.
- VF1/VF2/VF3 permanecem locais; não foi confirmada nova integração à `main`. O patch VF3 de `src/hooks/useAuth.tsx` foi preservado.
- Alterações concorrentes em governança, reprodução, importador, catálogo, `src/lib/offline/ops.ts` e testFarm foram preservadas e não são atribuídas à VF4. Houve novas alterações concorrentes durante a execução; esta evidência corresponde ao working tree, não a um build isolado de commit. O JSON registra hashes dos arquivos diretamente envolvidos na consolidação.
- Docker Desktop/Engine local disponível; Supabase CLI 2.117.0. Reutilizado o provisioning de `tests/codex/sanitario-v2-review.supabase.mjs`, em modo opt-in `--vf4`.
- Backend da execução final: **`sanitary-review-1e6d7817`**, API `http://127.0.0.1:55421`, PostgreSQL loopback porta 55422. Projeto sem vínculo remoto, seed desativado e cadeia ativa de **65 migrations locais**, confirmada por consulta somente leitura em `supabase_migrations.schema_migrations`.
- Quatro usuários e duas fazendas exclusivamente sintéticos: usuário A, usuário B, participante de ambas e outsider. Nenhum deles recebeu superadmin.
- Instâncias existentes `GestaoAgro` e `animal-v2-1762db34` não foram utilizadas como alvo de escrita. O harness cria e remove somente seu projeto com identificador aleatório.
- Gates de teste restritos às duas fazendas e aos respectivos usuários, contrato v2; controle negativo com gate OFF realmente executado. Gates desligados no finally e projeto removido ao final. Consulta posterior não encontrou containers `sanitary-review-*`; os containers preexistentes de `GestaoAgro` continuaram ativos.
- `config/backend-targets.json` continua identificando o backend remoto existente como produção. Nenhuma chamada ou mutação foi feita nele. Não houve migration remota, bootstrap sanitário, publicação, deploy, push ou merge.

Credenciais foram capturadas apenas em memória pelo harness; não estão no relatório ou JSON de evidências. O navegador recebe a chave pública local; `service_role` é usado somente no processo de preparação dos usuários sintéticos. As requisições dos cenários usam JWTs emitidos pelo Auth real, sem JWT fabricado ou resposta HTTP de sucesso inventada.

## Evidência e matriz de execução

Artefato persistido: [SANITARIO_V2_VF4_RECOVERY_RESULT_20261024.json](evidence/SANITARIO_V2_VF4_RECOVERY_RESULT_20261024.json). Contém os 16 casos, resultados, IDs sintéticos, contagens e proveniência. Log auxiliar final: `scratch/sanitary-vf4-run5.log` (ignorado pelo Git). A execução retornou exit 0, `result=PASS`, `checks=16`, cleanup confirmado.

| Cenário | Estado | Evidência observada |
|---|---|---|
| Login válido e refresh válido | PASS | Quatro identidades reais consultadas por `auth.getUser`; refresh aceito preserva a identidade. |
| RLS de config por A/B/ambas/outsider | PASS | Leituras: 1/1/2/0 fazendas. Atualização da config A: 1/0/1/0 linhas. Tentativa de reassociação do `fazenda_id`: `42501`. |
| RPC interna chamada diretamente pelo usuário | PASS | Assinatura completa de `internal_sanitario_sync_v2_create_agenda` rejeitada com `42501`; não se contou erro de função ausente como proteção de privilégio. |
| Gate OFF com membro autorizado | PASS | `SANITARIO_SYNC_DISABLED`; zero Agenda persistida para a tentativa. |
| Criação manual A/B e RLS da Agenda | PASS | Duas Agendas por comandos canônicos; usuários A/B/ambas/outsider leem 1/1/2/0. Zero Eventos nesse ponto. |
| Outsider, envelope de B, `fazenda_id` adulterado e animal B em A | PASS | Quatro tentativas rejeitadas, sem linhas indevidas persistidas. Inclui verificação no PostgreSQL, sem depender de filtro da UI. |
| Reenvio do UUID e duas tentativas concorrentes | PASS | Replays retornam `APPLIED`; as duas tentativas concorrentes retornam `APPLIED` para a mesma identidade com uma única Agenda e um único recibo dessa operação. Duas identidades distintas examinadas somam dois recibos. |
| Lote heterogêneo e recuperação por operação | PASS | Resultados reais: `APPLIED`, `REJECTED`, `BLOCKED_DEPENDENCY`, `CONFLICT`. Motivos: alvo cross-farm, Agenda faltante e revisão incorreta. Replay preserva integralmente o recibo do sucesso anterior. A dependência faltante é criada pelo comando canônico e o retry da operação original retorna `APPLIED`, com um recibo. Conflito não recebe rebase automático. |
| Três itens de raiva | PASS no cenário executado | Linhas homologadas mantêm `allows_agenda_auto=false` e `no_agenda_auto`; três tentativas automáticas recebem `SANITARIO_AUTOMATIC_RULE_NOT_APPROVED_OR_ACTIVATED`, sem criar Agenda. Não havia plano automático ativo; não se atribui a rejeição exclusivamente a uma única condição do guard. |
| Indisponibilidade transitória da RPC | PASS | Lock advisory controlado retém a RPC real; `pg_cancel_backend` cancela somente a sessão aguardando no banco exclusivo. Resposta `RETRYABLE`; removido o impedimento, retry da mesma identidade retorna `APPLIED` e uma linha. Nenhuma função foi substituída ou mockada. |
| Replay factual | PASS | `apply_factual_core` aceita fato standalone sintético; reenvio mantém exatamente um Evento e um detalhe. Não é aplicação derivada de planejamento nem comprovação de produto/carência específicos. |
| ACK perdido após commit e reinício do cliente | PASS | `route.fetch()` executa o servidor; somente depois da resposta real a entrega é abortada como timeout. Revisão remota confirmada antes do retry. Página é fechada e outra aberta, lendo o mesmo IndexedDB. Backoff real respeitado; mesma operação reapresentada, fila esvaziada, um recibo e nenhuma segunda revisão aplicada. |
| Offline/reconnect, troca de fazenda durante resposta e ACK tardio | PASS | Intenção válida enfileirada antes da desconexão. Na reconexão, resposta real é retida após commit; seleção local muda para B antes de liberar ACK. Worker reconcilia a operação em A, preserva a fazenda original e esvazia a fila. |
| Logout com operação pendente e novo login | PASS | Logout real; zero chamadas de batch enquanto sem sessão. UUID pendente preservado; autenticação real da mesma conta e recuperação canônica permitem concluir. |
| Expiração offline e reconexão | PASS | Fila é criada com sessão utilizável, auto-refresh parado e JWT deixado expirar pelo relógio real. Reconnect observa refresh HTTP real, preserva UUID, produz um recibo e esvazia a fila. Foram observadas 13 chamadas de refresh sob TTL artificial de 60 segundos; não se certifica frequência de refresh de produção. |
| JWT expirado, refresh revogado e ausência de sessão | PASS | Token originalmente emitido pelo GoTrue expira sem edição de claims: batch recebe 401 e zero gravações. Outro refresh válido é aceito; refresh de sessão revogada recebe 400. Sem bearer, batch recebe 401. |
| Invariantes finais | PASS | Banco final: 1 Evento e 1 detalhe, ambos do fato explícito de teste; 0 movimentações de estoque, 0 carências preenchidas e 12 recibos canônicos. Planejamento e replay não criaram fatos extras. |

A tabela agrupa asserções dos 16 casos automatizados; RPC direta está no caso de RLS, por isso a quantidade de linhas não é a contagem de testes.

## Catálogo e contratos preservados

Reutilizado o snapshot somente leitura da VF2, SHA-256 `c9744cf2e6b6a9b95e11e68d74990cdb0af887f849c9acde9421bb720d80fdcc`. Foram restaurados no banco descartável somente o protocolo de raiva e seus três itens ativos. Regras, versões e restrições são as do snapshot. As únicas adaptações foram `created_by=null` e `approved_by` apontando para usuário sintético local, para não copiar FKs de usuários reais. Não houve chamada de importador, bootstrap ou decisão curatorial. Esta fixture não pretende representar novamente o catálogo inteiro.

O fluxo de escrita permanece o canônico `sync-batch` → RPC interna → ledger. Manipulação de envelopes foi usada nos testes negativos e contratuais desse endpoint, sem criar writer de produto alternativo. No cliente, reagendamento, worker, fila e pull são os existentes. Agenda permaneceu intenção; o Evento foi criado apenas pelo comando factual explícito. Nenhum teste reconstruiu histórico a partir de `state_*`.

## Defeitos, ajustes e arquivos

**Defeitos de produto reproduzidos nesta fase: nenhum demonstrado. Correções de runtime: nenhuma.**

Durante a preparação houve quatro falhas da fixture: campos obrigatórios ausentes no payload; retry antes de vencer o backoff; tentativa de nova escrita offline quando o SDK não conseguia renovar a sessão curta; comparação de `Date` do driver com string SQL. Foram corrigidos os campos/precondições/assertivas dos testes, sem relaxar regras ou editar a fila. O caso de perda de ACK foi mantido e passou após aguardar o prazo real. As operações dos cenários offline finais são enfileiradas com sessão válida antes da desconexão.

Arquivos da VF4:

- `tests/codex/sanitario-v2-review.supabase.mjs`: sete linhas adicionadas; modo opt-in reutiliza provisioning/cleanup e reduz TTL somente no projeto descartável. O caminho anterior não foi executado nem alterado em seu comportamento.
- `tests/codex/sanitario-v2-vf4.fixture.mjs`: 16 cenários reais, sem novos writers ou alterações de domínio.
- `docs/review/SANITARIO_V2_VF4_VALIDACAO_20261024.md`: este relatório.
- `docs/review/evidence/SANITARIO_V2_VF4_RECOVERY_RESULT_20261024.json`: evidência consolidada.

Perfis, logs, diretórios temporários do provisioning e script de consolidação são auxiliares descartáveis; não foram usados dados de usuário real. Nenhuma entrega anterior ou arquivo concorrente foi removido, restaurado ou incluído indevidamente na atribuição desta fase.

## Verificações e limites

Executado:

- `node tests/codex/sanitario-v2-review.supabase.mjs --vf4` → execução final exit 0, 16/16 PASS; repetições anteriores documentadas como preparação da fixture.
- `node --check tests/codex/sanitario-v2-review.supabase.mjs` e `node --check tests/codex/sanitario-v2-vf4.fixture.mjs` → exit 0.
- `pnpm exec eslint tests/codex/sanitario-v2-review.supabase.mjs tests/codex/sanitario-v2-vf4.fixture.mjs` → exit 0, zero diagnósticos.
- Consulta somente leitura da cadeia de migrations no banco exclusivo → 65 aplicadas.
- `git status --short --untracked-files=all`, `git diff --name-status`, `git diff --stat`, equivalentes cached, inspeção dos arquivos VF4 e `git diff --check` → escopo identificado, sem staged, diff check aprovado.
- Consolidação valida 16 resultados, cleanup/gates OFF e JSON; evidência não contém credenciais ou sessões.

Não executado:

- **NOT_RUN — revisão independente:** o agente revisor não conseguiu iniciar a revisão por limite de uso. Foi feita autorrevisão; não há parecer independente alegado.
- **NOT_RUN — cloud/produção:** a execução é local e real; não comprova equivalência de versões/configuração de um deploy remoto. Gates de produção não foram consultados ou ativados.
- **NOT_RUN — processo completo/PWA:** reinício nesta fase fecha a página e recria o cliente JS; não foi repetido o kill/restart do contexto Chromium da VF3 nem testado cold start PWA sem shell/assets.
- **NOT_RUN — nova escrita local sem sessão utilizável:** preservação de intenção já válida foi exercitada. Com TTL de 60s, o SDK pode exigir refresh mesmo antes da expiração; sem rede o boundary rejeita nova escrita. Não foi modificado esse contrato nem classificado como bug sem demonstrar violação de regra prevista.
- **NOT_RUN — regressão global, build, TypeScript e validador funcional amplo do baseline:** nenhum contrato de runtime, migration, RLS ou função foi alterado pela VF4. A validação real focada cobre o objetivo sem repetir suítes VF1–VF3 ou fluxos alheios. Os 38 diagnósticos TypeScript anteriores não foram reavaliados nem declarados resolvidos.

Não há cenário dependente de backend marcado BLOCKED nesta execução: o impedimento de infraestrutura foi superado pelo projeto local exclusivo. Isso não converte cenários não executados em PASS.

## Riscos residuais e recomendação

1. Evidência de working tree compartilhado; patches VF1–VF4 ainda sem integração confirmada e revisão independente da VF4 indisponível.
2. Configuração local de JWT curto e falhas controladas não certifica todos os modos de falha, escala ou configuração de produção; regras de catálogo não foram re-homologadas.
3. Cold start PWA/crash de processo e criação de novas intenções sem sessão utilizável permanecem fora desta certificação.

**Recomendação:** submeter o patch de testes e os patches VF1–VF3 à revisão de integração, usando estes resultados server-side como evidência. Resolver as ressalvas relevantes à liberação pretendida antes de preparar integração. Manter gates de produção OFF; qualquer ativação operacional continua exigindo decisão e autorização próprias.
