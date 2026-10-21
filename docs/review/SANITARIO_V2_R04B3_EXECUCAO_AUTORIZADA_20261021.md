# R04B.3 — execução autorizada: impedimento de conexão

**BLOCKED_REMOTE_CONNECTION.** A autorização expressa do proprietário está válida e registrada. Não será solicitada novamente. O preflight anterior passou; na retomada de 21/10/2026 às 11:33 UTC, a `DB_URL` continuava indisponível. O estado remoto não foi revalidado nesta retomada.

[Evidência estruturada](evidence/SANITARIO_V2_R04B3_AUTHORIZED_EXECUTION_20261021.json) · [Snapshot do preflight autorizado](evidence/SANITARIO_V2_R04B3_AUTHORIZED_PREFLIGHT_20261021.json).

## Preflight e pacote

Projeto `zqloazqzhwauamcejmuz`, branch `codex/sanitario-v2-convergencia`, HEAD `b5b6ffc9f515874577003efd2cce3ef4492bdb74`. Snapshot em 21/10/2026 **11:08:14 UTC**. Todos os conjuntos curatoriais protegidos coincidiram com o baseline aceito, inclusive decisões e triggers aplicáveis. Os quatro Eventos, quatro animais, sete Agendas e gates OFF permaneceram preservados; nenhuma operação independente foi usada como bloqueio.

Os 36 arquivos do manifesto e oito inputs estão íntegros. Migration SHA256 `c490630d646a9d99a8fc424c07cc73f73485b6e6bd5ae2d5b6a5582f06e29e59`; delta `55a71d9f4adb6b4fcbbfe9cd5d26ee8c15fd4fc99f1106b50d02dc830ca877e4`.

Foi criada uma cópia temporária do delta com a referência à autorização real e somente `import_gate` habilitado. O digest do conteúdo permaneceu idêntico. O CLI canônico `--validate --incremental` retornou exit 0 para essa cópia. O original certificado, o código e os guards não foram alterados; nenhum `--apply` foi apontado inadvertidamente para o banco local.

## Impedimento observado

- O driver do publicador existente exige conexão PostgreSQL por `pg.Client`/`DB_URL`.
- O endpoint direto `db.zqloazqzhwauamcejmuz.supabase.co` retornou AAAA `2600:1f1e:dbb:f602:5c5b:11e1:b5a3:a9c7`. A tentativa TCP IPv6 retornou **ENETUNREACH** neste executor.
- O session pooler `aws-1-sa-east-1.pooler.supabase.com:5432` está **acessível por TCP**. A URL local de ligação aponta ao usuário/projeto aceito pelo guard canônico, porém não contém senha.
- Não há `DB_URL`, `SUPABASE_DB_PASSWORD`, `PGPASSFILE` ou `PGSERVICE` no ambiente. Os arquivos de ambiente do projeto contêm configurações frontend/OIDC, sem credencial PostgreSQL; os arquivos padrão de senha verificados não existem.
- A API de gestão está autenticada e permitiu as leituras, mas não fornece ao `pg.Client` uma sessão SQL transacional persistente para o writer existente. Não foi criado writer alternativo, proxy que contorne o guard, RPC auxiliar ou nova concessão.

A autenticação temporária `cli_login_postgres` usada historicamente na R03 não foi renovada/rotacionada nesta tentativa. O caminho incremental certificado valida o usuário de pooler `postgres.<project_ref>`; não se alterou esse guard nem o digest para acomodar outro caminho de autenticação. Isso registra uma limitação do transporte preparado, sem transformar autorização válida em autorização pendente.

## Estado final observado

Leitura independente às **11:14:11 UTC**:

| Estado | Resultado |
|---|---|
| Migrations | 63; `20261020232807` ainda ausente |
| Catálogo | 20 itens, sete aprovados, zero candidatas novas |
| Operacional R05 | Quatro Eventos, quatro animais e sete Agendas |
| Gates | OFF |
| Aprovações/decisões desta etapa | Zero |
| Previews autenticados/digests agrupados | Não obtidos, pois as candidatas não foram publicadas |

Não houve dry-run/aplicação remota da migration, publicação/replay do delta, decisão curatorial, alteração operacional, gate ON, homologação, deploy, push ou merge. A aba real do RebanhoSync foi inspecionada e devolvida à rota original da Agenda; a navegação normal pode emitir telemetria da aplicação, sem envio de ação operacional.

## Retomada

Disponibilizar a conexão PostgreSQL autenticada do pooler **somente pelo ambiente seguro do executor**, com TLS verificado e projeto correto; não enviar senha/token no chat. A autorização R04B.3 já concedida continua válida. Após a configuração, reconfirmar o read-set protegido e executar a migration/delta exatos, integridade/replay e sete previews reais, mantendo todas as proibições existentes.

Não se declara `AWAITING_CURATORIAL_APPROVAL`: migration, publicação e previews ainda não ocorreram. A preparação anterior validou o publicador localmente; esta tentativa demonstrou a limitação concreta da conexão remota disponível.

## Retomada após bloqueio — 21/10/2026, 11:33 UTC

**Resultado: `BLOCKED_REMOTE_CONNECTION`, por configuração ausente.** [Evidência desta retomada](evidence/SANITARIO_V2_R04B3_RESUMPTION_CONNECTION_CHECK_20261021.json). Esta seção acrescenta uma observação; os snapshots, recibos e resultados anteriores permanecem históricos.

### Verificações locais observadas

- Worktree utilizado: `C:/Users/mares/.codex/worktrees/r04b2-certificacao/GestaoAgro`; branch `codex/sanitario-v2-convergencia`; HEAD `b5b6ffc9f515874577003efd2cce3ef4492bdb74`.
- `git status --short --untracked-files=all`, `git diff --stat`, `git diff --cached --stat`, `git branch --show-current`, `git rev-parse HEAD` e `git worktree list --porcelain` executados. O worktree contém o patch e os artefatos anteriores; staging vazio. O repositório principal está em outra branch e não foi utilizado para alterações.
- A metadata local `supabase/.temp/cli-latest` está modificada fora do manifesto certificado; foi preservada. Não integra o digest nem o caminho de publicação certificado. Não foi atribuída autoria dessa alteração.
- Recalculados SHA256 dos 36 arquivos do manifesto e dos oito inputs: **zero divergências**, às `2026-10-21T11:33:09.092Z`. Migration e digest do delta permanecem exatamente os autorizados acima. Os flags do pacote original continuam `execute_import=false`, `approved=false` e `import_real_authorized=false`.
- Consultada somente a presença das variáveis, sem imprimir valores: `DB_URL`, `PGPASSWORD`, `PGSSLMODE` e `NODE_EXTRA_CA_CERTS` ausentes no processo. `DB_URL` também ausente nos escopos persistentes `User` e `Machine`, por `[Environment]::GetEnvironmentVariable('DB_URL', <escopo>)`.

A primeira expressão PowerShell de presença de variáveis falhou no parser (`An empty pipe element is not allowed`), antes da execução. A expressão foi corrigida para coletar o resultado do `foreach` antes de serializar; a consulta concluída retornou exit 0. O verificador Node de hashes/digest e os comandos Git concluíram com exit 0. Não houve tentativa de conexão PostgreSQL nesta retomada: ausência de configuração não comprova falha de autenticação, TLS ou projeto.

### Limite desta tentativa

Conforme a condição de parada solicitada, não foram iniciados dry-run, migration, importação, replay, previews, consultas remotas, renovação de credenciais ou caminhos alternativos. Publicador, guards e artefatos certificados não foram alterados. A autorização existente continua válida para o escopo exato e não precisa ser concedida novamente.

O último estado remoto observado continua sendo o snapshot histórico de `2026-10-21T11:14:11.370679+00:00` documentado acima. Não se afirma que migrations, catálogo, operações ou gates foram reconfirmados às 11:33 UTC. Nenhuma escrita remota foi emitida nesta retomada; portanto, esta tentativa não modificou Eventos, animais, Agendas, aprovações ou gates.

A pendência concreta é disponibilizar `DB_URL` no ambiente seguro herdado pelo executor, para o session pooler do projeto autorizado. Não enviar credenciais no chat nem gravá-las no repositório. Com a configuração disponível, testar autenticação/TLS/identidade e só então reconfirmar o read-set imediatamente antes das escritas previstas, mantendo os hashes autorizados.
