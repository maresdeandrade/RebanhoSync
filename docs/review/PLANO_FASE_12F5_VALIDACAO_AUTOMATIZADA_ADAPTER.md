# Plano Fase 12F5 — Validacao automatizada do adapter candidato

Atualizado em: 2026-06-14

## 1. Decisao executiva

Decisao: `FASE 12F5 CONCLUIDA COMO VALIDACAO AUTOMATIZADA NAO DESTRUTIVA`.

A 12F5 criou e executou um script local, deterministico e somente leitura para validar os artefatos do adapter 12F4. O script passou com exit code 0.

Resultado:

- `PASS`: 300;
- `WARNING`: 1;
- `FAIL`: 0.

Nenhum seed/import foi aplicado. Nenhuma migration, schema, runtime funcional, UI, Dexie, sync, agenda, evento, estoque, carencia ativa ou liberacao operacional foi criado.

## 2. Script criado

Script:

- `scripts/codex/validate-sanitario-adapter-payloads-12f5.mjs`

Caracteristicas:

- Node.js puro;
- sem dependencia externa nova;
- somente leitura;
- le arquivos Markdown;
- extrai blocos JSON;
- valida contagens, enums, flags proibidas, rejeicoes, B19, aftosa, ProductClassGroups, SourceRefs/RotationRules e invariantes sanitarios;
- nao conecta ao banco;
- nao chama Supabase;
- nao grava arquivos;
- retorna exit code 0/1.

## 3. Regras validadas

Categorias validadas:

- flags proibidas;
- contagens esperadas;
- enums SQL reais de protocolos;
- B19 nacional;
- aftosa archived/blocked;
- tabela de itens adaptaveis;
- exemplos JSON completos de B19 e aftosa;
- rejeicoes obrigatorias de itens ProductClassGroup;
- bloqueio de ProductClassGroup members sem `class_id`;
- ProductClassGroups adaptados;
- SourceRefs vs SourceGaps vs SourcePolicy;
- RotationRules em JSONB;
- invariantes sanitarios.

## 4. Resultado do script

Comando executado:

```bash
node scripts/codex/validate-sanitario-adapter-payloads-12f5.mjs
```

Resultado:

```txt
PASS: 300
WARNING: 1
FAIL: 0
```

Warning:

- `12F4 documenta exemplos JSON completos para todos os 13 itens adaptaveis`.

Interpretacao: a 12F4 tem tabela documental para os 13 itens adaptaveis e exemplos JSON completos para B19/aftosa. Isso nao bloqueia 12F5, mas orienta 12F6/12F7 caso a proxima etapa exija payload JSON completo por item.

## 5. Falhas encontradas

Nenhuma falha P0/P1 foi encontrada pelo script.

## 6. Ajustes documentais feitos

Criados:

- `docs/review/PLANO_FASE_12F5_VALIDACAO_AUTOMATIZADA_ADAPTER.md`;
- `docs/review/evidence/VALIDACAO_AUTOMATIZADA_ADAPTER_12F5.md`;
- `docs/review/evidence/RESULTADO_VALIDACAO_ADAPTER_12F5.md`;
- `docs/review/evidence/REGRAS_VALIDACAO_ADAPTER_12F5.md`.

Atualizados:

- docs ativos de fase/status/roadmap/dominio.

## 7. Bloqueios preservados

- ProductClassGroup em item continua rejeitado por `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`.
- ProductClassGroup members continuam bloqueados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.
- Nenhum `class_id` foi inventado.
- Nenhum ProductClassGroup foi convertido para `product_class`, `specific_product` ou `none`.
- B19 permanece nacional.
- Aftosa permanece archived/blocked.
- `agenda_allowed` e `approved_for_catalog` permanecem zero.

## 8. Criterios para 12F6

12F6 pode avancar somente como decisao estrutural sobre ProductClassGroup em itens, ainda sem seed/import real, escolhendo uma das alternativas:

- migration para suportar `product_class_group`;
- tabela ponte de item requirement group;
- manter itens antiparasitarios fora do import ate redesign;
- outro adapter formal sem perda semantica.

Nao seguir para seed/import real enquanto ProductClassGroup e `class_id` estiverem bloqueados.
