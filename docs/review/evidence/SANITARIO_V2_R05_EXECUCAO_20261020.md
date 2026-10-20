# R05 — execução e fechamento da homologação A/B

Data: 2026-10-20. Classificação operacional: **CLOSED** no escopo desktop A/B autorizado.
Base: `b4589608e6d94d938915aab435276cc138268b55`, branch `codex/sanitario-v2-convergencia`.
Projeto existente: `zqloazqzhwauamcejmuz`. A autorização específica R05 foi fornecida pelo proprietário.
Não há autorização de rollout público, R04B, push, merge, migration ou deploy decorrente deste resultado.

## Ambiente e identidade verificados

- Fazenda criada pela UI autenticada e RPC canônica `create_fazenda`: **Homologação Sanitário V2**,
  `2d8a30d9-bd9c-41b4-a71d-93d2d293058f`, código `HOMO-SANV2-R05`, Brasília/DF.
- Principal `0f00a75c-32a9-4555-a840-cb0f13f2d3f7` verificado por Auth e membership `owner`.
  O superadmin já existente não foi usado como substituto de membership.
- A: Chrome, perfil Joao Paulo, `browser:fb597b8f-9dc0-407c-892d-1436c0e831ce`.
- B: navegador integrado independente, `browser:55766748-d1c7-44a0-9938-46f74d5fbfbd`.
- Mesma origem `http://127.0.0.1:5184`; filas/obrigações inicialmente vazias e preservadas.
  Catálogo e cutover APPLIED pelos serviços canônicos nos dois perfis, sem marcação manual.
- Três animais sintéticos preservados: fêmea/macho bovinos de seis meses e matriz adulta.
  IDs, payloads de homologação e ACK estão nos exports. Nenhuma aplicação ou fato reprodutivo foi registrado.

## Matriz observada

| Cenário | Resultado e evidência |
|---|---|
| Plano offline A | Plano revisão 1 e sete Agendas persistidos no Dexie, oito operações pendentes; consulta independente ainda sem plano/Agendas remotos. Falha de transporte injetada antes do envio. |
| Reconnect e B | Worker canônico aceitou as operações; B puxou os mesmos sete IDs. Filas e obrigações zeradas. |
| Lost ACK | Resposta real retida após sucesso remoto; retry com envelope e resposta inteiramente idênticos, um único recibo/efeito. |
| Concorrência | A/B partiram da revisão 2; B venceu, A recebeu SANITARIO_PLAN_REVISION_CONFLICT e reconciliou para revisão 3. Rejeição terminal preservada. |
| Cancelamento | Agenda CONF `2b9e8f06-e304-5e47-9bf4-3d3856794f31` cancelada por B e convergente em A; nova geração criou zero e não a reabriu. |
| Reagendamento | Agenda B19 `77c1f16e-8452-5cf5-a245-73b0168b8e17` movida para 2026-10-23; data e revisão 1 iguais em A/B/remoto. |
| Crash/restart | Aba A encerrada após aceitação remota e antes do ACK; mesma origem/perfil recuperou SYNCING e IDs, fez replay com mesmo envelope/recibo e convergiu para revisão 4. |
| HTTP 401 | Uma requisição sem Authorization recebeu 401 real; SDK renovou sessão e reenviou o mesmo envelope com sucesso, revisão 5. Esse caso foi distinguido da expiração natural. |
| JWT naturalmente expirado | Operação B original atravessou vencimento real do token, TOKEN_REFRESHED do SDK e aceitação única após refresh, revisão 6; fila/obrigações finais zero. |
| Farm-switch | Troca para fazenda já pertencente ao principal com intenção pendente preservou o digest integral da fila; retorno à fazenda de teste sem escrita externa. |
| Clientes antigos | Operação no formato legado de configuração sanitária foi traduzida para set_automation_plan sem trocar client_op_id, client_tx_id ou domain_op_id; ACK e convergência observados. |
| RLS | Sessão real vê membership owner da fazenda dedicada; consultas à fazenda existente de outro owner retornam vazio. Existência externa confirmada independentemente. |
| Elegibilidade | Sete versões revisadas no preview real; geração condicional de sete Agendas a partir de quatro regras elegíveis. PAR permaneceu negativo no calendário atual. |
| Negativos | Macho excluído de B19; cópia de fonte de preview com UF SC gerou zero, sem persistir fazenda/contexto SC; os treze itens sem autorização geraram zero. |
| Domínio e isolamento | Zero Eventos, estoque e carências ativas na fazenda de teste; snapshots de 49 tabelas fora dela iguais ao baseline. |

As sete Agendas não equivalem a sete itens distintos aprovados: B19 produziu uma, DES duas,
CONF três e PARTO uma. PAR (três regras) foi exercitado como inelegível no mês/contexto atual,
sem adulterar a data para forçar geração. Contextos de pré-desmama, destino e pré-parto são
explicitamente sintéticos e não constituem execução, diagnóstico, parto ou movimentação factual.

## Recibos e auditoria

| Caso | client_op_id original | Recibo persistido no ledger |
|---|---|---|
| Lost ACK | `83700b33-714a-4909-a466-5f57e76b7fe6` | `4d09c598-1f9e-43a5-8433-641c9a146ce2` |
| Interrupção/restart | `bd34103a-86e1-461b-bfad-0dbcdfee4b58` | `3521f83b-feea-421a-8bf5-81ac856c6acf` |
| Expiração natural | `a6f0d754-efdc-4b70-8baa-c73c5cadbca6` | `a7e0004f-9f9e-4734-995a-68beff54a1fe` |

No caso natural, intent criado às 14:10:13Z, token original vencido às 15:06:20Z,
TOKEN_REFRESHED às 15:35:31Z e aceitação remota às 15:37:15.750404Z, sempre com o principal real.
O `client_tx_id` original é `2319bc7c-cabc-4e74-941f-0b257c8b0a2e`.
O snapshot de expiry-resume capturou processamento concorrente ainda SYNCING; os inventários
posteriores e o recibo remoto comprovam a conclusão. O verificador exige essa convergência posterior.

O ledger final contém **15 linhas / 15 client_op_ids distintos**, correspondentes às operações
aplicadas. O conflito e a rejeição controlada descrita abaixo foram preservados separadamente
em queue_rejections e nos snapshots locais; não compõem essas quinze linhas do ledger.
Há **sete Agendas / sete dedup_keys distintos**, seis programadas e uma cancelada,
mais um encerramento de cancelamento sem Evento.

Auditorias do gate:
- abertura inicial: `6e449ad2-6068-4556-87c2-c67ecd83b567`, 12:24:09Z;
- contenção durante espera: `9b39a07e-4da3-4a11-89c1-7df3ba75bb0c`, 12:36:12Z;
- reabertura exclusiva para JWT: `f27c5fd1-4f93-4e15-a9c7-251c810673ec`, 15:37:04Z;
- fechamento definitivo: `af599e4f-c1dc-4a79-ac09-251ab4d74560`, **15:38:29.3427Z**.

Gate configurado exclusivamente para esta fazenda, principal e client_ids A/B, contrato min/max 2,
rollout 100% restrito às allowlists, janelas máximas de vinte e dez minutos.
Operação administrativa via Management API foi auditada como tal, com database_auth_uid nulo;
as operações funcionais usaram a sessão real do proprietário.

## Falhas observadas e correções limitadas

Uma primeira tentativa de expiração natural sofreu interferência de outro contexto/worker do mesmo
perfil: a operação `904383cd-8daf-490c-b315-288348dd1595` foi enviada com gate OFF e recebeu
SANITARIO_SYNC_DISABLED. A rejeição foi preservada e não foi contada como teste aprovado nem reenviada.
Após pull canônico, nova intenção foi protegida pelo lock canônico do gesto e pelo lock de Auth do SDK,
permitindo observar o vencimento real sem adulterar JWT, relógio ou identidade. Gate permaneceu OFF
durante a espera. Nenhum patch no runtime do aplicativo foi necessário.

O runner B também precisou ser recarregado no mesmo perfil no fechamento; manteve client_id,
evidências e estado persistido, e o novo inventário confirmou fila zero e push OFF.
A causa da longa interrupção de tempo durante a espera não foi determinada.

## Validações e fechamento

- Consulta independente final às **21:35:08.554797Z**: gate OFF, plano 6, sete Agendas únicas,
  quinze operações únicas, zero Eventos/estoque/carências e 63 migrations.
- As vinte linhas completas do catálogo permanecem idênticas ao snapshot pós-R04:
  **cinco decisões / sete itens autorizados / treze preservados sem autorização**.
- `sync-batch` ACTIVE **v28**, verify_jwt=true, pacote SHA256
  `21aa82b9c7c6b41510a93670bab919c9a65362d04d51196913397c106f1809a0`.
- A/B finais: plano revisão 6 e mesmas Agendas/status/datas/revisões; push OFF, operações
  e obrigações pendentes zero. Rejeições terminais foram preservadas como auditoria.
- Rollout local `config/backend-targets.json` restaurado para **false**, sem diff final.
  Plano sintético enabled=true permanece como evidência; gate e push OFF impedem a continuação do sync.
- `node scripts/codex/verify-sanitario-r05-evidence.mjs`: **33 assertions observadas**,
  sem rede/escritas remotas, incluindo SHA256 dos dois exports comprimidos.
- Vitest focalizado: **52 testes distintos aprovados em cinco arquivos**:
  sanitarioV2Worker (11), sanitarioV2PullCutover (10), sanitarioV2Cutover (8),
  sanitaryAutomaticGenerationV2 (18), sanitaryPlanningSyncV2 (5).
- A tentativa inicial com pnpm não executou testes por ERR_PNPM_UNSAFE_MODULES_DIR;
  o node_modules é compartilhado com outro worktree e não foi alterado.
  Primeira execução direta teve 28 passes, uma falha por rollout temporariamente ON e duas suítes
  sem coleta por falta de configuração VITE no processo. Somente os três arquivos afetados foram
  repetidos com rollout OFF e configuração pública fictícia de localhost:1: **31/31**.
- Não foram repetidas suítes R01–R03, regressão global, build ou deploy: nenhum contrato/runtime
  do aplicativo foi alterado. Sintaxe dos dois scripts, links locais e git diff --check passaram.
- Gate local de entrega: **READY**. Os sete arquivos (tracked, staged e novos, inclusive exports
  descomprimidos) foram inspecionados; o diff final contém somente executor/verificador operacional,
  evidências e documentação. Nenhum arquivo de runtime, schema, RLS ou RPC foi alterado.

Evidências sanitizadas: [cliente A](SANITARIO_V2_R05_CLIENT_A_20261020.json.gz),
[cliente B](SANITARIO_V2_R05_CLIENT_B_20261020.json.gz) e
[leituras remotas, hashes e auditoria](SANITARIO_V2_R05_REMOTE_20261020.json).
O executor local está em [sanitario-r05-session.html](../../../scripts/codex/sanitario-r05-session.html).
Os arquivos são evidência de homologação, não habilitação do produto nem fonte paralela de domínio.

## Limites e próximo trabalho

Fato confirmado: homologação em dois perfis desktop com backend real e interrupção de aba/contexto.
Não foi testado encerramento do processo do sistema operacional, aparelho físico Android/iOS ou
binário antigo; compatibilidade antiga foi exercitada pelo formato de fila legado.
RLS negativo foi leitura autenticada; nenhuma escrita em fazenda alheia foi tentada.

Não há bloqueador remanescente da R05 neste escopo. Dados sintéticos, recibos e auditorias preservados.
Próximo trabalho independente: **R04B — revisão dirigida dos treze itens restantes**, priorizando
os sete comerciais e respectivas fontes/condições técnicas. **Não executada**; exige suas próprias
decisões, previews e autorizações, sem inferir liberação a partir da homologação R05.
