# R04B.2 — certificação e preparação da publicação por classe

Data: 21/10/2026. **READY_FOR_REMOTE_AUTHORIZATION**, exclusivamente para solicitar a autorização de preflight, migration e publicação incremental descrita abaixo. Cinco candidatas, zero aprovações reais, zero operações remotas nesta execução. Verification gate: **READY WITH CAVEAT**, pelas limitações explícitas de homologação e ambiente; isso não certifica rollout nem aprovação curatorial.

## Baseline e escopo real

- Branch `codex/sanitario-v2-convergencia`, HEAD `b5b6ffc9f515874577003efd2cce3ef4492bdb74`, sem commit, staging, push ou merge.
- Worktree de execução: `C:/Users/mares/.codex/worktrees/r04b2-certificacao/GestaoAgro`.
- O worktree anterior foi removido por limpeza concorrente do aplicativo durante o bootstrap, antes de qualquer escrita nossa. Recuperação pelo snapshot automático `cfb421179201cebb3729da2d2147e715ea21b998`, cujo pai é o HEAD acima. Os 25 arquivos R04B.1 foram restaurados como alterações locais; os 24 hashes do manifesto de verificação anterior coincidiram antes dos novos ajustes. Nenhuma mudança concorrente do checkout principal foi sobrescrita.
- Evidência remota reutilizada: snapshot R04B de 21/10/2026 03:00:35 UTC. Não é uma reconfirmação remota R04B.2. O plano exige nova comparação antes de qualquer escrita.
- Escopo novo: importador canônico existente, preparadores derivados, harness PostgreSQL, seis testes de CLI e documentação diretamente afetada. Uma correção na migration local ainda não publicada. Nenhum arquivo TypeScript de runtime, schema de tabela, Edge, sync ou UX foi modificado pela R04B.2.

## Revisão técnica e correção

| Contrato | Fato confirmado / decisão |
|---|---|
| Opt-in e legado | `class_scheme` depende de marcador explícito no snapshot. Itens e snapshots antigos continuam no caminho anterior; não há backfill. Hashes dos arquivos TypeScript da R04B.1 permanecem iguais. |
| Fila offline | Não há alteração de envelope, writer, retry ou sync. Versões físicas anteriores e seus snapshots permanecem; supersessão aposenta apenas os cinco predecessores draft. Não se certifica o conteúdo inacessível de filas reais. |
| Dose anterior | Dose 2 exige execução factual compatível, não Agenda ou plano. CLO anual ancora série inicial concluída (dose 2) ou reforço próprio; LEP anual ancora inicial única ou reforço próprio. Sem tolerância adicional inferida. |
| Produto/variante | Pertencer à classe não comprova compatibilidade. Fonte de janela vinculada ao produto e cobertura da variante são verificadas na execução e relidas na transação local. Fato explícito incompatível permanece registrável com alerta, sem certificar o esquema. |
| SQL e curadoria | As quatro evidências específicas de planejamento continuam exigidas; classe revisada integra o digest/locks. Auth, papel autorizado, CAS, auditoria, rollback e request-id permanecem. |
| Flags transitórias | Defeito reproduzido: aprovação deixava `proposal_only=true`, contradizendo a liberação. Ajuste mínimo: a decisão existente passa a gravar `proposal_only=false` junto a `agenda_allowed`, `approved_for_catalog`, `curationStatus`, `automationStatus` e `allows_agenda_auto`. Assertion PostgreSQL falhou antes e passou depois. |
| Isolamento | RLS e grants não mudam. Conta sem papel, anon e escrita global direta continuam recusados. Pré-condições de tenant e sete Agendas protegidas não são substituídas por validação de UI. |

## Cinco candidatas

Todas permanecem `draft`, `allows_agenda_auto=false`, `proposal_only=true` no pacote de publicação. Estão prontas para publicação como candidatas e posterior preview autenticado; não estão aprovadas.

| Chave lógica | ID candidato / versão | Predecessor | Variante proposta |
|---|---|---|---|
| `clostridial_primovac_dose1` | `0625eedf-f069-5ee4-ae50-decd329176e6` v3 | v2 | Inicial bovina, classe clostridial, referência Fortress 7 |
| `clostridial_primovac_dose2` | `cb8fad2f-5836-5939-a64f-ce6a323acd1c` v4 | v3 | 28–42 dias após dose 1 compatível |
| `clostridial_reforco_anual` | `d4a9602e-b011-5b33-a1c9-890b36da1b46` v3 | v2 | Anual após série inicial/último reforço compatível |
| `lepto_primovac_dose1` | `d69c754c-1d61-5680-abfe-92fc1d43209b` v3 | v2 | Inicial única bovina, referência Leptoferm 5/2 mL |
| `lepto_reforco_anual_semestral` | `f3122e73-549d-594a-aed6-5dd4ab93c0d9` v3 | v2 | Somente anual; a chave histórica não autoriza periodicidade semestral |

Fontes, IDs, versões e justificativas por campo: [previews R04B.1 preservados](evidence/SANITARIO_V2_R04B_CLASS_PREVIEWS_20261021.json). Evidência de uma marca não autoriza a classe inteira; bovinos apenas, sem exigência bubalina. Produto, dose, via e carência permanecem ausentes do planejamento. Os produtos de referência ainda têm curadoria pendente e vigência de registro desconhecida nos registros canônicos; o delta não altera esses produtos. É necessário curá-los ou outro produto comprovadamente compatível antes de aplicação prospectiva.

## Delta, CAS e idempotência

[Pacote derivado](evidence/SANITARIO_V2_R04B2_CANONICAL_DELTA_20261021.json), [plano estruturado](evidence/SANITARIO_V2_R04B2_PUBLICATION_PLAN_20261021.json).

Digest do conteúdo publicável: `55a71d9f4adb6b4fcbbfe9cd5d26ee8c15fd4fc99f1106b50d02dc830ca877e4`.

- Cinco versões, oito coberturas, duas revisões de classe e dois vínculos produto/fonte: 15 criações e sete atualizações, incluindo cinco supersessões. Duas fontes, dois produtos e dois protocolos são referências de pais existentes, sem reimportação/escrita desses pais.
- Classes continuam `automation_status=manual_only` e `can_validate_execution=false`; somente sua revisão taxonômica é proposta. Não se habilitam produtos nem se generalizam bulas.
- O preparador não conecta ao banco. O mesmo CLI público e o mesmo `applyTransaction`/writer canônico recebem `--incremental`; não há writer alternativo exportado. O pacote deriva dos previews, fontes e baseline existentes, sem nova fonte de verdade.
- SHA256 dos oito inputs, digest do conteúdo e regeneração independente do pacote detectam alterações. Mudar corpo e recalcular apenas seu digest não basta. Mudanças de evidência exigem regeneração, revisão e autorização de novo conteúdo.
- Aplicação exige autorização explícita no artefato, confirmação do digest, gates de importação existentes e projeto correto. `import_real_authorized=false` no arquivo preparado. As variáveis de confirmação do CLI não são os gates de automação do produto.
- Advisory lock, locks de protocolos/itens antes das referências, CAS dos pais e predecessores, recusa de versão concorrente mais nova e transação única. Falha intermediária não deixa publicação parcial. Retry exato não cria duplicatas nem rebaixa versão já aprovada; esse replay exige recibo/auditoria canônicos coerentes.
- Nenhum overwrite de snapshot anterior. Sete aprovados, sete Agendas e gates são comparados integralmente antes/depois da importação local.

## Validação observada

[Evidência PostgreSQL](evidence/SANITARIO_V2_R04B2_POSTGRES_20261021.json) e [manifesto de verificação/diff](evidence/SANITARIO_V2_R04B2_VERIFICATION_20261021.json). PostgreSQL novo, descartável, somente loopback, removido ao final. Nenhuma consulta ou mutação remota executada.

| Comando / evidência | Resultado observado |
|---|---|
| `node tests/codex/sanitario-v2-review.postgres.mjs` | 17 cenários PASS; schema real, RLS, roles, locks, CAS, rollback, concorrência, retry e auditoria |
| Lote exato da migration | Dry-run mantém 63; apply chega a 64; retry não reaplica; baseline/histórico divergentes recusados; dados iguais antes/depois |
| Publicador público incremental | Dry-run sem writes; aplicação concorrente converge; retry após ACK perdido sem criações/atualizações; fonte alterada, predecessor ativo e versão mais nova recusados |
| Falha de storage | Rollback de candidatos, classes, coberturas e vínculos |
| Curadoria de teste | Cinco previews individuais sem bloqueios, dois previews/decisões agrupados, replay exato, flags coerentes e uma única versão ativa por chave |
| `node node_modules/vitest/vitest.mjs run tests/codex/sanitario-v2-incremental.test.mjs` | 6 testes PASS; alvo remoto incorreto e opções que sobrescrevem host também recusados antes da conexão |
| Teste `R04B bloqueia aplicação incompatível` de `sanitaryAgendaExecutionV2.test.ts` | 1 PASS, 53 não executados pelo filtro; preserva registro factual com alerta |
| Suíte legada do publicador | Primeira execução: 152 PASS e uma falha por export público adicionado; export removido e teste específico reexecutado: 1 PASS. Não se declara nova execução completa de 153 após o ajuste. |
| ESLint nos cinco `.mjs` afetados | Exit 0 |
| `git diff --check`, sintaxe Node e inspeção do diff | Conforme evidência final de verificação |
| Revisão independente | Sem bloqueador concreto; incluiu publicador e lote de migration, sem novas execuções/remoto |

As 193 verificações de domínio e build da R04B.1 são evidência histórica preservada, não reexecução R04B.2. Sem delta TypeScript, não se repetiu a bateria. Typecheck global e build de produção com ambiente real continuam não certificados. A baseline funcional geral não foi apontada para banco persistente nem teve seu guard de ambiente contornado.

**Limite da preservação R05:** cópia dos sete IDs/snapshots para fixtures `contract_version=null`, pelo caminho legado existente; o guard recusou inserção direta contract v2. Não houve bypass de trigger nem gate ON. Igualdade de snapshots/IDs, sete aprovações originais, Eventos e gates foi testada, mas isso não é homologação do transporte real Auth/Edge/sync contract v2 e não reabre R05.

## Plano remoto executável — preparado, não autorizado

Executar somente depois da autorização correspondente. Conexão por cliente `psql`/driver já configurado com segredo privado no ambiente executor; nunca imprimir credenciais, colocar senha em argumento, salvar tokens no repositório ou usar papel de banco como identidade curatorial.

1. **Preflight read-only.** Confirmar branch, HEAD, hashes e projeto `zqloazqzhwauamcejmuz`. Executar [SQL preparado](evidence/SANITARIO_V2_R04B2_PREFLIGHT_20261021.sql) e comparar linhas completas com o baseline/pacote: sete aprovados, sete Agendas R05, zero Eventos R05, cinco decisões anteriores, gates OFF, pais e cinco predecessores esperados. Comparar também definições/ACLs das quatro rotinas com o baseline anterior à migration, obtido das migrations canônicas. Histórico deve ter as 63 versões/nomes esperados. Drift interrompe publicação e exige revisão do impacto; não atualizar CAS silenciosamente.

2. **Migration única.** Arquivo `20261020232807_sanitario_class_scheme_planning_v2.sql`, SHA256 `c490630d646a9d99a8fc424c07cc73f73485b6e6bd5ae2d5b6a5582f06e29e59`. Usar lote com versão/nome/bytes explícitos e guard do histórico, não `db push` de migrations pendentes. Gerador `scripts/codex/prepare-sanitario-class-migration-v2.mjs` produz somente arquivo, não executa SQL. Os lotes preparados e testados são:

   - [Dry-run com rollback](evidence/SANITARIO_V2_R04B2_MIGRATION_DRY_RUN_20261021.sql).
   - [Aplicação transacional](evidence/SANITARIO_V2_R04B2_MIGRATION_APPLY_20261021.sql).

   Exemplo no ambiente executor com cliente `psql` disponível, autenticação privada configurada e autorização já registrada:

   ```powershell
   psql -X -h db.zqloazqzhwauamcejmuz.supabase.co -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f docs/review/evidence/SANITARIO_V2_R04B2_PREFLIGHT_20261021.sql
   psql -X -h db.zqloazqzhwauamcejmuz.supabase.co -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f docs/review/evidence/SANITARIO_V2_R04B2_MIGRATION_DRY_RUN_20261021.sql
   # Conferir o rollback e a autorização antes da linha seguinte.
   psql -X -h db.zqloazqzhwauamcejmuz.supabase.co -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f docs/review/evidence/SANITARIO_V2_R04B2_MIGRATION_APPLY_20261021.sql
   ```

   Parar a sequência se qualquer comando retornar exit code diferente de zero. A conexão deve exigir TLS conforme configuração privada do cliente. O lote registra exatamente a versão `20261020232807`; não depender de ferramenta que gere outra versão de histórico. Repetir com mesmo histórico é no-op; histórico diferente falha.

3. **Delta canônico.** Após autorização de publicação, criar uma cópia privada do pacote com `import_gate.import_real_authorized=true` e `authorization_reference` vinculada ao ato do proprietário. Manter os demais campos e digest exatos; o original preparado continua false. `DB_URL` deve existir apenas no ambiente protegido, apontando ao projeto correto (direto ou pooler com usuário `postgres.zqloazqzhwauamcejmuz`), sem opções de query que possam trocar o alvo. Não inserir a URL no comando/log.

   ```powershell
   # Somente após autorização registrada; $authorizedDelta é o caminho da cópia autorizada.
   $env:ALLOW_SANITARIO_IMPORT='1'
   $env:SANITARIO_IMPORT_CONFIRM='13.0.0-canonical-contract'
   $env:ALLOW_SANITARIO_REMOTE_IMPORT='1'
   $env:SANITARIO_DELTA_CONFIRM='55a71d9f4adb6b4fcbbfe9cd5d26ee8c15fd4fc99f1106b50d02dc830ca877e4'
   node scripts/codex/import-sanitario-protocols-v2.mjs --validate --incremental $authorizedDelta
   node scripts/codex/import-sanitario-protocols-v2.mjs --dry-run --incremental $authorizedDelta
   # Exigir exit 0, exatamente 15 criações/7 atualizações e pais somente referência.
   node scripts/codex/import-sanitario-protocols-v2.mjs --apply --incremental $authorizedDelta
   # Ao terminar, remover do processo as confirmações temporárias acima.
   ```

   Capturar resumo/recibo, hashes e snapshots antes/depois sem segredos. Retry usa mesmo pacote autorizado; espera zero criações/atualizações. Não reimportar o seed original. Qualquer conflito suspende execução.

4. **Previews autenticados.** Usar `sanitario_catalog_review_preview_v2` por sessão Auth real do principal já autorizado, sem spoof de claims via Management SQL. O [plano JSON](evidence/SANITARIO_V2_R04B2_PUBLICATION_PLAN_20261021.json) contém os cinco conjuntos individuais e dois grupos com args exatos `_protocol_id`, `_expected_version`, `_item_ids`. Exigir cinco versões esperadas, `blockers=[]` e conservar conteúdo completo e `reviewed_content_digest`.

5. **Autorização específica das decisões.** Apresentar ao proprietário os cinco previews, as justificativas e **dois digests agrupados**: CLO (três itens), LEP (dois). Os grupos usam os mesmos protocolos e evitam stale digest: aprovar um item altera os metadados do pai e invalida os demais previews individuais anteriores. Para decisão individual seria necessário novo preview e nova autorização a cada mudança. Os dois digests remotos, actor e request IDs não foram fabricados.

6. **Somente após essa autorização**, chamar `sanitario_catalog_decide_v2` duas vezes, uma por grupo, passando os args do grupo e `_reviewed_content_digest` efetivamente autorizado, `_result='approved'`, `_justification` específica e `_request_id` UUID estável. Guardar recibos. ACK perdido exige replay do mesmo request/digest, não novo UUID. Mudança de conteúdo exige novo preview e autorização; nunca ajustar digest para forçar aprovação. Conferir flags e ausência de duplicidade ativa. Gates continuam OFF.

7. **Homologação incremental:** autorização própria, delimitando fazenda R05, novos cenários e eventual janela de gate. Não reexecutar R05 nem modificar suas sete Agendas existentes. Esta preparação não ativa gates nem autoriza essa etapa. Ao concluir ensaio autorizado, capturar comparação final e manter todos os gates OFF.

## Autorização solicitável e riscos residuais

Primeiro ato solicitável: preflight remoto read-only; aplicação da única migration pinada; publicação exclusiva do delta de digest acima; obtenção dos cinco previews e dois grupos autenticados; verificação read-only final. **Esse ato exclui decisões curatoriais, gates ON e homologação incremental.** Autorizações seguintes devem citar digests reais e, separadamente, o ensaio incremental.

1. Estado remoto atual ainda não reconfirmado; snapshot anterior não substitui preflight nem comparação de rotinas/ACLs.
2. Execução prospectiva depende da curadoria específica do produto/compatibilidade; publicação da variante não comprova validade comercial, dose, via ou carência de outras marcas.
3. Homologação remota incremental/Auth/Edge e R05 contract v2 não executadas; typecheck global e build de produção real permanecem fora da certificação local.

Reconciliação documental: atualizados apenas `normative` sanitário/RLS e `derived` relatório R04B.1 para apontar a preparação incremental; novos `snapshot/derived` de certificação/evidências. Manual, prompts, skills, roadmap e histórico de R01–R05 mantidos; nenhum arquivo arquivado/movido e nenhum ADR necessário.
