# Arquitetura Operacional (Two Rails)

> **Status:** Normativo
> **Fonte de Verdade:** Codigo fonte e migrations
> **Ultima Atualizacao:** 2026-04-21

Documento normativo enxuto para semantica operacional transversal e invariantes de execucao. Complementa `docs/SYSTEM.md`.

---

## 1. Modelo Two Rails

- **Rail 1 (Agenda / `agenda_itens`)**: intencao futura mutavel.
- **Rail 2 (Eventos / `eventos` + `eventos_*`)**: fato executado append-only.
- Agenda e Evento nao se confundem.
- Correcao historica ocorre por contra-lancamento, nao por update destrutivo de negocio.

Regra de acao:
- `Registrar` / `Executar` -> escrevem no trilho de eventos.
- `Encerrar` / `Cancelar` -> atualizam pendencia no trilho de agenda.
- `Aplicar protocolo` -> recalcula/materializa agenda; nao cria evento diretamente.

---

## 2. Taxonomia Semantica Consolidada

CTAs oficiais do fluxo operacional:

- `Registrar` (fluxo completo com formulario)
- `Executar` (acao direta com evento imediato)
- `Encerrar` (fecha pendencia na agenda)
- `Cancelar` (cancela pendencia na agenda)
- `Aplicar protocolo` (materializa agenda por regra)
- `Seguir pos-parto` / `Seguir rotina da cria` (continuidade guiada de reproducao)
- `Voltar para agenda` (navegacao contextual)

Termos proibidos:
- `Concluir direto`
- `Abrir proxima acao`
- `Abrir registro detalhado`
- `Executar direto`

---

## 3. Idempotencia e Concorrencia de Execucao

Invariante operacional:

- `1 acao -> 1 createGesture`.

Regras de implementacao:

- handlers de acao direta devem impedir reentrada (clique duplo/submissao repetida);
- protecoes de concorrencia devem bloquear execucoes paralelas redundantes;
- fluxo critico deve preservar `1 acao -> 1 resultado -> 1 navegacao`.

---

## 4. Protecao de Regressao

- `tests/smoke/semantic_terms_guard.smoke.test.ts` e a regra oficial para bloquear retorno de termos semanticos proibidos.
- O gate de qualidade deve manter smoke ativo para validar previsibilidade dos fluxos centrais.

