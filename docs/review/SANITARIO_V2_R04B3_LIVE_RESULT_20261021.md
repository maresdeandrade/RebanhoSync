# R04B.3 — publicação realizada; previews autenticados pendentes

> **Atualização pós-consolidação:** [7/7 previews autenticados obtidos e avaliados](SANITARIO_V2_R04B3_PREVIEWS_POSTCONSOLIDATION_20261021.md), sem blockers; estado atual `AWAITING_CURATORIAL_APPROVAL`. A publicação e o bloqueio de transporte descritos abaixo são o registro histórico anterior. Nenhuma decisão curatorial foi emitida na atualização.

**Estado atual: `BLOCKED_AUTHENTICATED_PREVIEWS`.** Em 21/10/2026, a migration e o delta certificados foram aplicados no projeto `zqloazqzhwauamcejmuz`. O estado `AWAITING_CURATORIAL_APPROVAL` ainda não foi atingido: faltam cinco previews individuais e dois agrupados por sessão Auth real.

[Resultado estruturado e snapshot final](evidence/SANITARIO_V2_R04B3_LIVE_FINAL_20261021.json) · [Preflight protegido](evidence/SANITARIO_V2_R04B3_TLS_VERIFIED_PREFLIGHT_20261021.json).

## Identidade, transporte e integridade

- Branch `codex/sanitario-v2-convergencia`, HEAD `b5b6ffc9f515874577003efd2cce3ef4492bdb74`, no worktree autorizado. Alterações anteriores preservadas; nenhum código, guard ou pacote certificado alterado.
- `DB_URL` presente no processo; alvo passou o guard canônico de projeto/pooler, sem opções de query. Autenticação PostgreSQL concluída. Nenhuma credencial foi exibida ou persistida.
- `pg.Client({ connectionString: process.env.DB_URL })`, mesma configuração do publicador, confirmou socket criptografado e certificado autorizado, sem erro de autorização; `PGSSLMODE=verify-full`, CA adicional configurada e `rejectUnauthorized` não desabilitado. O `psql` também usou `verify-full` com a CA configurada privadamente. `pg_stat_ssl.ssl=false` refere-se à sessão PostgreSQL atrás do pooler e não foi usado como prova do TLS cliente–pooler.
- Os 36 arquivos do manifesto e os oito inputs conferiram, sem divergência. Migration SHA256 `c490630d646a9d99a8fc424c07cc73f73485b6e6bd5ae2d5b6a5582f06e29e59`; delta `55a71d9f4adb6b4fcbbfe9cd5d26ee8c15fd4fc99f1106b50d02dc830ca877e4`.
- Read-set curatorial completo comparado ao preflight autorizado: migrations, funções/ACLs, protocolos, itens, fontes, coberturas, classes, produtos, vínculos, decisões e triggers iguais. Dados operacionais também iguais ao baseline aceito. Snapshot às `13:24:57 UTC`.

## Execução observada

1. `psql -X -v ON_ERROR_STOP=1 -f ...MIGRATION_DRY_RUN_20261021.sql`: exit 0, guards aceitos, três funções processadas e rollback. [Recibo](evidence/SANITARIO_V2_R04B3_LIVE_MIGRATION_DRY_RUN_20261021.json).
2. Mesmo cliente com `...MIGRATION_APPLY_20261021.sql`: exit 0 e commit. Somente `20261020232807`; histórico passou de 63 para 64 migrations. Os bytes de `statements[1]` registrados foram comparados ao arquivo original e coincidem. [Recibo](evidence/SANITARIO_V2_R04B3_LIVE_MIGRATION_APPLY_20261021.json).
3. Publicador `scripts/codex/import-sanitario-protocols-v2.mjs --dry-run --incremental <cópia autorizada>`: exit 0; 15 criações, sete atualizações, seis referências sem alteração e zero rejeições. [Recibo](evidence/SANITARIO_V2_R04B3_LIVE_DELTA_DRY_RUN_20261021.json).
4. Mesmo publicador com `--apply --incremental`: exit 0 e mesmo resumo. O original certificado permanece com autorização desabilitada; somente a cópia temporária recebeu `import_gate` vinculado à autorização existente, sem mudar o digest. [Recibo](evidence/SANITARIO_V2_R04B3_LIVE_DELTA_APPLY_20261021.json).
5. Replay do mesmo pacote pelo mesmo comando: exit 0; **zero criações, zero atualizações, 23 skips e zero rejeições**. Snapshot posterior idêntico ao anterior ao replay, exceto horário observacional. [Recibo](evidence/SANITARIO_V2_R04B3_LIVE_DELTA_REPLAY_20261021.json).

CAS do histórico, baseline/read-set, locks e convergência transacional do publicador passaram no caminho real. Não foram injetados conflitos ou falhas no remoto. Auditorias e testes locais já concluídos não foram repetidos. `git diff --check` retornou exit 0.

Uma tentativa inicial de iniciar `psql` por `spawnSync` retornou `EPERM` antes de lançar o processo, sem executar SQL. A execução direta pelo PowerShell, mantendo segredos somente no ambiente privado, funcionou; não foi criado writer alternativo.

## Preservação e limite

Snapshot final às `13:28:05 UTC`: 25 itens totais, cinco candidatas novas em `draft` com `allows_agenda_auto=false`, sete itens previamente aprovados intactos, quatro Eventos, quatro animais, sete Agendas, cinco decisões anteriores e zero gates habilitados. Eventos, detalhes, casos, animais, Agendas, vínculos, fechamento, ledger, configuração, estoque e gates coincidem integralmente com o snapshot anterior à escrita. Fontes, produtos e protocolos de referência permanecem iguais.

Nenhuma chamada de decisão curatorial, alteração operacional, gate ON, homologação, deploy, push ou merge foi executada. As alterações técnicas de classes e supersessões são exclusivamente as sete atualizações do delta certificado, sem decisão curatorial adicional.

O controle automático de autorização do navegador recusou adquirir acesso ao conteúdo/sessão da aba existente em `https://rebanho-sync.vercel.app`, informando recusa de permissão pelo usuário. Nenhuma tentativa de contorno, extração alternativa de sessão ou spoof de claims foi feita. **Zero previews autenticados foram obtidos**; não existem digests agrupados reais desta execução.

Para retomar, é necessário acesso autorizado a uma sessão Auth real para executar apenas os cinco previews individuais e dois agrupados previstos no plano certificado, exigir `blockers=[]` e guardar os conteúdos/digests reais. A autorização de publicação continua válida; migration e delta já estão publicados e não precisam ser reaplicados. Aprovações curatoriais continuam fora do escopo.
