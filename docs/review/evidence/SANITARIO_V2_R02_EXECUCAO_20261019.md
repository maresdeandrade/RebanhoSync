# R02 — sync-batch publicada em 19/10/2026

**Decisão: deploy executado; READY WITH CAVEAT pela ausência de smoke remoto autenticado.**

Projeto `zqloazqzhwauamcejmuz`, branch `codex/sanitario-v2-convergencia`, código no
HEAD `d4723b26521995f67b70fe14f14477cdb82bc264`. O worktree estava limpo antes da execução.
A autorização R02 foi usada exclusivamente para substituir a Function `sync-batch`.
R03–R05 continuam sem autorização.

## Alteração observada

| Propriedade | Antes | Depois |
|---|---|---|
| sync-batch | v27, ACTIVE | v28, ACTIVE |
| verify_jwt | true | true |
| import map | ausente | deno.json existente incluído no pacote |
| Migrations | 63 | 63 |
| Gates habilitados | 0 | 0 |
| Catálogo, planos, Agendas e ledger sanitários | vazios | vazios |

Publicação confirmada em `2026-10-19T19:33:25.776Z`. Hash do bundle publicado
`21aa82b9c7c6b41510a93670bab919c9a65362d04d51196913397c106f1809a0`.
Os 14 arquivos e dependências relativas conferiram com os hashes do manifesto
[preflight original](SANITARIO_V2_BACKEND_PREFLIGHT_20261019.json), seção `planned_functions[0]`.
O download posterior retornou exatamente os mesmos conteúdos dos 14 arquivos enviados.
O pacote contém somente o entrypoint e suas dependências, incluindo o contrato de taxonomia
compartilhado; não contém outras Functions, testes ou credenciais.

O deploy usou `Supabase.deploy_edge_function`, com nome exato `sync-batch`, os 14 arquivos,
entrypoint `supabase/functions/sync-batch/index.ts`, import map
`supabase/functions/deno.json` e `verify_jwt=true` explícito.
As outras Functions conservaram todos os metadados comparados, versões e hashes:
`sanitario-reconcile` v4, `telemetry-ingest` v2 e `test-auth` v5.

Os sete secrets existentes mantiveram nomes e digests SHA256. Seus valores não foram
obtidos, definidos nem rotacionados. O campo `updated_at` retornado mudou entre as consultas;
isso não é prova de rotação, pois todos os digests permaneceram iguais. `APP_ORIGIN`
já estava ausente; o allowlist existente de Vercel/loopback permanece no código.
O login auxiliar da CLI registrado na R01 continuava expirado na conferência final.

## Validações executadas

- **127 testes aprovados em 10 arquivos**, listados no [relatório estruturado](SANITARIO_V2_R02_EXECUCAO_20261019.json).
  Cobertura: comandos sanitários existentes, plano/reagendamento, CAS, gate OFF, rejeições,
  timeout/retry, deduplicação, sucesso parcial, reconciliação, perfil legado, estoque e evidência de produto.
  Os testes de worker também cobriram 401/refresh/retry, segundo 401 e preservação da fila.
- `deno check --config supabase/functions/deno.json supabase/functions/sync-batch/index.ts`: exit 0.
  Deno 2.9.7 informou que a opção legada `allowJs` foi ignorada.
- A suíte `sanitaryPlanningSyncV2.test.ts` inicialmente não importou por ausência de
  `VITE_SUPABASE_URL`; seus cinco testes passaram depois com URL/key fictícias locais
  fornecidas somente ao processo. Nenhum código ou teste foi alterado para isso.
- As seis RPCs internas consumidas pelo transporte foram consultadas no catálogo remoto:
  `create_agenda`, `replace_agenda_animals`, `apply_factual_core`, `close_agenda`,
  `set_automation_plan` e `reschedule_agenda`. Nomes e argumentos conferem com o dispatcher.
- HTTP remoto: OPTIONS com origem loopback retornou **200**, com execução da Function;
  POST sem JWT retornou **401**; JWT malformado retornou **401**, inclusive no retry.
  As rejeições de JWT ocorreram no gateway, antes do handler autenticado.
- Consulta final em `2026-10-19T19:34:55.759615Z`: **63 migrations**, zero registros de gates,
  zero catálogo nas 14 tabelas, planos, Agendas V2/legadas e ledger vazios.

Uma consulta inicial usou o nome incorreto `sanitario_catalog_protocols_v2` e falhou com
42P01. O nome correto implementado é `sanitario_protocolos_v2`; a consulta corrigida
confirmou catálogo vazio. A falha foi apenas de leitura.

## Limites e preservação de escopo

Não houve migration, mudança de RLS, criação de usuário, importação, aprovação, ativação de
gate, deploy de outra Function, push ou merge. Não foram alterados frontend ou filas de clientes.
Arquivos temporários criados pela CLI/Deno nesta execução foram removidos/restaurados.

**Não certificado nesta execução:** sucesso ou rejeição de domínio com JWT de usuário real
no endpoint publicado, pois nenhuma sessão autenticada estava acessível. A execução remota
autenticada não pode ser inferida dos smokes 401. Os contratos e retries foram testados
localmente. As filas de navegadores inacessíveis permanecem risco residual; não se presume
fila vazia. A regressão global, build e baseline funcional amplo não foram repetidos:
os fontes de runtime permaneceram iguais e a validação foi dirigida ao pacote publicado.

## Continuidade

A [R03 está preparada localmente](SANITARIO_V2_R03_PREPARADA_20261019.md): candidato
reproduzível de 20 rascunhos, validado e sem permissão de importação ou aprovação.
O próximo passo remoto depende de autorização R03 específica para os itens e dependências
discriminados. Não há nova rodada genérica de preflight proposta.
