# Sanitário V2 — R01 aplicada e verificada

Atualizado em: 2026-10-19

## Resultado

**R01_APPLIED_VERIFIED_WITH_AUXILIARY_CLI_EFFECT.** As três migrations foram aplicadas
ao projeto existente `zqloazqzhwauamcejmuz`, numa única transação, após recuperação lógica
ensaiada e testes de compatibilidade. Estado observado em **19/10/2026 às 16:12:32,
America/Sao_Paulo**: **63 migrations, gates OFF, catálogo vazio**.

Há um desvio operacional registrado abaixo: a CLI anunciou inicialização/renovação de login
temporário tanto no dump quanto em consultas. Portanto, esta entrega **não afirma que o único
efeito remoto tenha sido o DDL das migrations**. Nenhum login foi concedido manualmente pelo agente
e nenhuma limpeza/revogação remota foi executada para encobrir esse efeito.

R02–R05 não foram executadas. sync-batch permanece v27; sanitario-reconcile v4,
telemetry-ingest v2 e test-auth v5. Sem importação, superadmin, aprovação, criação de fazenda
ou ativação de gate. A flag de rollout local continua false.

Evidências sanitizadas: [JSON da execução](SANITARIO_V2_R01_APLICADA_20261019.json).
A falha anterior foi superada por trabalho técnico; o
[relatório anterior](SANITARIO_V2_R01_EXECUCAO_20261019.md) permanece como registro histórico.

## Backup protegido e recuperação demonstrada

Diretório privado, fora do repositório:

`C:/Users/mares/AppData/Local/RebanhoSync-private-backups/r01-a386755c369f4ff1b66a08d9cc8097fb`

ACL sem herança, permitindo somente o usuário Windows atual e SYSTEM.
Os dois backups estão cifrados com **DPAPI CurrentUser**. A decifração em memória e o
SHA256 do conteúdo original foram conferidos; as cópias de trabalho não cifradas e o log
com a credencial temporária foram removidos. Não se alega apagamento físico seguro do disco.

| Artefato | Bytes originais | SHA256 do conteúdo antes da cifra |
|---|---:|---|
| database.dump.dpapi | 1.246.639 | `575e4faa8f340afecdffc1dc26d11a03f7922fbf8c8beceba044046c10b8ae99` |
| roles.sql.dpapi | 6.062 | `9a5129df74b00b3431af1f0962d631932bb506a608b9bfec1fb25d4271e68ccb` |

database.dump foi produzido por pg_dump em formato custom, com schema/dados de todos os
schemas elegíveis, incluindo public, Auth, Storage e supabase_migrations.
roles.sql foi produzido por pg_dumpall --roles-only --no-role-passwords.
Não foi usada a ausência de PITR como impedimento: a recuperação lógica foi demonstrada.

Dois PostgreSQL 17 locais descartáveis foram restaurados sem erro final. Foram recuperadas
**107 tabelas**, incluindo **3 usuários Auth, 7 sessões e 32 refresh tokens do snapshot**,
além das **60 migrations originais**, estruturas, funções, constraints, triggers, RLS e grants.
As seis seções sanitárias comparadas coincidiram: migrations, RPCs/ACLs, colunas,
tabelas/RLS/ACLs, constraints e policies.

Na comparação com uma leitura remota posterior, **104/107 fingerprints de tabelas coincidiram**.
As diferenças foram auth.users, auth.sessions e auth.refresh_tokens; a leitura posterior tinha
33 refresh tokens. Isso registra atividade de Auth após a captura, não uma alegação de igualdade
entre o snapshot e um backend que continuou recebendo sessões.

Adaptações do ensaio local, explicitamente limitadas ao ambiente descartável:
- O postgres bootstrap local permaneceu SUPERUSER, pois o PostgreSQL não permite remover esse
  atributo de seu bootstrap superuser. O dump remoto contém o atributo remoto original.
- GRANTED BY das memberships foi adaptado ao administrador local de restauração. A primeira
  tentativa sem essa adaptação falhou pela exigência de ADMIN option do PostgreSQL 17.
- Os papéis/grants do aplicativo e as barreiras de authenticated foram restaurados e exercitados;
  o dump original de roles permanece cifrado, sem alterações.

**Recuperável:** schema/dados PostgreSQL do snapshot, usuários e hashes de senha Auth,
dados de sessões/tokens naquele instante, histórico de migrations, funções, policies, RLS,
constraints, triggers e definições de roles sem suas senhas.

**Reconfigurar/recriar conforme o destino:** senhas de login PostgreSQL, chaves API/JWT,
configuração de Auth/SMTP/providers/redirects, secrets e deployment de Functions,
publicações/subscrições excluídas deliberadamente do dump e bytes de objetos em Storage.
Metadados Storage estão no banco; os arquivos externos não estão neste backup.
vault.secrets estava vazio. Este dump não exporta chaves criptográficas externas do provedor.
O login temporário da CLI não deve ser tratado como credencial de recuperação.

DPAPI depende do usuário/perfil Windows original. Para outro computador, decifrar por esse usuário
e transportar/reproteger por canal autorizado. Não há cópia externa certificada nesta entrega.

Procedimento demonstrado: decifrar os arquivos em diretório privado, conferir SHA256,
preparar PostgreSQL 17 isolado com as extensões equivalentes, reconstruir os papéis com as
adaptações de bootstrap explícitas e executar pg_restore --exit-on-error; conferir dados,
FKs, RLS, grants e histórico antes de conectar serviços. O ensaio usou rede desabilitada para
evitar jobs/webhooks externos durante a restauração.
Uma restauração destrutiva do backend remoto continua exigindo autorização própria; backup
não significa rollback automático nem autorização para apagar dados posteriores ao snapshot.

Os três containers criados por esta execução, inclusive um primeiro bootstrap que falhou,
foram removidos após a validação. Os dois bancos compartilhados preexistentes permaneceram em execução.

## Compatibilidade efetivamente exercitada

Reprodutor: `tests/codex/sanitario-r01-legacy-payloads.local.mjs`.
O teste usa authenticated/RLS em cópia restaurada, o UPDATE genérico que v27 executa
e a implementação real de normalizeDbError de v27, cujo SHA256 de origem é
`4a43504634b90f50d0951616df606afc2693f6a3c139290def54fdeb864a389c`.
Não é um ensaio HTTP hospedado nem execução do worker num navegador físico.

| Cenário | Resultado observado |
|---|---|
| Perfil sem mudança de plano | UPDATE aceito |
| Payload sem campo sanitário, sem plano existente | UPDATE aceito |
| Payload com plano legado inalterado | UPDATE aceito |
| Plano antigo divergindo do atual | 42501; REJECTED / PERMISSION_DENIED |
| Alteração direta do plano | 42501; REJECTED / PERMISSION_DENIED |
| Inserir plano legado numa configuração sem plano | 42501; REJECTED / PERMISSION_DENIED |
| Omitir plano existente num payload completo | 42501; REJECTED / PERMISSION_DENIED |
| Retry rejeitado, primeiro envio | Rejeição explícita; entrada/IDs preservados |
| Retry rejeitado, mesmo ID, segundo envio | Mesma rejeição; nenhuma alteração ou duplicação |

**Nove casos passaram.** As fixtures e alterações aceitas foram revertidas nas transações
de teste; rejeições também não persistiram mudanças. Não se removeu nem enfraqueceu o trigger canônico.
No final local: 63 migrations, catálogo/ledger/gates vazios.

A recuperação da rejeição é explícita: a operação não é confirmada como aplicada, o banco mantém
seu estado e o mesmo envelope pode ser preservado. **Repetir o caminho v27 sozinho não faz a alteração
do plano passar.** Isso exige posterior transporte autorizado na R02 ou correção explícita da intenção.
Não houve resubmissão automática com novos IDs nem descarte de uma fila real.
O worker atual retém operações REJECTED e seus registros de rejeição; essa leitura de código não
foi apresentada como teste de todos os clientes anteriores.

Assim, as atualizações de perfil continuam compatíveis; gravações diretas do plano recebem rejeição
deliberada que impede sobrescrita e duplicação. A ativação de plano segue indisponível até as autorizações
posteriores. Filas inacessíveis continuam risco residual, sem presumir vazio e sem exigir acesso universal.

## Dry-run remoto e aplicação atômica

Preparador: `scripts/codex/sanitario-r01-atomic-sql.mjs`.
Ele apenas gera SQL e não se conecta ao backend.

A primeira migration tinha BEGIN/COMMIT próprios. Somente seus delimitadores externos foram
substituídos pelos delimitadores do lote de três migrations. Os arquivos originais não foram editados,
os hashes foram reconferidos e seus bytes originais foram registrados no histórico por versão/nome.
As instruções de domínio, grants e triggers permaneceram as dos três arquivos autorizados.

O lote:
- exige as 60 versões/nomes esperados, lock do histórico e gates desativados;
- executa somente os três SQLs previstos e seus três registros de histórico;
- exige 63 versões e as RPCs esperadas;
- compara catálogo, itens, ledger, gates e todas as configurações de fazenda antes/depois;
- termina em ROLLBACK no dry-run e COMMIT somente na aplicação.

Na segunda restauração local: **60 → dry-run/rollback → 60 → aplicação → 63**.
Depois foi executado remotamente por Management API, através de db query --linked com
project-ref explícito. O dry-run transacional retornou exit 0; uma leitura independente confirmou
60 versões e as seis seções sem alterações. A aplicação retornou exit 0; não houve aplicação parcial.

| Plano gerado | SHA256 |
|---|---|
| Dry-run com ROLLBACK | `fc5a2e8a7dc6cf66cf932e0a4c4fea792fa74da192e0b18a622a66f91ba080f0` |
| Aplicação com COMMIT | `82abc8b143c310b69ad8c5b11531502e28d31c83d002f4c30f68b5fe93b091f9` |

Versões aplicadas, e nenhuma outra:
- 20261015070038 — sanitario_agenda_catalog_v2_references;
- 20261017080447 — sanitario_catalog_review_v2;
- 20261017195545 — sanitario_planning_convergence_v2.

Hashes dos arquivos originais: consultar migrations no JSON desta execução ou no preflight anterior.
O preparador falha se qualquer um divergir. O HEAD reconfirmado antes da escrita era 7adca3b;
a main não foi integrada novamente por esta tarefa, cujo escopo era concluir R01.

## Pós-aplicação

As seis seções do schema remoto **coincidiram exatamente com a segunda restauração local após o lote**.
Foram confirmados:
- 63 migrations, com as três versões/nomes exatos;
- quatro triggers novos habilitados;
- constraint do ledger aceitando os quatro comandos antigos e os dois novos;
- RPCs de curadoria, plano e reagendamento;
- RLS habilitada nas 19 tabelas sanitárias V2;
- anon sem execução curatorial; authenticated com entrada curatorial sujeita ao guard de admin;
  authenticated sem execução interna do plano e service_role com execução interna;
- zero superadmins, zero gates, zero protocolos/itens/fontes/produtos, zero Agendas/planos/ledger;
- cinco configurações de fazenda preservadas pelo guard transacional de conteúdo;
- Functions nas mesmas versões; nenhum deploy ou atualização de secrets.

## Efeito auxiliar da CLI e limites

A CLI de dump anunciou **Initialising login role**. Foi observado cli_login_postgres e uma validade
limitada. Posteriormente, os logs de db query usados no dry-run e na aplicação também continham esse
anúncio; a validade observada passou para **19/10/2026 19:17:31.549893 UTC**.
Logo, a expectativa de que db query evitaria esse efeito auxiliar não se confirmou.

Isso é um desvio da restrição de não alterar o remoto fora das migrations e foi comunicado,
não ocultado como parte de R01. Não houve concessão manual de superadmin ou mudança manual de role,
mas não se afirma ausência de inicialização/renovação auxiliar pela ferramenta.
Não se tentou excluir/revogar o login sem autorização. Leitura independente às **16:18:27 de 19/10/2026,
America/Sao_Paulo**, confirmou expired=true (validade até 16:17:31). Validade expirada não deve ser confundida
com prova de encerramento de sessões preexistentes.

Os logs com credencial foram removidos; nenhuma senha, token ou dump de dados foi incluído no Git.
Os logs de consulta preservados no diretório privado não contêm URL PostgreSQL ou senha.

## Validação e próximo passo

Executados: exportação, hashes/DPAPI, duas restaurações locais, nove casos PostgreSQL/RLS/v27,
ensaio atômico local, dry-run remoto com rollback conferido, aplicação e verificação remota,
ESLint focado dos dois scripts, gates documentais e diff check. Nenhum build ou regressão global repetido sem delta de runtime.

Riscos residuais: clientes inacessíveis e planos diretos rejeitados até tratamento autorizado;
dependência do perfil Windows e configurações externas na recuperação; efeito auxiliar do login CLI.
Próximo passo objetivo: decidir separadamente R02 para atualizar somente sync-batch.
Até lá, manter gates OFF e não ativar plano/importação/curadoria.
