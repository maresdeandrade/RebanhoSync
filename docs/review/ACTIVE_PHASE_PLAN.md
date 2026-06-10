# ACTIVE_PHASE_PLAN - Fase 12D6

**Status:** Fase 12D6 concluída como implementação de schema SQL, tabelas e RLS.
**Foco:** Persistência de dados para ProductClass, ProductClassGroup e políticas de execução.
**Criado:** 2026-06-10
**Atualizado:** 2026-06-10
**Plano base:** 12D6 — Schema SQL, RLS e Tabelas no Banco de Dados para ProductClass

---

## Objetivo em 1 parágrafo

Criar a base física no Supabase/Postgres (schema SQL e RLS) para persistir as entidades `ProductClass`, `ProductClassGroup`, seus memberships e regras default por classe, respeitando o isolamento multitenant. A implementação foca estritamente no banco de dados e não altera persistência local (Dexie), sincronização, UI ou regras de negócio frontend.

---

## Decisão 12D6

Decisão: `PROSSEGUIR COM ESCOPO DEFINIDO`.

Implementação autorizada nesta fase:
- Criar a migration SQL para persistência de `ProductClass`, `ProductClassGroup`, group members e default rules.
- Implementar enums SQL e constraints garantindo coerência (ex. default rules requerendo snapshot em execução).
- Adicionar chaves e índices otimizados para busca tenant-aware.
- Configurar políticas de RLS baseadas nos metadados de fazenda (leitura global e tenant, escrita restrita a tenant managers).
- Adicionar triggers para `updated_at`.

Implementação não autorizada nesta fase:
- Alterar Dexie/offline stores;
- Alterar sync-batch edge functions;
- Alterar UI ou fluxos operacionais;
- Materializar agenda ou gerar seed curatorial real;
- Inserir carência ativa em nível de banco de dados;

---

## Evidência técnica

Arquivos gerados/alterados:
- `supabase/migrations/20260610233557_sanitario_product_class_v2.sql` (novo)

---

## Critérios de aceite da fase

- [x] Migration SQL nova criada.
- [x] Tabela de `ProductClass` criada.
- [x] Tabela de `ProductClassGroup` criada.
- [x] Tabela de membership grupo↔classe criada.
- [x] Tabela de default rules criada.
- [x] Status curatorial persistível.
- [x] Status de automação persistível.
- [x] `ExecutionProductPolicy` persistível.
- [x] Constraints impedem combinações críticas inválidas.
- [x] RLS habilitada em todas as tabelas novas com global read e tenant-scoped write.
- [x] Índices mínimos criados.
- [x] Comentários SQL documentam os limites sanitários.
- [x] Nenhuma seed curatorial final criada.
- [x] Nenhum Dexie/sync/UI alterado.

---

## Próxima fase segura

`12D7 — Integração Offline (Dexie) e Sincronização`

Escopo mínimo da próxima fase: Conectar as novas tabelas SQL criadas na 12D6 ao Dexie e adaptar as functions sync-batch para o envio/recebimento de dados.
