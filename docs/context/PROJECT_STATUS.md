# Project Status — RebanhoSync

Atualizado em: 2026-06-04
**Baseline Commit:** `8cd5534`

## Objetivo

Registrar o estado vivo do projeto RebanhoSync em formato curto, operacional e útil para agentes, revisões e priorização.

Este documento não é changelog detalhado, auditoria histórica ou roadmap completo.

---

## Status atual

RebanhoSync está em beta interno, com MVP operacional.

A fase atual é Fase 9 — Gate Pós-MVP Comercial/Patrimonial/Classificação/Custo.

Último gate validado:

- Fase 9A Inventário Operacional concluída localmente;
- unidade de compra/apresentação, unidade base e unidade de consumo/evento separadas;
- custo total, custo por entrada e custo unitário/base separados;
- baixa nutricional idempotente por evento/source validada local e remotamente;
- snapshot econômico preservado como derivado/read-only;
- baseline funcional Supabase passou após reset local;
- suite global `pnpm test` passou (260 arquivos, 1746 testes);
- lint e build passaram.

Próximo foco:

- continuar Fase 9 pela Subfase 9B;
- usar a base de custo/unidade/snapshot consolidada na 9A;
- preparar relatórios operacionais de custo parcial;
- não antecipar DRE, ROI, venda, abate ou custo por arroba.

---

## Produto

RebanhoSync é um app agropecuário offline-first para gestão pecuária de corte.

Foco atual:

- produtor pequeno/médio;
- operação de campo;
- manejo prático;
- baixa fricção;
- funcionamento offline;
- sincronização confiável;
- gestão de rebanho, fazenda, agenda, eventos e rotinas.

Não é objetivo imediato virar ERP fiscal completo.

---

## Stack principal

- React;
- TypeScript;
- Vite;
- Dexie/IndexedDB;
- Supabase/Postgres/Auth/RLS;
- sync local-remoto por gestures/transações;
- Vitest/Testing Library;
- pnpm.

---

## Princípios técnicos atuais

- Offline-first.
- RLS como barreira real.
- Multi-tenant por `fazenda_id`.
- Operações idempotentes.
- Rollback determinístico quando aplicável.
- Separação entre UI, domínio, offline/sync e Supabase.
- Patches pequenos, reversíveis e testáveis.
- Não refatorar por conveniência.

---

## Contratos de domínio vigentes

- Agenda = intenção/tarefa futura.
- Evento = fato histórico executado.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração.
- Tags, sinais e insights = auxiliares de UX/consulta.
- Decisões críticas exigem fonte técnica explícita.

Detalhes:

- `docs/context/SOURCE_OF_TRUTH.md`
- `docs/context/KNOWN_GAPS.md`

---

## Áreas funcionais em foco

### Agenda

Papel:

- tarefas futuras;
- pendências;
- vencimentos;
- próximos manejos.

Risco principal:

- ser tratada indevidamente como histórico.

---

### Eventos

Papel:

- fatos executados;
- histórico;
- KPIs;
- auditoria.

Risco principal:

- evento sem detail suficiente ser tratado como resposta completa.

---

### Animais

Papel:

- cadastro;
- identidade;
- estado atual;
- origem/destino;
- status operacional.

Riscos principais:

- duplicidade de identidade;
- status atual sem evento/fonte adequada;
- inferência indevida de peso/venda/abate.

---

### Sanitário

Papel:

- agenda sanitária;
- registro operacional;
- produtos;
- protocolos;
- estoque/custo quando aplicável;
- compliance/regulatório como camada separada.

Riscos principais:

- protocolo como execução;
- agenda como histórico;
- carência inferida;
- compliance como bloqueio universal sem fonte explícita.

Estado validado em 2026-06-02:

- correção sanitária permanece append-only;
- replay corretivo usa `idempotency_key` determinístico;
- evento original não deve ser editado por correção;
- payload corretivo legado sem contrato completo fica parcial, com limitações explícitas.

---

### Reprodução

Papel confirmado principal:

- parto;
- pós-parto;
- cria;
- vínculo determinístico mãe-cria;
- agenda derivada quando aplicável.

Risco principal:

- assumir motor reprodutivo amplo/IATF sem validação real.

---

### Lotes/pastos/movimentação

Papel:

- estrutura produtiva;
- localização;
- movimentação;
- estado atual;
- histórico por eventos quando disponível.

Riscos principais:

- usar estado atual como histórico completo;
- inferir tempo de lotação/ganho de peso sem eventos suficientes.

---

### Compra/venda/financeiro

Papel:

- operações econômicas e patrimoniais;
- custos/snapshots quando implementados;
- apoio à gestão.

Riscos principais:

- margem/custo consolidado sem fonte completa;
- venda/abate como decisão automatizada sem fonte técnica explícita.

Limite confirmado em 2026-06-02:

- sociedade pecuária permanece vínculo patrimonial;
- sociedade não gera sanitário, conformidade ou financeiro automático;
- não houve avanço para venda, abate, DRE, ROI, custo por arroba ou motor comercial.

Limite confirmado em 2026-06-04:

- inventário operacional separa custo total, custo por entrada e custo unitário/base;
- baixa nutricional automática é idempotente por `eventId`/`source_evento_id`;
- `insumo_movimentacoes` possui índice único parcial remoto para `consumo_nutricao` por `(fazenda_id, source_evento_id)`;
- snapshot econômico segue derivado/read-only, sem virar fonte primária.

---

### Insights/read-only

Papel:

- composição operacional;
- leitura auxiliar;
- sinais não persistidos;
- status de resposta;
- limitação explícita.

Riscos principais:

- virar motor de regra crítica;
- criar agenda/evento;
- persistir tag como verdade;
- decidir carência/venda/abate.

---

## Arquitetura documental atual

A organização documental ativa deve seguir:

```txt
docs/
  context/
  technical/
  domain/
  product/
  ux/
  finance/
  manuals/
  review/
  archive/
```

Papel das pastas:

| Pasta | Papel |
|---|---|
| `context/` | contexto vivo, fonte de verdade resumida e lacunas |
| `technical/` | contratos técnicos ativos |
| `domain/` | regras e limites por domínio |
| `product/` | escopo, prioridades e capacidade |
| `ux/` | princípios visuais e padrões de tela |
| `finance/` | KPIs, custos e indicadores |
| `manuals/` | material de usuário/suporte |
| `review/` | revisões ativas |
| `archive/` | histórico, auditorias antigas e docs substituídos |

---

## O que está fora do foco imediato

Não priorizar neste momento sem tarefa explícita:

- ERP fiscal completo;
- NF-e;
- motor financeiro avançado completo;
- analytics preditivo;
- automação crítica de abate/venda;
- carência automatizada sem fonte técnica;
- motor reprodutivo amplo;
- compliance regulatório universal como bloqueio automático;
- refatoração ampla sem necessidade.

---

## Prioridades de desenvolvimento

Prioridades atuais:

1. preservar estabilidade do MVP;
2. reduzir dívida estrutural localizada;
3. melhorar UX de fluxos centrais;
4. validar sync/offline/rollback;
5. consolidar documentação ativa;
6. evitar duplicidade de fonte de verdade;
7. melhorar testes de edge cases;
8. preparar transição segura para evolução pós-MVP.

---

## Critérios de aceite para novas mudanças

Toda mudança deve responder:

- Qual fonte de verdade usa?
- Afeta Agenda, Evento, `state_*`, Protocolo ou sinal?
- Afeta offline-first?
- Afeta RLS/multi-tenant?
- Afeta Supabase/migration/RPC?
- Exige novo teste?
- Exige atualização documental?
- Cria risco de regressão operacional?

---

## Validação esperada

Validação proporcional ao escopo:

- patch local: teste específico;
- UI: teste do componente + lint;
- domínio crítico: testes do domínio + lint + build;
- sync/offline: testes amplos + build;
- Supabase/RLS: baseline funcional Supabase;
- documentação: checagem de duplicidade e links ativos.

Estado de gate em 2026-06-02:

- `pnpm test -- --run` passou;
- `pnpm run lint` passou;
- `pnpm run build` passou;
- Vitest usa `maxWorkers: 2` para reduzir timeouts falsos por concorrência em testes de UI/IndexedDB fake.

Detalhes:

- `docs/technical/TESTING_GATES.md`
- `.agents/rules/rtk.md`

---

## Manutenção deste documento

Atualizar este arquivo quando houver:

- mudança real de fase do projeto;
- alteração relevante de escopo;
- novo contrato de domínio;
- mudança de prioridade;
- lacuna resolvida ou nova lacuna crítica;
- alteração estrutural da documentação.

Não atualizar para cada patch pequeno sem impacto estratégico.
