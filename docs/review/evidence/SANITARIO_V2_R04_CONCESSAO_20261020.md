# R04 — concessão administrativa executada

**Concessão concluída; cinco decisões curatoriais ainda não submetidas.**

Projeto `zqloazqzhwauamcejmuz`, branch `codex/sanitario-v2-convergencia`, baseline
`d6f902d17f4b7f59c0e0115dfcea08f6b3665cda`, worktree inicialmente limpo.
A autorização administrativa explícita do usuário em 20/10/2026 cobre somente a conta
`0f00a75c-32a9-4555-a840-cb0f13f2d3f7` e reconhece os poderes globais até revogação.
Não autoriza aprovações automáticas.

## Alteração remota observada

- Uma linha em `public.app_superadmins`, exclusivamente para o UUID autorizado.
- Uma linha append-only em `public.app_admin_audit_events`, ação `APP_SUPERADMIN_GRANTED`,
  ID **`9fdb61b5-11ca-455c-b262-34fbbc312670`**.
- Referência da autorização: `R04_ADMIN_AUTHORIZATION_20261020`.

Foi seguido o bootstrap já previsto em `20260824100000_app_superadmin_foundation.sql`.
O [SQL operacional](../../../scripts/codex/grant-sanitario-r04-superadmin.sql) insere o
vínculo e a auditoria em uma transação, com lock e guardas de baseline/preservação.
O dry-run remoto terminou em ROLLBACK e confirmou zero linhas persistidas. A aplicação
terminou em COMMIT; repetir o mesmo pedido preservou **uma concessão e uma auditoria**.

A execução usou a API administrativa existente, sem CLI, sem nova credencial e sem
`SET ROLE authenticated`, `set_config` ou alteração de claims. A auditoria informa
expressamente que `actor_user_id` referencia a conta identificada pelo humano como
própria e autorizadora nesta conversa; **não afirma autenticação Supabase ou assinatura
eletrônica do curador**. `created_by` permanece NULL porque o operador administrativo
não tem sujeito Supabase Auth. Executor, canal e `auth.uid()` NULL foram registrados.

## Verificação

- A conta existe no Auth; há exatamente um superadmin, o UUID autorizado.
- Os grants existentes permitem a `authenticated` consultar o próprio vínculo e executar
  `is_app_admin`, preview e decisão. A função `is_app_admin` consulta o vínculo pelo
  `auth.uid()` real. Sua execução na sessão real do curador ainda está pendente.
- Catálogo preservado por digest na transação: 20 itens draft, zero itens automáticos e
  zero protocolos aprovados. Nenhuma `SANITARY_RULE_DECISION_V2` foi registrada.
- Gates OFF; três Eventos anteriores preservados; zero Agendas V2/legadas e estoque.
- Nenhuma migration, deploy, importação, criação de usuário/fazenda ou execução R05.
- O pacote R04 original conserva o SHA256
  `7978961233575379fa351a9e3d1cbbd093443ed0dd44367890e733dd4e203771`.

Evidências estruturadas: [concessão e recibo](SANITARIO_V2_R04_CONCESSAO_20261020.json).
Não foi repetida a regressão anterior: o teste relevante desta operação foi a própria
transação remota com rollback, aplicação, replay e leitura independente dos resultados.

## Cinco seleções prontas para revisão manual

O frontend publicado não contém a aba curatorial da branch; foi conferido também seu
chunk administrativo, sem encontrar os callers curatoriais. Nenhum deploy foi feito.
Foi iniciado o Backoffice existente da branch, somente em loopback:
**[Backoffice local](http://127.0.0.1:5184/admin)**.
API e Functions apontam ao mesmo projeto autorizado, em `controlled-homologation`, com
digest da configuração pública conferido e `client_rollout_enabled=false`.
As rotas `/admin` e o módulo curatorial responderam HTTP 200. Nenhuma credencial foi salva
em arquivo; a configuração pública foi fornecida apenas ao processo local.

| Grupo | Seleção exata | Versão do item | Escopo da avaliação |
|---|---|---:|---|
| B19 | b19_femeas_3_8_meses | 3 | Avaliação genérica; contexto de UF e exclusão de SC preservados |
| PAR | recria_maio, recria_julho, recria_setembro | 2 | Manejo genérico contextual limitado ao DF |
| DES | pre_desmama_situacional | 2 | Manejo genérico contextual limitado ao DF |
| CONF | pre_confinamento_dose_unica | 2 | Manejo genérico contextual limitado ao DF |
| PARTO | matrizes_pre_parto_antiparasitario | 2 | Manejo genérico contextual limitado ao DF |

Todas as cinco versões de protocolo são v1. Não há seleção de produto, dose, via ou
carência. Fontes, IDs e condições constam nas
[seleções estruturadas](SANITARIO_V2_R04_REVISAO_MANUAL_20261020.json).

**Essas seleções não são resultados de preview da RPC.** Digests e blockers reais ficam
pendentes até a chamada autenticada. Nenhum resultado ou assinatura foi fabricado.

Para continuar: entrar no Backoffice com a conta autorizada, abrir **Curadoria sanitária**,
selecionar o protocolo e os itens exatos e clicar **Revisar conteúdo e fontes**.
Conferir conteúdo, fontes, versões, digest e `blockers=[]`. Não publicar antes da
confirmação explícita de cada decisão e de sua justificativa. O publicador existente
preserva o `request_id` da intenção confirmada nos retries; os IDs do pacote anterior
continuam propostos, sem execução. Não inserir comandos pendentes no navegador por fora
desse fluxo.

A aprovação futura pela RPC tornará os sete itens ativos e alterará seus flags globais
de catálogo, mantendo gates por fazenda OFF. Os sete comerciais e os seis restritos
permanecem excluídos. O estado atual da R04 é **parcial: administração concluída,
revisão/decisões autenticadas pendentes**. R05 continua não autorizada.
