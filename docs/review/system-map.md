# Mapa do Sistema: REBANHOSYNC

Este documento apresenta o resultado de uma revisão exploratória do repositório para mapear a arquitetura, stack e riscos técnicos do projeto.

## 1. Stack Tecnológico

### Frontend (Web/Mobile PWA)
- **Core:** React 19, Vite 6, TypeScript.
- **UI:** TailwindCSS, Shadcn/UI (Radix Primitives), Lucide React.
- **State/Cache:** `@tanstack/react-query` (server state), `dexie-react-hooks` (local DB).
- **Forms:** `react-hook-form` + `zod`.
- **Utils:** `date-fns`.

### Camada Offline & Dados
- **Local DB:** Dexie.js (IndexedDB wrapper).
  - Schema versionado (v6 atual).
  - Estratégia "Two Rails": Tabelas de Estado (`state_*`) vs Tabelas de Eventos (`event_*`).
- **Sync Engine:** Customizado (`src/lib/offline/`).
  - **Outbox Pattern:** Gestures (`queue_gestures`) + Operations (`queue_ops`).
  - **Worker:** `syncWorker.ts` (intervalo de 5s).
  - **Identificadores:** `client_tx_id` (transação lógica), `client_op_id` (operação atômica).

### Backend (Supabase)
- **Database:** PostgreSQL com extensions (`pgcrypto`).
- **Auth:** Supabase Auth (JWT).
- **Security:** RLS (Row Level Security) estrito.
  - Acesso de leitura via `public.has_membership(fazenda_id)`.
  - Acesso de escrita bloqueado diretamente em tabelas críticas (`user_fazendas`), forçando uso de RPCs.
- **Logic:**
  - **Append-Only:** Tabelas de eventos (`eventos_*`) proibidas de update/delete de negócio via Triggers.
  - **Derived State:** Views complexas (`vw_repro_episodios`, `vw_repro_status_animal`) para calcular estado reprodutivo.
- **Edge Functions:** `sync-batch` (recebe pacote de operações do cliente).

---

## 2. Arquitetura de Sincronização

O fluxo de dados segue um modelo **Optimistic UI + Event Sourcing Híbrido**:

1.  **Ação do Usuário:** O usuário realiza uma ação (ex: "Registrar Parto").
2.  **Gravação Local (Optimistic):**
    - `buildEventGesture.ts` gera operações (INSERT evento, UPDATE animal).
    - `ops.ts` aplica as operações diretamente nas tabelas `state_*` (UI atualiza instantaneamente).
    - As operações são gravadas na `queue_ops` e o gesto na `queue_gestures` (Status: `PENDING`).
3.  **Sync Worker (Push):**
    - Lê gestos `PENDING`.
    - Envia para Supabase Edge Function `sync-batch`.
4.  **Processamento Server-Side:**
    - O servidor processa o lote (transacionalmente, presume-se).
    - Retorna status `APPLIED` ou `REJECTED`.
5.  **Confirmação/Rollback:**
    - Se `APPLIED`: Marca gesto como `DONE`. Remove da fila.
    - Se `REJECTED`: Executa `rollbackOpLocal` para reverter as mudanças nas tabelas `state_*`.
6.  **Pull (Refresh):**
    - Se o sync afetou tabelas críticas, o worker dispara `pullDataForFarm`.
    - `pull.ts` baixa **todos** os dados da tabela (estratégia `replace` ou `merge`) e atualiza o Dexie.

---

## 3. Riscos Técnicos e Bugs Prováveis

Lista priorizada por impacto (Severidade: Alta/Média/Baixa).

| Prioridade | Risco / Bug | Causa Provável | Impacto | Como Reproduzir | Sugestão de Correção |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1 (Alta)** | **Flicker de Dados (Race Condition)** | `pull.ts` sobrescreve cegamente as tabelas `state_*`. Se houver um gesto `PENDING` (não syncado) e ocorrer um Pull (ex: background refresh), a mudança local é apagada até o próximo sync. | **UX Ruim / Confusão:** O usuário vê o dado sumir e reaparecer. | 1. Desligar rede (offline). <br> 2. Criar evento (muda UI local). <br> 3. Ligar rede e forçar reload/pull antes do worker rodar. <br> 4. Observar dado sumir. | O `pull.ts` deve re-aplicar operações pendentes da `queue_ops` após atualizar a tabela `state_*` (Rebase local). |
| **2 (Alta)** | **Performance do Pull (Escalabilidade)** | `pull.ts` faz `select *` sem filtros de paginação ou `updated_at` (delta sync). | **Travamento:** Em fazendas com >5k animais ou >10k eventos, o app vai ficar lento ou estourar memória no mobile. | 1. Popular DB com 10k registros em `eventos`. <br> 2. Rodar sync/pull no mobile. <br> 3. Monitorar memória e tempo de resposta. | Implementar "Delta Sync": Enviar `last_pulled_at` e baixar apenas modificados. Usar paginação. |
| **3 (Alta)** | **Duplicação de Lógica de Negócio** | O status reprodutivo é calculado no Frontend (memória) e no Backend (`vw_repro_status_animal`). | **Inconsistência:** Relatórios (SQL) podem mostrar dados diferentes da Tela (JS) se as regras divergirem. | 1. Identificar animal com histórico complexo. <br> 2. Comparar status na tela vs resultado da view SQL. | Centralizar a lógica. Idealmente, o Frontend deve consumir o status calculado pelo Backend ("Smart Server, Dumb Client") ou usar a mesma lib (WASM/Shared JS). |
| **4 (Média)** | **Segurança RLS (Granularidade)** | Policies como `eventos_insert_by_membership` permitem que qualquer membro insira eventos. | **Segurança:** Um usuário com role `cowboy` pode inserir eventos `financeiro` ou `sanitario` complexos indevidamente. | 1. Autenticar com usuário `cowboy`. <br> 2. Usar console JS para invocar `supabase.from('eventos_financeiro').insert(...)`. | Refinar RLS: `check (public.role_in_fazenda(fazenda_id) in ('owner', 'manager'))` para domínios sensíveis. |
| **5 (Média)** | **Gerenciamento de Erros de Sync** | Se o `sync-batch` falhar parcialmente (ex: timeout no meio do lote), o estado local pode ficar inconsistente. | **Corrupção de Dados Local:** O cliente pode achar que falhou e tentar de novo (duplicando) ou achar que sucesso e perder dados. | 1. Criar gesto com 10 operações. <br> 2. Simular falha de rede após a 5ª operação no servidor (via proxy/mock). | Garantir idempotência no servidor (`client_tx_id`) e transacionalidade atômica no `sync-batch`. |
| **6 (Média)** | **Limpeza de Dados (Soft Delete)** | O `pull.ts` baixa registros com `deleted_at` (tombstones) e salva no Dexie. | **Bloat:** O banco local cresce indefinidamente com lixo. | 1. Deletar 100 animais no servidor. <br> 2. Fazer pull total. <br> 3. Verificar count em `state_animais` no Dexie. | O `pull` deve baixar tombstones para processar deletes, mas depois removê-los fisicamente do Dexie após confirmação. |
| **7 (Baixa)** | **Token Refresh Loop** | O `syncWorker` tenta refresh do token. Se falhar, o loop continua tentando com backoff? | **Bateria/Rede:** Loop infinito de tentativas de auth falhas pode drenar recursos. | 1. Invalidar token (revoke) no server. <br> 2. Observar console logs do worker tentando refresh. | Implementar "Kill Switch" no worker após N falhas de Auth consecutivas (exigir re-login manual). |
| **8 (Baixa)** | **Hardcoded Table List** | A lista de tabelas no `pull.ts` (`DEFAULT_REMOTE_TABLES`) é hardcoded. | **Manutenção:** Adicionar uma nova tabela no backend exige mudar o código do frontend, ou o sync não funcionará para ela. | 1. Criar tabela `teste_nova` no backend. <br> 2. Tentar usar no sync sem alterar `pull.ts`. | Tornar a lista dinâmica ou baseada em configuração centralizada (`tableMap.ts`). |
| **9 (Baixa)** | **Schema Versioning Dexie** | Mudanças no schema local exigem incremento de versão e migração manual no `db.ts`. | **Crash na Atualização:** Se a migração falhar (ex: dados incompatíveis), o app não abre. | 1. Alterar `db.ts` incrementando versão com store incompatível. <br> 2. Recarregar app com dados antigos. | Testes rigorosos de migração de schema Dexie. Considerar reset automático em caso de erro fatal de schema (com aviso). |
| **10 (Baixa)** | **Observabilidade** | Logs são apenas `console.log`. | **Debug:** Impossível diagnosticar problemas de sync em produção (dispositivos de usuários). | 1. Simular bug no sync em dispositivo móvel. <br> 2. Tentar acessar logs remotamente. | Implementar log estruturado local que é enviado ao servidor periodicamente ou em caso de erro (Telemetry). |

## 4. Referências de Arquivos

- **Configuração DB:** `src/lib/offline/db.ts`
- **Sync Worker:** `src/lib/offline/syncWorker.ts`
- **Lógica de Pull:** `src/lib/offline/pull.ts`
- **Operações Locais:** `src/lib/offline/ops.ts`
- **Construção de Eventos:** `src/lib/events/buildEventGesture.ts`
- **Backend Schema:** `supabase/migrations/` (Principalmente `0001_init.sql`, `0004_rls_hardening.sql`)
