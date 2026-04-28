# Relatório de Auditoria de Arquitetura e Segurança - RebanhoSync

## 1. Resumo executivo

O RebanhoSync implementa uma arquitetura multi-tenant (`fazenda_id`) baseada no Supabase. O acesso é governado por RLS (Row Level Security) e restrito através de papéis (owner, manager, cowboy) gerenciados na tabela `user_fazendas`.

A segurança geral está bem estruturada com o uso de `auth.uid()` acoplado a verificações de `fazenda_id`, impedindo escalonamento de privilégio cross-tenant. O cadastro é automático, provisionando dados via triggers (`0002_user_auto_provision.sql`), e o provisionamento de fazendas também atualiza automaticamente a primeira `active_fazenda_id` na tabela `user_settings`.

**Principais Descobertas:**
1. A remoção de usuários é feita de forma segura via soft-delete usando a RPC `admin_remove_member`, que barra a remoção do último owner.
2. Não há uma interface para deletar a `fazenda` na UI. O deleção por owner é tecnicamente permitida nas policies de RLS (`fazendas_delete_owner`), mas isso geraria exclusão direta via cascade/restrict caso feito via API. É recomendada a implementação de soft-delete/arquivamento.
3. Convites (`farm_invites`) dependem de um schema seguro. Os tokens não vazam, e a função de aceitar convite (`accept_invite`) possui uma validação opcional de telefone razoável (valida apenas se o telefone existir, mitigando travas no onboarding).
4. As `Edge Functions` (`sync-batch`) usam instâncias do Supabase client autenticadas via JWT para manter o RLS ativo, mas também aplicam uma dupla verificação via busca prévia de roles em `user_fazendas`.

## 2. Escopo inspecionado
* **Frontend:**
  - Fluxos de autenticação (`SignUp.tsx`, `Login.tsx`, `AuthGate.tsx`, `useAuth.tsx`)
  - Seleção de rotas (`SelectFazenda.tsx`)
  - Gestão e deleção de membros (`Membros.tsx`, `RemoveMemberDialog.tsx`, `MemberRoleDialog.tsx`, `InviteMemberDialog.tsx`)
  - Configurações da fazenda (`CriarFazenda.tsx`, `Configuracoes.tsx`)
* **Backend:**
  - RLS Policies e migrations
  - Autoprovisionamento (`0002_user_auto_provision.sql`)
  - Gating e permissões de criação de fazenda (`0010_add_can_create_farm.sql`, `0011_fix_create_fazenda_permissions.sql`, `0017_update_create_fazenda_rpc.sql`)
  - Gestão de membros e convites (`0005_member_management_rpcs.sql`, `0006_invite_system.sql`, `0009_fix_accept_invite_validation.sql`)
  - Segurança (`0037_security_hardening_review.sql`, `20260308230748_rbac_delete_hardening_animais.sql`)
  - Edge Functions (`sync-batch`)

## 3. Evidence Ledger

| ID | Afirmação | Evidência concreta | Arquivo/Função/Policy | Confiança |
|----|-----------|--------------------|-----------------------|-----------|
| 1 | Cadastro de user aciona criação de profile | `handle_new_user()` trigger on `auth.users` insert | `0002_user_auto_provision.sql` | Alta |
| 2 | Usuário pode criar fazenda dependendo de role | `can_create_farm()` e validação na UI | `0010_add_can_create_farm.sql`, `SelectFazenda.tsx` | Alta |
| 3 | Remoção de membro é soft-delete e via RPC | `update user_fazendas set deleted_at = now()` | `0005_member_management_rpcs.sql`, `admin_remove_member` | Alta |
| 4 | Último owner não pode ser removido | `if _owner_count = 1 then raise exception` | `0005_member_management_rpcs.sql` | Alta |
| 5 | Deleção de animais bloqueia cowboy | `animais_delete_by_role` `USING ... IN ('owner', 'manager')` | `20260308230748_rbac_delete_hardening_animais.sql` | Alta |
| 6 | Convite é vinculado à fazenda e uso único | `status = 'accepted'` no `accept_invite` | `0006_invite_system.sql`, `accept_invite` | Alta |
| 7 | Edge function usa RLS | supabase client com JWT no header | `sync-batch/index.ts` | Alta |

## 4. Mapa real do fluxo de usuário

| Etapa | Existe? | Arquivo/Função | Entrada | Saída | Estado persistido | Validação de segurança | RLS envolvida? | Risco |
|-------|---------|----------------|---------|-------|-------------------|------------------------|----------------|-------|
| Usuário acessa sistema | implementado | `SignUp.tsx`, `Login.tsx` | email, password | Sessão JWT Supabase | Supabase Auth | - | Não | Baixo |
| Criação de profile | implementado | `handle_new_user` | inserção auth | Profiles e Settings gerados | `user_profiles`, `user_settings` | Executa via DB Trigger | Sim | Baixo |
| Elegibilidade criação fazenda | implementado | `can_create_farm()` | user ID | booleano | - | RPC server-side check | Sim | Baixo |
| Criação de fazenda | implementado | `create_fazenda()` | nome, estado, etc | `fazenda_id` | `fazendas`, `user_fazendas`, `user_settings` | Transacional via RPC `security definer` | Sim | Baixo |
| Atribuição papel inicial | implementado | `create_fazenda()` | - | Membership 'owner' | `user_fazendas` | Executa dentro do `create_fazenda` | Sim | Baixo |
| Seleção de fazenda ativa | implementado | `SelectFazenda.tsx`, `useAuth.tsx` | `fazenda_id` | Active farm set local | IndexedDB, `user_settings` remote | RLS checks active fazenda no access | Sim | Baixo |
| Gestão de membros/convites | implementado | `Membros.tsx`, `InviteMemberDialog.tsx`, RPC `create_invite` | email, telefone, role | Invite Link com Token UUID | `farm_invites` | Só Owner/Manager convida | Sim | Baixo |
| Aceite de convite | implementado | `accept_invite` RPC | Token | Membership | `user_fazendas` | JWT email/phone match, Token expiration | Sim | Baixo |

## 5. Inventário de arquivos relevantes

| Arquivo | Responsabilidade atual | Tipo | Callers/Dependentes | Evidência | Risco | Ação recomendada |
|---------|------------------------|------|-----------|-------|------------------|
| `0004_rls_hardening.sql` | Limita inserts globais e barra SELECT de outras fazendas | RLS policy | Tabelas do sistema | Políticas com `has_membership(fazenda_id)` | Baixo | preservar |
| `0005_member_management_rpcs.sql` | Trocar/remover papéis/membros sem RLS manual client | RPC | UI e testes | `admin_set_member_role`, `admin_remove_member` | Baixo | preservar |
| `sync-batch/index.ts` | Processa persistência offline garantindo tenant sync | Edge Function | Client app | `supabase = createClient(..., Bearer ${jwt})` | Baixo | preservar |
| `useAuth.tsx` | Provê session e carrega `user_fazendas` ativas | Context | Route guards, UI | `fetchMembershipRole` | Baixo | preservar |
## 6. Inventário de entidades/tabelas

| Entidade/Tabela | Finalidade | Campos críticos | Relações | RLS? | Constraints? | Índices? | Risco |
|-----------------|------------|-----------------|----------|------|--------------|-------|
| `fazendas` | Agrupa dados do tenant | `id`, `created_by` | - | Sim | - | Sim | Baixo |
| `user_fazendas` | Membership e Roles | `user_id`, `fazenda_id`, `role`, `deleted_at` | `fazendas`, `auth.users` | Sim | Unique `(user_id, fazenda_id)` | Sim | Baixo |
| `farm_invites` | Fila de convites | `token`, `email`, `role`, `status` | `fazendas` | Sim | Token expiration, soft delete | Sim | Baixo |

## 7. Matriz real de papéis e permissões

| Papel | Criar fazenda | Editar fazenda | Deletar/arquivar fazenda | Convidar membro | Alterar papel | Remover membro | Ver dados | Executar operações | Evidência |
|-------|---------------|----------------|--------------------------|-----------------|---------------|----------------|-----------|
| owner | permitido | permitido | permitido por backend/RLS | permitido | permitido | permitido | permitido | permitido | `admin_remove_member`, `admin_set_member_role` |
| manager | divergente/não checado ui | implícito (UI?) | bloqueado por backend/RLS | permitido | implícito | bloqueado por backend/RLS | permitido | permitido | `cancel_invite`, `create_invite` |
| cowboy | negado | negado | negado | negado | negado | negado | permitido | permitido | RLS gerais |

**Nota sobre `manager` e `owner`**: A política de alterar papéis na `admin_set_member_role` restringe manager de tocar nos owners, mas permite mexer em outros perfis. No entanto, o backend não expõe via UI o delete da fazenda. Apenas no backend as políticas permitem o `DELETE` para owners.

## 8. Casos críticos obrigatórios
### 8.1 Criação de fazenda
* **Todo usuário autenticado pode criar fazenda?** Não, checado pelo `can_create_farm()`.
* **A criação de fazenda também cria membership inicial?** Sim, insere `owner` na `user_fazendas`.
* **O fluxo é transacional?** Sim, é via RPC plpgsql garantindo commit/rollback em bloco.
* **Existe risco de fazenda sem owner?** Baixo risco de ser criada sem owner. No runtime, a RPC impede a remoção do último owner.
* **Existe idempotência contra duplo clique?** Parcial, UI bloqueia `isLoading`, RPC retorna insert padrão.
* **Existe proteção contra criação em massa?** Não há limits definidos no código explicitamente para criação, exceto rate-limit do Supabase.

### 8.2 Deleção ou arquivamento de fazenda
* **owner pode apagar fazenda hoje?** RLS permite (via `fazendas_delete_owner`), porém a UI não tem a funcionalidade exportada.
* **Existe hard delete ou soft delete/arquivamento?** Há um trigger/função de `soft-delete` sendo propagado, mas o delete direto faz cascade ou restrict (como nas fk da `animais`). Não exposto publicamente para usuários.
* **Existe cascade perigoso?** Algumas foreign keys usam `restrict` ao deletar a fazenda, protegendo contra apagar dados operacionais acidentalmente por cascading.
* **Recomendação:** Implementar `soft_delete` da fazenda explicitly, isolando na view e na sincronização, e ocultar hard deletes.

### 8.3 Gestão de equipe
* **owner remover qualquer membro:** permitido por backend/RLS (via RPC `admin_remove_member`) e pela UI.
* **owner alterar papel de qualquer membro:** permitido.
* **impedir remoção do último owner:** permitido por backend (RPC impede)
* **manager remover cowboy:** permitido pela RPC (apenas owner remove no código atual da `admin_remove_member` -> **Risco divergente**: a função `admin_remove_member` diz explicitamente `if _caller_role <> 'owner' then raise exception 'Forbidden'`). Logo, MANAGER não remove ninguém.

### 8.4 Convites
* **Quem pode convidar?** owner e manager (validação RPC `create_invite`).
* **Convite é vinculado a fazenda_id?** Sim.
* **Convite tem token seguro?** Sim, usa uuid V4 genérico guardado e expirado (7 dias).
* **Convite pode ser reutilizado?** Não, marca `status = 'accepted'` (validação RPC).

## 9. Autorização em camadas

| Camada | Onde aparece | O que valida | Fonte de verdade? | Risco | Recomendação |
|--------|--------------|--------------|-------|--------------|
| UI | `AuthGate.tsx` | Redireciona se sem sessão e fazenda ativa | Não | Baixo | Preservar. |
| Supabase Client | Edge Functions, Frontend | Session Context e JWT headers | Sim | Baixo | Seguro, utiliza auth.uid(). |
| RPCs | `create_fazenda`, `admin_remove_member` | Transacional e Bypass local para gerenciar roles validando user antes | Sim | Baixo | Excelente segurança transacional. |
| RLS Policies | DB Core (`0004_rls_hardening.sql` e subsequentes) | Impede CRUD em `user_fazendas` publicamente e garante que as queries fiquem atreladas ao schema do app | Sim | Baixo | Preservar as validações rígidas de membership. |
| Sync (Edge Function) | `sync-batch` | JWT decoding, origin cors whitelist, checagem cruzada da `user_fazendas` do ID e fazenda_id vindos na payload | Sim | Baixo | Preservar. |

## 10. Matriz RLS e multi-tenancy

* **Tabelas Principais:** Todas utilizam o ID da fazenda referenciada. As políticas garantem isolamento exigindo que `auth.uid()` tenha permissão `has_membership(fazenda_id)`.
* **Acesso Cruzado:** Não encontrado. O `sync-batch` avalia payload de sincronização contra a permissão do usuário de enviar algo. O Edge function busca o `membership` baseado no payload JWT contra o banco antes de aprovar.

## 11. Ameaças e abuso

| Fluxo | Ameaça | Vetor | Impacto | Controle existente | Lacuna | Mitigação |
|-------|--------|-------|--------------------|------------------|
| Deleção de Fazenda | Escalonamento/Apagar registros alheios | RLS exposta e sem trigger defensivo pra `hard delete` em cascata restrita | Perda de dados | Restrict keys no DB, UI sem botão | Falta RPC de soft delete | Implementar soft-delete formal para fazendas por owner via RPC transacional controlada |
| Convites | Convite Replay ou Hijacking por e-mail | Encaminhar email de invite e logar com outra conta | Acesso não autorizado | Verificação opcional cruzada: checa via jwt payload do aceitante se condiz com email listado | Nenhuma conhecida | Seguir com a verificação existente (email matches auth.jwt) |

## 12. Testes e gates mínimos

Recomenda-se adicionar testes de integração e RLS para blindar de vez as restrições:

| Teste | Tipo | Entrada | Resultado esperado | Risco coberto |
|-------|------|---------|--------------------|---------------|
| `owner_can_soft_delete_farm` | RLS test | `fazenda_id` | Sucesso ou erro de FK restrita | Apagar dados indevidos |
| `manager_cannot_remove_members` | RPC test | `user_id`, `fazenda_id` | Erro 'Forbidden' | Escalonamento de permissão |
| `cowboy_cannot_invite` | RPC test | Payload de convite | Erro 'Forbidden' | Escalonamento de permissão |
| `convite_reutilizado_falha` | integration | Token já aceito | Erro 'Invite not pending' | Convite Replay |
| `troca_manual_fazenda_id_vaza_dados` | RLS test | Modificar ID local na query | Nenhum resultado retornado | RLS bypass |

## 13. (Old) Decisão Final

**Menor caminho seguro e próximos passos recomendados:**
* **O que não mexer ainda:** Fluxo de Login, Auth, Cadastro e criação de perfil. O provisionamento e criação da primeira fazenda (`can_create_farm`) e Convites (`farm_invites`, `accept_invite`) estão sólidos. A sincronização em Batch na Edge está segura contra spoofing de Tenant IDs.
* **O que focar agora / Backlog Operacional:**
  - `P1`: Implementar Arquivamento (Soft-Delete) de Fazenda via RPC controlada (protegendo deletes acidentais ou perigosos via cascade limitando a RLS base para leitura).
  - `P2`: Alinhar/Verificar se `Manager` deveria ter permissão de remover `cowboy`. Se a intenção era essa, a regra do backend `admin_remove_member` precisa ser atualizada (agora só Owner o faz). Se é proposital, alinhar a UI para não exibir botões de remover para manager.

**Resultado do Arquivo:** `audit_report.md` gerado no sistema.

## 14. TypeScript/UI vs SQL/RLS

| Ação | Validação TS/UI | Validação SQL/RLS | Diverge? | Risco | Fonte de verdade recomendada |
|------|-----------------|-------------------|----------|-------|------------------------------|
| criar fazenda | `can_create_farm()` hook + state bloqueia UI | `create_fazenda` RPC usa `can_create_farm()` | Nenhuma | Baixo | SQL/RLS (RPC) |
| editar fazenda | UI (Configurações) checa se tem permissão | `fazendas` RLS restringe update para owner | Nenhuma | Baixo | SQL/RLS |
| deletar/arquivar fazenda | Nenhuma (Não existe botão na UI) | RLS tem `fazendas_delete_owner` mas sem restrição a cascata | Divergente | Alto | SQL/RLS + Implementar RPC com soft-delete |
| convidar usuário | UI esconde/mostra pra owner/manager | `create_invite` RPC checa permissões explicitamente | Nenhuma | Baixo | SQL/RLS |
| alterar papel | Modal de role disponível p/ manager/owner | `admin_set_member_role` restringe logicamente manager de rebaixar owner | Nenhuma | Baixo | SQL/RLS (RPC) |
| remover membro | Modal disponível p/ manager/owner | `admin_remove_member` APENAS owner. Manager tomará erro se tentar. | UI diverge do backend | Médio | SQL/RLS (Backend é a verdade) |
| acessar dados | Hooks limitam por `activeFarmId` | RLS global por `has_membership` | Nenhuma | Baixo | SQL/RLS |
| executar RPC/Edge Function | Token Auth passado no Headers | Edge valida Token e chama supabase para validar fazenda_id e membership | Nenhuma | Baixo | Edge Function (dupla checagem RLS) |

## 15. Estados inconsistentes

| Estado inconsistente | Como pode ocorrer | Impacto | Existe proteção? | Evidência | Recomendação |
|----------------------|-------------------|---------|------------------|-----------|--------------|
| auth user sem profile | Falha no Trigger on auth.users insert | App quebra por falta de profile | Parcial (Trigger SQL) | `0002_user_auto_provision.sql` | O Supabase Trigger lida bem, mas um backfill script é útil caso um insert morra. |
| fazenda sem owner | Último owner sai da fazenda / deleta user | Dados órfãos | Sim | RPC `admin_remove_member` impede último owner | Preservar |
| último owner removido | Owner tenta remover a si mesmo se for o único | Trava tenant | Sim | RPC bloqueia `_owner_count = 1` | Preservar |
| convite aceito duas vezes | Race condition | Duplica membership | Sim | Transacional lock for update no `accept_invite` e constraints na DB | Preservar |
| convite expirado aceito | Demora no frontend para recarregar | Cadastro indevido | Sim | `accept_invite` checa `_expires_at < now()` | Preservar |
| dados com fazenda_id inexistente | Falha no envio Edge via FK corrompida | Dados inválidos | Sim | FKs no postgres para tabelas `lotes`, `pastos`, `animais`, etc | Preservar |

## 16. Arquitetura-alvo incremental

Sugestão de arquitetura compatível com o legado:

| Pasta | Responsabilidade | O que entra | O que não entra | Arquivos atuais candidatos | Risco |
|-------|------------------|-------------|-----------------|----------------------------|-------|
| `src/lib/auth/` | Autenticação Base | Session, AuthGate, Hooks de Login | RPCs, Deleção, Config | `useAuth.tsx`, `AuthGate.tsx`, `SignUp/Login.tsx` | Baixo |
| `src/lib/identity/` | Perfil do Usuário | Onboarding, settings do avatar | Regras de fazenda | `user_profiles` UI calls | Baixo |
| `src/lib/fazendas/` | Gestão de Fazenda | Criar, Ativar, Soft-Delete, Settings | Sincronismo, Membros | `SelectFazenda.tsx`, `CriarFazenda.tsx`, RPC `create_fazenda` | Baixo |
| `src/lib/access/` | Controle de Acesso (RBAC) | Roles, Checagem de permissão, UI Guards | Modificação de dados operacionais | RPCs: `admin_set_member_role`, `has_membership` policies | Baixo |
| `src/lib/invitations/` | Convites | Emitir, Cancelar, Aceitar convite | Gestão de perfis | `0006_invite_system.sql`, RPCs de invite | Baixo |
| `supabase/migrations/` | Schema e Seg | Funções, RLS, Tabelas, Triggers | - | - | Baixo |

## 17. Plano incremental

### Fase 0 — Baseline read-only
- `Feito:` Mapeamento de papéis, convites, fazendas, auth e perfis concluído via Auditoria de SQL e Frontend.

### Fase 1 — Matriz real de permissões
- `Documentado:` Divergências mapeadas. UI do Manager precisa ocultar remoção de membro (atualmente quebra via RPC no Backend).

### Fase 2 — Blindagem multi-tenant
- `Mapeado:` RLS validam membership por tabela. O Frontend não consegue ultrapassar o Backend graças as restrições transacionais e RLS de leitura restrita. Falta formalizar exclusão em lote de Fazendas (atualmente só permite hard-delete invisível).

### Fase 3 — Gestão de equipe
- `Verificado:` RPCs bloqueiam última remoção de owner, convites e controle restritivo do Manager.

### Fase 4 — Deleção/arquivamento de fazenda
- `Falta implementar:` Recomendado Soft-delete para `fazendas`.

### Fase 5 — Auditoria e observabilidade
- `Falta implementar:` Log consolidado em DB de transações sensíveis.

## 18. Backlog operacional

| Prioridade | Tarefa | Arquivos prováveis | Critério de aceite | Risco coberto |
|------------|--------|--------------------|--------------------|---------------|
| P1 | Implementar Soft-Delete p/ Fazendas | Migration Supabase SQL | Adicionar `archive_farm()` RPC, e update em `fazendas` RLS. | Deleção insegura que apaga transações |
| P1 | Ajustar UI p/ Ocultar Remoção p/ Manager | `RemoveMemberDialog.tsx`, `Membros.tsx` | Se user for manager, botão de remover membro (cowboy/manager) some da UI. | UI Inconsistente / Erro na cara do usuário |
| P2 | Refatorar `useAuth.tsx` | `useAuth.tsx` | Reduzir "God Hook", extraindo `refreshSettings` e `loadFarmContext` para camada store (ex: zustand). | Melhoria arquitetural |
| P3 | Implementar Audit Trail de Equipe | DB Migration SQL | Inserir registro em tabela `audit_logs` quando convite criado, aceito ou membro demitido. | Ausência de observabilidade |

## 19. ADRs sugeridos

| ADR | Decisão | Alternativas | Recomendação | Risco se não decidir |
|-----|---------|--------------|--------------|----------------------|
| Hard Delete vs Soft Delete de Fazenda | Usar Soft Delete. | Manter RLS com cascade restrict. | Atualizar políticas de `fazendas` e criar função RPC de `archive_farm()`. | Owner invocar delete por script apagando sem trilha caso bypass restrições ou falha na RLS. |
| Regra do Manager | O que Manager pode fazer com membros? | Manager pode remover Cowboy? | Decidir se a RPC do banco deve ser atualizada ou se a UI será adaptada (Atualmente RPC trava remoção de qualquer um pelo Manager). Recomenda-se alinhar UI com backend. | Experiência de uso ruim e atrito. |

## 20. Decisão final

A base do aplicativo está altamente madura na separação de tenants (`fazenda_id`) e isolamento com RLS, juntamente com Edge functions restritas que validam via JWT e Banco de Dados. O fluxo principal é extremamente seguro do ponto de vista arquitetural, não existindo vazamento de dados provável (P0).

**O que corrigir primeiro:**
- Bloquear a deleção manual no RLS e convertê-la em uma RPC `soft-delete` (`P1`).
- Corrigir a UI de Equipe, ocultando o botão de demissão para Managers que hoje ocasiona erro fatal (`P1`).

**O que não mexer ainda:**
- Fluxo de login e Edge functions de Sincronismo (`sync-batch`) e políticas isoladas de domínios (Sanitário, Pesagem), pois estão seguras.

**Menor caminho seguro:** O menor caminho seguro para refinar ainda mais a fundação multi-tenant é criar e aprovar PR isoladas para as tarefas `P1` descritas no backlog acima e gerar os testes unitários da Matriz de Roles (Fase 1 e Fase 4).
