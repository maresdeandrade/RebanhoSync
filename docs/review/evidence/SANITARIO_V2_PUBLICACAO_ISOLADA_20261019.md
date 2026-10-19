# Sanitário V2 — pacote executável de homologação exclusiva

Atualizado em: 2026-10-19

> Estratégia de destino e autorizações substituída pela decisão do proprietário de reutilizar o backend atual.
> Seguir [preflight do backend existente](SANITARIO_V2_BACKEND_PREFLIGHT_20261019.md) e R01–R05.
> Este registro preserva a preparação anterior; H01–H10 não autorizam operações no backend existente.

Escopo: preparar implantação; **nenhuma operação remota de escrita autorizada ou executada**.
O único merge autorizado nesta tarefa foi o **merge local** da main `350955f91c2b06859ba7d093926d3f5b27389b86`,
incluindo PR #214, na branch `codex/sanitario-v2-convergencia`. Resultado `323f7b5a6a8a0fb23a2d0a40250e6d57b5be6bd4`,
sem conflitos. Base sanitária preservada: `5e4240b9f147ad446e87d2474a2cf9fbd67ac6ce`.
Durante a preparação a main avançou para `86c802a111c7ef3ecdd23ae2618190a0d36c5be4`, com PR #215
(extração do builder de edição de lote de insumos e estabilização de teste de idade). Também integrada
por merge local autorizado, sem conflitos, em `d41290c30461d3195a15eee1eff95ef412384667`.
Worktree: `C:/Users/mares/.codex/worktrees/sanitario-v2-convergencia/GestaoAgro`.
As outras worktrees não foram alteradas; o formulário schema 2 concorrente permanece na worktree anterior.

## Destino e conteúdo fechado

Projeto de destino: **a provisionar, exclusivo de homologação**, nome proposto `RebanhoSync-SanitarioV2-Homologacao`,
região proposta `sa-east-1`. Organização, responsável, ref, domínio preview e digest da chave devem ser
vinculados à autorização H01/H02. Esses valores ainda não existem; não são pendências de curadoria.
Inventário Supabase reconferido em 19/10: nenhum projeto exclusivo acessível.
`zqloazqzhwauamcejmuz` é produção e está permanentemente excluído deste procedimento.

O [manifesto completo](SANITARIO_V2_PUBLICACAO_ISOLADA_20261019.json) lista, em ordem, os **63 arquivos SQL**,
SHA256 de cada arquivo, dependências das Functions, IDs/versões de cada decisão e dez autorizações ainda falsas.
Projeto novo precisa da cadeia ativa completa, incluindo fundação, RLS e membership; aplicar somente as três
migrations recentes não é suficiente. Nenhuma migration existente foi modificada.

| Contrato recente | Migration |
|---|---|
| Vínculos de Agenda ao catálogo | `20261015070038_sanitario_agenda_catalog_v2_references.sql` |
| Curadoria eletrônica e publicação | `20261017080447_sanitario_catalog_review_v2.sql` |
| Plano/Agenda, CAS e ledger | `20261017195545_sanitario_planning_convergence_v2.sql` |

RPCs revisadas: `sanitario_catalog_review_preview_v2`, `sanitario_catalog_decide_v2`,
`internal_sanitario_sync_v2_set_automation_plan`, `internal_sanitario_sync_v2_reschedule_agenda` e o writer
existente `internal_sanitario_sync_v2_create_agenda`. Revisão global exige usuário autenticado e
`is_app_admin()`, identidade `auth.uid()`, timestamp transacional, versão/hash, locks e auditoria.
As RPCs internas de sync são INVOKER, exclusivas de `service_role`, e revalidam membership, owner/manager,
gate por fazenda, revisão e recibo idempotente. Grants de anon/authenticated não concedem acesso a elas.
RLS e os clientes antigos continuam preservados; não existe migração implícita de IDs textuais.

Functions: **`sync-batch`** (obrigatória), **`sanitario-reconcile`** (reconciliação existente),
**`telemetry-ingest`** (consumida pelo cliente). O pacote inclui a dependência
`src/lib/animals/taxonomyFactsContract.ts` e `supabase/functions/deno.json`.
Não inclui `test-auth`, `.temp`, seed, `.env`, usuários/dados ou segredos de produção.
URLs externas de bibliotecas nas fontes são dependências, não endpoints de banco.

## Preparação e ensaio local — permitido agora

Executar na worktree acima, PowerShell, com Node, Docker local e Supabase CLI **2.117.0**, cujos parâmetros
foram conferidos por `--help`. Não atualizar ferramentas como parte desta implantação.

```powershell
node scripts/codex/prepare-sanitario-homologation.mjs --validate
$release = Join-Path $env:TEMP ('sanitario-v2-release-' + [guid]::NewGuid().ToString('N'))
node scripts/codex/prepare-sanitario-homologation.mjs --output $release
node tests/codex/sanitario-v2-deployment.local.mjs
```

O gerador somente lê e empacota fontes; rejeita diretório existente, exige as duas bases integradas e confere
o formulário com o candidato compilado. Não altera catálogo ou backend. O ensaio cria seu próprio projeto
local, aplica as 63 migrations sem seed, executa `db push --local --dry-run --skip-vault` e o importador
existente com `--dry-run --review-candidate`; compara contagens antes/depois, verifica grants e descarta
somente o projeto que criou. Não usa a entrada privada de importação das fixtures.

Evidência: [ensaio local](SANITARIO_V2_PUBLICACAO_ENSAIO_LOCAL_20261019.json), **6 cenários aprovados**;
dry-run do candidato: **144 criações propostas, 4 rejeições esperadas, zero gravações persistentes**.
As 4 rejeições são os vínculos legados de associações antiparasitárias que não constituem classe confirmada;
não são quatro itens sanitários adicionais. Catálogo, decisões, Agendas, Eventos, estoque, operações e gates
habilitados ficaram em zero. O ambiente descartável foi removido.

## Autorizações e comandos remotos — não executar agora

Cada Hxx exige decisão humana com responsável, referência, projeto exclusivo e hashes. Uma decisão pode
autorizar explicitamente várias Hxx; autorização de dry-run não autoriza aplicação. O manifesto não é uma
concessão de acesso. Nenhum comando abaixo usa o link implícito da worktree.

| ID | Ação a autorizar | Condição verificável |
|---|---|---|
| H01 | Provisionar projeto exclusivo | Organização, região, custo e responsável definidos; usar Dashboard para manter senha fora de argumentos/logs |
| H02 | Vincular destino e preview | Ref novo, chave independente, origem exclusiva, Auth/redirects/SMTP isolados; nenhum provider/usuário/secret copiado de produção |
| H03 | Dry-run remoto e depois aplicar migrations | Duas liberações explícitas; lista e hashes do manifesto; gate ainda OFF; sem seeds ou Vault |
| H04 | Configurar origem e deploy das três Functions | Ref explícito; JWT ON; URLs/chaves SUPABASE_* nativas do projeto, sem sobrescrevê-las com produção |
| H05 | Promover candidato a payload canônico de rascunhos | Commit local revisado, referência real da autorização; nenhuma aprovação técnica |
| H06 | Dry-run remoto e depois importar rascunhos | Duas liberações explícitas; hash do payload promovido e alvo conferidos |
| H07 | Conceder papel de revisor | Usuário real desse projeto, autorização de governança; não conceder ao produtor por inferência |
| H08 | Decidir os cinco conjuntos | Ação explícita do revisor no Backoffice; hash de conteúdo da RPC, versões e justificativa |
| H09 | Fazenda/membros de teste, gate e preview | IDs reais identificados, owner/manager, allowlists de usuários/clientes, vigência; rollout só nessa fazenda |
| H10 | Smoke remoto A/B | Somente contas e fazenda de homologação, contexto preenchido e resultados registrados |

Após H01/H02, registrar novo ref/digest em `config/backend-targets.json` num commit revisado. Manter o ref e
digest produtivos exclusivamente na lista de produção. Criar `approved-target.json` sem credenciais:

```json
{
  "project_ref": null,
  "organization_id": null,
  "environment_owner": null,
  "provisioning_decision_reference": null,
  "api_url": null,
  "functions_url": null,
  "preview_origin": null,
  "publishable_key_sha256": null
}
```

Preencher somente com valores comprovados do novo projeto. API deve ser `https://<ref>.supabase.co` e
Functions exatamente a mesma origem em `/functions/v1`. Configurar variáveis no preview, sem gravar
credenciais no repositório ou no manifesto. `VITE_BACKEND_ENV=homologation`; `VITE_SUPABASE_URL`,
`VITE_SUPABASE_FUNCTIONS_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` pertencem ao novo projeto.
`DB_URL` e autenticação da CLI somente por canal seguro em memória; nunca imprimir nem passar URL/senha
em linha de comando. `PGSSLMODE=require` para a conexão remota. Não usar `--debug`.

```powershell
# Após registro local do destino e carregamento seguro das variáveis:
$bindingPath = 'CAMINHO_ABSOLUTO/approved-target.json'
node scripts/codex/verify-sanitario-homologation-target.mjs $bindingPath
if ($LASTEXITCODE -ne 0) { throw 'Destino não validado' }
$binding = Get-Content -LiteralPath $bindingPath -Raw | ConvertFrom-Json
$ref = $binding.project_ref
# $release aponta ao pacote imutável gerado anteriormente; conferir seus hashes.

# H03a: somente dry-run autorizado; --skip-vault impede escrita prévia no Vault.
supabase db push --project-ref $ref --workdir $release --dry-run --skip-vault
# H03b: aplicar somente depois de revisar a lista/hashes e autorizar separadamente.
supabase db push --project-ref $ref --workdir $release --skip-vault

# H04: APP_ORIGIN não é segredo; SUPABASE_* são injetadas pelo projeto de destino.
supabase secrets set --project-ref $ref "APP_ORIGIN=$($binding.preview_origin)"
supabase functions deploy sync-batch sanitario-reconcile telemetry-ingest --project-ref $ref --workdir $release --import-map "$release/supabase/functions/deno.json"
```

Executar o preflight novamente **imediatamente antes de cada operação remota**, com o mesmo binding e ambiente.
Ele é local e rejeita ref/chave produtivos, API/Functions diferentes, build de produção, conexão de banco
fora do ref (incluindo pooler de outro projeto) e parâmetros de URL que sobrescrevam o host.
Não atesta existência/acesso remoto: confirmar no Dashboard a exclusividade, organização e ref após H01.
Não usar `--include-seed`, `--prune`, `--no-verify-jwt` ou `db reset --linked`.
A CLI não oferece dry-run de deploy de Function; o pacote local e os hashes preparam a revisão, sem
alegar que um deploy remoto foi ensaiado ou executado.

## Rascunhos e decisão eletrônica

Candidato de revisão: SHA256 `2b3adab34d0eb58dcc5d8fa976d1cd852d41f204e00063b776e2271d60753fe6`.
Formulário schema **3**, pacote schema **4**; não importar o formulário schema 2 concorrente.
O hash do arquivo candidato **não é** o `reviewed_content_digest` JSONB retornado pela RPC.

O importador existente proíbe `--review-candidate --apply` e dry-run remoto do candidato. H05 deve
promover seu conteúdo ao caminho canônico fixo, preservar `review_provenance`/IDs/versões e retirar
`review_only`; registrar em `import_gate` a autorização **de importação de rascunhos** real e
`import_real_authorized=true`. Manter `execute_import=false`, protocolos/itens em draft e todas as flags
operacionais falsas. Não editar apenas flags para aprovar. Segue receita de preparação **somente após H05**:

```powershell
# SANITARIO_RELEASE_DIR aponta ao pacote; SANITARIO_DRAFT_IMPORT_DECISION_REFERENCE contém autorização H05 real.
@'
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const reference = process.env.SANITARIO_DRAFT_IMPORT_DECISION_REFERENCE;
assert(reference?.trim(), "Autorizacao H05 obrigatoria");
const data = readFileSync(path.join(process.env.SANITARIO_RELEASE_DIR, "candidate.review.json"));
assert.equal(createHash("sha256").update(data).digest("hex"), "2b3adab34d0eb58dcc5d8fa976d1cd852d41f204e00063b776e2271d60753fe6");
const payload = JSON.parse(data);
assert.equal(payload.review_only, true);
delete payload.review_only;
payload.import_gate = { ...payload.import_gate, import_real_authorized: true, authorization_reference: reference };
payload.execute_import = false;
writeFileSync("docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json", JSON.stringify(payload, null, 2) + "\n");
'@ | node --input-type=module
node scripts/codex/import-sanitario-protocols-v2.mjs --validate
Get-FileHash docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json -Algorithm SHA256
```

Revisar o diff e criar o commit autorizado de promoção antes de H06. O digest será diferente, pela mudança
de gate; registrar novo digest e alvo na autorização H06. Não atualizar artificialmente a decisão curatorial.
Depois, com `DB_URL` exclusivo já validado e em memória:

```powershell
# H06a; o importador lê o payload promovido no caminho fixo da worktree.
node scripts/codex/verify-sanitario-homologation-target.mjs $bindingPath
if ($LASTEXITCODE -ne 0) { throw 'Destino não validado' }
node scripts/codex/import-sanitario-protocols-v2.mjs --dry-run
# H06b, após conferir plano/digest e autorização específica de aplicação:
$env:ALLOW_SANITARIO_IMPORT = '1'
$env:SANITARIO_IMPORT_CONFIRM = '13.0.0-canonical-contract'
$env:ALLOW_SANITARIO_REMOTE_IMPORT = '1'
node scripts/codex/import-sanitario-protocols-v2.mjs --apply
Remove-Item Env:ALLOW_SANITARIO_IMPORT, Env:SANITARIO_IMPORT_CONFIRM, Env:ALLOW_SANITARIO_REMOTE_IMPORT
```

Esperado em projeto vazio: 10 protocolos, 20 itens, fontes/coberturas/classes/produtos de revisão correspondentes
ao dry-run; **0 itens automáticos** após importação. Novo dry-run deve conter somente skips e as rejeições
esperadas. Importador usa advisory lock, transação e reconferência de convergência antes do commit.

H07/H08: entrar no Backoffice/Admin, aba de revisão sanitária, com usuário real autorizado deste projeto.
Selecionar as versões do manifesto, obter preview, conferir fontes/campos/hash/ausência de blockers e decidir
explicitamente **B19 (1), PAR (3), DES (1), CONF (1), PARTO (1)**. Guardar cada recibo e `request_id` para retry
idempotente; conflito exige novo preview, nunca reuso silencioso de hash antigo. Aprovação global não exige
fazenda nem veterinário executor. A execução futura conserva as obrigações profissionais aplicáveis.

Manter **7 comerciais pendentes** (CLO 3, LEP 2, IBR 2), **3 raivas consultivas no_agenda_auto**,
**2 aftosas bloqueadas e LEP2 canônica bloqueada**. Aprovar exatamente os 7 IDs/versionados e nenhum dos outros 13.

## Smoke A/B, liberação e contenção

H09: criar somente dados de teste identificados, fazenda com owner/manager, animais elegíveis e contexto
DF/sistema/categorias/manejos/calendário/reprodução conforme cada regra. Registrar ator e IDs reais.
Preparar gate existente `sanitario_sync_v2_gates` só para essa fazenda, contrato min/max **2**, allowlists
explícitas de usuários/clientes e vigência. Aplicar por transação autorizada com conferência de membership;
não inserir gate amplo ou alterar produção. Entregar preview pelo canal autorizado, build `--mode homologation`.
Executar cutover pelos serviços existentes `prepareSanitarioV2Cutover`/`applySanitarioV2Cutover`, com a
reconciliação existente; somente então habilitar o enqueue local. Não simular cutover por flag.

O cutover é um serviço existente, não um botão publicado. Para o primeiro smoke remoto assistido,
usar dois perfis Chromium no frontend Vite local ligado **somente ao Supabase exclusivo**, depois do
preflight acima. Essa modalidade não certifica distribuição pública do preview:

```powershell
node node_modules/vite/bin/vite.js --mode homologation --host 127.0.0.1 --port 5173 --strictPort
```

Em cada perfil, após login normal na fazenda de teste, executar no DevTools desse Vite:

```javascript
const farm = "UUID_REAL_DA_FAZENDA_DE_HOMOLOGACAO";
const ref = "REF_REAL_EXCLUSIVO_REGISTRADO";
const cut = await import("/src/lib/offline/sanitarioV2Cutover.ts");
const pull = await import("/src/lib/offline/pull.ts");
await pull.pullSanitarioProtocolCatalogV2();
await pull.pullSanitarioTechnicalCatalogV2(farm);
await pull.pullDataForFarm(farm, ["animais", "fazenda_sanidade_config"], { mode: "merge" });
await cut.applySanitarioV2Cutover(farm, pull.pullSanitarioV2CutoverState);
cut.setSanitarioV2PushEnabled(true, ref);
```

Não executar esse trecho numa origem de produção. Não registrar `APPLIED` manualmente. Em erro de
ownership, sessão, RLS ou reconciliação, interromper e preservar a fila. O smoke de um preview compilado
exigirá invocar esse mesmo serviço por um acesso operacional autorizado; não existe migração automática
do IndexedDB do localhost para outra origem.

H10 — dois perfis/aparelhos independentes, mesmo projeto exclusivo e fazenda:

1. A/B recebem catálogo por pull: apenas 7 itens autorizados, IDs/versões e recibos correspondem ao manifesto.
2. Em A offline, ativar plano e fechar/reabrir. Reconectar; aguardar ACK/ledger e receber o mesmo plano em B.
3. Gerar Agendas aplicáveis em A; B recebe mesmos UUIDs, alvos e versões. Nova geração/retry não duplica.
   PAR tem janelas próprias em maio/julho/setembro; fora da janela registrar exclusão esperada, sem mudar
   relógio/banco ou exigir 7 Agendas na mesma data. Não falsificar procedimento ou histórico para produzir elegibilidade.
4. Cancelar e reagendar offline; reconectar e confirmar em B. Novo planejamento não recria cancelada nem
   desfaz a data canônica. Provocar conflito de revisão entre A/B: rejeição explícita e pull, sem sobrescrita.
5. Repetir envio perdido/reconnect, sessão expirada/refresh e farm-switch; mesmos recibos, nenhuma escrita em
   fazenda diferente. Outsider não lê/escreve os dados da fazenda. Usuário sem papel não aprova catálogo.
6. Conferir banco, não só Dexie: plano, Agenda/alvos, revisão e ledger; comparar IDs/digest do recibo.
   Nenhum Evento, detalhe sanitário factual, estoque ou carência deve resultar do planejamento.

Guardar evidência sanitizada, atores/versões/IDs/request_ids e resultado de cada passo. A evidência local de
17 cenários A/B e 11 PostgreSQL anterior continua válida para código inalterado; não certifica ambiente remoto.
IDs textuais antigos continuam locais. Não converter, renumerar ou enfileirar esses registros neste rollout.

Contenção: interromper novos enqueues e distribuição do preview; se houver falha de segurança, desabilitar
imediatamente o gate dessa fazenda. Preservar IndexedDB, fila, UUIDs, recibos, versões e auditoria. Bloquear
gate pode deixar operações pendentes: corrigir contrato e reativar controladamente para drenagem/replay.
Não marcar pendência como sincronizada. Não apagar catálogo, reenviar com novos IDs ou desfazer commit de
banco já aceito. Publicação/SQL falhou antes de commit: a transação não publica parcialmente; confirmar estado
antes de retry. ACK perdido: repetir mesmo request_id/op_id. Falha de migração/deploy: manter gate OFF,
conferir histórico/objetos efetivos e corrigir forward-only; não usar rollback/reset remoto universal.
Revisão já aprovada não é desfeita por desligar gate; qualquer suspensão/versionamento curatorial precisa
de outra decisão rastreável. Produção permanece fora de todas essas operações.

## Validação desta preparação

- **59 testes distintos aprovados**: 12 em `AppShell.test.tsx`/`backend-environment.test.mjs`, mais 12 em
  `sanitario-v2-deployment.test.mjs`. O teste novo cobre inclusive chave diferente de um mesmo projeto,
  conexão de produção, sobrescrita de host na URL, endpoints misturados e ausência de autorização de provisionamento.
  Outros 35 em `buildLotEditOperations.test.ts`/`lifecycle.test.ts` validaram os commits adicionais do PR #215.
- Ensaio descartável: **6 cenários aprovados**, cadeia completa de 63 migrations e importador público em dry-run,
  zero gravação de catálogo/decisão e cleanup confirmado no JSON vinculado acima.
- ESLint dos quatro novos scripts/testes passou; build Vite `--mode homologation` após o merge passou.
  Permanecem avisos de Browserslist/chunking preexistentes.
- Fallow `audit --base d41290c30461d3195a15eee1eff95ef412384667 --gate new-only --format json`:
  zero achados introduzidos pelo pacote. O ajuste UX05 incorporado não foi refatorado para remover seus
  avisos de estilo/duplicação. A resolução de dependências do Fallow emite aviso sobre o junction node_modules.
- Motor, publicador, migrations, RPCs e Functions não foram alterados; não repetidos os 482 testes, os 17
  cenários A/B e os 11 PostgreSQL anteriores. Tampouco houve nova certificação remota ou de aparelhos físicos.

Classificação: **READY para a preparação e submissão das autorizações H01–H10**, sem liberação remota.
