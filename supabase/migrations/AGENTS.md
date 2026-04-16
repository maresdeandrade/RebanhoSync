# MIGRATIONS / DB / RLS LOCAL AGENT

Escopo:
- `supabase/migrations/**`
- `docs/DB.md`
- `docs/RLS.md`
- `supabase/functions/**` só se a migration exigir alinhamento de regra
- não tocar UI sem necessidade explícita

Leia primeiro:
1. `docs/DB.md`
2. `docs/RLS.md`
3. `docs/ARCHITECTURE.md`

Leia só se necessário:
- `docs/CONTRACTS.md`
- `docs/OFFLINE.md`
- `docs/CURRENT_STATE.md`

Foco deste diretório:
- schema lógico
- FKs compostas com `fazenda_id`
- enums
- views de leitura
- triggers append-only
- policies RLS
- RPCs `SECURITY DEFINER`
- catálogos globais vs tabelas tenant-scoped

Invariantes obrigatórias:
- tabela tenant-scoped deve carregar `fazenda_id` quando aplicável
- FK interna deve incluir `fazenda_id` quando aplicável
- eventos continuam append-only
- políticas RLS continuam exigindo membership / role corretos
- `user_fazendas` não ganha escrita direta
- `SECURITY DEFINER` exige validação explícita + `search_path = public`
- tabela global precisa ser exceção intencional e documentada
- migration deve ser idempotente/segura o suficiente para evolução incremental

Checagens mentais antes de alterar:
1. Esta tabela é tenant-scoped ou catálogo global?
2. Precisa de FK composta?
3. É fato append-only ou estado mutável?
4. Precisa de policy, trigger, RPC ou view?
5. A mudança exige update nos docs normativos?
6. Há impacto no Dexie schema / pull / tableMap?

Evitar:
- FK simples quando a relação é multi-tenant
- policy recursiva consultando a própria tabela
- criar coluna derivada que deveria ser projeção
- embutir regra de negócio opaca em migration sem documentação
- migration acoplada a dado transitório de auditoria

Entrega esperada:
- migration mínima
- justificativa da modelagem
- impacto em RLS/FKs/views
- até 3 riscos

Validação mínima:
- `pnpm test`
- `pnpm run lint`
- `pnpm run build`

Quando atualizar docs:
- `docs/DB.md`
- `docs/RLS.md`
- `docs/CONTRACTS.md` se tocar sync
- derivados só se houver mudança funcional real

Quando escalar:
- se mudar contrato de sync, modelo canônico, RLS/RBAC estrutural ou estratégia offline-first -> avaliar ADR