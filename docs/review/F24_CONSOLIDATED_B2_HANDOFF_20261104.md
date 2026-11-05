# RebanhoSync — F24 / candidato consolidado A + A05 para B2

Atualizado em: 2026-11-04
Baseline: `4389f2e709643e521bfea0373876cef1ff69da2b`
Branch: `codex/f24-a-a05-consolidated`
Worktree: `C:/Users/mares/.codex/worktrees/f24-a-a05-consolidated/GestaoAgro`
Decisão: **READY_FOR_B2_REHEARSAL**, exclusivamente como entrada congelada para ensaio local autorizado. Não é aprovação de FULL, implantação, F24.7, F24.8 ou operação.

## Identidade e proveniência

Identidade do núcleo: `sha256:1ae3cd0815b94f4e6c5ad76abb004b9dba782f091fb1f1f1581bb386d92db318`.

O núcleo é o inventário ordenado de caminhos e hashes SHA-256 de todos os arquivos versionados mais os untracked transportados. Exclui somente este handoff e o manifest derivado de migrations para evitar autorreferência. O ZIP possui hash próprio em `SHA256SUMS.json`, e `candidate-files.json` / `B2_SNAPSHOT_FILES.json` inventariam também esses dois documentos.

Pacote externo: `C:/Users/mares/.codex/artifacts/f24-a-a05-20261104-1ae3cd0815b9/`. Usar `candidate.zip`, nunca montar uma worktree de origem mutável no rehearsal. O pacote contém fontes completas sem `.git`/`node_modules`, dependências fixadas pelo lockfile, deltas A/A05, diff integrado, manifest das 74 migrations, hashes e evidências de checks.

Entradas congeladas antes da integração:

| Origem | HEAD | Deltas observados | SHA-256 do patch tracked |
| --- | --- | --- | --- |
| A | `4389f2e709643e521bfea0373876cef1ff69da2b` | 6 testes + relatório untracked; staged vazio | `98b89f3d122271fee5895805b015825caee795ef248f7ca39d7097211124db21` |
| A05 | `910af3ee16439444106ec3c728f4fd914f7f3318` | 18 modificados + 8 untracked; staged vazio | `9d185bebe2dfc62c88b3b71d060176684fd50bbe3f933d3cc77e9c81413c3ba9` |
| B2, somente leitura | `4389f2e709643e521bfea0373876cef1ff69da2b` | 3 documentos untracked; staged/tracked vazios | patch vazio |

`source-worktrees.json` no pacote registra caminhos e hashes individuais. Nenhuma origem foi modificada pela integração. O snapshot A é o estado efetivamente encontrado (6 testes e relatório); a contagem de 104 testes em 12 arquivos mencionada na solicitação não foi usada como prova de conteúdo adicional.

## Transporte e resolução

Os deltas tracked congelados foram examinados e aplicados com `git apply --check` / `git apply`, sem checkout, commit ou merge das origens. Os arquivos novos foram copiados das entradas congeladas. As diferenças commitadas entre HEAD A05 e a main atual, em MASTER_BACKLOG e quatro testes, não foram revertidas: a baseline atual foi preservada.

`sanitaryProgressiveV3.test.ts` compõe os stubs HTTP loopback, restauração em finally e dois controles negativos A com imports/mock e dois cenários de óbito A05. Não houve rejeição textual; os dez testes combinados passaram. O cenário neonatal mantém a restrição vigente e não recebeu animalIds para contorná-la.

Correção adicional demonstrada na consolidação: inclusão de `death_participant` na união `SanitarioV2QueuedOperation` em `sanitarioV2Cutover.ts`. A05 já ampliava a união da Edge, gerando três erros TS2322 novos na atribuição de envelopes ao contrato local. Uma linha de tipagem eliminou esses diagnósticos; payload, autorização e comportamento não foram alterados. Nenhuma migration transportada foi editada.

## Validação observada

- Vitest focado: **431/431 testes em 22 arquivos**, 151,065 s, sem falhas/skips; JSON contém nomes, asserções e resultado por arquivo. Contagem de suites aninhadas do reporter não é contagem de arquivos.
- Após a correção de tipagem: **13/13 adicionais em 2 arquivos** (cutover 8, colaboração 5), 6,96 s. Total de testes distintos observados: **444 em 24 arquivos**. A correção é somente de tipo; as demais superfícies não foram reexecutadas por rotina.
- Cobertura selecionada: todos os testes A; óbito local/rollback/farm-switch; gesto factual; proteção de pull antes do ACK; worker e receipts; Edge dos dois envelopes; concorrência, retry, auth/ownership, execução progressiva e restrição neonatal. `tests/codex/obito*.local.mjs` e o HTTP real não foram executados, pois usam/escrevem PostgreSQL e/ou aplicam migrations.
- ESLint dos 29 arquivos JS/TS transportados aprovado; lint adicional de `sanitarioV2Cutover.ts` aprovado. Sintaxe dos três harnesses SQL de óbito e do HTTP integrado aprovada por `node --check` sem execução.
- `tsc -p tsconfig.app.json --noEmit --incremental false --pretty false`: baseline 224 diagnósticos, candidato final 220; zero novos por multiset arquivo+código+mensagem, ignorando deslocamentos de linha. Quatro diagnósticos de AnimalDetalhe foram removidos. Typecheck global continua com exit 2; não é declarado limpo.
- Deno `check --cached-only --config supabase/functions/deno.json supabase/functions/sync-batch/index.ts`: três TS2339 em inventory-dependency.ts nas linhas 59–61, reproduzidos identicamente na baseline. Check não aprovado; nenhum erro novo observado. Aviso allowJs ignorado é preexistente. Não houve download necessário ou execução da Edge.
- Diff checks aprovados. Gates documentais são registrados após a execução no pacote de evidências; não substituem os checks acima.
- Sem FULL, build, SQL, migration, deploy ou acesso a banco nesta execução. As provas HTTP 11/11 e SQL/concurrency relatadas por A05 são históricas e não foram convertidas em certificação deste candidato.

## Contratos A05 e provas exigidas em B2

O fato de óbito permanece Evento; cancelamento da intenção comum é operação condicional com recibo, não exclusão do histórico. O comando sanitário `death_participant` dispensa somente o animal ainda pendente da fazenda/Agenda, preserva atendimentos anteriores e os demais participantes. A execução posterior consulta a dispensa dentro da transação local.

O pull integrado protege a chave composta Agenda/animal enquanto o comando está pendente e permite instalar o estado remoto após ACK/rejeição. Worker retém estados por operação, obrigações duráveis e reconciliação de fato/estado/cancelamento em sucesso parcial; replay conserva identidade e recibos. A UI revalida fazenda durante o gesto.

No SQL, a migration 73 serializa pela linha da Agenda e pelo lock obrigação/animal; o core factual verifica dispensa e recibos de óbito. A migration 74 usa lock por operação, UPDATE condicional da intenção comum e recibo imutável, além de trigger contra reabertura por escrita genérica. B2 deverá provar execução→óbito e óbito→execução, novas sessões/lost ACK/replay, outsider e cross-tenant; inspeção estática e mocks não provam bloqueios reais.

## Bloqueador pré-migration e ordem de implantação

Condição: cliente integrado, ownership/fazenda válidos, obrigação `agenda-v2` a drenar (ou outro caller de pull sanitário), backend sem uma das quatro tabelas V3. `pullSanitarioAgendaV2` consulta sete tabelas, inclusive com push OFF; PGRST205 é propagado antes da transação local. O drain conserva a obrigação e registra falha. Não foi implementado fallback vazio nem conclusão artificial.

Os controles negativos A continuam aprovados sobre o pull A05. Filas, caches e obrigações são preservados, mas o snapshot sanitário pode ficar desatualizado. O pacote **não é compatível para rollout frontend sobre o backend de 65 migrations**. Compatibilidade de reabertura Dexie por cliente antigo não certifica o transporte de envelopes antigos no novo servidor.

Decisão de integração: preservar esse bloqueador como impedimento de rollout. Não há correção mínima independente de uma política de convivência: separar snapshots V2/V3 ou descobrir capacidades remotamente mudaria o contrato de entrega/reconciliação. O menor caminho proposto é backend compatível primeiro, Edge correspondente depois, frontend por último, com ativação autorizada separada. Gates OFF são condição de implantação, não prova de compatibilidade do pull.

Clientes antigos, envelopes pré-existentes e fila offline devem ser exercitados em B2 antes de transição/retirada. Se convivência com backend pré-V3 for requisito, abrir correção específica sobre este snapshot; não lançar o frontend até existir prova desse contrato.

## Manifest e três rotas B2

[Manifest completo das 74 migrations](./evidence/F24_CONSOLIDATED_MIGRATIONS_20261104.json): versões ordenadas, SHA-256 dos bytes transportados, blobs Git das 72 canônicas, ordem precedente, dependências diretas revisadas das duas novas e inventário estático de DDL/grants/RLS. Diferenças LF/CRLF são separadas de conteúdo canônico. Extração estática não substitui fingerprints de funções, policies e privilégios no banco.

| Rota | Conteúdo e ponto de partida |
| --- | --- |
| 0→74 | Instalação limpa de todas as versões, ordem canônica |
| 65→74 | Partir de `20261022230000_sanitario_manual_catalog_review_v2.sql`, com fixtures V2 e envelopes pendentes preservados; aplicar 9 versões |
| 72→74 | Partir de `20261102130006_sanitario_v3_collaboration_closure.sql`; aplicar apenas as 2 A05 |

As duas novas são `20261103180000_obito_sanitario_participant.sql` e `20261103181000_obito_agenda_cancel.sql`. A primeira depende dos contratos V3/progressivo/collaboration já instalados; a segunda acrescenta recibo privado com RLS, RPC service-only e trigger em Agenda comum. Não amplia escrita autenticada/anon. O manifest distingue dependência semântica da ordem sequencial obrigatória; não inventa um grafo completo das 72 versões históricas.

## Consumo seguro do snapshot

1. Autorizar especificamente provisionamento/escrita local descartável. Esta entrega não inicia nem autoriza o rehearsal por si.
2. Conferir SHA-256 de candidate.zip com SHA256SUMS.json, extrair em diretório novo e conferir cada arquivo de B2_SNAPSHOT_FILES.json. Conferir as 74 versões/hashes antes de qualquer SQL. Não montar worktrees A/A05/B2 mutáveis como fonte.
3. Usar somente recursos novos com identidade/labels/volumes/portas comprovados e ambiente sanitizado; não herdar credenciais do processo. Não adotar container existente por nome semelhante.
4. Os três scripts `obito-agenda.local.mjs`, `obito-sanitario-v3.local.mjs` e `obito-concurrency.local.mjs` transportados referenciam alvo A05 antigo (`a05b04-pg-test` / `v31_disposable_a05b04d`). **Não executá-los como estão contra esse alvo.** B2 deve parametrizar/revisar o runner para a sua stack nova autorizada, preservando as asserções, ou reutilizar essas asserções no seu executor. Nenhum desses recursos foi inspecionado ou modificado aqui.
5. Executar clean, upgrade e complemento isoladamente; provar history/DDL/RLS/grants/RPCs, idempotência, sucesso parcial, lock concorrente e proteção de dados legados. Gates permanecem OFF salvo fixture explicitamente autorizada.
6. Registrar resultados e recuperação sobre o mesmo snapshot. Reservar FULL para o candidato consolidado após B2, conforme autorização e gates aplicáveis. Timeouts históricos de FarmProtocolManager e P38 permanecem inconclusivos; não foram repetidos nesta integração nem tiveram timeout aumentado.

Reprodução do inventário local: `git status --short --untracked-files=all`, `git diff --name-status`, `git diff --numstat`, `git diff --cached --name-status`, `git ls-files --others --exclude-standard`, `git diff --check`. O ZIP inclui tracked e untracked; integrated.patch sozinho não inclui arquivos novos.
