# Sanitário V2 — integração final e preflight do backend existente

Atualizado em: 2026-10-19

## Decisão e limite desta entrega

**Preparação local validada com ressalvas; implantação ainda não liberada.**
A decisão do proprietário substitui a exigência anterior de criar projeto exclusivo:
reutilizar `zqloazqzhwauamcejmuz`, atualmente usado somente para testes segundo o proprietário.
Essa finalidade é declaração do proprietário; nomes/quantidades de registros não provam ausência de uso operacional.

Nenhuma escrita remota, migration, importação, aprovação, alteração de gate, deploy, push ou merge remoto foi executado.
A autorização de reutilização recebeu a referência local `SANITARIO_V2_BACKEND_EXISTENTE_20261019`;
ela não autoriza nenhuma R01–R05. O projeto continua registrado na lista de produção para proteger os builds existentes.

Este documento substitui **somente a estratégia de destino e autorizações** de
[SANITARIO_V2_PUBLICACAO_ISOLADA_20261019.md](SANITARIO_V2_PUBLICACAO_ISOLADA_20261019.md).
O gerador `prepare-sanitario-homologation.mjs` continua sendo o empacotador **exclusivo** anterior;
não usar seu destino/autorizações H01–H10 como receita de aplicação neste backend.

## Integração e estado confirmado

| Verificação | Evidência observada |
|---|---|
| Worktree | `C:/Users/mares/.codex/worktrees/sanitario-v2-convergencia/GestaoAgro` |
| Branch/base | `codex/sanitario-v2-convergencia@d5a62cce85e4cab7638f59f782ca20e7661eb369`; inicialmente limpa |
| Main remota | Inicial `52a6ddbe8d92230d70bfcde0f88ef31beed679a9`; avançou durante a tarefa para `613c89dfcce04ec4b312173a404fb006b82caee7` (PR #217), também integrada |
| Integração PR #216 | Merge local `e71670bda3e0319cff4e1dcd9e099a894707bcca`, sem conflitos; main e base sanitária ancestrais |
| Integração PR #217 | Merge local `24720aafcbda2025917a72cf5e71dc81f3fc1d62`, sem conflitos; cinco arquivos de navegação mobile, sem interseção com o patch |
| Delta integrado | Quatro arquivos do PR #216 e cinco do PR #217; nenhuma migration |
| Outros worktrees | Não receberam alterações de código/configuração; junction de dependências preexistente preservada |
| Projeto | RebanhoSync, org `zrcfplrzfpmihemqaemj`, sa-east-1, ACTIVE_HEALTHY, PostgreSQL 17.11.0.002 |
| Frontend publicado | `https://rebanho-sync.vercel.app`, bundle `/assets/index-CwiPqPHK.js`; API/Functions no mesmo ref, digest público coincide com registro |
| Catálogo | Todas as 14 entidades do importador vazias, inclusive 0 protocolos, 0 versões de itens, 0 produtos/fontes; 0 itens automáticos |
| Operação V2 | 0 Agendas V2, 0 recibos no ledger, 0 planos de automação; 5 configurações de fazenda |
| Gates | Zero linhas em `sanitario_sync_v2_gates`; autorização remota falha fechada sem gate |
| Auth/membership | 3 usuários, todos com login nos últimos 30 dias; 7 sessões registradas, 5 fazendas e 5 memberships owner |
| Curadoria | Zero linhas em `app_superadmins`; nenhum usuário apto hoje a decidir globalmente |
| Offline | Nenhuma IndexedDB de navegador inspecionada; Opera exige reautenticação. Ledger vazio não prova fila local vazia |

O [snapshot JSON](SANITARIO_V2_BACKEND_PREFLIGHT_20261019.json) contém contagens, versões,
hashes, membros/fazendas, assinaturas/ACLs de RPC, colunas, constraints e policies consultadas.
Observação remota principal: **19/10/2026 às 06:22:25, America/Sao_Paulo**.
A consulta reproduzível é `scripts/codex/preflight-sanitario-existing-backend.sql`, composta apenas por SELECT.
A hora é a da observação, não garantia de imutabilidade posterior.

## Migrations, dependências e drift

Há 63 arquivos locais e 60 versões remotas, sem versão remota extra.
As 60 versões comuns coincidem por SHA256 de texto normalizado após retirar comentários,
espaços e ponto-e-vírgula. Isso é comparação textual auxiliar: **não é igualdade byte a byte
dos arquivos originais nem prova de equivalência global do schema**. A normalização também elimina
esses caracteres dentro de literais; os hashes brutos locais permanecem registrados separadamente.

Pendências exatas, em ordem:

| Arquivo em supabase/migrations | SHA256 dos bytes locais |
|---|---|
| `20261015070038_sanitario_agenda_catalog_v2_references.sql` | `625fe8940f09476833205d44978031dcfd10223fb0683ee08afd7cd4ed0cd916` |
| `20261017080447_sanitario_catalog_review_v2.sql` | `6b73f0dce568eb37c6941f5fa7354dde7604aeba070a5a815a211fc96efabd1e` |
| `20261017195545_sanitario_planning_convergence_v2.sql` | `8b6b0577e6f07280ee58ead78221fcec6c5b9973aad8222e225c350a9ff36593` |

**Classificação do drift inspecionado:** defasagem esperada pelas três migrations ausentes.
As duas colunas `catalog_*`, as RPCs de decisão/preview e as duas RPCs de plano/reagendamento estão ausentes;
a constraint de operações ainda permite somente os quatro comandos anteriores.
As 19 tabelas V2 inspecionadas têm RLS. FKs compostas mantêm Agenda/alvos/animais na mesma fazenda.
ACLs internas restringem execução a service_role; a função authorize remota valida usuário,
membership, owner/manager, contrato, vigência, allowlists e gate por fazenda.
Policies/ACLs foram lidas, sem ensaios remotos de escrita ou personificação de papéis.

A primeira migration é aditiva: referências canônicas separadas preservam FKs/IDs legados,
triggers validam pai/tenant e grants pontuais permitem leitura/row-lock ao executor interno.
A segunda instala revisão global com auth.uid(), is_app_admin(), digest/versão, locks e auditoria.
A terceira amplia ledger, instala CAS de plano/reagendamento e preserva a assinatura do create existente.
Ela depende das colunas da primeira e exige writer canônico para alterar o plano em fazenda_sanidade_config.
**Clientes antigos com planos locais pendentes precisam ser inventariados antes da aplicação**:
não presumir que a manutenção de assinaturas torna qualquer payload antigo aceitável.

Não há backfill de catálogo, importação, aprovação ou habilitação de gate nessas migrations.
Não houve dump/diff integral do schema remoto. Objetos fora da superfície consultada,
Auth Site URL/redirects/SMTP, secrets de Functions e disponibilidade de backup/PITR não foram certificados.

## Functions: escopo mínimo

| Function | Atual | Previsto |
|---|---|---|
| sync-batch | v27, ACTIVE, verify_jwt=true | Atualizar os 14 arquivos do fechamento listado no snapshot; próxima versão esperada v28 se não houver deploy interveniente |
| sanitario-reconcile | v4, ACTIVE, verify_jwt=true | Preservar v4; diferença local é refactor do handler, sem necessidade demonstrada para esta implantação |
| telemetry-ingest | v2, ACTIVE, verify_jwt=true | Preservar v2; handler idêntico, deno.json difere apenas por fmt.exclude |
| test-auth | v5, ACTIVE, verify_jwt=false | Fora do escopo; não atualizar nem excluir |

sync-batch local contém os caminhos de plano/reagendamento e convergência ausentes no bundle v27.
O deploy deverá incluir `planning-v2.ts`, `movement-v1.ts`, imports compartilhados e
`src/lib/animals/taxonomyFactsContract.ts`; conferir o fechamento completo no snapshot.
A plataforma atribui o número final da versão. Não definir v28 como resultado já observado.
CORS local permite loopback; não é necessário alterar APP_ORIGIN para o smoke assistido local proposto.

Auth público foi consultado sem login: e-mail habilitado, anonymous_users=false,
demais providers desativados, disable_signup=false. Isso não certifica entrega de e-mail ou refresh real de sessões.

## Modo controlado preparado, ainda OFF

- `config/backend-targets.json` registra ref/org/decisão de reutilização, mantendo `client_rollout_enabled=false`.
- `config/sanitario-existing-backend-target.json` vincula o alvo e origem local `http://127.0.0.1:5173`, sem credenciais.
- Preflight exige `mode=controlled-existing-backend`, `VITE_BACKEND_ENV=controlled-homologation`,
  ref/org/decisão/digest exatos, API e Functions coincidentes, banco do mesmo ref, database postgres,
  TLS require/verify-full e ausência de parâmetros capazes de substituir host.
- Build de produção continua exigindo backend produtivo registrado e rejeita o modo controlado.
  A homologação exclusiva anterior continua rejeitando este projeto.
- O cliente controlado exige decisão de rollout separada, flag local e cutover APPLIED.
  As barreiras de sessão, ownership, fila e gate remoto continuam aplicáveis.

A saída do preflight controlado inclui `remote_write_authorized=false` e `remote_operations=0`.
Ele não executa nem concede permissão para comandos externos.
Carregar credenciais somente por canal seguro em memória; não passá-las por argumentos, scripts ou logs.
A chave publicada foi conferida por digest em memória; não foi copiada.
Não há DB_URL nem configuração remota Vite neste worktree; o binding real completo deve ser
revalidado quando essas variáveis forem fornecidas. Testes usaram valores sintéticos.

## Sequência de implantação condicionada a R01–R05

Todos os comandos desta seção são **futuros**, sujeitos à autorização indicada.
Antes de cada escrita: reconferir ref, HEAD/árvore, hash do artefato, estado remoto e autorização individual.
Executar o preflight local com o binding versionado e ambiente seguro:

```powershell
node scripts/codex/verify-sanitario-homologation-target.mjs config/sanitario-existing-backend-target.json
if ($LASTEXITCODE -ne 0) { throw 'Preflight de destino falhou' }
```

1. **R01 — migrations.** Primeiro inventariar filas dos clientes acessíveis e suspender novos
   planejamentos/envios sanitários durante a janela. Registrar cópia recuperável das filas, IDs e estados;
   confirmar backup/recuperação do backend pelo canal do proprietário. Reexecutar o SELECT de inventário
   e comparar versão/nome/hash, colunas/triggers/ACLs e gate OFF. Se houver qualquer divergência nova, parar.
   Carregar autenticação CLI e senha pelo mecanismo seguro suportado pela CLI 2.117.0.
   Conferir novamente que a lista pendente contém somente os três arquivos acima.
   A CLI teve `db push --help` e `functions deploy --help` conferidos nesta entrega.
   Com workdir apontando a esta árvore revisada, aplicar:
   `supabase db push --project-ref zqloazqzhwauamcejmuz --workdir C:/Users/mares/.codex/worktrees/sanitario-v2-convergencia/GestaoAgro --skip-vault`.
   Não usar include-seed, include-all, reset ou link implícito.
   A CLI oferece dry-run; não foi executado remotamente nesta fase e não é tratado como prova de ausência de efeitos
   auxiliares. Se for necessário antes de R01, revisar seu comportamento na versão instalada.
   Após aplicar, conferir 63 registros, objetos/ACLs esperados e gates ainda vazios/OFF.

2. **R02 — somente sync-batch.** Após R01, conferir os hashes de seu fechamento no snapshot e executar:
   `supabase functions deploy sync-batch --project-ref zqloazqzhwauamcejmuz --workdir C:/Users/mares/.codex/worktrees/sanitario-v2-convergencia/GestaoAgro --import-map C:/Users/mares/.codex/worktrees/sanitario-v2-convergencia/GestaoAgro/supabase/functions/deno.json`.
   Não usar prune/no-verify-jwt. Preservar secrets, Auth, outras Functions e gates.
   Registrar versão efetivamente retornada e verificar JWT/compatibilidade antes de liberar clientes.

3. **R03 — promover e importar somente rascunhos.** Gerar candidato por
   `node scripts/codex/prepare-sanitario-approval-v2.mjs --out CAMINHO_NOVO_DO_CANDIDATO`;
   exigir SHA256 `2b3adab34d0eb58dcc5d8fa976d1cd852d41f204e00063b776e2271d60753fe6`.
   Em commit local revisado, copiar esse candidato para o canônico
   `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`,
   retirando apenas review_only e registrando import_gate.import_real_authorized=true +
   authorization_reference da R03 real. Preservar import_provenance, execute_import=false,
   IDs/versões, status draft e flags operacionais falsas. **Não fazer essa promoção agora.**
   O canônico novo terá outro hash, que deve constar da R03 final.
   Validar com o importador --validate e, depois de conferir no código que buildPlan só lê, --dry-run
   usando DB_URL seguro e binding validado. O modo --review-candidate continua proibido para apply remoto.
   Revisar contagens/criações/4 rejeições esperadas de membros de grupos;
   só então definir ALLOW_SANITARIO_IMPORT=1, SANITARIO_IMPORT_CONFIRM=13.0.0-canonical-contract,
   ALLOW_SANITARIO_REMOTE_IMPORT=1 e executar o importador com --apply.
   Remover as três variáveis de autorização após a operação.
   Conferir 10 protocolos/20 itens em draft, zero automáticos, 7 comerciais ainda pendentes,
   3 raivas no_agenda_auto, 2 aftosas bloqueadas e LEP2 canônica bloqueada.
   Novo dry-run deverá convergir sem criação adicional. Importação não é aprovação.

4. **R04 — governança e curadoria global.** Conta principal existente identificada por leitura de auth.users:
   `maresdeandrade@gmail.com`, UUID `0f00a75c-32a9-4555-a840-cb0f13f2d3f7`, owner de três fazendas.
   As outras duas contas têm domínios telemetry-cert.invalid de fixtures. Nenhum papel foi concedido.
   Não há revisor atual: a concessão existente é **app_superadmins**, com poderes administrativos
   globais além do catálogo, e precisa ser explicitamente aceita na R04; não inferir esse papel por ownership.
   O bootstrap previsto pelo schema é INSERT em public.app_superadmins(user_id,notes,created_by)
   por operador administrativo autorizado, registrando a referência R04; sem conceder escrita dessa tabela ao client.
   Após login normal desse usuário, no Backoffice/Admin executar preview e decisão RPC por conjunto:
   B19 (1), PAR (3), DES (1), CONF (1), PARTO (1), exatamente IDs/versões do formulário schema 3.
   Conferir fontes, blockers vazios e digest servido pelo preview; decidir approved com justificativa
   e request_id único. Guardar cinco recibos; retry conserva request_id e conteúdo.
   Conflito exige novo preview e nova decisão explícita. Não usar o hash do arquivo como digest de revisão.
   Aprovação global não exige fazenda ou veterinário executor.
   Os outros 13 itens não recebem permissão automática; obrigações profissionais da execução permanecem.

5. **R05 — plano local, gate e smoke A/B.** Criar somente nesta etapa autorizada a fazenda dedicada
   **Homologação Sanitário V2**, no mesmo projeto, conforme definição do proprietário. Não reutilizar fazendas existentes.
   **UUID da nova fazenda, usuário(s) do smoke, dois client_ids e vigência ainda precisam ser vinculados**;
   não emitir SQL de gate com allowlists vazias. Cada usuário deve ser owner/manager nessa fazenda.
   Após inventário/reconciliação das filas e aprovação das regras, mudar client_rollout_enabled para true
   em commit local específico da R05; manter builds Production fora do modo controlado.
   Iniciar Vite assistido: `node node_modules/vite/bin/vite.js --mode controlled-homologation --host 127.0.0.1 --port 5173 --strictPort`.
   No runtime local, após login, usar os serviços existentes:
   pullSanitarioProtocolCatalogV2(), pullSanitarioTechnicalCatalogV2(farm),
   pullDataForFarm(farm, ["animais","fazenda_sanidade_config"], {mode:"merge"}),
   applySanitarioV2Cutover(farm,pullSanitarioV2CutoverState) e somente depois setSanitarioV2PushEnabled(true,ref).
   Não registrar APPLIED manualmente. Esses exports ficam em src/lib/offline/pull.ts e sanitarioV2Cutover.ts.
   Com os dois clientes offline, preencher contexto real e ativar o plano na UI sanitária da fazenda;
   conferir intenção persistida/fila, sem fatos/estoque. Antes de reconectar, sob a R05, inserir gate
   somente dessa fazenda com enabled=true, contrato min/max 2, usuários/clientes explícitos,
   rollout_percentage=100 restrito pelas allowlists e intervalo curto aprovado.
   Não habilitar gates nas demais fazendas. Reconectar A/B e executar a matriz abaixo.

A R05 inclui a alteração local de rollout, o plano e a escrita limitada do gate/smoke;
não inclui deploy público de frontend. Usar a mesma origem local em dois perfis independentes.
Se for necessário Preview hospedado, o deploy de frontend e redirects de Auth precisam de autorização própria,
com binding de origem HTTPS revisado; não inventar que o preview já existe.

## Smoke, filas e recuperação

| Risco | Verificação obrigatória na R05 |
|---|---|
| Filas prévias/clientes antigos | Inventariar queue_gestures/queue_ops por farm/estado e obligations/cutovers; preservar client_op_id, client_tx_id, domain_op_id, expected_revision e before_snapshot; não migrar IDs textuais |
| Crash/restart | Fechar processo com operação pendente e reabrir mesma origem/perfil; retomar sem regenerar IDs; comparar fila, ACK e ledger |
| Lost ACK/replay | Reenviar envelope aceito sem criar segundo plano/Agenda/Evento; conferir mesmo recibo e revisão |
| Reconnect/auth expirada | Persistir offline, expirar sessão, reautenticar e retomar mesma operação; não tratar 401 como sucesso |
| Conflito A/B | Concorrer na mesma revisão de plano/data; um ganha, outro recebe conflito e reconcilia sem sobrescrita |
| Farm-switch/RLS | Outra fazenda/outsider não lê nem escreve a fazenda alvo; fila anterior conserva ownership e isolamento |
| Cancelamento/reagendamento | Cancelar/reagendar offline, receber em B; materialização não reabre cancelamento nem desfaz data canônica |
| Domínio | Planejamento gera intenção de Agenda; Eventos, consumo e carência não aumentam; PAR respeita janelas, sem adulterar data para forçar elegibilidade |

O fato de haver 7 regras aprovadas não implica 7 Agendas simultaneamente elegíveis.
Registrar projeção local **e** linhas/versões remotas, recibos e efeitos negativos esperados.

Contenção: parar novos enqueues e desabilitar flag dos clientes; em incidente de segurança,
desabilitar imediatamente o gate da fazenda. Preservar IndexedDB, recibos, auditoria e snapshots;
gate OFF não desfaz escrita já aceita nem aprovação global.
Corrigir forward-only, conferir história efetiva e reconciliar; reabrir apenas a janela/allowlists
necessárias à drenagem e repetir os mesmos IDs. Não marcar manualmente synced,
não limpar IndexedDB, não resetar banco, não remover testes e não reaplicar migration às cegas.
Falha parcial de aplicação/deploy exige conferir cada objeto/versão antes do próximo passo.

## Validação desta entrega

- 170 testes distintos em oito arquivos, sendo 154 nos seis arquivos sanitários/C2C: validateLotEditForm (55), buildLotEditOperations (26),
  resolveLotEditCosts (43), backend-environment (9), sanitario-v2-deployment (13), sanitarioV2Cutover (8).
  Mais 16 testes após integrar o PR #217: AppShell (4) e AppShellNavigation (12), todos aprovados.
  Checklist React revisou foco, refs/hooks e callbacks mobile; lint focado também passou.
  Foram observados avisos de React Router e Radix sobre título/descrição do diálogo no shell incorporado,
  sem correção lateral nesta tarefa. E2E de navegação não repetido; evidência nova é unitária/jsdom.
  Os arquivos de preflight/cutover foram repetidos somente após alterações correspondentes.
- Comando: `node node_modules/vitest/vitest.mjs run` seguido desses caminhos.
  C2C valida normalização/erros do form; preflight testa alvo/chave/contexto/TLS/override;
  cutover testa default OFF, decisão separada, endpoint divergente e modo production bloqueado.
- ESLint focado nos scripts/testes, helper C2C e cutover passou.
- Fallow audit --base e71670bda3e0319cff4e1dcd9e099a894707bcca --gate new-only:
  passou após separar os predicados de destino; nenhum achado introduzido. Avisos de resolução da junction
  e achados herdados permanecem registrados, sem alterar dependências/config do Fallow.
- Build Vite --mode development com endpoints loopback/chave sintética passou.
  Avisos de Browserslist antigo, imports mistos e chunk grande observados.
  Build padrão falhou antes de compilar pela ausência de URLs/ambiente neste worktree;
  não é certificação de build produtivo ou de preview real.
- prepare-sanitario-homologation.mjs --validate passou: 63 migrations, candidato 7/7/6 preservado;
  o integrated_main=86c802a informado por esse gerador é a base anterior fixada nele, não a main atual.
- validate-supabase-baseline-functional.mjs recusou execução antes de conectar:
  exige banco explicitamente descartável. Não se removeu essa proteção nem se usou banco de outra tarefa.
- pnpm exec recusou a junction de node_modules antes de instalar. Usados binários existentes diretamente;
  não houve instalação ou mudança de lockfile.
- Não repetidos os 482 testes, 17 cenários Supabase/Chromium ou 11 PostgreSQL anteriores.
  Não houve novo ensaio remoto de RLS, dry-run de migration remoto ou smoke A/B.
- Snapshot e hashes foram produzidos de consultas somente de leitura; segredos não integram os artefatos.
- Gates documentais executados pelo launcher do repositório passaram: headers, continuidade e contratos de governança.

Gate final do patch local: **READY WITH CAVEAT**, limitado à integração, proteção de destino e preparação.
Os arquivos tracked/untracked desta entrega foram inspecionados; nenhuma migration, RPC ou Function foi editada.
**NOT READY para executar a implantação**, enquanto inventário de filas, recuperação, credenciais e autorizações
não estiverem vinculados. A equivalência integral do schema remoto não foi certificada.

## Autorizações ainda necessárias

Destino de todas: **RebanhoSync / zqloazqzhwauamcejmuz / org zrcfplrzfpmihemqaemj**.
Cada linha é independente e continua não autorizada.

| ID | Escopo e alterações previstas |
|---|---|
| R01 | Aplicar somente as três migrations/hash acima, em ordem; criar referências/triggers/RPCs e ampliar ledger; gates OFF, sem seed/importação. Condição anterior à execução: inventário dos clientes e recuperação disponíveis |
| R02 | Deploy somente de sync-batch e fechamento do snapshot, JWT ON, mantendo secrets e demais Functions |
| R03 | Promoção local auditada do candidato e importação transacional dos 20 rascunhos e dependências; zero aprovação/automação |
| R04 | Concessão administrativa global exclusivamente à conta `0f00a75c-32a9-4555-a840-cb0f13f2d3f7`, seguida de cinco decisões curatoriais para exatamente sete itens; sete comerciais e seis restrições preservados |
| R05 | Criar somente a fazenda Homologação Sanitário V2 e vincular farm/usuários/clientes/vigência, liberar cliente controlado local, ativar plano e gate somente nessa farm e executar smoke A/B; sem deploy público |

**Próximo pedido: R01**, com a lista e hashes fechados acima.
A ausência de acesso às filas é pendência explícita anterior à execução, e não autorização presumida.
R04 depende da autorização de superadmin para a conta identificada; R05 depende da criação autorizada da
fazenda nominal e vinculação dos IDs ainda inexistentes. Essas vinculações não bloqueiam o preflight atual.
Nenhuma Rxx autoriza as demais.
