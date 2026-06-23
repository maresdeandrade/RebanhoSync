# Relatorio ajuste curatorial e UX Catalogo Sanitario v2

Data: 2026-06-21

## Decisao

O Catalogo Sanitario v2 permanece read-only/offline-first. O patch remove duplicidade curatorial de raiva, evita concorrencia de leptospirose em matrizes pre-parto e melhora a exibicao tecnica de ProductClassGroup e limitacoes estruturadas.

## Resultado funcional

- `raiva_herbivoros` mantem exatamente tres itens ativos: `raiva_primovac_dose1`, `raiva_primovac_reforco_30d` e `raiva_reforco_anual_area_risco`.
- `raiva_area_risco_anual` permanece tombstonado/inativo.
- `matrizes_pre_parto` mantem ativo apenas `matrizes_pre_parto_antiparasitario`.
- `matrizes_pre_parto_lepto_reforco_situacional` foi tombstonado/inativo para nao concorrer com o protocolo proprio `leptospirose`.
- Contagem ativa esperada: 10 protocolos, 20 itens, 4 ProductClassGroups e 16 members bloqueados.
- A UI mostra nome tecnico do ProductClassGroup e limitacoes textuais/estruturadas, sem UUID cru.

## Guardrails

Nenhuma migration, schema, RLS, Edge Function, push, `queue_ops`, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criada.
