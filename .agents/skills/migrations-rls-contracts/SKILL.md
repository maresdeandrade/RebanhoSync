---
name: migrations-rls-contracts
description: Protege contratos de banco do RebanhoSync em migrations Supabase/Postgres, RLS, policies, grants, funções, triggers, RPCs, índices, constraints, FKs compostas, RBAC, membership, `fazenda_id`, sync-batch e baseline. Usar ao criar, alterar, revisar ou consolidar schema ou autorização remota. Não usar para UI/copy, documentação local sem mudança de contrato ou sync exclusivamente local; combinar com a skill de domínio e com `sync-offline-rollback` quando aplicável.
---

# Migrations RLS Contracts

## Missão

Preservar evolução segura do schema, isolamento por tenant, autorização por papel, integridade referencial e compatibilidade dos contratos remotos.

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/CONTEXT_LOADING.md`;
4. `.agents/rules/no-broad-context.md`;
5. `.agents/rules/rtk.md`;
6. `AGENTS.md` local em `supabase/**`, se existir;
7. migrations ativas, código consumidor e testes diretamente relacionados.

Carregar somente quando necessário:

- `docs/technical/SUPABASE_RLS.md`;
- `docs/technical/EVENTS_AGENDA_CONTRACT.md`;
- `docs/technical/OFFLINE_SYNC.md`;
- `docs/technical/ARCHITECTURE.md`;
- `docs/technical/TESTING_GATES.md`;
- `docs/context/SOURCE_OF_TRUTH.md`;
- skill de domínio afetada.

## Hierarquia em conflito

1. código + migrations ativas;
2. `docs/context/PROJECT_STATUS.md`;
3. docs normativos ativos;
4. docs derivados;
5. histórico em `docs/archive/**` e migrations legadas;
6. esta skill.

## Restrições

- Não enfraquecer ou contornar RLS.
- Preservar `fazenda_id` como fronteira de isolamento.
- Impedir relações cross-tenant com constraints/FKs compostas quando aplicável, não apenas por validação de UI.
- Não confiar em `fazenda_id` enviado pelo cliente sem validar membership e papel.
- Não expor `service_role` ao cliente.
- Não conceder escrita direta em membership sem contrato explícito e proteção equivalente.
- Não editar migration já aplicada; preferir migration forward-only. Alterar baseline ou consolidar migrations somente com escopo explícito e plano de compatibilidade.
- Não usar migrations legadas como verdade ativa sem pedido expresso.
- Não adicionar constraint, status ou dedup físico sem auditar dados existentes, semântica e impacto offline/sync.
- Não executar reset, deploy, push ou operação destrutiva sem autorização explícita.

## Procedimento

### 1. Registrar o contrato alterado

Identificar tabelas, colunas, relações, policies, funções/RPCs, triggers, índices, grants, payloads de sync e consumidores afetados. Distinguir mudança aditiva, restritiva, backfill, substituição ou remoção.

### 2. Validar isolamento tenant

Confirmar:

- `fazenda_id` nas estruturas tenant-scoped;
- unicidade e FKs compatíveis com o escopo da fazenda;
- impossibilidade de relacionar IDs de fazendas distintas;
- membership validada no banco;
- payload do cliente incapaz de elevar acesso;
- comportamento de outsider, membro e cada papel realmente afetado.

### 3. Validar RLS e grants

Para cada operação suportada, verificar `SELECT`, `INSERT`, `UPDATE` e `DELETE` conforme o contrato. Avaliar `USING`, `WITH CHECK`, soft delete, views, owner da tabela, grants e caminhos indiretos por função ou trigger.

Não aprovar policy apenas pelo happy path. Cobrir outsider, papel insuficiente, troca de `fazenda_id` e referência cross-tenant.

### 4. Validar função, RPC e trigger

Confirmar:

- autenticação quando exigida;
- membership, papel e tenant;
- `search_path` controlado conforme o padrão ativo e objetos sensíveis qualificados;
- privilégio do executor, `SECURITY INVOKER`/`SECURITY DEFINER` e grants coerentes;
- ausência de bypass amplo;
- idempotência e concorrência quando aplicáveis;
- mensagens de erro sem vazamento de dado privilegiado.

### 5. Validar migration

Avaliar:

- ordem e dependências;
- compatibilidade forward com clientes locais ainda não sincronizados;
- lock e custo de backfill;
- dados inválidos preexistentes;
- `NOT NULL`, enum, unique, FK e índice em tabelas populadas;
- reexecução segura quando o padrão do projeto exigir;
- falha parcial e estratégia de correção;
- impacto no baseline e em ambientes novos.

### 6. Validar contratos de domínio

Aplicar apenas os contratos relevantes:

- Agenda = intenção futura;
- Evento = fato executado;
- fechamento de Agenda = estado administrativo, não histórico;
- `state_*` = estado atual/read model;
- Protocolo = regra/configuração;
- tags/sinais/insights = auxiliares;
- decisão crítica = fonte técnica explícita.

Não converter dedup lógico do core em constraint física sem decisão explícita, auditoria dos dados e plano de migration/sync.

## Cautela com Agenda Sanitária v2

Quando esse fluxo for afetado:

- auditar o legado antes de criar enum, status ou constraint;
- distinguir execução, execução parcial, cancelamento, descarte e fechamento sem execução antes de exigir `source_evento_id`;
- comprovar idempotência real antes de persistir intents ou impor unicidade;
- preservar `fazenda_id`, RLS e compatibilidade com clientes offline;
- combinar com a skill sanitária aplicável.

## Testes mínimos por risco

Cobrir quando aplicável:

- outsider sem acesso;
- papel insuficiente rejeitado;
- membro autorizado aceito;
- spoof ou troca de `fazenda_id` rejeitado;
- FK cross-tenant rejeitada;
- chamada direta da RPC com tenant não autorizado;
- retry/idempotência e concorrência;
- upgrade sobre dados existentes;
- criação limpa a partir do baseline.

## Validação

Seguir `.agents/rules/rtk.md`. Executar no mínimo:

```bash
git status --short --untracked-files=all
git diff --check
rtk node scripts/codex/validate-supabase-baseline-functional.mjs
```

Executar testes focados de RLS/RPC/schema. Usar lint e build se o contrato TypeScript/cliente mudar; executar a suíte completa quando o escopo for amplo. Se um comando não puder rodar, registrar o motivo e não declarar o contrato validado.

## Saída obrigatória

Informar:

1. fatos confirmados;
2. contratos, tabelas e funções afetados;
3. isolamento tenant e matriz de acesso;
4. segurança de RLS, grants, RPCs e triggers;
5. segurança da migration, backfill e compatibilidade;
6. arquivos alterados;
7. comandos executados e resultados;
8. bloqueadores e até três riscos residuais.

Não aprovar RLS sem avaliar outsider/papéis, RPC sem autenticação/tenant/privilégios ou baseline sem executar a validação correspondente.
