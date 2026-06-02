# Fase 6 — Sanitária em Staging + RLS/Multi-tenant + Sync/Replay

Atualizado em: 2026-06-02  
**Baseline Commit:** `32d7779`

## 1. Fonte de continuidade

Fontes principais:

- `docs/review/Relatorio Consolidado.md`
- `docs/review/Gate Pos-MVP Robustez Sanitaria Custo Snapshot Isolamento Comercial.md`

---

## 2. Estado consolidado anterior

O Gate Pós-MVP local foi concluído com sucesso.

Considerar concluído e não refazer:

- `retirado` existe em enum/migration.
- `retirado` permanece isolado de `ativo`, `vendido` e `morto`.
- Sociedade básica existe no Registrar.
- Sociedade permanece vínculo patrimonial.
- Sociedade não deve gerar conformidade sanitária.
- Sociedade não deve gerar financeiro automático.
- `classificationSnapshot` existe.
- `classificationSnapshot` é leitura operacional, não autorização crítica.
- `getCategoriaAtual` ficou restrito a helper legado em `src/lib/animals/categoriaHelper.ts`.
- Occupancy não usa mais `getCategoriaAtual`.
- Occupancy usa `resolveAnimalClassificationSnapshot`.
- `source` e `limitations` da classificação são propagados:
  - no adapter puro;
  - nos builders usados por `useOccupancyData`.
- Testes de occupancy passaram.
- Testes globais passaram.
- Lint passou.
- Build passou.
- Não houve alteração em Supabase, RLS, migrations, RPC, schema ou sync remoto.

---

## 3. Arquivos alterados no gate anterior

```txt
src/lib/animals/classificationSnapshot.ts
src/features/occupancy/classification.ts
src/features/occupancy/cockpitManejoAdapter.ts
src/features/occupancy/useOccupancyData.ts
src/features/occupancy/occupancyTypes.ts
src/features/occupancy/buildLoteOccupancyMetrics.ts
src/features/occupancy/buildPastoOccupancyMetrics.ts
src/features/occupancy/__tests__/*
docs/review/Gate Pos-MVP Robustez Sanitaria Custo Snapshot Isolamento Comercial.md
4. Pendências reais abertas

A próxima etapa deve atacar somente:

Fase 6 sanitária em staging.
Sync/retry/replay de eventos sanitários corretivos.
Validação RLS/multi-tenant para sanitário, estoque e sociedade.
Validação real de que sociedade não gera conformidade sanitária.
Validação real de que sociedade não gera financeiro automático.
Contrato formal de payload corretivo sanitário.
Política operacional para lote legado sem custo.
5. Objetivo da etapa

Executar:

Fase 6 — Robustez Sanitária em Staging + RLS/Multi-tenant + Sync/Replay

Prioridade:

robustez;
validação;
documentação técnica;
idempotência;
isolamento multi-tenant;
replay/retry seguro.

Não criar feature comercial avançada.

6. Contratos obrigatórios

Preservar:

Agenda = intenção/tarefa futura.
Evento = fato histórico append-only.
state_* = read model / estado atual.
Protocolo = regra/configuração, não execução.
Snapshot = evidência histórica congelada.
Financeiro = ledger explícito separado.
Sociedade = vínculo patrimonial.
Classificação = leitura operacional, não autorização crítica.
Tags/sinais/insights = auxiliares, nunca fonte primária.
7. Escopo permitido

Pode:

criar documentação técnica da Fase 6 em docs/review;
criar ou ajustar scripts de validação Supabase/staging;
criar ou ajustar testes de integração para:
sanitário;
correções;
estoque;
sociedade;
sync;
RLS;
multi-tenant;
formalizar contrato de payload corretivo sanitário;
formalizar política de lote legado sem custo;
validar replay/idempotência de eventos corretivos;
validar retry sem duplicidade;
validar que evento original não é alterado;
validar que correção cria novo evento vinculado;
validar fechamento de pendência corretiva por source_evento_id.
8. Escopo proibido

Não implementar:

venda;
abate;
DRE;
ROI;
custo por arroba;
motor comercial avançado;
aptidão automática para venda;
aptidão automática para abate;
carência liberatória;
financeiro automático;
dashboard econômico conclusivo.

Não transformar:

agenda em histórico;
protocolo em execução;
tag/sinal/insight em fonte primária;
classificação em autorização crítica;
sociedade em conformidade sanitária;
snapshot em valor recalculável retroativamente.
9. Áreas para auditoria

Auditar:

src/lib/sanitario
src/lib/inventory
src/lib/events
src/lib/comercial
src/pages/Registrar
src/features/operationalInsights
supabase/migrations
scripts/codex
docs/review

Não mexer em occupancy/classification salvo regressão comprovada.

10. Buscas obrigatórias

Executar equivalentes a:

rg "corrige_evento_id|source_evento_id|payload_correcao|tipo_correcao" src supabase scripts docs
rg "sanitaryCorrections|sanitaryExceptions|reconciliation" src
rg "insumo_movimentacoes|eventos_sanitario|snapshot|custo_unitario|custo_total" src supabase
rg "sociedade|RegistrarSociedadeSection|finance_transaction|finance_transactions" src supabase
rg "auth.uid|fazenda_id|policy|rls|tenant|owner|manager|cowboy|outsider" supabase scripts src
rg "sync|replay|retry|idempot" src scripts docs
rg "agenda_itens|source_evento_id|protocolos_sanitarios_itens|state_animais" src supabase
11. Diagnóstico antes do patch

Antes de alterar arquivos, entregar:

Estado atual da Fase 6.
O que já existe no repositório.
O que falta validar.
Riscos reais encontrados.
Arquivos candidatos a alteração.
Se será necessário alterar schema/RLS/RPC/migration.
Plano mínimo de patch.
12. Implementação prioritária
12.1 Robustez sanitária

Validar:

evento sanitário normal;
evento sanitário com consumo de estoque;
correção sanitária append-only;
evento original preservado;
read model de exceções;
pendência corretiva vinculada;
replay sem duplicidade;
retry sem duplicidade;
sync multi-dispositivo.
12.2 RLS/multi-tenant

Validar:

owner acessa sua fazenda;
manager acessa conforme papel;
cowboy acessa conforme papel;
outsider não acessa;
fazenda A não lê dados da fazenda B;
eventos sanitários respeitam tenant;
estoque respeita tenant;
sociedade respeita tenant.
12.3 Sociedade isolada

Validar:

entrada em sociedade não gera evento sanitário;
retirada patrimonial não gera conformidade sanitária;
encerramento de sociedade não gera finance_transaction;
sociedade não altera carência;
sociedade não altera aptidão sanitária;
sociedade não altera snapshot econômico.
12.4 Payload corretivo sanitário

Contrato mínimo:

schema_version
evento_origem_id
corrige_evento_id
tipo_correcao
motivo
payload_original_snapshot
payload_correcao
created_at
created_by
fazenda_id
idempotency_key

Regras:

evento original não é editado;
correção é novo evento;
replay deve ser idempotente;
payload deve manter compatibilidade futura;
ausência de campo gera bloqueio/parcial, não inferência crítica.
12.5 Lote legado sem custo

Política:

não recalcular histórico automaticamente;
marcar custo como ausente/parcial;
permitir correção manual futura;
consumo futuro usa custo disponível no momento do consumo;
relatórios exibem limitação quando custo faltar.
13. Testes esperados

Criar ou ajustar testes para:

Correção sanitária append-only.
Replay de correção sem duplicidade.
Retry de correção sem duplicidade.
Evento original preservado.
Pendência corretiva fechada apenas por source_evento_id.
Sociedade sem geração sanitária.
Sociedade sem geração financeira automática.
Snapshot econômico não retroativo.
Lote legado sem custo como parcial/ausente.
Isolamento multi-tenant, se houver estrutura disponível.
14. Validação obrigatória

Executar:

pnpm test -- src/lib/sanitario
pnpm test -- src/lib/inventory
pnpm test -- src/lib/events
pnpm test -- src/lib/comercial
pnpm test -- src/pages/Registrar
pnpm test -- --run
pnpm run lint
pnpm run build

Se houver alteração em migration, RLS, RPC, sync ou schema:

node scripts/codex/validate-supabase-baseline-functional.mjs
15. Critérios de aceite
 Fase 6 documentada.
 Correção sanitária validada como append-only.
 Replay/retry não duplica eventos.
 Evento original preservado.
 Pendência corretiva respeita source_evento_id.
 Sociedade validada como patrimonial.
 Sociedade não gera conformidade sanitária.
 Sociedade não gera finance_transaction.
 Snapshot econômico não retroativo validado.
 Lote legado sem custo tratado como parcial/ausente.
 RLS/multi-tenant validado ou pendência técnica explicitamente documentada.
 Testes relevantes criados/ajustados.
 pnpm test -- --run passou.
 pnpm run lint passou.
 pnpm run build passou.
 Validação Supabase executada se houve impacto em schema/RLS/RPC/sync.
16. Resultado final esperado

Entregar relatório em Markdown:

# Resultado — Fase 6 Sanitária em Staging + RLS/Multi-tenant + Sync/Replay

## 1. Fonte de continuidade

## 2. Resumo do que foi validado

## 3. Arquivos alterados

| Arquivo | Motivo |
|---|---|

## 4. Testes criados ou ajustados

| Teste | Cobertura |
|---|---|

## 5. Validação sanitária

## 6. Validação sync/retry/replay

## 7. Validação RLS/multi-tenant

## 8. Validação sociedade

## 9. Validação custo/snapshot

## 10. Comandos executados

| Comando | Resultado |
|---|---|

## 11. Pendências remanescentes

## 12. Próximo passo recomendado
17. Restrição final

Não avançar para:

relatórios econômicos;
venda;
abate;
DRE;
ROI;
custo por arroba.

Objetivo: transformar o gate local em validação real de robustez sanitária, RLS, sync e multi-tenant.


---

