# R04 — curadoria sanitária concluída

Atualizado em: 2026-10-20
Status: **R04 CONCLUÍDA — cinco decisões aprovadas e persistidas**.

Projeto `zqloazqzhwauamcejmuz`, branch `codex/sanitario-v2-convergencia`, baseline local
`0583d7690abfc595d9cec7e6e4fe6522e554746f`, worktree inicialmente limpa.
O proprietário autorizou expressamente os cinco conjuntos e digests na conversa atual.
O pacote original conserva SHA256 `7978961233575379fa351a9e3d1cbbd093443ed0dd44367890e733dd4e203771`.

## Administração e execução autenticada

A concessão já existente foi preservada: somente `0f00a75c-32a9-4555-a840-cb0f13f2d3f7`,
auditoria administrativa `9fdb61b5-11ca-455c-b262-34fbbc312670`.
O Backoffice local foi acessado autenticado; `supabase.auth.getUser()` confirmou esse UUID
e `is_app_admin()` retornou true. Nenhum novo privilégio foi concedido.

O [executor operacional local](../../../scripts/codex/sanitario-r04-session.html) foi necessário
para conservar os request_ids preparados, pois o botão atual do Backoffice gera outro UUID.
Ele usa a mesma origem `http://127.0.0.1:5184`, o mesmo cliente Supabase e os exports do
publicador existente; não modifica a interface React, RPCs, RLS, schema, regras técnicas ou rollout.
Não houve exportação de credenciais, simulação de JWT ou identidade via SQL administrativo.
As escritas curatoriais passaram exclusivamente pela RPC autenticada canônica.

## Recibos persistidos

Todos os protocolos são v1. As referências completas são `sanitary-v2:<request_id>`.
Cada request_id também é o ID da auditoria `SANITARY_RULE_DECISION_V2`.

| Conjunto | Itens aprovados | request_id / auditoria | Data/hora do servidor (UTC) |
|---|---|---|---|
| B19 | `b19_femeas_3_8_meses` v3 | `f3853908-6139-46d6-8861-0ad317a9370f` | 2026-10-20T07:16:53.232818Z |
| PAR | `recria_maio`, `recria_julho`, `recria_setembro`, v2 | `ea3a973d-bce4-4235-9e6a-a1041f28d78d` | 2026-10-20T07:16:53.812361Z |
| DES | `pre_desmama_situacional` v2 | `6ec6ef7f-c856-4b8c-9c13-402cc5ce2e0f` | 2026-10-20T07:16:54.247240Z |
| CONF | `pre_confinamento_dose_unica` v2 | `944b6b41-a67f-4634-b241-f7825ce1d47a` | 2026-10-20T07:16:54.649172Z |
| PARTO | `matrizes_pre_parto_antiparasitario` v2 | `ee6b3e75-493e-4cb2-9a91-c6aef53847b2` | 2026-10-20T07:16:55.038836Z |

Entre 04:16:53 e 04:16:55 de 20/10/2026 em America/Sao_Paulo.
Os IDs completos dos sete itens, digests, justificativas integrais, fontes e recibos estão
na [evidência estruturada](SANITARIO_V2_R04_EXECUCAO_20261020.json).

Cada preview real foi reconferido imediatamente antes da decisão: IDs/versões previstos,
digest exatamente confirmado e `blockers=[]`. B19 preserva exclusão de SC e exceção de
obrigatoriedade em UF risco A. Os demais seis itens são avaliações genéricas condicionais no DF,
com as limitações da fonte Embrapa preservadas; cobertura parcial não foi convertida em
autorização para produto, dose, via, janela individual de aplicação ou carência.

## Verificação observada

- Cinco decisões, cinco auditorias, sete itens ativos e `allows_agenda_auto=true` nas versões previstas.
- Ator real, justificativas integrais, timestamp, request_id e recibo conferidos por leitura SQL independente.
- Os cinco pedidos foram repetidos autenticados com o mesmo request_id/conteúdo: recibos idênticos.
  Persistiram somente cinco decisões, sem versões ou recibos duplicados.
- O SHA256 de `state_before::text` de cada auditoria coincide com o digest confirmado.
  O conteúdo integral revisado permanece persistido em `app_admin_audit_events.state_before`.
- Os treze itens excluídos permanecem integralmente iguais ao snapshot anterior, inclusive IDs,
  versões, status, fontes, flags e restrições: sete comerciais, três de raiva, dois de aftosa e LEP2.
- Gates OFF: zero linhas habilitadas, tabela de gates vazia e inalterada.
  `config/backend-targets.json` conserva `client_rollout_enabled=false`.
- Agendas legadas/V2 e estoque: zero antes/depois. Eventos: os mesmos três, com digest integral preservado.
  Detalhes sanitários: zero. Carências ativas: zero. Campos técnicos dos sete itens não foram atribuídos.
- 63 migrations preservadas por contagem e digest; `sync-batch` ACTIVE v28, JWT verificado e mesmo digest de pacote.
- Nenhuma fazenda criada; nenhuma migration, importação, deploy, push, merge ou execução R05.

Aprovação global torna os sete itens elegíveis ao planejamento condicional; não ativa plano
de fazenda nem materializa Agenda. Não representa aplicação sanitária ou comprovação profissional.

Validação proporcional: cinco previews + cinco decisões + cinco replays reais e consultas SQL
independentes de persistência, auditoria, unicidade, invariantes e preservação integral.
As suítes R01–R03, build e regressão global não foram repetidos, pois seus contratos não mudaram.

Verificação local final: integridade JSON/recibos, correspondência dos IDs/versões com o pacote,
SHA256 original, sintaxe do módulo operacional e rollout OFF aprovados por assertions Node.
Links locais conferidos e `git diff --check` sem erros. Gate proporcional: **READY**.
O patch local contém somente o executor operacional, evidências, ponteiro de atualização do
snapshot anterior e roteiro R05; nenhum arquivo de runtime do aplicativo foi alterado.

R04 não tem impedimento remanescente. A [R05 está preparada](../SANITARIO_V2_R05_HOMOLOGACAO_AB_20261020.md),
sem execução ou autorização implícita de gate/fazenda/smoke.
