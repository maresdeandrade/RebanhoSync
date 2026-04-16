# Reconcile Docs

Objetivo:
Reconciliar a documentação do RebanhoSync com o estado real do código e das migrations, atualizando apenas os documentos realmente impactados e evitando drift.

## Quando usar
Use este workflow quando:
- houver mudança funcional relevante no repo
- houver suspeita de drift entre código e docs
- o objetivo for atualizar snapshot, normativos ou derivados
- o usuário pedir análise do estágio atual do projeto

## Não usar quando
Não use se a mudança for apenas:
- visual
- limpeza/refatoração interna sem impacto funcional
- ajuste local de texto sem necessidade de reconciliação

## Leitura inicial obrigatória
1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`

## Leitura adicional conforme necessidade

### Snapshot operacional
- `docs/STACK.md`
- `docs/ROUTES.md`
- `docs/REPO_MAP.md`

### Normativos
- `docs/ARCHITECTURE.md`
- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`
- `docs/DB.md`
- `docs/RLS.md`

### Derivados
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/TECH_DEBT.md`
- `docs/ROADMAP.md`
- `docs/review/RECONCILIACAO_REPORT.md`

## Regras duras
- Não usar `docs/archive/**` como fonte operacional.
- Não atualizar docs derivados sem delta funcional real.
- Em caso de conflito, confiar primeiro em:
  1. código + migrations
  2. `docs/CURRENT_STATE.md`
  3. docs normativos
  4. docs derivados
- Não reescrever documentos estáveis sem necessidade.

## Passo a passo
1. Identificar o escopo da iteração:
   - capability(s) afetadas
   - arquivos/módulos alterados
   - migrations envolvidas
   - testes relevantes

2. Classificar o impacto:
   - snapshot operacional
   - normativo
   - derivado
   - nenhum impacto documental real

3. Validar o estado real no código:
   - superfícies de UI alteradas
   - domínio(s) afetados
   - sync/offline
   - schema/RLS/contratos
   - evidências de testes

4. Medir o delta documental:
   - o que mudou de verdade
   - o que continua válido
   - o que está em drift
   - o que não deve ser tocado

5. Atualizar docs na ordem correta, se aplicável:
   1. `docs/IMPLEMENTATION_STATUS.md`
   2. `docs/TECH_DEBT.md`
   3. `docs/ROADMAP.md`
   4. `docs/review/RECONCILIACAO_REPORT.md`

6. Atualizar normativos apenas se houve mudança real em:
   - contrato
   - arquitetura
   - RLS/RBAC/RPC
   - offline/sync
   - modelo canônico

7. Avaliar ADR:
   - contrato do sync
   - ordering / deduplicação / status codes
   - modelo canônico
   - offline-first / Two Rails
   - regra normativa nova que passa a orientar o produto

## Entrega esperada
Retornar:
1. resumo da iteração
2. avanços, pendências e regressões
3. fase atual do projeto
4. documentos atualizados
5. documentos deliberadamente não alterados
6. riscos / dívidas / divergências
7. ADRs sugeridos, se houver

## Formato de saída
- diff mínimo por documento
- sem reescrever arquivo inteiro sem necessidade
- até 3 riscos principais
- separar claramente:
  - snapshot
  - normativo
  - derivado

## Checklist final
- O delta foi validado no código/migrations?
- Docs derivados não se contradizem?
- `CURRENT_STATE.md` continua refletindo o estado atual?
- Algum drift antigo foi removido?
- Houve mudança que exige ADR?