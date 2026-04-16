# Harden Module

Objetivo:
Restaurar fronteiras arquiteturais em um módulo ou hotspot específico do RebanhoSync, de forma incremental, segura e revisável, sem big bang rewrite.

## Quando usar
Use este workflow quando:
- um módulo mistura normalização, regra, payload, plano de mutação, efeito colateral e reconciliação
- o fluxo está difícil de testar, revisar ou evoluir
- existe perda de arquitetura operacional
- o objetivo é endurecer um hotspot sem redesenhar o sistema inteiro

## Não usar quando
Não use se a tarefa for apenas:
- bug visual local
- ajuste de texto
- alteração operacional pequena sem dívida arquitetural real

## Leitura inicial obrigatória
1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`

## Regras duras
- Trabalhar com escopo estreito.
- Atacar no máximo 1 capability principal por vez.
- Não usar `docs/archive/**` como fonte operacional.
- Não fazer big bang rewrite.
- Não expandir para outros domínios sem justificar.
- Preservar comportamento atual salvo se a tarefa pedir correção funcional explícita.
- Preferir patch mínimo e revisável.

## Invariantes globais do repositório
- Two Rails:
  - `agenda_itens` = intenção futura mutável
  - `eventos` + `eventos_*` = fatos passados append-only
- `fazenda_id` é a fronteira de isolamento
- sync/offline deve preservar:
  - idempotência
  - rollback determinístico por `before_snapshot`
  - coerência entre `queue_*`, `tableMap`, `pull` e `sync-batch`
- não espalhar retry/replay/idempotência na UI
- não transformar histórico em update destrutivo

## Pipeline arquitetural alvo
Toda refatoração deve buscar separar, no que for aplicável:

1. **Normalize**
2. **Select / Policy**
3. **Payload**
4. **Plan**
5. **Effects**
6. **Reconcile**

O objetivo não é impor necessariamente uma árvore física rígida, mas deixar a separação de responsabilidades inequívoca.

## Fronteiras desejadas
Use esta intenção como bússola:

- `normalize` → parsing, defaults, saneamento
- `policy` → elegibilidade, seleção, invariantes
- `payload` → shape persistível/de negócio
- `plan` → plano de mutação/operações
- `effects` → IO, Dexie, Supabase, fila, side effects
- `reconcile` → rollback, deduplicação, replay, refresh, merge
- `ui` → apresentação, interação, estado de tela

## Passo a passo

### Etapa 1 — Delimitar o hotspot
Defina:
- arquivos-alvo
- arquivos adjacentes permitidos
- arquivos explicitamente fora do escopo

### Etapa 2 — Diagnóstico
Mapeie no hotspot:
- responsabilidades misturadas
- pontos de acoplamento
- pontos de risco
- dependências ocultas
- quais partes pertencem a Normalize / Policy / Payload / Plan / Effects / Reconcile

### Etapa 3 — Baseline antes da cirurgia
Antes de mover código:
- identifique fluxos críticos afetados
- crie characterization tests quando fizer sentido
- documente o comportamento atual que precisa ser preservado
- explicite edge cases relevantes:
  - retry
  - rejeição
  - rollback
  - replay
  - idempotência
  - refresh pós-sync

### Etapa 4 — Escolher a primeira intervenção
Escolha o hotspot mais crítico e seguro.
A primeira rodada deve:
- reduzir mistura de camadas
- manter comportamento
- gerar diff pequeno
- melhorar testabilidade
- preparar a próxima extração

### Etapa 5 — Executar refatoração piloto
Extraia ou isole, quando aplicável:
- helpers de normalização
- validators / selectors / policy guards
- builders de payload
- builders de plano de mutação
- adapters / effects
- reconcile handlers

O arquivo principal do hotspot deve caminhar para **orquestrador**, não concentrador.

### Etapa 6 — Validar
Rodar:
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Se tocar área crítica, revisar invariantes específicas do domínio.

### Etapa 7 — Governança
Ao final, propor mecanismos para evitar recaída:
- checklist de PR
- regra de import/fronteira
- convenção de pastas
- definition of done arquitetural
- ADR, se necessário

## Entrega esperada
Responder sempre em:

### 1. Diagnóstico
- hotspots
- responsabilidades misturadas
- impacto
- riscos

### 2. Plano
- fases
- ordem de ataque
- fronteiras alvo
- critérios de aceite

### 3. Mudanças propostas
- o que será isolado ou extraído
- o que ficará explicitamente fora do escopo

### 4. Implementação executada
- primeira rodada de refatoração real
- arquivos tocados
- o que foi movido
- o que ainda permaneceu

### 5. Riscos / pendências
- até 3 riscos principais
- dívidas remanescentes
- acoplamentos ainda não removidos

### 6. Próximo passo recomendado
- próxima rodada incremental
- sem expandir escopo além do necessário

## Critérios de aceite
A tarefa só é considerada bem sucedida se:
- houver separação mais clara entre Normalize / Policy / Payload / Plan / Effects / Reconcile
- a UI ficar mais fina quando ela for parte do hotspot
- a lógica de negócio ficar mais testável sem UI/infra
- rollback/idempotência não ficarem espalhados
- o comportamento atual estiver preservado por teste ou evidência objetiva
- a mudança for incremental e revisável