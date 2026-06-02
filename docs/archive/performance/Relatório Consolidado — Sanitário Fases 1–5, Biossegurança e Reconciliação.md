# Relatório Consolidado — Sanitário Fases 1–5, Biossegurança e Reconciliação — RebanhoSync

**Arquivos avaliados:**
- **Arquivo 1:** Markdown.md colado — contexto amplo das Fases 1–6, com Fase 5 ainda descrita como planejada.
- **Arquivo 2:** Texto colado (2).txt — atualização posterior da Fase 5, reportando implementação concluída e validada.

---

## 1. Diagnóstico da frente

### Objetivo da frente
Consolidar o domínio sanitário do RebanhoSync antes de avançar para comercial, venda, abate, sociedade ou financeiro avançado.

**Sequência consolidada:**
1. Fase 1 — Protocolos Sanitários, Versionamento e Legado
2. Fase 2 — Rastreabilidade Sanitária Operacional
3. Fase 3 — Consolidação Sanitária Operacional
4. Fase 4 — Clínica, Compliance, Checklists, Biossegurança e Doenças Notificáveis
5. Fase 5 — Exceções, Correções e Reconciliação Sanitária
6. Fase 6 — Robustez Sanitária em Staging

*Origem:* Arquivo 1.

### Estado atual
A versão consolidada correta é:
- Fases 1–4 concluídas.
- Fase 5 concluída e validada.
- Fase 6 planejada como robustez em staging.

O Arquivo 1 ainda tratava a Fase 5 como planejada/não consolidada. O Arquivo 2 atualiza esse estado e informa que a Fase 5 foi executada, sem migration, com evento histórico preservado, correções append-only e `pnpm test` completo passando com 257 arquivos / 1726 testes.

### Principais entregas

| Entrega | Estado consolidado | Origem |
|---|---|---|
| Protocolos sanitários versionados | Construído | Arquivo 1 |
| Remoção do uso operacional de `protocol_item_id` legado | Construído | Arquivo 1 |
| Rastreabilidade forte em `eventos_sanitario` | Construído | Arquivo 1 |
| Relatórios e sinais sanitários | Construído | Ambos |
| Compliance contextual | Construído | Arquivo 1 |
| Biossegurança como ocorrência contextual | Construído | Ambos |
| Doença notificável vinculada a animal/lote/evento | Construído/parcial para lote | Arquivo 1 |
| Pendência corretiva específica por ocorrência real | Construído | Ambos |
| Read model de exceções sanitárias | Construído | Arquivo 2 |
| Correções sanitárias append-only | Construído | Arquivo 2 |
| Reconciliação de estoque/custo por helpers | Construído | Arquivo 2 |
| Painel mínimo de exceções em Eventos | Construído | Arquivo 2 |
| Fase 6 staging | Planejado | Ambos |

### Principais pendências

| Pendência | Estado | Origem |
|---|---|---|
| Formulário dedicado para estorno/contra-lançamento | Pendente | Arquivo 2 |
| Validação real de sync, concorrência, retry, rollback e multi-dispositivo | Pendente | Ambos |
| Validação RLS/multi-tenant em staging | Pendente | Arquivo 2 |
| Testes de compatibilidade do payload corretivo | Pendente | Arquivo 2 |
| Validar fechamento de exceções por projeção em cenários reais | Pendente | Arquivo 2 |
| Suporte estruturado de `sanitario_casos` por lote sem animal | Backlog | Arquivo 1 |
| Documentação de contrato sanitário ativa | Pendente/recomendado | Arquivo 1 |

### Principais riscos

| Risco | Gravidade | Motivo |
|---|---|---|
| Payload corretivo virar contrato implícito frágil | Médio | Fase 5 não criou migration; depende de payload bem documentado e testado |
| Correção destrutiva ser reintroduzida por agente futuro | Alto | Quebra append-only e rastreabilidade |
| Agenda geral ser usada como histórico | Alto | Viola fonte de verdade |
| Protocolo/checklist/tag virar fonte primária | Alto | Gera falso compliance, falsa carência ou falsa execução |
| UI de estorno incompleta gerar operação manual insegura | Médio | Helpers existem, mas formulário dedicado ainda falta |
| Sync parcial duplicar movimentação ou correção | Alto | Precisa validação de idempotência em staging |
| `sanitario_casos` não cobrir lote sem animal | Médio | Pode ocultar suspeita coletiva se relatório ler só `sanitario_casos` |

---

## 2. O que já foi construído

### Funcionalidades

| Funcionalidade | Estado | Origem |
|---|---|---|
| Versionamento imutável de itens de protocolo sanitário | Construído | Arquivo 1 |
| Uso de `protocol_item_version_id`, `protocol_item_logical_key`, `protocol_item_version`, `protocol_item_snapshot` | Construído | Arquivo 1 |
| Rastreabilidade sanitária operacional em `eventos_sanitario` | Construído | Arquivo 1 |
| Baixa de estoque idempotente e bloqueio de saldo negativo silencioso | Construído | Arquivo 1 |
| Cálculo de carência pela data efetiva do evento | Construído | Arquivo 1 |
| Histórico sanitário auditável | Construído | Arquivo 1 |
| Relatórios sanitários por produto, lote, animal, lote pecuário, protocolo e período | Construído | Arquivo 1 |
| Compliance regulatório contextual/actionable | Construído | Arquivo 1 |
| Registro de ocorrência real de biossegurança | Construído | Ambos |
| Registro de suspeita notificável | Construído | Arquivo 1 |
| Pendência corretiva específica a partir de ocorrência real | Construído | Ambos |
| Read model de exceções sanitárias | Construído | Arquivo 2 |
| Correções sanitárias via novos eventos vinculados | Construído | Arquivo 2 |
| Estorno/contra-lançamento como helpers testados | Construído parcial | Arquivo 2 |
| Resolução/cancelamento de biossegurança por novo evento vinculado | Construído | Arquivo 2 |
| Encerramento de pendência corretiva específica vinculada por `source_evento_id` | Construído | Arquivo 2 |

### Telas / Componentes

| Tela / componente | Papel | Origem |
|---|---|---|
| `ProtocolosSanitarios/**` | Protocolos versionados e checklist contextual | Arquivo 1 |
| `Agenda/**` | Agenda sanitária, sem virar histórico | Arquivo 1 |
| `Registrar/**` | Registro sanitário e ocorrência contextual | Arquivo 1 |
| `RegistrarInventorySection.tsx` | Integração com produto/lote/custo no registro sanitário | Arquivo 1 |
| `RegistrarSanitarioSection.tsx` | Fluxo sanitário e biossegurança contextual | Arquivo 1 |
| `RegulatoryOverlayManager.tsx` | Checklist regulatório como contexto passivo | Arquivo 1 |
| `src/pages/Eventos.tsx` | Histórico e painel mínimo de exceções sanitárias | Ambos |

### APIs / Serviços / Helpers

| Arquivo / serviço | Papel | Origem |
|---|---|---|
| `buildEventGesture.ts` | Construção de eventos sanitários, ocorrência, pendência e correção | Ambos |
| `compliance.ts` | Contrato de compliance contextual | Arquivo 1 |
| `complianceAttention.ts` | Atenção operacional de compliance | Arquivo 1 |
| `complianceGuards.ts` | Guardas para não tratar contexto como pendência | Arquivo 1 |
| `regulatoryReadModel.ts` | Read model regulatório | Arquivo 1 |
| `biosecurityOccurrence.ts` | Draft/contrato de ocorrência de biossegurança | Ambos |
| `biosecurityReadModel.ts` | Projeção de ocorrência/status efetivo | Ambos |
| `sanitaryCorrections.ts` | Contrato e helpers de correção sanitária | Arquivo 2 |
| `sanitaryExceptions.ts` | Read model de exceções sanitárias | Arquivo 2 |
| `sanitaryExceptionSignals.ts` | Sinais derivados de exceções sanitárias | Arquivo 2 |
| `operationalSummary.ts` | Relatórios operacionais sanitários/biossegurança | Ambos |
| `tagSignals.ts` | Sinais operacionais auxiliares | Ambos |
| `sanitaryWithdrawalSignals.ts` | Sinais de carência sanitária estruturada | Arquivo 1 |

### Banco de dados / Models / Schemas

| Item | Estado | Origem |
|---|---|---|
| `protocolos_sanitarios_itens.id` como versão física imutável | Construído | Arquivo 1 |
| `logical_item_key` como identidade lógica | Construído | Arquivo 1 |
| `superseded_by_id`, `superseded_at`, `deleted_at` | Construído | Arquivo 1 |
| Migration `20260531000000_protocolos_sanitarios_itens_immutable_versions.sql` | Reportada | Arquivo 1 |
| Migration `20260531001000_protocolos_sanitarios_drop_legacy_protocol_item_id.sql` | Reportada | Arquivo 1 |
| Migration `20260531002000_eventos_sanitario_operational_traceability.sql` | Reportada | Arquivo 1 |
| `eventos_sanitario` com campos de produto, lote, validade, dose, via, responsável, carência e custo | Construído | Arquivo 1 |
| `eventos.payload.biosseguranca_ocorrencia` | Construído | Ambos |
| `agenda_itens.source_evento_id` para pendência corretiva específica | Construído | Ambos |
| Contrato `SanitaryCorrectionType` / `SanitaryCorrectionPayload` via payload | Construído sem migration | Arquivo 2 |

### Arquivos / Pastas
Consolidação dos arquivos reportados:
- `src/lib/events/buildEventGesture.ts`
- `src/lib/sanitario/reconciliation/sanitaryCorrections.ts`
- `src/lib/sanitario/reconciliation/sanitaryExceptions.ts`
- `src/lib/sanitario/biosecurityOccurrence.ts`
- `src/lib/sanitario/biosecurityReadModel.ts`
- `src/lib/insights/sanitaryExceptionSignals.ts`
- `src/lib/insights/sanitaryWithdrawalSignals.ts`
- `src/lib/insights/tagSignals.ts`
- `src/lib/reports/operationalSummary.ts`
- `src/pages/Eventos.tsx`
- `src/pages/Registrar/index.tsx`
- `src/pages/Registrar/components/RegistrarSanitarioSection.tsx`
- `src/pages/Registrar/components/RegistrarInventorySection.tsx`
- `src/components/RegulatoryOverlayManager.tsx`
- `docs/review/sanitario-consolidacao-fase-3.md`
- `docs/review/sanitario-biosseguranca-ocorrencias-fase-4.md`
- `docs/review/sanitario-excecoes-reconciliacao-fase-5.md`

*Origem:* Ambos, com Fase 5 detalhada no Arquivo 2.

### Regras de negócio

| Regra | Decisão consolidada | Origem |
|---|---|---|
| Agenda | Intenção/tarefa futura, não histórico | Ambos |
| Evento | Fato histórico append-only | Ambos |
| Protocolo | Regra/configuração, não execução | Ambos |
| Checklist regulatório | Contexto, não pendência obrigatória | Arquivo 1 |
| Biossegurança | Ocorrência contextual quando há fato real | Ambos |
| Doença notificável | Suspeita/caso vinculado a animal/lote/evento | Arquivo 1 |
| Correção | Novo evento vinculado, não edição destrutiva | Ambos |
| Tags/sinais/insights | Auxiliares, nunca fonte primária | Ambos |
| Pendência corretiva | Só nasce de ocorrência real com `gera_pendencia=true` e `prazo_correcao` | Arquivo 1 |
| Fechamento de pendência | Só agenda específica vinculada por `source_evento_id`; agenda geral não é concluída | Arquivo 2 |
| Carência | Não inferir por agenda/protocolo isolado | Arquivo 1 |

---

## 3. O que está parcialmente feito

| Item | Estado atual | O que falta | Risco |
|---|---|---|---|
| Estorno/contra-lançamento | Helpers implementados/testados | Formulário dedicado com confirmação, motivo, saldo projetado e vínculo ao evento original | Médio |
| Caso notificável por lote | Suspeita por lote gera evento/payload | `sanitario_casos` ainda não suporta lote sem animal | Médio |
| Fechamento de exceções por projeção | Read model projeta status por eventos corretivos | Validar em staging com cenários reais/parciais | Médio |
| Payload corretivo | Funciona sem migration | Documentação formal e testes de compatibilidade | Médio |
| Robustez offline-first | Contrato implementado | Testar retry, replay, sync parcial, multi-dispositivo e concorrência | Alto |
| RLS/multi-tenant | Não houve alteração nesta fase | Validar em staging se correções respeitam isolamento por fazenda | Alto |
| Dashboard sanitário avançado | Não implementado por decisão | Só avançar após staging | Baixo |
| Documentação de domínio sanitário | Há docs de review por fase | Criar/atualizar contrato central `docs/domain/SANITARIO_CONTRACT.md` ou equivalente | Médio |

---

## 4. O que está planejado

### Agora

| Ação | Origem |
|---|---|
| Iniciar Fase 6 — Robustez Sanitária em Staging | Ambos |
| Testar correções sanitárias offline-first | Arquivo 2 |
| Validar replay/retry idempotente de eventos corretivos | Arquivo 2 |
| Validar estorno/contra-lançamento em sync parcial | Arquivo 2 |
| Validar isolamento por fazenda/RLS | Arquivo 2 |
| Validar resolução/cancelamento de ocorrência em múltiplos dispositivos | Arquivo 2 |
| Validar encerramento de agenda específica sem afetar agenda geral | Arquivo 2 |
| Criar checklist operacional de staging | Arquivo 2 |
| Documentar contrato sanitário consolidado | Arquivo 1 / recomendação ainda válida |

### Depois

| Ação | Origem |
|---|---|
| Criar formulário dedicado para estorno/contra-lançamento | Arquivo 2 |
| Ampliar validação de payload corretivo | Arquivo 2 |
| Validar projeção de fechamento de exceções em operação real | Arquivo 2 |
| Avaliar `sanitario_casos` com escopo `animal / lote` | Ambos |
| Melhorar execução assistida da pendência corretiva | Ambos |

### Futuro

| Ação | Origem |
|---|---|
| Dashboard sanitário mais completo | Arquivo 2 informa não iniciar ainda |
| Comercial/venda/abate | Explicitamente não iniciar ainda |
| Motor comercial | Não iniciar ainda |
| Financeiro avançado | Não iniciar ainda |
| Carência conclusiva para venda/abate | Só com fonte técnica explícita |

---

## 5. Duplicidades entre os arquivos

| Item repetido | Arquivo 1 | Arquivo 2 | Versão consolidada correta |
|---|---|---|---|
| Regra append-only | Planejada para Fase 5 | Implementada na Fase 5 | Correção/complemento/estorno/resolução/cancelamento são novos eventos vinculados |
| Exceções sanitárias mínimas | Listadas como escopo planejado | Listadas como read model implementado | Considerar implementadas conforme Arquivo 2 |
| Fontes primárias permitidas | Planejadas | Implementadas | `eventos`, `eventos_sanitario`, `insumo_movimentacoes`, `agenda_itens.source_evento_id`, `payload.biosseguranca_ocorrencia` |
| Fontes proibidas | Planejadas | Confirmadas | Agenda geral, protocolo isolado, checklist contextual, tag/marcador, insight |
| Encerramento de pendência corretiva | Planejado | Implementado | Apenas `agenda_itens` vinculados por `source_evento_id` |
| Fase 6 | Planejada após Fase 5 | Próximo passo recomendado | Iniciar staging sanitário |
| UI de exceções | Planejada | Implementada como painel mínimo em Eventos | Manter painel mínimo, sem dashboard avançado ainda |

---

## 6. Conflitos entre os arquivos

| Tema | Arquivo 1 | Arquivo 2 | Decisão recomendada | Risco |
|---|---|---|---|---|
| Status da Fase 5 | Planejada, não consolidada / execução pendente | Concluída e validada | Usar Arquivo 2 como estado mais recente | Alto |
| Reconciliação sanitária | Planejada, falta implementar | Helpers e read model implementados | Consolidar como implementada parcialmente: core pronto, UI de estorno pendente | Médio |
| Resolução/cancelamento de ocorrência | Parcial, escopo natural da Fase 5 | Implementado por novo evento vinculado | Considerar construído; validar staging | Médio |
| Tempo até resolução | Omitido quando sem data estruturada; faltava resolução estruturada | Relatório expõe tempo quando houver data estruturada | Considerar suportado apenas quando dados estruturados existirem | Baixo |
| Testes completos | Fase 4 tinha timeout em suíte completa | `fase 5` informa `pnpm test` completo verde | Usar Arquivo 2 para estado atual de validação | Médio |
| Necessidade de migration na Fase 5 | Documento 1 planejava sem explicitar execução | Arquivo 2 confirma sem migration | Manter sem migration, mas formalizar contrato de payload | Médio |
| UI de exceções | Planejada | Painel mínimo em `Eventos.tsx` | Considerar UI mínima pronta; formulário de estorno ainda pendente | Médio |

---

## 7. Pendências consolidadas

| Prioridade | Pendência | Origem | Observação |
|---|---|---|---|
| Alta | Validar Fase 5 em staging com sync real | Ambos | Próxima fase técnica |
| Alta | Testar retry/replay idempotente de eventos corretivos | Arquivo 2 | Essencial para offline-first |
| Alta | Validar RLS/multi-tenant para correções e pendências | Arquivo 2 | Impede vazamento cross-fazenda |
| Alta | Validar estorno/contra-lançamento em sync parcial | Arquivo 2 | Risco de saldo incorreto |
| Alta | Garantir que agenda geral não seja concluída no fluxo corretivo | Ambos | Regra central do domínio |
| Média | Criar formulário dedicado para estorno/contra-lançamento | Arquivo 2 | Helpers existem, UI incompleta |
| Média | Documentar contrato por payload corretivo | Arquivo 2 | Sem migration aumenta dependência de contrato |
| Média | Criar testes de compatibilidade do payload corretivo | Arquivo 2 | Evita regressão silenciosa |
| Média | Validar fechamento de exceções por projeção | Arquivo 2 | Read model pode falhar em casos parciais |
| Média | Atualizar documentação sanitária central | Arquivo 1 | Evita agentes reabrirem decisões fechadas |
| Média | Avaliar suporte de `sanitario_casos` por lote | Arquivo 1 | Backlog sanitário futuro |
| Baixa | Dashboard sanitário avançado | Arquivo 2 | Não iniciar antes de staging |
| Baixa | Comercial/venda/abate/financeiro avançado | Ambos | Explicitamente fora do próximo passo |

---

## 8. Decisões técnicas consolidadas

### Preservar
- **Agenda** = intenção/tarefa futura, não histórico.
- **Evento** = fato histórico append-only.
- **Protocolo** = regra/configuração, não execução.
- **Checklist regulatório** = contexto, não pendência obrigatória.
- **Biossegurança** = ocorrência contextual real, não checklist obrigatório.
- **Doença notificável** = suspeita/caso vinculado a animal/lote/evento.
- **Correção** = novo evento vinculado, não UPDATE destrutivo.
- **Tags/sinais/insights** = auxiliares, nunca fonte primária.
- Agenda geral não pode ser encerrada por correção sanitária.
- Pendência corretiva só pode ser encerrada se vinculada por `source_evento_id`.
- Carência não deve ser inferida por agenda ou protocolo isolado.

### Revisar/fortalecer
- Contrato de payload corretivo.
- Testes de compatibilidade de payload.
- Projeção de status por read model em cenários de sync parcial.
- UI segura para estorno/contra-lançamento.
- Documentação central do domínio sanitário.
- Suporte futuro de caso notificável por lote em model próprio.

---

## 9. Lacunas de informação

- Informação não identificada nos arquivos: diff real do repositório.
- Informação não identificada nos arquivos: commits/branches relacionados.
- Informação não identificada nos arquivos: cobertura exata por teste de cada helper da Fase 5.
- Informação não identificada nos arquivos: shape TypeScript completo de `SanitaryCorrectionPayload`.
- Informação não identificada nos arquivos: schema completo atual de `eventos.payload`.
- Informação não identificada nos arquivos: regras exatas de merge/replay no sync para eventos corretivos.
- Informação não identificada nos arquivos: evidência de validação Supabase local/staging para Fase 5.
- Informação não identificada nos arquivos: comportamento em conflito multi-dispositivo.
- Informação não identificada nos arquivos: impacto em RLS de cada correção.
- Informação não identificada nos arquivos: se `docs/domain/SANITARIO_CONTRACT.md` já foi criado.
- Informação não identificada nos arquivos: se `sanitario_casos` terá refatoração para lote.

---

## 10. Próximo passo recomendado

### Executar: Fase 6 — Robustez Sanitária em Staging
*Objetivo:* validar o domínio sanitário implementado em condições reais de operação, sem criar feature nova.

**Escopo técnico recomendado:**
1. Rodar cenários offline-first de correção sanitária.
2. Validar replay/retry idempotente de eventos corretivos.
3. Validar estorno/contra-lançamento com sync parcial.
4. Validar isolamento por fazenda/RLS.
5. Validar múltiplos dispositivos resolvendo/cancelando ocorrência.
6. Validar encerramento de agenda específica sem tocar agenda geral.
7. Validar projeção de exceções abertas/resolvidas/canceladas.
8. Criar checklist operacional de staging.
9. Formalizar contrato sanitário em documentação central.
10. Só rodar baseline Supabase se tocar RPC/RLS/migration.

### Não iniciar ainda:
- Venda
- Abate
- Motor comercial
- Sociedade
- Financeiro avançado
- Dashboard sanitário complexo
- Carência conclusiva sem fonte técnica explícita

**Decisão final consolidada:** a frente sanitária está funcionalmente concluída até Fase 5, mas ainda não está operacionalmente endurecida para staging real. A próxima etapa correta é robustez, não nova feature.