---
name: rebanhosync-verification-gate
description: Valida um patch concluído do RebanhoSync, inspeciona diff tracked, staged e arquivos untracked, confirma escopo, contratos de domínio e evidências de teste e classifica a entrega antes de PR ou merge. Usar quando a implementação estiver concluída, houver mudanças locais a revisar ou a tarefa tocar domínio crítico, sync, RLS, migrations ou documentação. Não usar durante descoberta, planejamento, implementação em curso ou apenas para escrever o PR.
---

# RebanhoSync Verification Gate

## Missão

Classificar uma entrega com base no patch real e em validação proporcional:

- **READY**;
- **READY WITH CAVEAT**;
- **NOT READY**.

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/CONTEXT_LOADING.md`;
4. `.agents/rules/rtk.md`;
5. `AGENTS.md` local e skill de domínio, se o patch tocar caminho crítico.

## Inspeção obrigatória do patch

Executar:

```bash
git status --short --untracked-files=all
git diff --name-status
git diff --stat
git diff --cached --name-status
git diff --cached --stat
git diff --check
```

Regras:

- inspecionar o conteúdo do diff tracked e staged;
- abrir cada arquivo untracked relevante: nome no status não equivale a conteúdo revisado;
- identificar modificações preexistentes e não atribuí-las ao patch;
- se a entrega já estiver commitada, usar o base explicitamente informado para revisar `base...HEAD`;
- não usar base presumido para aprovar a entrega.

## Verificação de escopo

Comparar intenção e alterações reais:

- arquivos modificados, adicionados, removidos e renomeados;
- arquivos untracked;
- artefatos gerados;
- refactor amplo acidental;
- testes alterados sem justificativa;
- docs alterados sem delta funcional;
- migrations/RLS/RPC fora do escopo.

## Verificação de contratos

Aplicar apenas os contratos relevantes ao patch e confirmar que não houve violação:

- Agenda = intenção futura;
- Evento = fato executado;
- `state_*` = estado atual/read model;
- Protocolo = regra/configuração;
- tags/sinais/insights = auxiliares;
- decisão crítica = fonte técnica explícita;
- UI não contém regra crítica como única implementação;
- não existe fonte paralela de verdade;
- `fazenda_id`, RLS e isolamento multi-tenant permanecem preservados.

Quando aplicável, verificar offline-first, Dexie, gesto/fila, retry/replay, rollback, conflito, sucesso parcial, pull/reconcile, Supabase, policies, RPCs e migrations.

## Validação proporcional

Seguir `.agents/rules/rtk.md`.

| Escopo | Evidência mínima |
|---|---|
| Docs/skills | diff, frontmatter/links afetados e `git diff --check` |
| Patch local | teste focado do módulo e checagens locais aplicáveis |
| Domínio crítico | testes focados, lint e build |
| Entrega ampla | lint, suíte completa e build |
| Supabase/RLS/RPC/migration/sync-batch | validação funcional de baseline indicada em `.agents/rules/rtk.md` |

Registrar exatamente:

- comando executado;
- resultado;
- warnings relevantes;
- comando não executado e motivo.

Não afirmar sucesso sem saída confirmatória. Não reclassificar warning preexistente como regressão sem evidência.

## Classificação

### READY

Usar somente quando:

- escopo real está íntegro;
- todos os arquivos relevantes, inclusive untracked, foram revisados;
- validação proporcional passou;
- contratos aplicáveis foram preservados;
- não resta risco crítico de migration, RLS ou sync.

### READY WITH CAVEAT

Usar quando o patch está provavelmente seguro, mas há validação parcial justificada ou ressalva não bloqueante, ambas explícitas.

Não usar para encobrir teste relevante falhando, arquivo untracked desconhecido, escopo incerto ou risco crítico não resolvido.

### NOT READY

Usar quando houver:

- falha em validação relevante;
- arquivo ausente ou untracked não inspecionado;
- expansão de escopo injustificada;
- violação de contrato de domínio;
- risco não resolvido de RLS/sync/migration;
- documentação afirmando comportamento inexistente.

## Próximo passo

- Acionar `reconcile-docs` se houver drift formal.
- Acionar skill de domínio se um bloqueador exigir implementação.
- Acionar `prepare-pr` somente após READY ou READY WITH CAVEAT.

## Saída obrigatória

Separar fatos confirmados, inferências e recomendações e retornar:

1. classificação;
2. resumo do diff real;
3. arquivos alterados e untracked;
4. confirmação de escopo;
5. contratos verificados;
6. comandos e resultados;
7. bloqueadores;
8. riscos/pendências, até três;
9. recomendação final.

Não ocultar falhas nem aprovar conteúdo desconhecido.
