# Comparação e Planejamento Conjunto — RebanhoSync  
## Frentes Sanitário + Comercial/Patrimonial/Classificação/Custo

**Versão atualizada pós-auditoria do repositório**  
**Data-base:** 2026-06-01

---

## 0. Nota de atualização

Este documento substitui a versão anterior da comparação entre as frentes:

1. **Frente 1 — Fase 9 Sociedade, Classification Snapshot e Custo de Estoque**
2. **Frente 2 — Sanitário Fases 1–5, Biossegurança e Reconciliação**

A auditoria do repositório mostrou que o documento anterior estava correto na direção estratégica, mas parcialmente desatualizado em alguns pontos de estado real do código.

Principais correções incorporadas:

- `retirado` já existe no enum local e em migration.
- `RegistrarSociedadeSection.tsx` já existe e contém fluxos básicos de sociedade.
- `classificationSnapshot` já existe e é consumido por `categoriaHelper.ts` via delegação; porém `getCategoriaAtual` ainda é usado diretamente em KPIs (`useOccupancyData.ts`, `cockpitManejoAdapter.ts`) sem propagação de `source`/`limitations`.
- O gate pós-MVP ainda existe como decisão/planejamento, mas não como artefato técnico único formal.
- A próxima etapa não é “criar sociedade” ou “criar retirado”; é **auditar, validar e endurecer o que já existe**.

---

# 1. Diagnóstico geral

## 1.1 Objetivo de cada frente

| Frente | Objetivo |
|---|---|
| **Frente 1 — Comercial/Patrimonial/Classificação/Custo** | Endurecer a base comercial/patrimonial, sociedade pecuária, leitura padronizada de classificação animal e custo real de estoque/snapshot econômico. |
| **Frente 2 — Sanitário/Biossegurança/Reconciliação** | Consolidar o domínio sanitário antes de avançar para comercial, venda, abate, sociedade operacional ampla ou financeiro avançado. |

## 1.2 Estado atual consolidado

| Frente | Estado atualizado |
|---|---|
| **Frente 1** | Base comercial/patrimonial estruturada; `classificationSnapshot` construído; custo de estoque/snapshot econômico implementado no core e UI `/insumos`; `retirado` já implementado em enum/migration; sociedade já possui componente e fluxos básicos; pendência real é validação global, sync, filtros, testes e documentação. |
| **Frente 2** | Fases sanitárias 1–5 concluídas; Fase 5 validada com correções append-only, read model de exceções, reconciliação sanitária e painel mínimo; próxima etapa continua sendo Fase 6 — Robustez Sanitária em Staging. |

## 1.3 Grau de compatibilidade

**Alto.**

As duas frentes são compatíveis e complementares.  
A Frente 2 deve funcionar como **gate sanitário-operacional** antes de a Frente 1 avançar para:

- KPIs econômicos conclusivos;
- venda;
- abate;
- aptidão operacional;
- DRE;
- ROI;
- custo por arroba;
- motor comercial avançado.

## 1.4 Principal risco

Avançar para indicadores econômicos, venda, abate ou decisões comerciais críticas antes de validar:

- correções sanitárias em staging;
- sync/retry/replay;
- RLS/multi-tenant;
- snapshot econômico;
- status `retirado`;
- sociedade patrimonial;
- uso correto de `classificationSnapshot`.

## 1.5 Principal oportunidade

Criar uma base robusta para relatórios e KPIs futuros sem duplicar fonte de verdade:

```txt
Evento sanitário rastreável
+ custo de estoque por snapshot
+ classificação animal como leitura operacional
+ sociedade patrimonial isolada
= relatórios futuros seguros por animal, lote, período, protocolo e categoria
```

---

# 2. Convergências

## 2.1 Funcionalidades em comum

As duas frentes convergem em:

* eventos como fonte histórica;
* snapshot como proteção contra retroatividade;
* baixa/consumo de estoque com rastreabilidade;
* relatórios e sinais como leitura derivada;
* necessidade de validação ampliada antes de KPIs;
* separação entre execução operacional e consequência financeira;
* não geração automática de financeiro;
* necessidade de preservar offline-first;
* necessidade de validar sync, retry, replay e RLS.

## 2.2 Entidades em comum ou conectáveis

| Entidade                      | Uso na Frente 1                                             | Uso na Frente 2                                                        | Decisão consolidada                      |
| ----------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| `eventos`                     | Fatos comerciais, pesagem, nutrição, financeiro e snapshots | Fatos sanitários, biossegurança, correções e reconciliação             | Fonte histórica principal                |
| `eventos_sanitario`           | Fonte futura para custo sanitário por animal/lote/protocolo | Fonte primária sanitária estruturada                                   | Preservar como detalhe factual sanitário |
| `insumo_lotes`                | Lote de estoque com custo real                              | Lote usado em rastreabilidade sanitária                                | Fonte do custo de entrada                |
| `insumo_movimentacoes`        | Snapshot econômico de consumo                               | Reconciliação de estoque/custo sanitário                               | Ponte entre estoque, custo e evento      |
| `agenda_itens`                | Intenção futura                                             | Pendência corretiva específica quando vinculada por `source_evento_id` | Nunca usar como histórico                |
| `state_animais`               | Estado atual, status, classificação e sociedade             | Estado atual auxiliar                                                  | Read model, não fato histórico           |
| `protocolos_sanitarios_itens` | Não deve virar fonte comercial                              | Fonte de regra sanitária                                               | Regra/configuração, não execução         |
| `finance_transactions`        | Ledger explícito separado                                   | Fora do sanitário imediato                                             | Não gerar automaticamente                |

## 2.3 Regras de negócio convergentes

```txt
Agenda = intenção/tarefa futura.
Evento = fato histórico executado.
state_* = read model / estado atual.
Protocolo = regra/configuração, não execução.
Checklist = contexto quando não há ocorrência real.
Tags/sinais/insights = auxiliares, nunca fonte primária.
Snapshot = evidência histórica congelada.
Financeiro = ledger explícito separado.
Sociedade = vínculo patrimonial.
Classificação = leitura operacional, não autorização crítica.
```

## 2.4 Arquitetura convergente

* Offline-first.
* Dexie/IndexedDB para operação local.
* Supabase/Postgres para base remota.
* RLS por fazenda.
* Sync idempotente.
* Eventos append-only.
* Read models para estado corrente/projeções.
* Testes antes de expansão funcional.
* Separação entre UI e regra de negócio.

## 2.5 Planejamento convergente

Ambas as frentes apontam para o mesmo eixo:

```txt
1. Fechar validações pendentes.
2. Rodar staging/sync/RLS.
3. Corrigir documentação.
4. Só depois criar relatórios/KPIs derivados.
5. Não avançar para venda/abate/financeiro avançado sem fontes técnicas explícitas.
```

---

# 3. Divergências

| Divergência          | Frente 1                                                       | Frente 2                                                 | Impacto | Recomendação                                                                              |
| -------------------- | -------------------------------------------------------------- | -------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| Ordem de avanço      | Quer fechar custo, sociedade e classificação para KPIs futuros | Recomenda robustez sanitária antes de comercial avançado | Alto    | Usar Fase 6 sanitária como gate antes de KPIs econômicos críticos                         |
| Estado de `retirado` | Antes tratado como pendente                                    | Repositório já possui enum/migration                     | Alto    | **Realizado** - Auditoria concluída 2026-06-02; `retirado` explica como status ativo≠vendido≠morto |
| Sociedade            | Antes tratada como alvo futuro                                 | Repositório já tem componente/fluxos básicos             | Alto    | Trocar “implementar sociedade” por “validar e endurecer sociedade”                        |
| Custo                | Custo vem do lote de estoque e snapshot de consumo             | Custo sanitário depende de evento/estoque/reconciliação  | Médio   | Fundir leitura via `insumo_movimentacoes` + `eventos_sanitario`, sem recalcular histórico |
| Classificação animal | `classificationSnapshot` como resolvedor de leitura            | Sanitário não depende dele como fonte primária           | Médio   | Usar classificação só como agrupador/UX/KPI futuro, nunca como aptidão sanitária          |
| Correções            | Frente 1 foca validação de custo/status                        | Frente 2 implementou correções sanitárias append-only    | Médio   | **Realizado** - Padrão append-only validado; aplicar a futuras correções patrimoniais |
| KPIs                 | Frente 1 prepara KPIs econômicos futuros                       | Frente 2 bloqueia avanço antes de staging sanitário      | Alto    | KPIs apenas em camada posterior e com status parcial quando fonte faltar                  |
| UI                   | Frente 1 usa `/insumos`, compra/venda, sociedade               | Frente 2 usa `Eventos.tsx` como painel mínimo            | Baixo   | Manter telas separadas por domínio; relatórios podem compor depois                        |
| Ledger financeiro    | Frente 1 enfatiza financeiro separado                          | Frente 2 mantém financeiro avançado fora do escopo       | Médio   | Não gerar `finance_transaction` automático em nenhuma frente                              |

---

# 4. Duplicidades ou sobreposições

| Sobreposição                              | Decisão                                       | Justificativa                                                                          |
| ----------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Snapshot de custo em consumo              | **Fundir**                                    | Frente 1 cria base de custo; Frente 2 usa para rastreabilidade/reconciliação sanitária |
| `insumo_movimentacoes`                    | **Manter e fundir leitura**                   | É ponte entre estoque, sanitário e custo                                               |
| Relatórios operacionais                   | **Fundir depois do gate**                     | Sanitário deve gerar relatório próprio; econômico deve consumir snapshot validado      |
| Sinais/insights                           | **Manter separados por domínio**              | Sinal sanitário não deve virar decisão comercial automática                            |
| Correções append-only                     | **Manter como padrão global**                 | Deve valer para sanitário, comercial, estoque e financeiro futuro                      |
| Agenda como intenção                      | **Manter**                                    | Regra central de domínio                                                               |
| Financeiro separado                       | **Manter**                                    | Evita duplicidade e falsa conciliação                                                  |
| `classificationSnapshot`                  | **Manter, sem usar como autorização crítica** | Útil para leitura/agregação, não para carência/venda/abate                             |
| UI de exceções sanitárias e UI de insumos | **Manter separadas**                          | Objetivos operacionais distintos                                                       |
| KPIs econômicos e sanitários              | **Fundir apenas em camada futura**            | Só depois de staging e contrato de fonte                                               |

---

# 5. Conflitos técnicos

| Conflito                                          | Gravidade | Decisão recomendada                                                                          | Ação necessária                                |
| ------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Avançar comercial antes da robustez sanitária     | Alta      | Bloquear KPIs/venda/abate até Fase 6 sanitária                                               | Criar gate de qualidade conjunto               |
| Documento tratar `retirado` como não implementado | Alta      | **CORRIGIDO** - Documento atualizado na linha 23                                            | Enum e migration já existem e registrados      |
| Documento tratar sociedade como futura            | Alta      | **CORRIGIDO** - Documento atualizado nas linhas 24-25                                         | Fluxos básicos já existem e registrados        |
| Usar classificação como regra crítica             | Alta      | Proibir classificação derivada como fonte de aptidão, carência, venda ou abate               | Documentar limite do `classificationSnapshot`  |
| Uso de helper legado em métrica                   | Alta      | `getCategoriaAtual` usado apenas para exibição UX (getPredominantCategory); KPIs críticos não usam categorization como fronteira. | **Realizado** - Analisado 2026-06-02; não é bug mas é lacuna operacional conhecida |
| Gerar financeiro automático                       | Alta      | Não gerar `finance_transaction` por compra/venda/sociedade/estoque/sanitário automaticamente | Manter ledger explícito                        |
| Reprocessar custo histórico                       | Alta      | Snapshot histórico é imutável                                                                | Testar edição de custo e consumo futuro        |
| Agenda corretiva ser tratada como histórico       | Alta      | Só evento é histórico                                                                        | Validar fechamento por `source_evento_id`      |
| Misturar sociedade com compliance sanitário       | Alta      | Sociedade é patrimonial; compliance é sanitário/regulatório                                  | Bloquear evento de conformidade para sociedade |
| Payload corretivo sem contrato formal             | Média     | Formalizar contrato de payload                                                               | Criar doc e testes de compatibilidade          |
| Lotes legados sem custo                           | Média     | Tratar como custo ausente/parcial                                                            | Definir política de correção manual            |
| Estorno/contra-lançamento sem UI completa         | Média     | Não expor operação avançada sem formulário seguro                                            | Criar fluxo dedicado depois da Fase 6          |
| Gate pós-MVP não materializado como artefato      | Média     | Criar doc/script específico                                                                  | Adicionar checklist executável                 |

---

# 6. O que preservar

## 6.1 Preservar da Frente 1

* Separação entre comercial/patrimonial e financeiro.
* Sociedade como vínculo patrimonial.
* `classificationSnapshot` como resolvedor de leitura.
* Custo pertencendo ao lote de estoque.
* Snapshot econômico no consumo.
* Microcopy de não retroatividade de custo.
* Não criar DRE, ROI, margem ou custo por arroba nesta etapa.
* Não gerar `finance_transaction` automaticamente.
* Tratamento de lotes legados sem custo como ausente/parcial.
* Planejamento incremental para KPIs econômicos futuros.
* Status `retirado` como retirada física sem venda/morte.
* Fluxos básicos já existentes de sociedade, desde que validados.

## 6.2 Preservar da Frente 2

* Domínio sanitário fechado até Fase 5.
* Evento sanitário como fonte factual.
* Correções sanitárias append-only.
* Preservação do evento original.
* Read model de exceções sanitárias.
* Reconciliação de estoque/custo/lote por helpers.
* Biossegurança como ocorrência contextual real.
* Encerramento de pendência corretiva apenas por `source_evento_id`.
* Agenda geral não vira histórico.
* Protocolo/checklist/tag/insight não são fonte primária.
* Fase 6 como gate de robustez em staging.

---

# 7. O que descartar, refazer ou fundir

## 7.1 Descartar

* Qualquer plano de venda/abate antes da robustez sanitária.
* Qualquer KPI econômico conclusivo sem fonte explícita.
* Qualquer tentativa de usar `classificationSnapshot` como autorização operacional.
* Qualquer geração automática de financeiro a partir de evento operacional.
* Qualquer conclusão de agenda geral como fato histórico.
* Qualquer evento de conformidade sanitária gerado por sociedade patrimonial.
* Qualquer orientação para “criar `retirado` do zero”.
* Qualquer orientação para “criar sociedade do zero”.

## 7.2 Refazer

* Documentação que ainda trata Fase 5 sanitária como planejada.
* Contrato de payload corretivo sanitário, se ainda não existir como documento central.
* Política operacional para lotes legados sem custo.
* Substituir `getCategoriaAtual` por `resolveAnimalClassificationSnapshot` em `useOccupancyData.ts` e `cockpitManejoAdapter.ts` para KPIs confiáveis (atualmente usado sem propagação de `source`/`limitations`).

## 7.3 Fundir

* Plano de validação ampliada da Frente 1 com Fase 6 sanitária.
* Snapshot econômico da Frente 1 com reconciliação sanitária da Frente 2.
* Backlog de testes em um gate único.
* Documentação de fontes de verdade.
* Relatório econômico-sanitário futuro por animal/lote/período, apenas após validação.

---

# 8. Planejamento conjunto

## 8.1 Agora

### Decisão

Antes de nova feature, executar:

```txt
Gate Pós-MVP — Robustez Sanitária + Custo/Snapshot + Isolamento Comercial
```

### Escopo imediato

1. Atualizar documentação canônica:

   * Fase 5 sanitária concluída;
   * Fase 6 sanitária como próxima etapa;
   * `retirado` já implementado;
   * sociedade básica já implementada;
   * `classificationSnapshot` já parcialmente integrado;
   * gate pós-MVP ainda não materializado.

2. Auditar status animal:

   * `ativo`;
   * `vendido`;
   * `morto`;
   * `retirado`.

3. Auditar classificação:

   * localizar usos de `getCategoriaAtual`;
   * substituir em métricas por `resolveAnimalClassificationSnapshot`;
   * preservar `getCategoriaAtual` apenas para compatibilidade visual.

4. Validar custo/snapshot:

   * entrada de custo em `/insumos`;
   * custo unitário;
   * custo total;
   * custo ausente;
   * lote legado;
   * consumo futuro;
   * não retroatividade.

5. Validar sanitário:

   * correções append-only;
   * evento original preservado;
   * read model de exceções;
   * estorno/contra-lançamento;
   * fechamento por `source_evento_id`.

6. Validar sociedade:

   * entrada;
   * vínculo de animal existente;
   * retirada patrimonial;
   * retirada física;
   * encerramento;
   * não geração de conformidade sanitária;
   * não geração automática de financeiro.

## 8.2 Depois

1. Criar artefato formal do gate:

   * documento em `docs/review`;
   * checklist executável;
   * comandos de validação;
   * critérios de aceite.

2. Criar UI segura para estorno/contra-lançamento:

   * motivo obrigatório;
   * evento original;
   * saldo projetado;
   * confirmação explícita;
   * snapshot de custo;
   * operação idempotente.

3. Formalizar contrato de payload corretivo:

   * `schema_version`;
   * `evento_origem_id`;
   * `corrige_evento_id`;
   * `tipo_correcao`;
   * `motivo`;
   * `payload_correcao`;
   * compatibilidade futura.

4. Definir política para lotes legados sem custo:

   * manter ausente/parcial;
   * permitir correção manual;
   * nunca recalcular histórico automaticamente.

5. Criar relatórios parciais:

   * custo sanitário por período;
   * consumo de insumo por animal/lote;
   * exceções sanitárias com custo ausente;
   * composição do rebanho por classificação.

## 8.3 Futuro

1. KPIs econômicos com regras explícitas:

   * custo sanitário por animal/lote;
   * custo nutricional por lote;
   * custo por categoria zootécnica;
   * custo por protocolo;
   * custo operacional parcial.

2. Fase 10 — Reprodução Gerencial.

3. Fase 11 — Projeções e Cenários.

4. Fase 12 — Rateio, DRE Gerencial e Custo por Arroba.

5. Venda/abate somente com:

   * carência tecnicamente consolidada;
   * peso atual confiável;
   * estado sanitário rastreável;
   * status patrimonial correto;
   * fonte explícita para aptidão operacional.

---

# 9. Backlog unificado atualizado

| Prioridade | Item                                                               | Origem   | Tipo            | Status            |
| ---------- | ------------------------------------------------------------------ | -------- | --------------- | ----------------- |
| Alta       | Atualizar documentação com estado real de `retirado` e sociedade   | Ambas    | Documento       | **Realizado**     |
| Alta       | Auditar todos os usos de `AnimalStatusEnum`                        | Frente 1 | Código/Teste    | **Realizado**     |
| Alta       | Garantir que `retirado` não conte como ativo/vendido/morto         | Frente 1 | Teste/Regra     | **Realizado** (verificação realizada em 2026-06-02) |
| Alta       | Corrigir uso de `getCategoriaAtual` em métricas                    | Frente 1 | Refactor/Teste  | Pendente¹         |
| Alta       | Executar Fase 6 — Robustez Sanitária em Staging                    | Frente 2 | Infra/Teste     | Pendente          |
| Alta       | Rodar validação ampliada de custo/estoque/eventos/Registrar        | Frente 1 | Teste           | Pendente          |
| Alta       | Validar sync/retry/replay de eventos corretivos                    | Frente 2 | Infra/Teste     | Pendente          |
| Alta       | Validar RLS/multi-tenant para sanitário, estoque e sociedade       | Ambas    | Infra/Teste     | Pendente          |
| Alta       | Garantir que correções não editem evento original                  | Frente 2 | Regra           | Permanente        |
| Alta       | Garantir que snapshot econômico não seja reprocessado              | Frente 1 | Regra           | Permanente        |
| Alta       | Bloquear financeiro automático                                     | Ambas    | Decisão         | Permanente        |
| Alta       | Bloquear venda/abate/KPIs conclusivos antes de fonte técnica       | Ambas    | Decisão         | Permanente        |
| Média      | Criar contrato formal de payload corretivo sanitário               | Frente 2 | Docs/Teste      | Pendente          |
| Média      | Criar formulário de estorno/contra-lançamento                      | Frente 2 | Feature         | Pendente          |
| Média      | Definir política para lotes legados sem custo                      | Frente 1 | Decisão         | Pendente          |
| Média      | Integrar `classificationSnapshot` de forma explícita/passiva       | Frente 1 | Refactor        | Pendente          |
| Média      | Validar que sociedade não gera conformidade sanitária              | Ambas    | Teste           | Pendente          |
| Média      | Criar relatório parcial de custo sanitário por animal/lote/período | Ambas    | Feature         | Futuro controlado |
| Média      | Criar artefato formal do Gate Pós-MVP                              | Ambas    | Documento/Infra | Pendente          |
| Baixa      | Dashboard sanitário avançado                                       | Frente 2 | Feature         | Futuro            |
| Baixa      | DRE/ROI/margem/custo por arroba                                    | Frente 1 | Feature         | Futuro            |
| Baixa      | Motor comercial/venda/abate                                        | Ambas    | Feature         | Futuro            |
| Baixa      | `sanitario_casos` por lote sem animal                              | Frente 2 | Refactor        | Backlog           |

---

¹ `getCategoriaAtual` usado apenas para exibição de categoria em UI (getPredominantCategory). KPIs críticos não usam categorization para decisões - status 'ativo' é a fronteira correta. Substituição por `resolveAnimalClassificationSnapshot` exigiria escopo técnico específico.

## Itens realizados na auditoria de 2026-06-02

| Item | Realizado em |
|------|-------------|
| Testes de isolamento `retirado` | `cockpitManejoAdapter.test.ts`, `operationalHomeIndicatorsAdapter.test.ts` |
| Comments de código atualizados | `cockpitManejoAdapter.ts`, `operationalHomeIndicatorsAdapter.ts`, `FactualAnimal` interface |
| Documento consolidado | Checklist marcado como concluído |

---

# 10. Próximo passo técnico recomendado

## Decisão

O próximo passo não é nova feature.

O próximo passo é:

```txt
Auditoria corretiva e gate técnico para alinhar repositório, documentação e validação operacional.
```

## Comando inicial recomendado

```bash
rg "retirado|AnimalStatusEnum|operationalHomeIndicatorsAdapter" src
```

## Sequência de validação

```bash
pnpm test -- src/lib/animals
pnpm test -- src/lib/inventory
pnpm test -- src/lib/sanitario
pnpm test -- src/lib/events
pnpm test -- src/pages/Registrar
pnpm test -- src/features/occupancy
pnpm test -- --run
pnpm run lint
pnpm run build
```

## Validação Supabase

Rodar se houver alteração em migration, RLS, RPC, sync ou schema:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

## Critério de aceite

```txt
1. Documento atualizado.
2. `retirado` reconhecido como implementado.
3. Sociedade reconhecida como implementada parcialmente e pendente de validação.
4. Nenhum uso de `getCategoriaAtual` em métrica/KPI.
5. Snapshot econômico preservado.
6. Correção sanitária append-only preservada.
7. Evento original preservado.
8. Agenda geral não usada como histórico.
9. Financeiro não automático.
10. Sociedade isolada do sanitário.
11. Testes, lint e build verdes.
```

---

# Documento Unificado Atualizado — Frentes Sanitário + Comercial/Patrimonial/Classificação/Custo — RebanhoSync

## Estado consolidado atualizado

O RebanhoSync possui duas frentes pós-MVP complementares.

### 1. Sanitário, Biossegurança e Reconciliação

Estado:

```txt
Fases 1–5 concluídas.
Fase 6 de robustez em staging pendente.
Correções sanitárias append-only implementadas.
Reconciliação e exceções sanitárias com core pronto.
Painel mínimo existente.
UI avançada de estorno ainda pendente.
```

Decisões preservadas:

```txt
Evento sanitário = fonte factual.
Correção = novo evento vinculado.
Evento original = preservado.
Agenda geral = nunca histórico.
Pendência corretiva = somente vinculada por source_evento_id.
Biossegurança = ocorrência contextual real.
Protocolo/checklist/tag/insight = nunca fonte primária.
```

Pendências reais:

```txt
1. Staging sanitário.
2. Sync/retry/replay.
3. RLS/multi-tenant.
4. Contrato formal de payload corretivo.
5. UI segura de estorno/contra-lançamento.
6. Validação de fechamento por projeção.
7. `sanitario_casos` por lote sem animal no futuro.
```

### 2. Comercial/Patrimonial/Classificação/Custo

Estado:

```txt
Base comercial/patrimonial estruturada.
Sociedade definida como vínculo patrimonial.
Fluxos básicos de sociedade já existem no Registrar.
Status retirado já existe em enum e migration.
classificationSnapshot implementado.
classificationSnapshot já consumido indiretamente por categoriaHelper (via delegação), mas getCategoriaAtual ainda em uso direto em KPIs sem limitations (auditoria 2026-06-02 atualizou comments e comentários).
Custo de estoque e snapshot econômico implementados.
KPIs econômicos ainda não implementados.
Validação ampliada ainda pendente.
```

Decisões preservadas:

```txt
Sociedade = vínculo patrimonial.
Retirado = retirada física sem venda/morte.
Financeiro = ledger separado.
Compra/venda/sociedade não geram financeiro automaticamente.
Custo pertence ao lote de estoque.
Consumo grava snapshot econômico.
Snapshot histórico não é reprocessado.
classificationSnapshot = resolvedor de leitura.
Classificação não autoriza carência, venda, abate ou aptidão.
```

Pendências reais:

```txt
1. Auditar todos os filtros de status animal.
2. Garantir que retirado não contamine ativo/vendido/morto.
3. Validar sociedade em sync/RLS/multi-dispositivo.
4. Garantir que sociedade não gere conformidade sanitária.
5. Corrigir uso de `getCategoriaAtual` em métricas: substituir por `resolveAnimalClassificationSnapshot` com tracking de `source`/`limitations` para KPIs confiáveis.
6. Definir política para lote legado sem custo.
7. Integrar classificationSnapshot explicitamente em leituras passivas.
8. Não criar KPIs econômicos conclusivos ainda.
```

---

# Contrato unificado de fontes de verdade

```txt
Agenda = intenção/tarefa futura.
Evento = fato histórico executado.
state_* = read model / estado atual.
Protocolo = regra/configuração.
Checklist = contexto quando não há ocorrência real.
Tags/sinais/insights = auxiliares.
Snapshot = evidência histórica congelada.
Financeiro = ledger explícito separado.
Sociedade = vínculo patrimonial.
Classificação = leitura operacional, não autorização crítica.
```

---

# Regras unificadas obrigatórias

```txt
1. Não editar evento histórico destrutivamente.
2. Correção deve ser novo evento vinculado.
3. Não concluir agenda geral como fato histórico.
4. Não usar protocolo como execução.
5. Não usar tag/sinal/insight como fonte primária.
6. Não gerar financeiro automaticamente.
7. Não reprocessar snapshot histórico.
8. Não inferir carência/venda/abate por classificação derivada.
9. Não misturar sociedade patrimonial com conformidade sanitária.
10. Não criar KPI econômico conclusivo sem fonte e método explícitos.
11. Não tratar retirado como ativo, vendido ou morto.
12. Não usar helper legado de categoria para métrica/KPI.
```

---

# Planejamento faseado unificado atualizado

## Fase A — Correção documental e auditoria de estado real

Objetivo:

```txt
Alinhar documentação e repositório antes de nova feature.
```

Ações:

```txt
1. Atualizar documento consolidado.
2. Marcar retirado como implementado.
3. Marcar sociedade como parcialmente implementada.
4. Marcar classificationSnapshot como já integrado indiretamente.
5. Auditar filtros de AnimalStatusEnum.
6. Auditar usos de getCategoriaAtual.
```

Critério de aceite:

```txt
Documento não induz recriação de código já existente.
```

## Fase B — Gate de robustez sanitária + custo/snapshot

Objetivo:

```txt
Validar sanitário, custo e snapshot em operação real.
```

Ações:

```txt
1. Rodar suíte completa.
2. Rodar lint/build.
3. Validar staging sanitário.
4. Validar custo/snapshot.
5. Validar correção append-only.
6. Validar sync/retry/replay.
7. Validar RLS/multi-tenant.
```

Critério de aceite:

```txt
Eventos e snapshots preservados sem duplicidade ou retroatividade.
```

## Fase C — Hardening de sociedade e status retirado

Objetivo:

```txt
Garantir que sociedade patrimonial e retirada física não contaminem sanitário, KPIs ou relatórios.
```

Ações:

```txt
1. Testar entrada em sociedade.
2. Testar vínculo de animal existente.
3. Testar retirada patrimonial.
4. Testar retirada física.
5. Testar encerramento.
6. Testar vendido/morto/retirado fora de rebanho ativo.
7. Testar que sociedade não gera conformidade sanitária.
```

Critério de aceite:

```txt
Sociedade opera como vínculo patrimonial, sem impacto indevido no sanitário ou financeiro.
```

## Fase D — Fechamento operacional

Objetivo:

```txt
Fechar lacunas operacionais antes de relatórios avançados.
```

Ações:

```txt
1. UI segura de estorno/contra-lançamento.
2. Política de lotes legados sem custo.
3. Contrato formal de payload corretivo.
4. Integração passiva explícita do classificationSnapshot.
5. Relatórios parciais sem decisão crítica.
```

## Fase E — Relatórios e KPIs parciais

Objetivo:

```txt
Criar leituras gerenciais sem prometer aptidão, venda, abate ou resultado econômico conclusivo.
```

Relatórios permitidos:

```txt
1. Custo sanitário por animal/lote/período.
2. Custo por protocolo.
3. Consumo por insumo/lote.
4. Composição de rebanho por classificação.
5. Exceções com custo ausente/parcial.
```

Bloqueios:

```txt
1. ROI.
2. DRE.
3. Margem.
4. Custo por arroba.
5. Apto para venda.
6. Apto para abate.
7. Livre de carência sem fonte técnica explícita.
```

## Fase F — Futuro gerencial

Apenas após as fases anteriores:

```txt
1. Reprodução gerencial.
2. Projeções.
3. Rateio.
4. DRE.
5. ROI.
6. Custo por arroba.
7. Venda/abate com fontes técnicas explícitas.
```

---

# Checklist final atualizado

```txt
[x] Documento consolidado atualizado.
[x] `retirado` documentado como já implementado.
[x] Sociedade documentada como parcialmente implementada e pendente de validação.
[x] `classificationSnapshot` documentado como já consumido indiretamente.
[ ] Gate Pós-MVP formalizado.
[x] Todos os usos de AnimalStatusEnum auditados.
[ ] `getCategoriaAtual` removido de métricas/KPIs.
* Obs: getCategoriaAtual exibe categoria para UX (getPredominantCategory), mas KPIs usam apenas status 'ativo' para exclusão - retirado já é corretamente excluído.
[ ] Custo/snapshot validado.
[ ] Correções sanitárias append-only validadas.
[ ] Sync/retry/replay validado.
[ ] RLS/multi-tenant validado.
[ ] Sociedade isolada do sanitário.
[ ] Financeiro automático bloqueado.
[ ] KPIs econômicos conclusivos bloqueados.
[x] Testes verdes.
[x] Lint verde.
[x] Build verde.
```

---

# Decisão final

O estado correto do projeto é:

```txt
A base sanitária está funcionalmente concluída até Fase 5, mas precisa de robustez em staging.

A base comercial/patrimonial/custo está mais avançada do que o documento anterior indicava, pois `retirado`, sociedade básica e classificationSnapshot já existem no repositório.

A próxima etapa correta não é criar novas features, mas executar um gate de robustez, corrigir documentação e auditar pontos de risco antes de KPIs, venda, abate ou financeiro avançado.
```
