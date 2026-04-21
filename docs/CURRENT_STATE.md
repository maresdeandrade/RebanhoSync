# Current State (Snapshot Operacional)

> **Status:** Snapshot vivo
> **Ultima atualizacao:** 2026-04-21
> **Estado do produto:** Beta interno
> **Fase atual:** MVP funcional completo -> **SLC (Simple, Lovable, Complete) em consolidacao**

---

## 1. Leitura de fase

O RebanhoSync nao esta mais na fase de organizar arvore e quebrar monolitos iniciais.

Os hotspots criticos de UI (`Registrar` e `Agenda`) passaram pelo hardening estrutural principal, com shell mais fino e fronteiras locais mais claras entre composicao, estado, interacao, policy e efeitos.

A fase corrente e de **consolidacao operacional**:
- preservar previsibilidade dos fluxos centrais;
- reduzir friccao de uso em campo;
- aumentar consistencia de experiencia;
- estabilizar qualidade para evolucao incremental sem regressao estrutural.

Consolidacoes recentes da fase SLC:
- semantica transversal padronizada: `Registrar`, `Executar`, `Encerrar`, `Aplicar protocolo`, `Seguir fluxo` (reproducao);
- remocao de termos ambiguos legados da UI operacional;
- reforco do modelo Two Rails: Agenda (`agenda_itens`) != Eventos (`eventos`);
- `Aplicar protocolo` atua apenas na agenda (materializacao/recalculo), sem gerar evento.

---

## 2. O que foi consolidado

### Hotspot `src/pages/Registrar`

Hardening estrutural principal concluido:
- IO saiu do shell;
- pacotes financeiro/sanitario sairam do shell;
- finalize orchestration saiu do shell;
- step-flow saiu do shell;
- query parsing saiu do shell;
- quick action policy saiu do shell;
- adapters de section/shell state sairam do shell.

Residual dominante:
- volume de composicao/JSX (sem orquestracao densa relevante).

### Hotspot `src/pages/Agenda`

Hardening estrutural principal concluido:
- action controller saiu do shell;
- shell state saiu do shell;
- interaction state saiu do shell;
- blocos macro de resumo/compliance/lifecycle sairam do shell;
- componente visual monolitico principal foi fatiado.

Residual dominante:
- leitura/preparacao de dados ainda concentrada no shell (nao composicao macro).

---

## 2.1 Invariantes operacionais consolidados

- idempotencia de execucao: `1 acao -> 1 createGesture`;
- guards de reentrada/concorrencia ativos nos fluxos operacionais criticos para evitar dupla execucao;
- regressao semantica travada por `tests/smoke/semantic_terms_guard.smoke.test.ts`.

---

## 3. O que ainda nao esta consolidado

- estabilizacao ampla de testes fora dos recortes locais de hotspot;
- consolidacao da nova suite de integracao por fluxo (`tests/integration/flows/**`) como cobertura minima cross-flow;
- cleanup residual de shell/read-model nos pontos restantes;
- acabamento de UX para reduzir ambiguidade e carga cognitiva;
- maior consistencia cross-flow (agenda <-> registrar <-> protocolos).

Esses pontos impedem declarar SLC consolidado neste momento.

---

## 4. Proximo estagio (MVP -> SLC)

### Simple
- manter fluxos criticos previsiveis e com menos ambiguidade;
- remover residuos de shell pesado onde ainda houver.

### Lovable
- aumentar coesao visual e consistencia de feedback;
- reduzir friccao entre intencao e execucao.

### Complete
- fechar buracos percebidos nas rotinas centrais do recorte-alvo;
- consolidar confiabilidade para evolucao sem reabrir acoplamento estrutural.

---

## 5. Referencias de acompanhamento

- [README.md](../README.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [TECH_DEBT.md](./TECH_DEBT.md)
- [ROADMAP.md](./ROADMAP.md)
- [PROCESS.md](./PROCESS.md)
