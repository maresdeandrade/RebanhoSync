# Processo de Engenharia (RebanhoSync)

> **Status:** Normativo
> **Fonte de Verdade:** Este documento
> **Última Atualização:** 2026-04-21

## 1. Objetivo

Este documento define **como o projeto é evoluído**, **como mudanças são enquadradas**, **como o estado do repositório é refletido na documentação** e **quais critérios mínimos determinam que uma entrega está realmente concluída**.

Ele não é snapshot do momento, nem backlog de gaps em aberto.  
Seu papel é normativo: orientar execução, revisão e reconciliação.

---

## 2. Princípios de execução

### 2.1 Capability-centric
Toda mudança deve ser enquadrada, sempre que possível, por:
- `capability_id`
- ou trilhos `infra.*`

A unidade principal de evolução não é “arquivo editado”, e sim:
- capacidade funcional
- contrato
- trilho estrutural
- item de infraestrutura

### 2.2 Código e migrations acima da narrativa
Em caso de conflito, a ordem de confiança é:

1. código + migrations
2. `docs/CURRENT_STATE.md`
3. docs normativos
4. docs derivados
5. histórico

### 2.3 Escopo estreito
Mudanças devem, por padrão:
- atacar no máximo 1 capability principal por vez
- preferir patch mínimo
- evitar refatoração ampla sem pedido explícito
- explicitar o que ficou fora do escopo

### 2.4 Não usar histórico como fonte operacional
`docs/archive/**` e materiais históricos podem servir como contexto, mas não como fonte principal de decisão do presente.

---

## 3. Taxonomia documental

### 3.1 Snapshot operacional
Resume o estado atual para leitura rápida.

Exemplos:
- `README.md`
- `docs/CURRENT_STATE.md`

### 3.2 Normativo
Define arquitetura, contratos, regras e processo.

Exemplos:
- `docs/PROCESS.md`
- `docs/PRODUCT.md`
- `docs/SYSTEM.md`
- `docs/ARCHITECTURE.md`
- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`
- `docs/DB.md`
- `docs/RLS.md`

### 3.3 Derivado
Mede o estado do repositório por derivação.

Exemplos:
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/TECH_DEBT.md`
- `docs/ROADMAP.md`
- `docs/review/RECONCILIACAO_REPORT.md`

### 3.4 Histórico
Não é fonte operacional de verdade.

Exemplos:
- `docs/archive/**`
- auditorias antigas
- relatórios temporários não consolidados

---

## 4. Trilho padrão de execução

### 4.1 Delimitar
Toda tarefa deve começar com:
- capability ou `infra.*` alvo
- arquivos-alvo
- arquivos explicitamente fora do escopo
- invariantes que não podem ser quebradas
- comandos mínimos de validação

### 4.2 Implementar
A implementação deve:
- preservar o modelo arquitetural do produto
- manter alinhamento com offline-first, contratos, banco e RLS
- evitar duplicação de regra entre camadas
- reduzir acoplamento quando a tarefa for de hardening
- permanecer revisável como patch pequeno

### 4.2.1 Disciplina arquitetural operacional

Além da coerência com arquitetura, offline, contratos, banco e RLS, toda frente relevante de fluxo operacional deve tender à separação explícita entre:

1. **Normalize**
2. **Select / Policy**
3. **Payload**
4. **Plan**
5. **Effects**
6. **Reconcile**

Intenção normativa por etapa:

- **Normalize:** saneamento, parsing, defaults e shape mínimo coerente de entrada
- **Select / Policy:** elegibilidade, seleção, autorização, invariantes e regras de negócio
- **Payload:** montagem do shape persistível/de negócio
- **Plan:** composição e ordenação do plano de mutação/operação
- **Effects:** IO, adapters, persistência, fila, chamadas remotas e side effects
- **Reconcile:** rollback, deduplicação, replay, merge, refresh e alinhamento local/remoto

Regras de fronteira:

- `domain/*` não deve importar React, router, toast, Dexie, Supabase, fetch, `window` ou `localStorage`
- `ui/*` não deve implementar regra de negócio forte, montar payload persistível como fonte de verdade nem concentrar reconciliação
- `infrastructure/*` não deve decidir elegibilidade ou política de negócio
- `reconcile/*` deve concentrar rollback, deduplicação, replay, idempotência e refresh quando aplicável
- `useCase` pode orquestrar, mas não deve concentrar o detalhe completo de todas as etapas

Regra prática:
- o objetivo não é impor uma árvore rígida em todo o repositório de uma vez
- o objetivo é reduzir hotspots que acumulam múltiplas responsabilidades primárias

### 4.2.2 Fluxo de hardening arquitetural

Quando a mudança tiver caráter de hardening arquitetural operacional, seguir esta ordem:

1. identificar hotspot e responsabilidades misturadas
2. registrar baseline/comportamento preservado
3. extrair funções puras quando fizer sentido
4. isolar efeitos e adapters
5. separar reconciliação da camada de tela
6. validar preservação de comportamento
7. só então expandir para o próximo hotspot

Regra prática:
- atacar um hotspot por vez
- evitar big bang rewrite
- preferir patch mínimo, incremental e revisável

### 4.2.3 Pós-hardening de hotspots críticos

Quando os hotspots criticos de uma frente estiverem endurecidos (ex.: shell fino, fronteiras claras, sem orquestracao densa na UI), o processo entra em fase de consolidacao:

- reduzir residuos estruturais pontuais sem reabrir monolitos;
- priorizar consistencia de experiencia e friccao operacional;
- fortalecer cobertura de regressao dos fluxos centrais;
- tratar a fase como transicao de MVP funcional para SLC em consolidacao (nao produto finalizado).

### 4.2.4 Governanca semantica e idempotencia

Em fluxos operacionais, manter as regras normativas:

- Two Rails explicito: Agenda (intencao mutavel) != Eventos (fato append-only).
- `Registrar` e `Executar` registram evento.
- `Encerrar` e `Cancelar` atuam apenas na agenda.
- `Aplicar protocolo` atua apenas na agenda (materializacao/recalculo), sem registrar evento.
- `Seguir pos-parto` e `Seguir rotina da cria` identificam continuidade de fluxo guiado em reproducao.
- `Concluir direto`, `Abrir proxima acao`, `Abrir registro detalhado` e `Executar direto` sao termos proibidos.
- invariavel de execucao: `1 acao -> 1 createGesture` (sem duplicacao sequencial).
- handlers de acao direta devem usar guarda de reentrada/concorrencia para evitar dupla submissao e navegacao duplicada.

### 4.3 Validar
Toda entrega deve, no mínimo, validar:

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Para evolucao de fluxo de produto em fase MVP -> SLC, manter tambem:

- `pnpm run test:hotspots`
- `pnpm run test:integration`
- `pnpm run test:smoke`

### 4.3.1 Smoke critico minimo

A suite de smoke critico fica em `tests/smoke/**` e precisa permanecer com execucao rapida (alvo <= 2 min).

Cobertura minima obrigatoria:

1. Agenda -> Registrar -> Conclusao
2. Registro direto (trilhos principais)
3. Execucao sanitaria basica
4. Navegacao critica (animal, evento, protocolo)

Regra:
- smoke nao substitui suites de dominio nem E2E;
- smoke protege regressao de fluxo central e roteamento operacional;
- toda mudanca que quebrar smoke bloqueia merge ate ajuste.
- `tests/smoke/semantic_terms_guard.smoke.test.ts` e regra oficial para bloquear regressoes de taxonomia semantica.

### 4.3.2 Gate minimo de qualidade

Gate operacional padrao para mudancas de produto:

1. `pnpm run lint`
2. `pnpm run test:hotspots`
3. `pnpm run test:integration`
4. `pnpm run test:smoke`

Script consolidado:
- `pnpm run quality:gate`

### 4.3.3 Padrao minimo de suites por dominio

Para reduzir regressao cross-flow e evitar cobertura excessivamente acoplada a componente, manter a separacao:

- `unit`: helpers, policies e funcoes puras (`src/**/__tests__/*helper.test.ts*` e equivalentes)
- `integration`: fluxo entre modulos/controladores (`tests/integration/**`)
- `smoke`: cenarios criticos de navegacao/execucao (`tests/smoke/**`)

Regra:
- priorizar testes por fluxo de negocio e nao por detalhe de UI;
- quando existir duvida, validar comportamento observavel do fluxo (entrada -> acao -> estado/saida).

Quando a tarefa tocar áreas sensíveis, revisar adicionalmente:
- invariantes de sync/offline
- isolamento por `fazenda_id`
- FKs compostas
- append-only
- contratos de payload
- impactos em rollback/idempotência

### 4.4 Reconciliar docs
Docs só devem ser atualizados quando houver delta real.

Regra:
- snapshot atualiza quando o momento operacional muda
- normativo atualiza quando arquitetura/contrato/regra muda
- derivados atualizam quando capability, gap, dívida, fase ou reconciliação mudam de fato

### 4.5 Definition of Done

Um item só vai para concluído quando:

- o código necessário está implementado
- lint, test e build estão verdes
- o `capability_id` deixa de aparecer como gap, ou o item `infra.*` foi resolvido
- os docs derivados foram atualizados quando aplicável
- a reconciliação não aponta inconsistências abertas para aquele item

Quando a mudança tiver caráter de hardening arquitetural operacional, a Definition of Done também exige:

- fronteiras de responsabilidade mais claras no hotspot atacado
- UI mais fina quando a tela fizer parte do hotspot
- regra testável sem depender diretamente de UI ou infra, quando aplicável
- reconciliação fora da tela quando aplicável
- comportamento preservado por testes ou evidência objetiva
- escopo incremental e revisável

---

## 5. Regras para `infra.*`

Trilhos `infra.*` são usados quando a mudança principal não é uma capability de produto, e sim uma frente estrutural.

Exemplos:
- `infra.sync.*`
- `infra.db.*`
- `infra.rls.*`
- `infra.docs.*`
- `infra.arch.*`
- `infra.gates.*`
- `infra.registrar.*`

Nesses casos, o item deve explicitar:
- hotspot ou área atacada
- risco atual
- fronteira desejada
- impacto esperado
- critério de fechamento

---

## 6. Atualização documental derivada

Quando a mudança tiver impacto funcional real, os derivados devem ser atualizados nesta ordem:

1. `docs/IMPLEMENTATION_STATUS.md`
2. `docs/TECH_DEBT.md`
3. `docs/ROADMAP.md`
4. `docs/review/RECONCILIACAO_REPORT.md`

Regras:
- `IMPLEMENTATION_STATUS` mede estado efetivo
- `TECH_DEBT` registra gaps/dívidas reais
- `ROADMAP` organiza execução futura
- `RECONCILIACAO_REPORT` registra inconsistências entre fontes

---

## 7. Quando abrir ADR

Abrir ADR se a mudança alterar:
- contrato do sync
- ordering / deduplicação / status codes
- modelo de dados canônico
- invariantes de RLS / RBAC / RPC
- arquitetura offline-first / Two Rails
- regra normativa que passa a orientar o produto

---

## 8. Resumo operacional

Em caso de dúvida, a ordem de consulta deve ser:

1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`
4. `docs/PRODUCT.md`
5. `docs/SYSTEM.md`
6. `docs/REFERENCE.md`
7. documentos derivados (`IMPLEMENTATION_STATUS`, `TECH_DEBT`, `ROADMAP`)

Esse encadeamento reduz confusão entre momento atual, processo, aprofundamento normativo e histórico.

---

## 9. Regras finais

- não usar histórico como fonte principal
- não abrir escopo por conveniência
- não atualizar docs por reflexo
- não declarar concluído o que ainda depende de reconciliação
- não misturar snapshot do momento com documento normativo de processo
