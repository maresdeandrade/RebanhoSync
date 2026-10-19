# Sanitário V2 — homologação local e convergência

Atualizado em: 2026-10-19

Classificação: **READY para homologação local**. Implementação preparada para ambiente isolado. Nenhuma aprovação operacional,
importação remota, migration remota, push, merge ou deploy foi executado.

## Checkout, integração e artefatos

- Base desta alteração: `43f2360449322d1e5dfdbf3671a56d6fba1ab9a3`.
- Worktree: `C:/Users/mares/.codex/worktrees/sanitario-v2-convergencia/GestaoAgro`;
  branch `codex/sanitario-v2-convergencia`, criada a partir da implementação existente.
- Ancestral comum com main: `b748a5941d513ef3a293e5e8a98f31eb051dfeb6`.
  Main remota observada: `350955f91c2b06859ba7d093926d3f5b27389b86`;
  os dois commits adicionais são o ajuste UX05 de rodapés e seu merge PR #214.
  Não há interseção entre seus arquivos e este patch. Eles não foram integrados;
  os oito commits sanitários anteriores continuam na ancestralidade local.
- A worktree anterior `sanitario-v2-plano-auto`, branch
  `codex/sanitario-v2-aprovacao`, conserva a edição concorrente do formulário schema 2.
  SHA256 desse arquivo: `ad912cdb6830233646c6ab4f0fadbb9ca740378aba4a90e103930dc343783388`.
  Ele não foi sobrescrito nem incorporado.
- O formulário versionado em 43f2360 é schema **3**; o pacote de decisões é schema
  **4**. Hash do candidato compilado:
  `2b3adab34d0eb58dcc5d8fa976d1cd852d41f204e00063b776e2271d60753fe6`.
  Hash do pacote:
  `f7dcda6d73f917177b1f5f358d7c2dae9db289b3b2839ebc7590c5698359c185`.
  O formulário schema 2 usa candidato antigo e protocolo v2; o contrato atual preserva
  protocolo v1 e versiona os itens físicos. Não são formulários intercambiáveis.
  A versão 2 do transporte sanitário é outro contrato, sem relação com esses schemas.

O payload operacional e o pacote/formulário de curadoria permanecem inalterados.
O publicador eletrônico e o motor existentes foram reutilizados.

## Ambiente e consumidores confirmados

Inventário remoto somente de leitura, observado em 17/10. Projetos acessíveis e
catálogo/RPCs de revisão foram reconferidos em 19/10, sem alteração:

- Supabase `zqloazqzhwauamcejmuz`, nome RebanhoSync, região sa-east-1,
  banco `db.zqloazqzhwauamcejmuz.supabase.co`, PostgreSQL 17.
- O frontend publicado em `https://rebanho-sync.vercel.app` usa esse projeto
  tanto para API quanto para `/functions/v1`. Bundle observado:
  `/assets/index-CRuIO9TT.js`, SHA256
  `94639b1a09b5556e82ab05de85acf0f0bc4fb2e391831805a11204ef857c65c6`.
- Projeto Vercel `rebanho-sync`, produção
  `dpl_82he2zdpCiSDXBF3L33eSKeaRPYU`; aliases de projeto, equipe e git-main
  apontam ao mesmo deployment observado.
- Functions: `sync-batch` v27, `test-auth` v5, `telemetry-ingest` v2 e
  `sanitario-reconcile` v4. A única branch Supabase acessível era a branch principal.
- Banco: consumidores PostgREST, pg_net, pg_cron e postgres_exporter observados.
  O job `metrics-events-retention-daily` estava ativo, cron `0 3 * * *`, sem
  destino HTTP na configuração consultada.
- No catálogo desse backend: **zero protocolos, zero itens e zero permissões auto**;
  as RPCs de curadoria e de convergência desta trilha ainda não estavam instaladas.
  Os 20 itens são artefatos canônicos locais, não 20 registros já importados.

Nenhum projeto exclusivamente de homologação foi encontrado entre os projetos
acessíveis. Isso não inventaria consumidores externos ou contas sem acesso ao conector.
O backend acima é produção e não será usado como staging.

`config/backend-targets.json` mantém a lista de homologação remota vazia.
A build verifica endpoint API/Functions, papel do ambiente, project-ref e hash da
chave pública. Produção rejeita homologação, loopback e credencial não registrada;
`VERCEL_ENV=production` continua protegido mesmo com outro modo Vite.
O exemplo local está em `.env.homologation.example`, sem credenciais.

## Contrato implementado

- Plano: writer existente → fila existente → adaptação do payload imutável →
  `set_automation_plan` → RPC service-role privada com membership/gate e CAS de
  revisão/conteúdo → ledger existente → ACK e pull.
- Agenda: a mesma identidade de intenção produz UUID estável nos clientes.
  `create_agenda` deduplica dispositivos e valida versão publicada/plano ativo.
- Reagendamento/cancelamento: comandos canônicos com revisão esperada, dependências
  locais, recibos idempotentes e preservação do estado canônico. Cancelar não registra
  procedimento executado.
- Pull: proteção do plano por PK `fazenda_id`, dos alvos/Agendas e dos envelopes
  antigos via gesto; cursores protegidos até instalação do resultado.
- A migration `20261017195545_sanitario_planning_convergence_v2.sql` estende o
  ledger existente, acrescenta duas RPCs e protege a escrita do plano. Não contém
  seed, concessão de aprovação, novo motor ou nova store.

As operações UUID antigas continuam aceitas sem exigir regravação da fila.
Atualização de perfil não é confundida com edição de plano. Shape ambíguo não é
reescrito silenciosamente. Agendas históricas de ID textual permanecem locais;
não há alegação de sincronização ou migração automática desses registros.

## Conjuntos e versões preparados

| Conjunto | Itens | Estado para revisão |
|---|---:|---|
| B19 | 1 | Pronto: avaliação genérica; conformidade profissional/produto na execução |
| PAR | 3 | Prontos: avaliações regionais DF, calendário individual 5/7/9 |
| DES | 1 | Pronto: avaliação pré-desmama com contexto intensivo/leiteiro ou referência técnica |
| CONF | 1 | Pronto: avaliação pré-confinamento, data e animais no plano |
| PARTO | 1 | Pronto: avaliação pré-parto, contexto reprodutivo e alvos no plano |
| CLO | 3 | Pendentes de evidência comercial específica; sem aprovação |
| LEP | 2 | Pendentes de evidência comercial específica; sem aprovação |
| IBR | 2 | Pendentes de evidência comercial específica; sem aprovação |

São **7 prontos**, em cinco decisões globais possíveis; PAR reúne três itens.
Os outros sete candidatos comerciais continuam pendentes. Raiva conserva três
itens consultivos com `no_agenda_auto`; aftosa conserva dois bloqueios, e LEP2
canônica conserva seu bloqueio específico. Total contemplado: **20 itens**.
IDs, versões, fontes e exigências continuam no
[formulário schema 3](SANITARIO_V2_APROVACAO_PENDENTE_20261017.json).
Não é necessário identificar veterinário ou fazenda para a decisão global.

## Evidência observada

O harness `node tests/codex/sanitario-v2-review.supabase.mjs --convergence`
cria um projeto local novo, API/Functions loopback 55421 e banco 55422, com usuários
sintéticos. Dois contextos Chromium independentes usam Auth, IndexedDB e localStorage
próprios, módulos reais do aplicativo, worker, pull, Edge, RPCs e PostgreSQL.
Não simula o transporte nem injeta flags de aprovação no cliente.

[Resultado Chromium/Supabase](SANITARIO_V2_CONVERGENCIA_TESTES_20261019.json):
**17 cenários aprovados**, sete IDs de itens gerados automaticamente, primeiro
conjunto de cinco Agendas convergente entre A/B e janelas restantes nos meses próprios.
Inclui plano offline/reabertura/reconnect, colisão de UUID/dedup, 13 tentativas
automáticas recusadas, perda de ACK após commit, JWT realmente expirado + refresh,
falha inserida após UPDATE com rollback transacional, retry único, cancelamento,
reagendamento, troca de fazenda, CAS de revisão e conteúdo e isolamento RLS.
Planejamento produziu **0 Eventos, 0 detalhes factuais e 0 movimentos de estoque**.
Os ambientes próprios foram descartados.

Testes focados: **467 aprovados** na bateria principal; os 15 inicialmente
condicionados à fixture publicada foram executados separadamente com
`SANITARIO_APPROVED_CATALOG` apontando para a saída real do harness PostgreSQL:
**15 aprovados**, total **482 testes distintos observados**.

Publicador: **11 cenários PostgreSQL aprovados** no harness
`node tests/codex/sanitario-v2-review.postgres.mjs`, incluindo RLS, hash/versão,
corrida de revisores, lost ACK, falha parcial e seis restrições.
Essa execução foi observada em 17/10; não foi repetida sem mudança no publicador.

Lint dos arquivos afetados passou. Fallow passou contra o baseline exato 43f2360,
`--gate new-only`, com **zero achados introduzidos**. A base origin/main também
inclui a trilha sanitária anterior; por isso não foi usada para atribuir este patch.
Build Vite de homologação passou, e a tentativa de build de produção com o backend
local foi recusada antes do bundle. Há avisos de Browserslist e chunking já presentes.
Comandos/resultados resumidos em
[manifesto da entrega](SANITARIO_V2_HOMOLOGACAO_20261019.json).

## Sequência remota — preparada, não executada

1. Autorizar e provisionar **novo projeto Supabase exclusivo**, na organização
   pretendida. Registrar ref, endpoints, consumidores e responsável pelo ambiente;
   não usar a branch ou o banco de produção como homologação.
2. Registrar esse ref e o hash da sua chave pública no manifesto de backend; configurar
   preview/homologação com os três endpoints/variáveis do exemplo e sem service-role
   no frontend. Validar build no modo homologation e manter a proteção de produção.
3. Após autorização da migration no projeto exclusivo, inspecionar
   `supabase db push --project-ref <REF_ISOLADO> --dry-run --skip-vault`.
   Aplicar o conjunto revisado com o mesmo comando sem `--dry-run`.
   Credenciais somente por canal seguro, sem URL persistida ou log de segredo.
4. Autorizar separadamente o deploy de `sync-batch` no ref exclusivo antes de
   distribuir clientes com os comandos novos. Isolar também as Functions consumidas
   `telemetry-ingest` e `sanitario-reconcile`; `test-auth` é consumidor inventariado,
   não uma condição de aprovação curatorial. Nenhum frontend pode reapontar produção.
5. Gerar candidato/formulário com o compilador existente e conferir os hashes acima.
   Autorizar a importação de **rascunhos** por digest/ambiente. Somente então preparar
   um commit revisado promovendo o candidato ao payload fixo do importador:
   retirar `review_only`, registrar a autorização de importação e preservar todas as
   permissões sanitárias falsas e `execute_import=false`. Não aplicar o pacote de
   decisões como payload; `--review-candidate --apply` continua proibido.
6. Seguir os gates existentes do importador: validar; dry-run contra o banco exclusivo;
   depois, somente com autorização explícita, `--apply` com
   `ALLOW_SANITARIO_IMPORT=1`, `SANITARIO_IMPORT_CONFIRM=13.0.0-canonical-contract`
   e `ALLOW_SANITARIO_REMOTE_IMPORT=1`. Conferir rascunhos/versões físicas e histórico.
   Não usar a entrada privada de fixture do harness para publicação operacional.
7. No Backoffice, um revisor autenticado já autorizado revisa fontes e hash e decide
   explicitamente B19, PAR, DES, CONF e PARTO, com justificativa e request_id.
   Conferir recibos/auditoria e preservação dos 13 itens não aprovados. Nome/CRMV do
   futuro executor não fazem parte dessa identidade curatorial.
8. Autorizar rollout somente para a fazenda/usuários de homologação após RPCs, Edge e
   clientes compatíveis estarem instalados. Preparar/aplicar o cutover existente,
   confirmar catálogo recebido, ativar o plano pela fazenda e repetir o smoke A/B
   acima com contexto real. Flags locais sozinhas não habilitam escrita.
9. Em falha de publicação/transporte, preservar fila, identidade e auditoria e corrigir
   por evolução forward-only. Desativar novos enqueues/gate se necessário; não
   remover contratos enquanto houver clientes/operações pendentes.

Essa sequência exige autorizações futuras distintas para infraestrutura, migrations,
deploy/importação e a decisão real do revisor. Nenhuma delas foi concedida nesta entrega.
Dois contextos Chromium comprovam clientes independentes locais; não equivalem a dois
aparelhos físicos nem certificam uma homologação remota ainda inexistente.
