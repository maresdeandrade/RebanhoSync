# R05 — Homologação A/B na fazenda dedicada

Atualizado em: 2026-10-20
Status: **PREPARADA — NÃO EXECUTADA; operações remotas ainda exigem autorização específica**.

## Entrada confirmada

A [R04 foi concluída](evidence/SANITARIO_V2_R04_EXECUCAO_20261020.md): cinco decisões autenticadas,
sete itens aprovados, treze preservados, cinco replays idênticos, gates OFF e nenhum efeito de domínio.
Projeto existente `zqloazqzhwauamcejmuz`; 63 migrations; `sync-batch` v28.
Base de código: `0583d7690abfc595d9cec7e6e4fe6522e554746f`, branch `codex/sanitario-v2-convergencia`.
O [preflight vigente, seção R05](evidence/SANITARIO_V2_BACKEND_PREFLIGHT_20261019.md#sequência-de-implantação-condicionada-a-r01r05)
define o procedimento; este roteiro só vincula a R04 concluída e organiza a execução seguinte.

## Vínculos a preencher antes de qualquer escrita R05

| Vínculo | Proposta / estado |
|---|---|
| Fazenda | Criar, quando autorizado, **Homologação Sanitário V2**; UUID ainda inexistente; não reutilizar fazendas reais |
| Usuário(s) A/B | Proposta: conta principal `0f00a75c-32a9-4555-a840-cb0f13f2d3f7`; confirmar owner/manager na nova fazenda |
| Clientes | Dois perfis independentes na mesma origem; registrar dois client_ids reais, ainda não vinculados |
| Origem local | Proposta: `http://127.0.0.1:5184`; manter a origem/perfil durante persistência offline, restart e replay |
| Janela do gate | Início/fim e vigência curta a autorizar; contrato min/max 2; allowlists explícitas de usuários e clientes |
| Dados do smoke | Contexto factual da fazenda e animais de teste elegíveis, a definir na execução; não usar animais de produção |

Não há SQL executável de gate com campos vazios, credenciais, fazenda criada ou configuração alterada nesta preparação.
A autorização para preparar não cobre criar fazenda/animais/membership, ativar rollout/gate ou executar smoke.

## Sequência pronta para execução autorizada

1. Vincular os campos acima e a autorização limitada a essa fazenda, usuários, clientes e janela.
   Criar a fazenda dedicada e os vínculos/dados de teste explicitamente autorizados. Registrar UUIDs e baseline.
2. Inventariar filas, obrigações e cutovers de A/B; preservar IDs e snapshots. Não limpar IndexedDB
   nem migrar IDs textuais. Registrar estado inicial dos dados de produção para comparação.
3. Em mudança local específica da R05, habilitar `client_rollout_enabled` apenas no modo controlado.
   Não fazer deploy nem alterar configuração de Production. Usar API e Functions do projeto autorizado,
   configuração pública por ambiente, sem registrar valores de chaves.
4. Nos dois perfis autenticados, executar o cutover pelos serviços existentes de
   `src/lib/offline/pull.ts` e `src/lib/offline/sanitarioV2Cutover.ts`: puxar catálogo global/técnico,
   animais/configuração da fazenda, aplicar o cutover com o estado remoto e só então habilitar o push local.
   Nunca registrar APPLIED manualmente. Superadmin global não substitui membership owner/manager da fazenda.
5. Offline, preencher contexto explícito e ativar o plano na UI da fazenda. Conferir intenção/fila
   persistida, IDs estáveis e ausência de execução factual. Não adulterar data/histórico para forçar elegibilidade.
6. Somente na janela autorizada, habilitar o gate exclusivo da fazenda com contrato 2,
   allowlists não vazias e rollout 100 restrito a elas. Demais fazendas continuam OFF.
7. Reconectar A/B, executar a matriz abaixo e registrar recibos, revisões, fila, estado local/remoto
   e verificações de isolamento. Os sete itens aprovados não implicam sete Agendas simultaneamente elegíveis.
8. Encerrar enqueues/push e fechar o gate ao terminar a janela autorizada. Preservar recibos,
   auditoria e dados de teste; não excluir dados nem executar rollback destrutivo sem autorização.

## Matriz e critérios de aceite A/B

| Caso | Evidência exigida |
|---|---|
| Plano offline/reconnect | Intenção persistida → fila → ACK → revisão remota e convergência em B |
| Lost ACK/replay | Reenvio do mesmo envelope retorna o mesmo recibo; não duplica plano/Agenda/Evento |
| Concorrência A/B | Mesma revisão: um vencedor; outro recebe conflito e reconcilia sem stale write |
| Cancelar/reagendar | Alteração offline converge em B; materialização não reabre cancelamento nem desfaz data canônica |
| Crash/restart | Reabrir a mesma origem/perfil retoma os mesmos IDs; fila/ledger/recibo íntegros |
| Sessão expirada | 401 não é sucesso; reautenticar e retomar a operação original sem duplicação |
| Farm-switch/outsider | Nenhuma leitura/escrita fora da fazenda autorizada; filas mantêm ownership |
| Limites sanitários | B19 respeita UF/SC/risco A; PAR/DES/CONF/PARTO respeitam DF e contexto; treze excluídos sem automação |
| Domínio | Planejamento só cria intenções de Agenda elegíveis; zero aumento em Eventos, estoque e carência |
| Contenção | Outras fazendas OFF; gate dedicado fechado ao fim; nenhum deploy/import/migration adicional |

Se houver falha, parar novos enqueues e conter o gate, preservar filas/recibos e corrigir forward-only.
Retomar pelos mesmos IDs, sem marcar synced manualmente ou resetar dados.

Nenhum caso desta matriz foi executado nesta preparação. Não há resultado A/B alegado.
