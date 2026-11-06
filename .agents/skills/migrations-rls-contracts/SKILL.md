---
name: migrations-rls-contracts
description: Protege contratos de banco do RebanhoSync em migrations Supabase/Postgres, RLS, policies, grants, funções, triggers, RPCs, índices, constraints, FKs compostas, RBAC, membership, `fazenda_id`, sync-batch e baseline. Usar ao criar, alterar, revisar ou consolidar schema ou autorização remota. Não usar para UI/copy, documentação local sem mudança de contrato ou sync exclusivamente local; durante implementação, usar no máximo uma skill de apoio quando houver interseção concreta.
role: engineering
---

# Migrations RLS Contracts

## Missão

Preservar evolução segura do schema, isolamento por tenant, autorização por papel, integridade referencial e compatibilidade dos contratos remotos.

## Leitura inicial

Reutilize o bootstrap único de `AGENTS.md`; não releia rules já carregadas por referência nesta skill. Leia o `AGENTS.md` local em `supabase/**`, migrations ativas, código consumidor e testes diretamente relacionados.

Carregar somente quando necessário:

- `docs/technical/SUPABASE_RLS.md`;
- `docs/technical/EVENTS_AGENDA_CONTRACT.md`;
- `docs/technical/OFFLINE_SYNC.md`;
- `docs/technical/ARCHITECTURE.md`;
- `docs/technical/TESTING_GATES.md`;
- `docs/context/SOURCE_OF_TRUTH.md`;
- skill de domínio afetada.

## Precedência

Aplicar as precedências factual e procedimental definidas em `.agents/rules/CORE_RULES.md`. Migrations legadas e esta skill não substituem contratos ativos.

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

Seguir `.agents/rules/rtk.md` e selecionar as verificações pelos contratos realmente afetados:

```bash
git status --short --untracked-files=all
git diff --check
```

Quando a alteração afetar contrato remoto Supabase/RLS/RPC/migration/sync-batch, executar a validação funcional de baseline indicada em `rtk.md`, se o script estiver disponível:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Executar testes focados dos objetos RLS/RPC/schema e cenários tenant/papel efetivamente afetados. Usar lint/build quando o contrato TypeScript/cliente mudar; suíte ampla/E2E somente quando escopo e risco justificarem e houver autorização pertinente. Se uma verificação aplicável não puder rodar, registrar o motivo e não declarar o contrato validado.

## Saída obrigatória

Resumir arquivos e contratos efetivamente afetados, fatos confirmados sobre isolamento tenant, papéis/matriz de acesso, RLS/grants/RPC e migration/compatibilidade conforme aplicável, distinguindo inferências e recomendações. Registrar comandos/resultados, verificações aplicáveis não executadas com motivo, bloqueadores e até três riscos residuais.

Não aprovar RLS sem avaliar outsider/papéis, RPC sem autenticação/tenant/privilégios ou baseline sem executar a validação correspondente.
