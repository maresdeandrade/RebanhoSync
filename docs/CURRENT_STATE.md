
---

## 2) `docs/CURRENT_STATE.md` — versão revisada

```md
# Estado Atual do Repositorio

> **Status:** Derivado (Snapshot Operacional)
> **Fonte de Verdade:** `src/`, `supabase/`, `package.json`
> **Ultima Atualizacao:** 2026-04-16

## 1. Resumo executivo

O repositório está em **beta interno**: o MVP principal já foi implementado e a base técnica segue funcional, testada e utilizável em regime interno controlado.

A fase atual não é de construção do núcleo funcional do produto, e sim de **hardening arquitetural operacional**. O foco imediato é restaurar fronteiras claras de responsabilidade em hotspots que ainda concentram, no mesmo módulo, normalização, regra, montagem de payload, plano de mutação, efeitos e reconciliação.

A frente atual deve ser lida como **melhoria estrutural incremental**, não como falta de capacidade funcional do produto.

---

## 2. Capacidades consolidadas

As seguintes frentes estão consolidadas no estado atual do produto:

- Onboarding inicial da fazenda.
- Importação CSV de animais, lotes e pastos.
- Registro rápido de manejos principais em `Registrar`.
- Agenda operacional com agrupamento, filtros, deduplicação e leitura contextual.
- Dashboard administrativo com leitura sanitária crítica.
- Dashboard reprodutivo dedicado.
- Ficha reprodutiva por matriz.
- Pós-parto neonatal e cria inicial.
- Ficha do animal com vínculos mãe/cria, curva de peso e timeline.
- Transições do rebanho com histórico consolidado.
- Relatórios operacionais com exportação/impressão.
- Biblioteca canônica de protocolos sanitários com `calendario_base`.
- Catálogo global de produtos veterinários com cache local e referência estruturada.
- Camada regulatória sanitária com catálogo oficial, overlays e `fazenda_sanidade_config`.
- `conformidade` como domínio append-only de verificações regulatório-operacionais.
- Bloqueios contextuais de nutrição, movimentação e venda/trânsito baseados no read model regulatório compartilhado.
- Telemetria de piloto com buffer local e flush remoto periódico.
- Taxonomia canônica bovina.
- Sync offline-first com rollback determinístico e fila transacional.
- RBAC endurecido, FKs compostas relevantes e contratos de sync estabilizados.

---

## 3. Arquitetura operacional: estado atual

O sistema já opera com uma pipeline arquitetural identificável, mas ainda com hotspots que acumulam responsabilidades demais.

A separação-alvo atualmente adotada como disciplina de engenharia é:

1. **Normalize**
2. **Select / Policy**
3. **Payload**
4. **Plan**
5. **Effects**
6. **Reconcile**

Leitura operacional dessa pipeline no estado atual:

- **Normalize**: saneamento, defaults, shape mínimo coerente para escrita.
- **Select / Policy**: elegibilidade, autorização, bloqueios e invariantes de negócio.
- **Payload**: montagem do shape persistível e metadados de sync.
- **Plan**: composição/ordenação das mutações e definição do fluxo transacional.
- **Effects**: IO, fila, escrita local/remota, adapters e integrações.
- **Reconcile**: rollback, replay, deduplicação, refresh, pull e alinhamento entre local/remoto.

**Status atual:** a pipeline já existe de forma operacional, mas ainda não está suficientemente explícita nem bem separada em todos os hotspots críticos.

---

## 4. Hotspots sob refatoração

### `src/pages/Registrar.tsx`
Hotspot de fluxo operacional e orquestração de tela.

Problema principal:
- mistura lógica de UI com partes de normalização, decisão operacional, montagem de payload e acionamento de efeitos.

Objetivo da frente:
- tornar a UI mais fina
- deslocar regra testável para camadas/artefatos mais previsíveis
- preservar comportamento atual

### `src/lib/offline/syncWorker.ts`
Hotspot de sync, efeitos e reconciliação.

Problema principal:
- concentra ordenação, envio, tratamento de resultado, retry, recuperação, purge, telemetria e refresh pós-sync.

Objetivo da frente:
- transformar o worker em orquestrador mais claro
- tornar explícita a separação entre plan, effects e reconcile
- preservar rollback determinístico e idempotência

---

## 5. Riscos e cuidado de regressão

Os principais riscos desta fase não são de escopo funcional, e sim de regressão estrutural:

- espalhar retry/replay/idempotência em UI ou camada de domínio
- quebrar rollback determinístico em fluxos offline-first
- deslocar regra de negócio para infraestrutura ou tela
- misturar catálogo regulatório, overlay e protocolo operacional da fazenda
- transformar a frente de hardening em refatoração ampla demais

Guardrails desta fase:
- patch mínimo e revisável
- baseline antes da cirurgia
- characterization tests quando fizer sentido
- preservação explícita de comportamento
- uma rodada de hotspot por vez

---

## 6. Proximos passos imediatos

Ordem imediata da frente atual:

1. atualizar docs-base
2. registrar baseline e comportamento preservado
3. refatorar piloto do `Registrar`
4. refatorar piloto do `syncWorker`
5. adicionar guardrails de processo, fronteira e revisão

---

## 7. Estado tecnico

- `pnpm run lint`: verde
- `pnpm test`: verde
- `pnpm run build`: verde
- `pnpm run test:e2e`: cobre onboarding, importações, relatórios e fluxo parto → pós-parto → cria inicial

---

## 8. Leitura recomendada para retomada

1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`
4. `docs/PRODUCT.md`
5. `docs/SYSTEM.md`
6. `docs/REFERENCE.md`