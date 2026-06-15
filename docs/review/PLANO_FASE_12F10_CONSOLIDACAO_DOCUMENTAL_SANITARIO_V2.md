# Plano Fase 12F10 - Consolidacao documental Sanitario v2

Status: concluido localmente como consolidacao documental.
Data: 2026-06-15

## Objetivo

Reduzir a fragmentacao documental das fases 12F0-12F9 e definir uma fonte final para payload, decisao e gate dos Protocolos Sanitarios v2 antes de qualquer 12G0.

## Escopo

- consolidar os 4 JSONs 12F9 em um payload canonico;
- registrar decisoes finais sem repetir historico completo;
- registrar gate de import com bloqueios reais;
- apontar artefatos 12F0-12F9 como evidencia intermediaria/legada;
- atualizar docs vivos para indicar que 12G0 depende do gate 12F10.

## Fora do escopo

- migration, schema, RLS, seed/import ou insercao no banco;
- UI, Dexie, sync, Edge Function ou runtime operacional;
- agenda, evento, estoque, carencia ativa ou liberacao operacional;
- novos ProductClass, ProductClassGroup members, `class_id` ou UUID artificial.

## Fonte final

O arquivo final para proxima fase e:

`docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`

## Criterios de aceite

- no maximo 5 arquivos novos;
- payload canonico parseavel;
- contagens preservadas: 10 protocolos, 19 itens, 4 ProductClassGroups, 16 rejeicoes de members;
- `execute_import=false`;
- gate bloqueia 12G0 ate haver autorizacao explicita para dry-run/import real;
- `git diff --check` passa;
- validacao JSON local passa.
