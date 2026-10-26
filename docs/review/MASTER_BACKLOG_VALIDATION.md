# MASTER-BACKLOG-01/02 — validação do pacote documental consolidado

Atualizado em: 2026-10-25
Alvo: onze caminhos comparados integralmente à `main@2f4e218c33b40b48524db721019186ddb2f3a70b`.
Checkout preservado: `codex/sanitario-v2-functional-validation`, HEAD `4b43fc10ec9dfd0c19527c22c4d725799d9e7969`.

## Escopo acumulado e autoridade

A entrega 01 produziu dez caminhos; a revisão 02 tocou cinco, dos quais quatro já existiam: **10 + 5 − 4 = 11**, não quinze. O pacote contém uma linha de acesso em docs/README.md, cinco documentos MASTER_BACKLOG e cinco evidências (dois CSVs, dois JSONs e um SQL somente leitura). Não há novo backlog, relatório permanente ou mudança nos documentos canônicos de fase.

O [índice](./MASTER_BACKLOG.md) detém as 71 iniciativas/relações; o [plano](./MASTER_BACKLOG_EXECUTION_PLAN.md) explica tipos/escopos e squads; a [arquitetura](./MASTER_BACKLOG_ARCHITECTURE.md) registra I01/I02 preliminares; a [reconciliação](./MASTER_BACKLOG_RECONCILIATION.md) detém inventário, classificações e projeções. Este registro concentra os checks, substituindo repetições e o script de exemplo anterior.

## Proveniência preservada

| Etapa | Evidência observada / limite |
| --- | --- |
| MASTER-BACKLOG-01 | Main/PRs #240–#246 conferidos; 15 worktrees; snapshot inicial 22 modificados/157 untracked no checkout principal; 230 ocorrências originais. Gates, links e hashes conferidos. Não houve verificação de ciclos naquela etapa |
| Consulta remota 01 | Projeto RebanhoSync; transação READ ONLY em 25/10/2026 19:54:54Z. [SQL](./evidence/MASTER_BACKLOG_REMOTE_READONLY_20261025.sql) e [resultado agregado](./evidence/MASTER_BACKLOG_REMOTE_READONLY_20261025.json) preservados sem nova consulta ou extrapolação |
| MASTER-BACKLOG-02 | Antes: 189 caminhos no checkout principal; quatro documentos revisados + um JSON novo. 71 IDs/dez colunas, 18 referências externas, 15 escopos e 214 relações conferidos. Revisão independente estática sem findings materiais; 185 caminhos fora do escopo preservados |
| Consolidação final | Main reconfirmada no mesmo SHA; 15 worktrees acessíveis, HEADs ancestrais da main e staged vazio. Antes: 241 ocorrências, 232 caminhos distintos; 23 modificados/167 untracked no checkout principal. Nenhum arquivo funcional alterado ou descartado |

Versões anteriores dos documentos e patches incrementais foram preservados em snapshots temporários fora do repositório. Os 230 registros originais e hashes permanecem no CSV, acrescidos da classificação de integração e dos onze caminhos documentais. A redução de repetição não elimina evidência ou vínculo histórico.

## MASTER-BACKLOG-02 — verificação da revisão documental

A coluna Dep. é a fonte única. O verificador lê as 71 linhas, exige dez colunas, resolve destinos internos ou EXT-* registrados, valida escopos e ordena requisito→dependente por Kahn. O [JSON derivado](./evidence/MASTER_BACKLOG_DEPENDENCIES_02.json) registra hashes atuais das fontes e ordens topológicas.

Resultado: **17 BLOCKING, 108 CONDITIONAL, 55 RELATED e 34 HISTORICAL**. Sem ciclos em BLOCKING ou em BLOCKING + todas as CONDITIONAL ativas. RELATED/HISTORICAL não bloqueiam execução. A03/B02, C02 e I05 permitem investigação independente. Edição das fontes exige regenerar o JSON; ele não cria matriz concorrente.

## Verificação do pacote e integração proposta

O artefato temporário de integração reúne os onze arquivos, patch contra a main, manifesto e proposta de PR conforme o template vigente. Dois candidatos funcionais são exportados separadamente contra seu HEAD de origem, sem aplicação ou certificação para a main. Substituir ops.ts perderia guards #245: o delta de retry exige reconciliação seletiva.

Checks proporcionais: diff check tracked/staged e whitespace untracked; CSV/JSON; IDs/relações/ciclos; links/âncoras contra pacote + main; comparação integral da allowlist; preservação dos demais arquivos/HEADs/staged; revisão independente do diff completo; aplicação em modo check usando índice temporário inicializado na main. Não se usa HEAD..HEAD para revisar arquivos não commitados.

Gates documentais verificam cabeçalhos, continuidade F24 e governança. Não se usa strict/check-scope: a árvore contém trabalho alheio e a allowlist estreita não inclui os novos documentos autorizados. Nenhum gate foi alterado. As classificações históricas das etapas 01/02 não substituem a verificação atual.

**Resultado atual: READY somente para o pacote documental de onze caminhos.** `pnpm run gates:docs`, diff checks e verificador do pacote passaram; 86 links/âncoras contra pacote + main, 71 iniciativas/214 relações sem ciclos obrigatórios, CSV/JSON e 230 ocorrências fora do pacote preservadas. `git apply --cached --check` em índice temporário baseado na main retornou 0. Revisão independente do patch integral, manifesto e evidências sem findings materiais; não repetiu banco, testes, build ou gates. As alterações herdadas e os candidatos funcionais não recebem essa classificação. Título/corpo de PR são preparados somente como artefatos locais; criar/publicar/integrar continua dependendo de autorização.

## Riscos e decisões

1. Checkout anterior à main, dois grupos funcionais (16 caminhos), governança local e equivalência semântica de um relatório ainda não provada; o pacote não aprova esses deltas.
2. I01/I02 são diagnóstico/proposta; callers administrativos, clientes instalados, deployment e autorização efetiva não foram certificados. Protocolo aprovado, curadoria de produto e autorização operacional permanecem distintos.
3. Encerramento de worktrees exige autorização, ownership/ignorados conferidos e preservação pertinente. Integrar documentos remotamente não limpa checkouts antigos.

Não executados testes funcionais, TypeScript global, build, E2E, benchmarks ou nova consulta de banco: não há alteração de comportamento. Sem commit, push, merge, reset, clean, stash, rebase, cherry-pick, descarte, remoção de worktree, deploy ou migration. A redução imediata é de conteúdo repetido e candidatos de integração; contagens físicas só mudarão por operações posteriores autorizadas.
