# ACTIVE_PHASE_PLAN - Fase 12D6

**Status:** Fase 12D6 em andamento — Criação do Schema SQL, RLS e Tabelas no Banco de Dados para ProductClass.
**Foco:** Persistência física de ProductClass, ProductClassGroup, default rules e memberships.
**Criado:** 2026-06-10
**Atualizado:** 2026-06-10
**Plano base:** 12D6 — Schema SQL, RLS e Tabelas no Banco de Dados para ProductClass

---

## Objetivo em 1 parágrafo

Traduzir os contratos TypeScript validados na Fase 12D5 em estruturas físicas de tabelas no Supabase/Postgres (`sanitario_product_classes_v2`, `sanitario_product_class_groups_v2`, `sanitario_product_class_group_members_v2` e `sanitario_product_class_default_rules_v2`), protegendo os dados com políticas de Row Level Security (RLS) alinhadas às regras de tenant (`fazenda_id`) e validando a pertinência de escopos por triggers `BEFORE INSERT OR UPDATE` no banco, sem integrar UI, offline/sync ou seeds operacionais reais.

---

## Decisão 12D6

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementação autorizada nesta fase:
- criar migration física para as novas tabelas v2;
- configurar RLS select, insert, e update policies reutilizando o padrão do projeto (`role_in_fazenda` e `has_membership`);
- configurar triggers de validação de coerência e de timestamp;
- criar índices parciais específicos para evitar colisões com nulos.

Implementação não autorizada nesta fase:
- seeds curatoriais ou dados comerciais reais;
- conexões com offline (Dexie) ou sincronização (sync-batch);
- alterações na UI ou nos fluxos de agenda/evento ativos.

---

## Evidência técnica

Arquivos gerados/alterados:
- `supabase/migrations/20260610203500_sanitario_product_class_v2.sql` (novo)

---

## Critérios de aceite da fase

- [x] Migration SQL criada no padrão de timestamp.
- [x] Tabelas `sanitario_product_classes_v2`, `sanitario_product_class_groups_v2`, `sanitario_product_class_group_members_v2` e `sanitario_product_class_default_rules_v2` criadas.
- [x] Constraints impedem cardinalidades zeradas ou tipos inválidos.
- [x] RLS ativada e policies configuradas com WITH CHECK estritos para escritas.
- [x] Triggers BEFORE INSERT OR UPDATE implementados para integridade e bloqueio de soft-deletes.
- [x] Privilégios de DELETE omitidos nos grants para authenticated.
- [x] Comentários SQL documentando as restrições sanitárias inseridos.
- [x] Sem seeds, Dexie ou UI conectados.

## Próxima fase segura

`12E — Offline/sync da Fundação Sanitária v2, incluindo ProductClass e Agenda Sanitária v2`
