---
name: harden-module
description: Endurece incrementalmente módulos e hotspots do RebanhoSync por separação de responsabilidades, extração de regras puras, contenção de efeitos e limites seguros entre UI, domínio, persistência e sync. Usar quando um módulo mistura responsabilidades, duplica payload/validação/efeitos, concentra regra crítica em React ou apresenta risco arquitetural/operacional sem justificar reescrita ampla. Não usar para microcopy/visual, quando o hotspot ainda não foi localizado ou quando o patch já está na etapa de verificação final.
---

# Harden Module

## Missão

Reduzir risco arquitetural e operacional com alterações pequenas, reversíveis, testáveis e compatíveis com o comportamento explicitamente preservado.

## Coordenação

- Usar `repository-context-retrieval` se o hotspot ainda não estiver localizado.
- Combinar com a skill de domínio quando houver regra específica.
- Combinar com `sync-offline-rollback` para gesto, fila, retry, rollback ou reconcile.
- Combinar com `migrations-rls-contracts` para schema, RLS, constraint ou RPC.
- Encerrar com `rebanhosync-verification-gate` após o patch.

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/CONTEXT_LOADING.md`;
4. `.agents/rules/no-broad-context.md`;
5. `AGENTS.md` local, se existir;
6. hotspot, chamadores diretos e testes relacionados;
7. `.agents/rules/rtk.md`, se houver comandos.

Não abrir documentação ampla. Carregar somente o contrato de domínio ou técnico necessário para definir o limite correto.

## Restrições

- Preservar comportamento, salvo mudança explicitamente solicitada e testada.
- Não mover regra crítica para componente React nem usar UI como única validação.
- Não criar fonte paralela de verdade.
- Não ampliar escopo por conveniência.
- Não alterar migrations, RLS, RPC, seed ou contrato de sync sem escopo explícito.
- Preservar offline-first, `fazenda_id`, idempotência, retry e rollback.
- Evitar renomeações amplas, movimentação de pastas e troca massiva de interfaces.
- Não extrair abstração sem responsabilidade clara e consumidor real.

## Pipeline preferencial

Aplicar somente as etapas úteis ao hotspot:

1. **Normalize:** normalizar entrada e defaults sem transformar ausência em fato;
2. **Select/Policy:** aplicar regra pura e selecionar ação;
3. **Payload:** construir contrato de persistência uma única vez;
4. **Plan:** descrever efeitos antes de executá-los;
5. **Effects:** persistir, enfileirar ou integrar nas bordas;
6. **Reconcile:** confirmar, corrigir ou desfazer estado após sucesso/falha.

Não forçar o pipeline quando ele não representar o fluxo real.

## Procedimento

### 1. Confirmar o vazamento de responsabilidade

Classificar com evidência:

- UI contém regra de domínio;
- serviço contém preocupação de apresentação;
- validação e efeito estão misturados;
- payload é construído em vários pontos;
- regra, sync e reconcile estão acoplados;
- módulo coordena responsabilidades demais;
- testes cobrem apenas happy path.

### 2. Definir comportamento preservado

Registrar entradas, saídas, efeitos, erros e invariantes atuais. Separar bug confirmado de comportamento que deve permanecer. Não usar refactor para introduzir mudança funcional implícita.

### 3. Escolher a menor contenção

Preferir, conforme a falha:

- helper puro;
- validator;
- builder/mapper;
- policy/selector;
- adapter de persistência;
- planner de efeitos;
- função local de domínio;
- teste de caracterização antes da extração.

Manter assinaturas e formatos existentes quando isso reduzir regressão e não perpetuar o defeito.

### 4. Separar decisão de efeito

Regra pura não deve importar React, Supabase, Dexie, storage ou relógio global quando o tempo puder ser entrada explícita. Efeitos devem ficar em bordas identificáveis e receber IDs/tempos necessários de forma controlada.

### 5. Preservar contratos do RebanhoSync

Confirmar, conforme o módulo:

- Agenda continua intenção;
- Evento continua fato;
- `state_*` continua read model atual;
- Protocolo continua regra;
- tags/sinais/insights continuam auxiliares;
- decisão crítica mantém fonte técnica explícita;
- UI não se torna fonte de verdade;
- operação composta continua idempotente e reconciliável.

Para detalhes sanitários, reprodutivos, de movimento ou cadastro animal, usar a skill de domínio correspondente em vez de duplicar suas regras aqui.

### 6. Testar por fronteira

Cobrir:

- comportamento preservado;
- entrada inválida e ausência de dados;
- edge cases do domínio;
- determinismo da regra pura;
- chamada única dos efeitos;
- retry e duplicidade, se aplicável;
- falha parcial e rollback, se aplicável;
- integração estável com chamadores existentes.

### 7. Parar diante de expansão

Se a menor contenção exigir novo schema, mudança transversal de contrato, migração de dados ou reescrita de múltiplos módulos, interromper e relatar o novo escopo antes de implementá-lo.

## Validação

Seguir `.agents/rules/rtk.md`. Executar:

```bash
git status --short --untracked-files=all
git diff --check
```

Adicionar testes focados do hotspot. Para domínio crítico, usar lint e build; para entrega ampla, executar a suíte completa. Se tocar Supabase/RLS/RPC/migration/sync-batch, executar também a validação de baseline indicada nas regras.

## Saída obrigatória

Informar:

1. decisão de hardening;
2. fatos confirmados e comportamento preservado;
3. vazamento ou risco atual;
4. extração/limite mínimo aplicado;
5. arquivos afetados;
6. contratos de domínio, sync ou banco impactados;
7. testes e resultados;
8. bloqueadores e até três riscos residuais.

Separar fato, inferência e recomendação. Não propor reescrita ampla como primeira intervenção.
