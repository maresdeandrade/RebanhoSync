# Prepare PR

Objetivo:
Preparar uma mudança para revisão com escopo claro, riscos explícitos, validação objetiva e corpo de PR limpo.

## Quando usar
Use este workflow quando:
- a implementação já foi feita
- você precisa revisar o patch antes do PR
- você quer montar um PR enxuto e revisável
- a tarefa mexeu em área crítica do repo

## Leitura inicial obrigatória
1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`

## Leitura adicional conforme o tipo de mudança
### Offline / sync
- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`

### Schema / RLS
- `docs/DB.md`
- `docs/RLS.md`

### Arquitetura
- `docs/ARCHITECTURE.md`

### Docs derivados
- só se a mudança tiver impacto funcional real

## Regras duras
- Não ampliar escopo no fim da tarefa.
- Não incluir refatoração oportunista fora do objetivo principal.
- Não misturar correção estrutural, cleanup e feature nova sem deixar isso explícito.
- Preferir PR pequeno e coerente por capability/tema.

## Passo a passo
1. Identificar o alvo do PR:
   - capability principal ou `infra.*`
   - problema resolvido
   - arquivos centrais afetados

2. Revisar o patch:
   - o diff está mínimo?
   - há arquivo fora do escopo?
   - há mudança estrutural escondida?
   - há duplicação evitável?

3. Revisar invariantes conforme a área:
   - Two Rails
   - append-only
   - `fazenda_id`
   - FKs compostas
   - rollback / idempotência
   - catálogo global vs tenant-scoped
   - separação entre sanitário operacional e regulatório
   - fluxo parto -> pós-parto -> cria inicial
   - anti-teleporte / trânsito / compliance

4. Revisar documentação:
   - a mudança exige update normativo?
   - a mudança exige update derivado?
   - a mudança não exige docs e deve ficar assim?

5. Validar localmente:
   - `pnpm run lint`
   - `pnpm test`
   - `pnpm run build`

6. Montar o resumo do PR:
   - problema
   - solução
   - arquivos-chave
   - riscos
   - testes
   - docs alterados

## Corpo sugerido do PR
Usar este template:

### Contexto
- qual problema estava aberto
- qual capability / tema foi atacado

### O que mudou
- listar no máximo 5 mudanças principais
- citar os arquivos-chave

### O que NÃO mudou
- deixar claro o que ficou fora do escopo

### Riscos
- até 3 riscos reais

### Validação
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
- testes focados adicionais, se houver

### Docs
- documentos atualizados
- ou justificativa para não atualizar docs

## Entrega esperada
Retornar:
1. título sugerido do PR
2. corpo do PR pronto para colar
3. lista de arquivos centrais
4. lista de riscos
5. checklist final antes de abrir

## Checklist final
- O PR está fechado por um tema principal?
- O diff está mínimo?
- As invariantes principais foram preservadas?
- Os testes relevantes foram executados?
- A documentação foi tratada corretamente?
- Algum ADR seria necessário?