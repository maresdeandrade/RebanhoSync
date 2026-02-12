# Tarefas de Implementacao - Fase 1 e Fase 2

Data: 2026-02-11
Referencia: `docs/PLANO_UNIFICACAO_EVENTOS_V3_IMPLANTACAO.md`

## 1. Fase 1 - Unificacao de escrita no cliente

Objetivo: todos os dominios criarem eventos via pipeline unico.

### F1-01 Criar tipos canonicos de eventos

Arquivos:

1. `src/lib/events/types.ts` (novo)

Implementacao:

1. Definir `EventDomain`, `EventoBaseInput`.
2. Definir `SanitarioInput`, `PesagemInput`, `MovimentacaoInput`, `NutricaoInput`, `FinanceiroInput`.
3. Definir `EventGestureBuildResult` (`client_tx_id?`, `ops`).

Aceite:

1. Tipos cobrem todos os campos MVP do schema.
2. Nenhum tipo de dominio usa coluna inexistente no schema.

### F1-02 Criar validadores comuns

Arquivos:

1. `src/lib/events/validators/common.ts` (novo)

Implementacao:

1. Validar `occurred_at` (formato e janela temporal).
2. Validar alvo (`animal_id` xor `lote_id` quando aplicavel).
3. Validar campos comuns (`dominio`, observacoes, payload).

Aceite:

1. Erros retornam `code`, `field`, `message`.

### F1-03 Criar validadores por dominio

Arquivos:

1. `src/lib/events/validators/sanitario.ts` (novo)
2. `src/lib/events/validators/pesagem.ts` (novo)
3. `src/lib/events/validators/movimentacao.ts` (novo)
4. `src/lib/events/validators/nutricao.ts` (novo)
5. `src/lib/events/validators/financeiro.ts` (novo)

Implementacao:

1. Sanitario: `tipo` e `produto`.
2. Pesagem: `peso_kg > 0`.
3. Movimentacao: destino obrigatorio, origem != destino.
4. Nutricao: `alimento_nome` e `quantidade_kg > 0` quando informado.
5. Financeiro: `tipo`, `valor_total > 0`.

Aceite:

1. Suite unitaria por validador.

### F1-04 Criar builder unificado de gesture

Arquivos:

1. `src/lib/events/buildEventGesture.ts` (novo)

Implementacao:

1. Gerar `eventos` + detalhe (`eventos_*`) por dominio.
2. Resolver evento composto de movimentacao:
   1. INSERT `eventos`
   2. INSERT `eventos_movimentacao`
   3. UPDATE `animais.lote_id`/`pasto_id`
3. Incluir `source_task_id` quando execucao vem da agenda.

Aceite:

1. Builder retorna `OperationInput[]` valido para `createGesture()`.
2. Operacao de movimentacao passa no pre-check anti-teleporte.

### F1-05 Integrar builder no fluxo de registro

Arquivos:

1. `src/pages/Registrar.tsx`
2. `src/lib/offline/ops.ts` (apenas se necessario para suporte)

Implementacao:

1. Substituir montagem manual de ops pela factory unica.
2. Mapear erros de validacao por campo.
3. Habilitar fluxo de nutricao e financeiro no registrar (MVP minimo).

Aceite:

1. Registro funcional de 5 dominios.
2. Sync offline funcionando sem regressao.

### F1-06 Cobertura de testes Fase 1

Arquivos:

1. `src/lib/events/__tests__/*` (novos)

Implementacao:

1. Testes unitarios para builder e validadores.
2. Teste de regressao para movimentacao composta.

Aceite:

1. Todos os testes novos passando localmente.

## 2. Fase 2 - Hardening de banco e sync

Objetivo: elevar integridade e previsibilidade de rejeicoes.

Status atual:

1. `F2-01` concluida.
2. `F2-02` concluida.
3. `F2-03` concluida.
4. `F2-04` concluida.
5. `F2-05` concluida.
6. `F2-06` concluida (suite em `supabase/functions/sync-batch/rules.test.ts` + `src/lib/offline/__tests__/syncOrder.test.ts` e cenarios E2E atualizados).

### F2-01 Migration de hardening financeiro

Arquivos:

1. `supabase/migrations/0023_hardening_eventos_financeiro.sql` (novo)

Implementacao:

1. Adicionar `check (valor_total > 0)` em `eventos_financeiro`.
2. Avaliar/ajustar dados legados invalidos antes de validar constraint.

Aceite:

1. Migration aplica com sucesso em base limpa e base com dados.

### F2-02 Migration de hardening nutricao

Arquivos:

1. `supabase/migrations/0024_hardening_eventos_nutricao.sql` (novo)

Implementacao:

1. Constraint para `quantidade_kg` positiva quando nao nula.

Aceite:

1. Inserts invalidos passam a ser rejeitados com erro de constraint.

### F2-03 Migration de hardening movimentacao

Arquivos:

1. `supabase/migrations/0025_hardening_eventos_movimentacao.sql` (novo)

Implementacao:

1. Constraint de destino obrigatorio (`to_lote_id` ou `to_pasto_id`).
2. Constraint `from` diferente de `to` para lote e pasto quando ambos preenchidos.

Aceite:

1. Casos invalidos rejeitados no banco.

### F2-04 FK tenant-safe para financeiro/contrapartes

Arquivos:

1. `supabase/migrations/0026_fk_eventos_financeiro_contrapartes.sql` (novo)

Implementacao:

1. Criar indice unico composto em `contrapartes(id, fazenda_id)` se necessario.
2. Adicionar FK composta em `eventos_financeiro(contraparte_id, fazenda_id)`.

Aceite:

1. Nao permite `contraparte_id` de outra fazenda.

### F2-05 Padronizar reason codes no sync-batch

Arquivos:

1. `supabase/functions/sync-batch/index.ts`

Implementacao:

1. Definir catalogo de `reason_code` (ex.: `VALIDATION_ERROR`, `ANTI_TELEPORTE`, `BLOCKED_TABLE`, `UNIQUE_CONFLICT`, `INTERNAL_ERROR`).
2. Padronizar estrutura de erro por operacao.
3. Manter compatibilidade com `APPLIED_ALTERED` para dedup agenda.

Aceite:

1. Resposta do sync previsivel para UI de reprocessamento.

### F2-06 Atualizar testes de integracao de sync

Arquivos:

1. `supabase/functions/sync-batch/*test*` (criar/ajustar conforme stack atual)
2. `docs/E2E_MVP.md` (atualizacao de cenarios)

Implementacao:

1. Casos de aceite e rejeicao por dominio.
2. Caso anti-teleporte.
3. Caso dedup agenda (`APPLIED_ALTERED`).

Aceite:

1. Cenarios criticos cobertos e documentados.

## 3. Dependencias e ordem recomendada

1. F1-01 -> F1-02 -> F1-03 -> F1-04 -> F1-05 -> F1-06
2. F2-01/F2-02/F2-03/F2-04 podem ser preparados em paralelo.
3. F2-05 depende de definicao final de validadores e constraints.
4. F2-06 fecha a fase apos todas as anteriores.

## 4. Definition of Done por fase

Fase 1 concluida quando:

1. Todos os dominios usam builder unico.
2. Registro offline-first dos 5 dominios validado.

Fase 2 concluida quando:

1. Constraints e FKs aplicadas em producao sem regressao.
2. `sync-batch` retorna erros padronizados.
3. Testes de integracao/E2E atualizados e aprovados.
