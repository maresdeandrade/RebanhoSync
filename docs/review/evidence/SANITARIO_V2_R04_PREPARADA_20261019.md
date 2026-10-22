# R04 — aprovação curatorial dos sete itens preparada

> Atualização de 20/10/2026: a concessão administrativa foi explicitamente autorizada,
> aplicada e auditada. As cinco decisões continuam pendentes de sessão real e confirmação
> individual. Este documento preserva a preparação original; ver
> [estado da concessão R04](SANITARIO_V2_R04_CONCESSAO_20261020.md).

**Preparação local concluída; R04 não autorizada e não executada.**
As 144 linhas da R03 estão persistidas e convergentes. Não há necessidade de nova rodada
genérica de diagnóstico antes de tratar a decisão curatorial delimitada abaixo.

[Pacote concreto](SANITARIO_V2_R04_PREPARADA_20261019.json), SHA256
`7978961233575379fa351a9e3d1cbbd093443ed0dd44367890e733dd4e203771`.
Derivado da função existente `buildApprovalForm`, filtrado para cinco decisões/sete itens,
com IDs e versões conferidos contra o inventário remoto da R03. Seus cinco `request_id`
foram preparados localmente para permitir retry idempotente; não há decisão executada.

| Decisão | Item | Versão |
|---|---|---:|
| B19 | b19_femeas_3_8_meses | 3 |
| PAR | recria_maio | 2 |
| PAR | recria_julho | 2 |
| PAR | recria_setembro | 2 |
| DES | pre_desmama_situacional | 2 |
| CONF | pre_confinamento_dose_unica | 2 |
| PARTO | matrizes_pre_parto_antiparasitario | 2 |

O escopo proposto é curadoria para as avaliações genéricas descritas nos dossiês, sem
inferir produto, dose, via ou carência. Os sete itens comerciais e os seis restritos
estão excluídos. A B19 mantém contexto de UF, restrição em SC e suas condições técnicas.

## Conta e permissão pendentes

A conta principal existente foi novamente localizada no Supabase Auth, correspondendo ao
UUID **`0f00a75c-32a9-4555-a840-cb0f13f2d3f7`**. Não foi criada conta administrativa.
`app_superadmins` continua vazio. A concessão restrita a essa conta deve estar
explicitamente autorizada e ser auditável na R04. Nenhuma concessão foi executada na R03.

É necessária uma sessão autenticada real dessa conta para usar as RPCs curatoriais.
Não foi preparado token nem simulação de identidade administrativa. O pacote mantém
ator, assinatura, justificativa, resultado e digest de revisão pendentes; não constitui
aprovação do conteúdo.

## Ação concreta após autorização R04

1. Conceder e auditar somente a permissão explicitamente autorizada para a conta identificada.
2. Usar `sanitario_catalog_review_preview_v2` nas cinco seleções exatas do pacote.
   Conferir versões/fontes e exigir `blockers=[]`; obter o digest real do conteúdo PostgreSQL.
3. Registrar a decisão explícita do curador por `sanitario_catalog_decide_v2`, usando
   digest, justificativa e `request_id` estável. Rejeitar mudanças concorrentes de conteúdo.
4. Conferir os recibos e a auditoria, os sete itens e as exclusões; repetir somente requests
   cuja resposta seja incerta, com o mesmo ID/conteúdo. Manter todos os gates OFF.

**Efeito real da RPC existente quando uma aprovação for autorizada:** os cinco protocolos
ficam `active/approved`, os sete itens ficam `active` e `allows_agenda_auto=true`, e são
registradas as referências curatoriais. Esses flags globais integram o contrato instalado;
não se deve prometer aprovação mantendo esses mesmos flags falsos. Os gates por fazenda
continuam OFF e não são criadas Agendas, Eventos, estoque ou carência pela decisão curatorial.
Qualquer ativação de planejamento por fazenda continua separada na R05.

Não foram chamadas RPCs de preview/decisão nesta preparação. R04 não autoriza os demais
13 itens, criação de fazenda, importação adicional, deploy ou migration. A futura fazenda
“Homologação Sanitário V2” continua pendente da autorização R05.
