# Saneamento sanitario v2 - UI legada e raiva

Data: 2026-06-21

## Decisao

Manter o Catalogo Sanitario v2 como superficie principal read-only e ocultar as interfaces legadas sem dado historico util: Pack Oficial, Conformidade e Protocolos da fazenda.

## Patch

- `/protocolos-sanitarios` virou hub read-only para `/protocolos-sanitarios/catalogo-v2`.
- `raiva_herbivoros` passou de um item ativo para tres itens ativos:
  - `raiva_primovac_dose1`;
  - `raiva_primovac_reforco_30d`;
  - `raiva_reforco_anual_area_risco`.
- `raiva_area_risco_anual` foi tombstonado pelo importador controlado.

## Guardrails

- Nenhum item de raiva permite `allows_agenda_auto=true`.
- Nenhum item de raiva promove approval.
- ProductClassGroup members seguem rejeitados sem `class_id`.
- Nenhuma agenda, evento, estoque, carencia ativa ou liberacao operacional foi criada.

## Validacao de dados

- `--validate`: 10 protocolos, 21 itens, 4 ProductClassGroups, 16 rejeicoes.
- `--apply`: `{"create":3,"update":1,"skip":32,"reject":16}`.
- `--dry-run` pos-apply: `{"create":0,"update":0,"skip":35,"reject":16}`.
