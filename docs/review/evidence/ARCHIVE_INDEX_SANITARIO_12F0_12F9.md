# Archive Index Sanitario 12F0-12F9

Data: 2026-06-15

Este indice reduz a necessidade de reabrir todos os artefatos intermediarios. Ele nao move arquivos e nao cria `docs/archive`.

## Fonte final vigente

- `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json` - payload final candidato para 12G0.
- `docs/review/evidence/SANITARIO_PROTOCOLS_V2_DECISION_RECORD_12F10.md` - decisoes finais.
- `docs/review/evidence/SANITARIO_PROTOCOLS_V2_IMPORT_GATE_12F10.md` - gate obrigatorio antes de dry-run/import.

## Evidencias intermediarias

| Fase | Uso atual |
|---|---|
| 12F0 | curadoria inicial; evidencia historica |
| 12F1 | normalizacao tecnica; evidencia historica |
| 12F2 | payload candidato inicial; substituido para execucao futura |
| 12F3 | validacao contra schema real; evidencia de bloqueios |
| 12F4 | adapter/normalizer candidato; evidencia de mapeamento |
| 12F5 | validacao automatizada do adapter; evidencia de regras |
| 12F6 | decisao estrutural ProductClassGroup; evidencia normativa |
| 12F7 | migration controlada ProductClassGroup; schema ativo |
| 12F8 | revalidacao ProductClassGroup; evidencia de adaptacao |
| 12F9 | JSONs completos de origem; substituidos como fonte preferencial pelo payload canonico 12F10 |

## Regra de uso

Para 12G0 e fases futuras, usar o payload canonico 12F10. Consultar artefatos 12F0-12F9 apenas para auditoria, justificativa ou investigacao de divergencia.
