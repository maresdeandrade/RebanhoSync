# Sanitário V2 — execução da autorização condicional R01

Atualizado em: 2026-10-19

## Decisão

**R01_APPLICATION_BLOCKED — nenhuma migration aplicada, nenhuma escrita remota executada.**

O proprietário autorizou R01 condicionalmente nesta conversa. A condição crítica de backup recuperável
não foi comprovada; a aplicação foi interrompida antes da primeira migration.
A autorização não foi recusada nem substituída por uma nova solicitação: permanece condicionada.
R02, R03, R04 e R05 continuam sem autorização.

Baseline local: `codex/sanitario-v2-convergencia@b05cd8d350ec133d7e93d0847f0c2527ba2dc007`,
worktree inicialmente limpa em `C:/Users/mares/.codex/worktrees/sanitario-v2-convergencia/GestaoAgro`.
Não houve novo merge, instalação, alteração de runtime ou modificação de migration nesta execução.

[Snapshot desta execução](SANITARIO_V2_R01_EXECUCAO_20261019.json).
[Preflight anterior](SANITARIO_V2_BACKEND_PREFLIGHT_20261019.md).
Observação principal: **19/10/2026 às 06:31:22, America/Sao_Paulo**.

## Critérios da autorização

| Critério | Evidência observada | Resultado |
|---|---|---|
| 1. Destino, histórico e hashes | Projeto/org/região conferidos; 60 versões remotas; os três SHA256 coincidem exatamente com o preflight | Atendido no escopo inspecionado |
| 2. Filas acessíveis | Opera exige reautenticação; Chrome listou o cliente aberto, mas duas tentativas de leitura falharam antes de obter DOM/filas | Clientes tecnicamente inacessíveis; risco residual explícito, sem presumir fila vazia |
| 3. Compatibilidade | FKs/colunas/assinatura antiga preservadas; porém trigger novo rejeita alteração direta do plano, e sync-batch v27 não suporta o comando novo | Compatibilidade integral das operações antigas pendentes não comprovada |
| 4. Backup/recuperação | CLI retornou backups=null, physical_backup_data={}, pitr_enabled=false | **Impedimento crítico: ponto recuperável não comprovado** |
| 5. Gates/automação | Zero gates, planos, Agendas V2 e itens automáticos; os arquivos não habilitam gates nem invocam execução de negócio durante sua aplicação | Atendido na inspeção estática e leitura remota |
| 6. Dry-run/plano | CLI oferece --dry-run e --skip-vault; não foi invocado db push após falhar o critério crítico de backup | Não executado; aplicação não liberada |

## Projeto, schema e hashes

Projeto `zqloazqzhwauamcejmuz`, RebanhoSync, organização `zrcfplrzfpmihemqaemj`,
região sa-east-1, ACTIVE_HEALTHY, PostgreSQL 17.11.0.002.

| Migration local | SHA256 reconferido |
|---|---|
| `20261015070038_sanitario_agenda_catalog_v2_references.sql` | `625fe8940f09476833205d44978031dcfd10223fb0683ee08afd7cd4ed0cd916` |
| `20261017080447_sanitario_catalog_review_v2.sql` | `6b73f0dce568eb37c6941f5fa7354dde7604aeba070a5a815a211fc96efabd1e` |
| `20261017195545_sanitario_planning_convergence_v2.sql` | `8b6b0577e6f07280ee58ead78221fcec6c5b9973aad8222e225c350a9ff36593` |

Foram comparados com o snapshot anterior: histórico de migrations, assinaturas/ACLs de RPCs,
colunas, RLS/ACLs das 19 tabelas V2, constraints e policies da superfície sanitária.
Essas seis seções permanecem iguais na leitura atual. Os hashes normalizados das 60 versões comuns
também coincidem com o registro anterior; normalização textual não equivale a comparação byte a byte
do arquivo remoto original nem a um diff integral de todo o schema.

Continuam **60 migrations**, não 63. Os objetos das três pendentes continuam ausentes conforme o
inventário: referências canônicas, curadoria e novos comandos de planejamento não foram instalados.

## Backup e recuperação

Comando de leitura, com saída observada exit 0:

```powershell
supabase backups list --project-ref zqloazqzhwauamcejmuz --output json
```

```json
{
  "backups": null,
  "physical_backup_data": {},
  "pitr_enabled": false,
  "region": "sa-east-1",
  "walg_enabled": true
}
```

A organização retornou plano free/tier_free. Não se infere desse plano, isoladamente, existência
ou inexistência de uma cópia interna do provedor. O fato operacional é que a consulta não comprovou
um backup disponível/restaurável nem uma janela PITR. WAL-G habilitado não prova retenção,
ponto de restauração acessível, cobertura dos dados ou recuperação utilizável pelo proprietário.

Nenhum backup foi criado, arquivo de banco exportado, restore iniciado ou credencial alterada.
Não foi suposto rollback automático das migrations.

Para retomar, comprovar um backup/ponto de restauração identificável, horário, retenção, abrangência
(schema, dados, Auth, roles/grants e histórico de migrations), localização protegida e procedimento de
restauração adequado. A restauração integral pode perder fatos aceitos após o ponto escolhido;
reconciliar recibos, IDs de operações e filas preservadas antes de qualquer reenvio.
Não executar restore/reset/limpeza automaticamente. Recuperação que altere o backend exige escopo próprio.

## Filas e compatibilidade

**Fatos observados:**

- O conector Opera retornou necessidade de reautenticação.
- O inventário Chrome encontrou o perfil Joao Paulo com um RebanhoSync aberto em
  `https://rebanho-sync.vercel.app/animais`.
- Duas tentativas de vincular/ler esse cliente falharam no controle CDP antes de obter conteúdo.
  Não houve navegação, reload, login, mudança de perfil ou tentativa de drenar fila.
- Nenhuma IndexedDB foi lida ou limpa. Não foi possível inventariar queue_gestures/queue_ops,
  before_snapshot, revisões, obrigações de reconciliação ou cutovers.
- Outros perfis/dispositivos não foram acessados. Zero ledger remoto não prova ausência de pendências locais.

**Análise estática de compatibilidade:**

A primeira migration preserva colunas/FKs legadas e acrescenta referências separadas do catálogo.
A terceira amplia a allowlist do ledger sem excluir os quatro operation_kind anteriores,
mantém a assinatura do create_agenda e consulta recibos antes de reexecutar efeitos.

Entretanto, `20261017195545_sanitario_planning_convergence_v2.sql:6` cria
`guard_sanitary_automation_plan_writer_v2`, que intercepta INSERT/UPDATE de
`fazenda_sanidade_config`. Se o payload inserir ou alterar
`sanitary_agenda_automation_v2`, a operação exige service_role **e** flag interna do writer;
caso contrário, lança `42501 / SANITARIO_PLAN_CANONICAL_WRITER_REQUIRED`.

Cenário concreto: cliente anterior possui UPDATE genérico pendente alterando esse campo.
Após a migration, esse payload deixa de ser aceito pelo caminho genérico.
Um payload completo de perfil com plano obsoleto também pode ser rejeitado se alterar o campo.
Atualizações que deixam o plano idêntico não acionam essa condição.
Não é confirmado que tais operações existam nos clientes atuais; a fila deles está inacessível.

O bundle remoto de sync-batch foi relido: **v27, ACTIVE, verify_jwt=true**,
sem `set_automation_plan` ou referência à RPC nova.
A tradução existente no worker local não comprova atualização dos clientes já instalados nem desse backend.
R02 não foi executada e não é autorizada por R01.
Assim, não foi declarada compatibilidade integral de operações antigas somente porque os IDs/FKs permanecem.

Antes de retomar, identificar clientes/versões e payloads pendentes, preservar envelopes e IDs, comprovar
caminho compatível e definir janela de contenção sem migração implícita ou perda de fila.
Não corrigir migration já fechada, mudar seus hashes ou antecipar R02 por esta autorização.

Os SQLs exatos também contêm GRANT/REVOKE técnicos de tabelas/funções.
Nenhuma dessas instruções foi executada; nenhuma permissão de usuário, role ou objeto foi alterada.
As restrições de permissão da solicitação não foram contornadas nem usadas para editar os arquivos autorizados.

## Estado remoto observado e ações efetivas

- 60 migrations; catálogo com zero protocolos, itens, produtos, fontes e demais entidades de importação.
- Zero gates, zero itens automáticos, zero planos, zero Agendas V2 e zero recibos sanitários.
- Cinco configurações de fazenda, três usuários, sete sessões e zero superadmins.
- RLS habilitada nas 19 tabelas V2 inventariadas.
- Nenhum apply_migration, db push, deploy, importação, bootstrap administrativo, criação de fazenda ou mudança de gate.
- Apenas consultas de leitura e gravação local do relatório/evidências.
  Não houve aplicação parcial da lista autorizada.

A inspeção não comprova imutabilidade de dados fora desse recorte nem ausência de escritores concorrentes.
Como nada foi aplicado, os checks pós-aplicação de 63 versões e instalação dos novos objetos
não foram executados nem substituídos por uma declaração de sucesso.

## Validação e próxima ação

Executados: status/HEAD/worktree; SHA256 dos três SQLs; get_project/list_migrations/get_organization;
SELECT de inventário; comparação das seis seções; leitura do bundle sync-batch; ajuda da CLI;
listagem de backups; tentativas de acesso aos clientes.
Os 170 testes da preparação anterior não foram repetidos nem apresentados como testes desta execução.
Não houve mudança de runtime, schema local ou migration que justificasse repetir build/regressão.

**Resultado: NOT READY para aplicar R01.** Impedimento crítico: recuperação não comprovada.
Compatibilidade de planos antigos permanece pendente de demonstração; filas inacessíveis são risco residual.
A próxima ação é obter evidência recuperável de backup e resolver essa compatibilidade; depois reconferir
destino/hashes/schema/gates e executar o dry-run autorizado antes de qualquer aplicação.
Não é necessária nova autorização genérica para R01; são necessárias as condições já exigidas pelo proprietário.
