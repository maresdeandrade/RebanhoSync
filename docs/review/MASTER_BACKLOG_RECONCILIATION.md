# MASTER-BACKLOG-01 — reconciliação Git e evidências

Atualizado em: 2026-10-25
Tipo: diagnóstico local; snapshot derivado, sem integração ou certificação funcional.

## Baseline e método

**FATO CONFIRMADO:** `git ls-remote origin refs/heads/main` e `git fetch --no-tags origin main` confirmaram `2f4e218c33b40b48524db721019186ddb2f3a70b`. O fetch atualizou apenas a referência remota e objetos; nenhum checkout foi atualizado. Remoto: `maresdeandrade/RebanhoSync`.

Checkout de trabalho: `C:/Users/mares/dyad-apps/GestaoAgro`, branch `codex/sanitario-v2-functional-validation`, HEAD `4b43fc10ec9dfd0c19527c22c4d725799d9e7969`. Antes da edição desta entrega: **22 modificados, 157 untracked, staged vazio**. Os 179 caminhos foram observados novamente; não se adotou a contagem histórica como premissa.

Inventário: `git worktree list --porcelain`; por checkout, HEAD, branch, `git status --porcelain=v1 -z -uall`, staged e ancestralidade contra o SHA remoto congelado. Todos os 15 worktrees registrados estavam acessíveis; todos os HEADs são ancestrais desse SHA. Isso não torna alterações não commitadas integradas.

Para cada caminho alterado/untracked, compararam-se bytes locais com `main:path` e `HEAD:path`, normalizando somente CRLF/LF. Para divergências relevantes, inspecionaram-se diff e versões históricas em `git log main -- path` / `git show commit:path`. O [CSV por arquivo](./evidence/MASTER_BACKLOG_WORKTREE_FILES_20261025.csv) preserva os **230 registros originais**, acrescenta os onze caminhos documentais e classifica as **241 ocorrências atuais / 232 caminhos distintos** para integração. Ignorados, diretórios externos e worktrees não registrados ficam fora do inventário.

## Entregas integradas confirmadas

Metadados consultados pelo conector GitHub; merges/heads também presentes na ancestralidade local da main. Integração Git não equivale a certificação ampliada; checks relatados nos PRs não foram reexecutados nesta tarefa.

| PR | Merge | Head / branch local correspondente | Resultado integrado |
| --- | --- | --- | --- |
| [#240](https://github.com/maresdeandrade/RebanhoSync/pull/240) | `31815a260c8aef2798e87a448dce3f973673b4c4` | `08ed2af1f8ea36e960b1c195e4ab69abd0003cae` / `codex/operational-summary-modularization` | Relatórios operacionais modularizados e contratos reconciliados |
| [#241](https://github.com/maresdeandrade/RebanhoSync/pull/241) | `01f0cb6ae62abc7f7a255b111461a64132aff8a7` | `cc7c7d90f32a13881c21619e04e81dec0fb3f5cc` / `refactor/insumos-inventory-projection` | Projeção pura de Insumos |
| [#242](https://github.com/maresdeandrade/RebanhoSync/pull/242) | `c9155a513d3b82a86f4fa1ce1b8c8562e086f4f2` | `be0f1e09652582924ec797a45ac7ceeed3aa8ff0` / `codex/sanitario-vf5-integration` | VF1–VF5, contexto e rastreabilidade sanitária |
| [#243](https://github.com/maresdeandrade/RebanhoSync/pull/243) | `7daaa49c06f4b1de72181fe2fc5967a749a6e67c` | `4f139b508c80d906d0cd9f9e4e1766b9a156ff50` / `codex/insumos-inventory-snapshot` | Adaptador de snapshot Dexie de Insumos |
| [#244](https://github.com/maresdeandrade/RebanhoSync/pull/244) | `0e7f5137a865f2671d035e51d624609a563e441e` | `00f42b6804ce1cb8a4329daf6a45d13c4e607551` / `codex/sanitario-f9-public-integration` | Artefatos públicos F6–F9 e publicador |
| [#245](https://github.com/maresdeandrade/RebanhoSync/pull/245) | `20fd5c6fbd7cfbccf1d3db1446cf8a8e3fd60aaa` | `e86518146d2e8815d770414ae90720e4b4741b95` / `fix/insumos-farm-context-isolation` | Auth e isolamento transacional/UI de Insumos |
| [#246](https://github.com/maresdeandrade/RebanhoSync/pull/246) | `2f4e218c33b40b48524db721019186ddb2f3a70b` | `7e3bbf95a3429ad2f1979826d913a6ca94677f8b` / `codex/sanitario-f9-doc-closeout` | Fechamento documental pós-F9 |

## Worktrees inspecionados

Prefixos: **C** = `C:/Users/mares/dyad-apps/`; **W** = `C:/Users/mares/.codex/worktrees/`; **K** = `C:/Users/mares/.local/share/kilo/worktree-pool/gestaoagro-d353e5299704/`. A tabela abaixo preserva M/U e classes do snapshot 01; os campos `current_*`/`closure_assessment` do [CSV de worktrees](./evidence/MASTER_BACKLOG_WORKTREES_20261025.csv) contêm a conferência atual. Staged = 0 em todos. `detached` não significa abandonado nem autoriza limpeza.

| WT | Caminho sob prefixo | HEAD curto / branch ou detached | M/U | Reconciliação |
| --- | --- | --- | --- | --- |
| W00 | C `GestaoAgro` | `4b43fc10` / `codex/sanitario-v2-functional-validation` | 22/157 | 21 INTEGRATED; 6 STALE_VERSION; 20 LOCAL_DELTA; 1 CONFLICT; 131 EVIDENCE_ONLY |
| W01 | W `farm-context-01/GestaoAgro` | `7daaa49c` / detached | 3/5 | 8 INTEGRATED: conteúdo igual à main, #245 |
| W02 | W `farm-context-01-integration/GestaoAgro` | `e8651814` / `fix/insumos-farm-context-isolation` | 0/0 | Head integrado #245; sem delta local |
| W03 | W `operational-contract-04/GestaoAgro` | `4b43fc10` / detached | 3/2 | 2 INTEGRATED; 1 STALE_VERSION; 1 EVIDENCE_ONLY; 1 UNVERIFIED |
| W04 | W `operational-integration-05/GestaoAgro` | `08ed2af1` / `codex/operational-summary-modularization` | 0/0 | Head integrado #240; sem delta local |
| W05 | W `sanitario-f9-closure-docs/GestaoAgro` | `7e3bbf95` / `codex/sanitario-f9-doc-closeout` | 0/0 | Head integrado #246; sem delta local |
| W06 | W `sanitario-f9-public-integration/GestaoAgro` | `00f42b68` / `codex/sanitario-f9-public-integration` | 0/0 | Head integrado #244; sem delta local |
| W07 | W `sanitario-vf5-integration/GestaoAgro` | `be0f1e09` / `codex/sanitario-vf5-integration` | 0/0 | Head integrado #242; sem delta local |
| W08 | W `sanitario-vf5-types-baseline/GestaoAgro` | `31815a26` / detached | 0/0 | Baseline histórico integrado; sem delta local |
| W09 | W `superpowers-pilot/GestaoAgro` | `3492b6d8` / detached | 5/20 | 8 INTEGRATED; 10 STALE_VERSION; 3 LOCAL_DELTA; 4 EVIDENCE_ONLY |
| W10 | W `ui-struct-01a/GestaoAgro` | `4b43fc10` / detached | 2/5 | 3 INTEGRATED; 4 STALE_VERSION, #241 + evolução posterior |
| W11 | W `ui-struct-01a-integration/GestaoAgro` | `cc7c7d90` / `refactor/insumos-inventory-projection` | 0/0 | Head integrado #241; sem delta local |
| W12 | W `ui-struct-01b/GestaoAgro` | `01f0cb6a` / detached | 1/5 | 5 INTEGRATED; Insumos.tsx STALE_VERSION do #243, antes do #245 |
| W13 | W `ui-struct-01b-integration/GestaoAgro` | `4f139b50` / `codex/insumos-inventory-snapshot` | 0/0 | Head integrado #243; sem delta local |
| W14 | K `mighty-cormorant` | `31815a26` / detached | 0/0 | Baseline histórico integrado; sem delta local |

## Matriz de deltas, versões e conflitos

| Conjunto | Classe e evidência | Tratamento proposto / IDs |
| --- | --- | --- |
| Governança em W00/W09 | LOCAL_DELTA nos três arquivos AGENTS.md, CONTEXT_LOADING.md, no-broad-context.md. Main não mudou esses caminhos desde os HEADs; diferenças não integradas. São 6 ocorrências, não 6 iniciativas. | A06: comparar os dois candidatos e selecionar um patch após revisão. Não assumir identidade pelo nome. Nenhuma edição nesses arquivos nesta tarefa. |
| Reprodução W00 | LOCAL_DELTA em ReproductionForm, calfJourney/register/remoteSync e três testes. Diferenças: espécie/raça de cria, replay de parto e comparação factual de JSON/instantes. | B02/D02/A03: extrair por contrato, revalidar em baseline atual; não tratar relato de execução histórica como certificação do patch integrado. |
| Retry em `src/lib/offline/ops.ts` W00 | CONFLICT de reconciliação, **sem conflito Git não resolvido**: local acrescenta `persistExpectedAnimalRevision(op, existing)` no retry, mas não contém `validateContext` e verificações de inventário/fazenda integradas no #245. | D02/D03/A03: portar somente o hunk autorizado após caracterização; substituir o arquivo perderia guards. Não se demonstrou incompatibilidade inevitável entre os dois comportamentos. |
| Fazenda Modelo W00 | LOCAL_DELTA: sete arquivos `src/lib/testFarm/**` ausentes na main e import DEV em `src/main.tsx`. | B01/F07: integração seletiva futura; verificar proteção DEV, writers, ownership, replay e dependências reprodutivas. |
| UI-STRUCT-00 W00 | LOCAL_DELTA documental: plano e métricas locais. Insumos e relatório sugeridos no plano já evoluíram por #240/#241/#243/#245. | A07/E03: rebaseline apenas hotspots residuais; proposta de refactor não prova funcionalidade ausente. |
| Auth/publicador W00 | STALE_VERSION: useAuth igual à versão `4446725812…`; publicador e publisher.test iguais a `f650e6a94f…`, anteriores às correções atuais. | A03/C01/C05: reutilizar main. Não reaplicar. |
| E2E/fixture VF4 W00 | STALE_VERSION por inspeção: main extrai helpers no teste e usa `createConfirmedTestSession`/`restrictContextToLoopback` no harness. Não foi identificado incremento local ausente. | Preservar como histórico; não reabrir #242. Certificação composta C05 continua tarefa distinta. |
| F6–F9 W00 | 21 caminhos locais idênticos à main no total W00 incluem artefatos VF, catálogo, recibo público, preparador. Relatórios/matrizes/recibo remoto adicionais são EVIDENCE_ONLY. Sumário público local carece do complemento posterior, portanto STALE_VERSION. | A01/C01 integrados; C02/C03 permanecem curadoria, não nova importação. Artefatos brutos não devem ser publicados sem revisão de dados/segredos. |
| Relatórios W09 | 8 arquivos idênticos; 10 versões anteriores. Vários blobs iguais ao commit histórico `658296d10c…`; main acrescenta Pastagem, corrige proveniência e extrai helpers. | A03/E03: não copiar módulos antigos; #240 já incorporou o trabalho com correções. Quatro planos locais são EVIDENCE_ONLY. |
| Relatórios W03 | testes presentation/source idênticos; operationalSummary.test anterior ao caso de cobertura factual da main. `operationalSummary.ts` monolítico = UNVERIFIED quanto a eventual delta semântico residual. | Comparar regras específicas com módulos extraídos #240 antes de encerrar a dúvida. Nenhuma integração autorizada; `OPERATIONAL_CONTRACT_04.md` preservado como evidência histórica. |
| Insumos W01/W10/W12 | W01 inteiro idêntico; W10 anterior a refinamentos #241; W12 tela igual ao head #243, superada por #245. Fixture W10 difere apenas por linha em branco. | B06/E03/D03: trabalho integrado, não pendência de extração. |
| `.tmp/**`, cache CLI | EVIDENCE_ONLY, existência e hash registrados; conteúdo bruto não auditado integralmente. | Preservar; sem execução, limpeza, cópia integral ou incorporação automática. |

Totais das ocorrências: **47 INTEGRATED, 23 LOCAL_DELTA, 22 STALE_VERSION, 136 EVIDENCE_ONLY, 1 CONFLICT, 1 UNVERIFIED**. Classes são por conteúdo local, não por branch inteira. CSV registra motivo individual e match histórico quando observado. LOCAL_DELTA não significa patch apto para integração.

## Limites históricos e preservação

Os relatórios locais `.tmp/test-farm-01g/RELATORIO.md` e `.tmp/test-farm-01h/RELATORIO.md` foram lidos para delimitar o que alegam. G registra carga local, 120 animais/474 eventos/252 agendas, replay e ressalvas TypeScript; H registra impedimento por catálogo técnico local ausente, zero eventos/agendas propostos. São evidências históricas em backend loopback; não houve repetição dos cenários nem confirmação do estado atual de Dexie/PostgreSQL local. Não copiar dados pessoais dos relatórios para o backlog.

O diagnóstico arquitetural específico de 24/10/2026 descrito na solicitação não foi localizado como documento autônomo acessível nas buscas dirigidas. Seus tópicos foram revalidados em código/migrations e banco, conforme [Frente I](./MASTER_BACKLOG_ARCHITECTURE.md); não se inventou uma origem documental.

Nenhum reset, clean, stash, rebase, merge, cherry-pick, exclusão ou cópia integral de worktree foi executado. Nenhum commit/push/deploy/migration ou alteração de runtime integra esta entrega. Preservação dos bytes preexistentes e limites dos checks estão no [registro de validação](./MASTER_BACKLOG_VALIDATION.md).

## Consolidação final — pacote único e passivo residual

Main reconfirmada em `2f4e218c…`; HEADs e staged dos quinze worktrees preservados. O pacote acumulado tem **onze caminhos únicos**: dez da entrega 01 + cinco tocados na 02 − quatro repetidos. Inclui README, cinco documentos e cinco evidências MASTER_BACKLOG; nenhum arquivo funcional ou relatório local bruto entra nele. As colunas originais dos CSVs permanecem históricas; as novas colunas registram a avaliação atual, sem substituir hashes por versões antigas.

| Classe no CSV (`integration_class`) | Ocorrências | Decisão |
| --- | --- | --- |
| Pronto para integração (`READY_DOCUMENTATION`) | 11 | Somente allowlist documental; integração depende de autorização, não de nova fase |
| Já integrado (`ALREADY_INTEGRATED`) | 69 | 47 blobs equivalentes e 22 versões superadas de trabalho integrado; não reaplicar arquivos antigos |
| Evidência local a preservar (`PRESERVE_LOCAL_EVIDENCE`) | 144 | Artefatos históricos, governança, plano UI e um relatório com equivalência semântica não provada; preservação não significa aprovação nem ausência de delta |
| Delta funcional / PR separado (`SEPARATE_FUNCTIONAL_PR`) | 16 | Reprodução/retry: oito caminhos; Fazenda Modelo: oito caminhos. Dois candidatos brutos contra HEAD de origem; não prontos para main |
| Candidato a descarte, exige aprovação (`DISCARD_REQUIRES_APPROVAL`) | 1 | Apenas cache `supabase/.temp/cli-latest`; não descartado |

São **241 ocorrências caminho/worktree**, correspondentes a **232 caminhos distintos**. Repetição de nove caminhos modificados entre worktrees não gera nove novas tarefas. Governança repetida em W00/W09 permanece fora do pacote e pode receber revisão própria; não é contada como runtime. O monólito W03 continua UNVERIFIED e não é contabilizado como delta funcional confirmado.

| Worktrees | Situação / possibilidade de encerramento após decisão |
| --- | --- |
| W02/W04/W05/W06/W07/W08/W11/W13/W14 | Nove limpos, HEADs já integrados. Candidatos a encerramento após autorização e conferência de ownership/arquivos ignorados; não precisam esperar outra implementação |
| W01/W10/W12 | Três com conteúdo já integrado/superado; candidatos após snapshot recuperável, conferência de ignorados e autorização. Arquivo diferente da main não deve ser descartado automaticamente |
| W03 | Preservar relatório monolítico não verificado e evidência local; não encerrar antes de resolver/preservar essa incerteza |
| W09 | Preservar delta exclusivo de governança e planos históricos; não incorporar à documentação do backlog por conveniência |
| W00 | Preservar checkout principal, dois candidatos funcionais e evidências; o pacote documental é uma seleção de caminhos, não autorização para transportar a árvore inteira |

| Métrica | Antes | Após preparação | Após integração proposta |
| --- | --- | --- | --- |
| Worktrees existentes | 15 | 15 | 15; sem remoção autorizada |
| Worktrees com alterações pendentes | 6 | 6 | 6; merge remoto não altera os checkouts |
| Arquivos modificados | 28 | 28 | 28; sem reconciliação local automática |
| Arquivos não rastreados | 204 | 204 | 204; sem atualização/descarte local automático |
| Deltas funcionais não integrados | 2 grupos / 16 caminhos | 2 / 16 | 2 / 16; pacote exclusivamente documental |
| Documentos do pacote aguardando integração | 11 | 11 em um pacote | **0, projeção** condicionada ao merge integral dos onze caminhos |

M/U da tabela contam caminhos únicos entre os quinze worktrees, sem somar duplicatas; não são arquivos únicos por conteúdo. No checkout principal continuam **23 M / 167 U**; a soma por checkout é 37 M / 204 U, incluindo nove repetições de M. A integração proposta significa merge remoto do pacote, sem presumir atualização do HEAD local ou arquivo antes untracked tornar-se rastreado. Não se declara redução física de passivo: onze documentos ficam reunidos em um candidato, doze worktrees têm possibilidade de encerramento condicionada, nenhum foi removido.
