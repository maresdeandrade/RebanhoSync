---
name: rebanhosync-verification-gate
description: Usar quando um patch do RebanhoSync estiver concluído e aguardando verificação técnica. Não usar durante descoberta, planejamento ou implementação em andamento, por simples menção a domínio crítico, sanitário, sync, RLS, migrations ou documentação, nem apenas para escrever o PR.
role: lifecycle
---

# RebanhoSync Verification Gate

## Missão

Classificar uma entrega com base no patch real e em validação proporcional:

- **READY**;
- **READY WITH CAVEAT**;
- **NOT READY**.

## Leitura inicial

Aplique o bootstrap único de `.agents/rules/CONTEXT_LOADING.md` e `.agents/rules/rtk.md`, sem reler arquivos já carregados e vigentes. Consulte o `AGENTS.md` local e contratos identificados pela implementação; carregar no máximo uma skill de apoio se uma lacuna crítica de domínio permanecer explícita.

O gate é uma fase lifecycle posterior ao patch e não conta como segunda skill principal da implementação. Ele não corrige o patch durante a revisão.
É a autoridade final da classificação; scripts e pareceres são evidência, não gates concorrentes. Pode ser breve na rota A e ocorrer na mesma sessão da implementação, sem documento adicional.

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
- diff vazio não valida commit não examinado; sem patch ou intervalo confirmado, não emitir READY;
- escopo declarado parcial nunca substitui a inspeção de todas as alterações reais; separar explicitamente deltas preexistentes protegidos da entrega.

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
| Patch local | teste focado quando houver delta comportamental e checagens locais aplicáveis; docs/microcopy/triviais sem esse delta não exigem testes artificiais |
| Domínio crítico | testes focados do comportamento e modos de falha; lint/build conforme impacto real e critérios de aceite |
| Entrega ampla | cobertura das superfícies alteradas; lint, suíte ampliada/build/E2E somente quando risco e critérios exigirem, com autorização pertinente |
| Supabase/RLS/RPC/migration/sync-batch | validação funcional de baseline indicada em `.agents/rules/rtk.md` quando o contrato for afetado; mera menção não aciona o comando |

Para correção de comportamento, exigir evidência funcional pertinente ao defeito, incluindo falha anterior/controle negativo quando viável e resultado esperado após a correção. Lint, build ou teste sem relação demonstrada não substituem essa evidência.

Reutilize testes, revisão e conferência de evidências existentes somente se conteúdo do patch, baseline e condições relevantes não mudaram. Registre alvo e resultados reaproveitados; repita apenas verificações afetadas por mudanças ou por lacuna técnica concreta. Revisão independente é proporcional ao risco; não repeti-la por rotina nem apresentar autorrevisão como independente.

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
- evidência funcional pertinente está presente para mudanças de comportamento, sem verificação crítica ausente;
- contratos aplicáveis foram preservados;
- não resta risco crítico de migration, RLS ou sync.

### READY WITH CAVEAT

Usar quando o patch está provavelmente seguro, mas há validação parcial justificada ou ressalva não bloqueante, ambas explícitas.

Não usar para encobrir teste relevante falhando, arquivo untracked desconhecido, escopo incerto ou risco crítico não resolvido.
Ausência de verificação crítica exige NOT READY, mesmo que todos os comandos executados tenham passado. `Validation PARTIAL`/`NONE` do script não autorizam READY; resolver a lacuna com evidência pertinente antes de classificar.

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
- Acionar `prepare-pr` somente após READY. READY WITH CAVEAT exige resolver ou reclassificar a ressalva antes de usar o contrato automatizado de PR.

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
