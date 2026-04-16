---
paths:
  - "supabase/migrations/**"
  - "supabase/functions/sync-batch/**"
  - "docs/DB.md"
  - "docs/RLS.md"
  - "docs/CONTRACTS.md"
---

# RebanhoSync — DB / RLS / Contracts Rules

Leia:
1. `docs/DB.md`
2. `docs/RLS.md`
3. `docs/CONTRACTS.md`

Regras estruturais:
- Tabela tenant-scoped deve carregar `fazenda_id` quando aplicável.
- Relações internas multi-tenant devem usar FK composta com `fazenda_id` quando aplicável.
- Tabelas de fatos/eventos permanecem append-only.
- `user_fazendas` não deve ganhar escrita direta.
- RPC privilegiada exige:
  - `SECURITY DEFINER`
  - validação explícita
  - `search_path = public`
- Policies não podem abrir bypass cross-tenant.

Catálogo global:
- Só criar tabela global sem `fazenda_id` quando a exceção for intencional e justificada.
- Catálogo global não deve virar tabela tenant-scoped por conveniência.

Contratos:
- Mudança em payload versionado exige:
  - schema claro
  - validação local
  - validação autoritativa no servidor
  - atualização de docs normativos
  - testes

Checklist antes de migration:
1. A entidade é tenant-scoped ou global?
2. Precisa de RLS?
3. Precisa de FK composta?
4. É estado mutável ou fato append-only?
5. Há impacto em offline/sync?
6. Precisa de ADR?

Quando tocar estrutura, revisar:
- `docs/DB.md`
- `docs/RLS.md`
- `docs/CONTRACTS.md`