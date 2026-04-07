# ADR-0002: Catálogo de Produtos Veterinários como Tabela Global

> **Status:** Aceito
> **Data:** 2026-04-07
> **Autores:** Revisão de auditoria técnica

---

## Contexto

A migration `20260308230824_produtos_veterinarios_ui.sql` criou a tabela `produtos_veterinarios` para resolver o TD-011 (produtos sanitários em texto livre). O design adotado é diferente do padrão geral do sistema.

---

## Decisão

A tabela `produtos_veterinarios` é **global** (não tem coluna `fazenda_id`), ao contrário de todas as tabelas operacionais do sistema que são tenant-scoped.

**Motivação:**
- O catálogo de produtos é compartilhado entre todos os produtores
- Produtos como "Ivermectina" ou "Vacina Aftosa" são nomes canônicos, não específicos por fazenda
- Permite que o catálogo central seja enriquecido uma vez e beneficie todos os tenants
- É somente leitura pelo cliente (sem write via sync-batch)

**Contrato de acesso:**
- `SELECT`: pública para qualquer `authenticated` (RLS policy existente)
- `INSERT/UPDATE/DELETE`: sem política permissiva (seed-only via migrations)
- Se o catálogo precisar crescer dinamicamente: criar RPC `SECURITY DEFINER` com controle de acesso explícito (ex.: somente `admin` ou `owner`)

**Posição no sistema:**
- Não entra no `tableMap.ts` (não é sincronizada via sync-batch)
- Não entra nos stores Dexie (opcional: pode ser buscada diretamente via Supabase para autocomplete, com fallback offline)
- Integração de UI pendente: autocomplete em `Registrar.tsx` (TD-022)

---

## Alternativas Consideradas

**Opção A: Tabela tenant-scoped com seed por fazenda**
- Descartada: duplicação desnecessária; um produto é o mesmo produto independente da fazenda.

**Opção B: Enum de banco de dados**
- Descartada: enums são rígidos e exigem migrations para expansão.

**Opção C: Hardcode no frontend**
- Descartada: dificulta manutenção e não permite expansão sem deploy.

---

## Consequências

**Positivas:**
- Catálogo centralizado e fácil de manter
- Leitura simples do cliente (sem filtro de tenant)

**Negativas:**
- Violação do padrão "tudo tem fazenda_id" — requer documentação explícita
- Sem granulação por tenant: produtores não podem ter catálogos personalizados por fazenda (limitação aceita para v1)
- Acesso de escrita precisa ser protegido explicitamente (não há default safe como nas tabelas tenant)

---

## Veja Também

- [DB.md](../DB.md) — documentação da tabela
- [RLS.md](../RLS.md) — nota sobre políticas da tabela global
- `supabase/migrations/20260308230824_produtos_veterinarios_ui.sql`
