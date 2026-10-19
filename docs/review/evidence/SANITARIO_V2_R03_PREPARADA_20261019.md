# R03 — importação dos 20 rascunhos preparada

**Estado: preparação local concluída; importação remota não autorizada e não executada.**
Destino previsto: projeto existente `zqloazqzhwauamcejmuz`, após R01 e deploy R02 v28.

## Artefato concreto

[Candidato de revisão](SANITARIO_V2_R03_CANDIDATE_20261019.json), 163429 bytes,
SHA256 `2b3adab34d0eb58dcc5d8fa976d1cd852d41f204e00063b776e2271d60753fe6`.
Gerado pelo preparador existente, sem modificar o canônico:

```text
node scripts/codex/prepare-sanitario-approval-v2.mjs --out docs/review/evidence/SANITARIO_V2_R03_CANDIDATE_20261019.json
node scripts/codex/import-sanitario-protocols-v2.mjs --validate --review-candidate docs/review/evidence/SANITARIO_V2_R03_CANDIDATE_20261019.json
```

Resultados observados: `REVIEW_CANDIDATE_VALID` e `12G validate OK`.
Os 20 itens estão em `draft`, zero `allows_agenda_auto`, zero aprovações assinadas,
`execute_import=false` e `import_gate.import_real_authorized=false`.
Há sete itens preparados para submissão global, sete dependentes de evidências comerciais
específicas e seis formulários de avaliação em fazenda. Nenhuma dessas classificações
equivale a aprovação ou liberação operacional.

## Escopo de dados do candidato

| Tabela | Linhas propostas |
|---|---:|
| sanitario_protocolo_itens_versions_v2 | 20 rascunhos |
| sanitario_protocolos_v2 | 10 protocolos pais |
| sanitario_fontes_tecnicas_v2 | 16 |
| sanitario_fonte_cobertura_campos_v2 | 71 |
| sanitario_produtos_v2 | 3 rascunhos, precisa_validar |
| sanitario_product_classes_v2 | 8 |
| sanitario_product_class_groups_v2 | 4 |
| sanitario_product_class_group_members_v2 | 12 |
| Outras seis coleções de regras/autorizações de produto | 0 |

São 144 linhas candidatas no total, incluindo dependências dos 20 itens. O plano de
escrita exato deve ser conferido contra o estado transacional na R03; não se declara aqui
um dry-run remoto já executado. As quatro rejeições de membros são diagnósticos do
validador, sem linhas adicionais propostas.

## Execução delimitada para a autorização R03

1. Vincular a autorização exclusivamente a este hash e às dependências acima.
2. Preparar a promoção explícita do candidato para a entrada canônica do publisher,
   preservando UUIDs, versões, status draft e todos os flags operacionais desligados.
   O importer atual rejeita `--apply --review-candidate`; não se deve contornar esse guard.
3. Executar dry-run transacional dirigido desse artefato, conferir somente suas alterações
   e aplicar atomicamente com o publisher existente após o plano conferir. Evitar comandos
   de conexão CLI que renovem o login auxiliar observado na R01.
4. Conferir contagens, vínculos, idempotência do plano convergido, zero aprovações,
   gates OFF e ausência de novas Agendas/Eventos/estoque.

R03 não concede superadmin, não aprova catálogo e não ativa geração automática.
R04 e R05 continuam separadas. A fazenda futura “Homologação Sanitário V2” permanece
pendente de criação autorizada na R05; não é requisito para importar rascunhos globais.
O curador existente já identificado permanece sem concessão nesta fase.
