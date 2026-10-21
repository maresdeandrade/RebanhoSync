# Sanitário V2 — aprovação curatorial eletrônica

Atualizado em: 2026-10-17

## Resultado e baseline

Implementados o fluxo explícito no Backoffice e a publicação transacional por RPC. Nenhuma aprovação real foi concedida e nenhuma operação remota de escrita foi executada. O payload operacional 12F10 permanece byte a byte preservado. As aprovações dos testes pertencem exclusivamente a usuários e bancos locais descartáveis.

Classificação do patch: **READY para homologação local**. A publicação operacional permanece pendente de autorização e de decisão curatorial real.

Worktree: `C:\Users\mares\.codex\worktrees\sanitario-v2-plano-auto\GestaoAgro`. Branch desta entrega: `codex/sanitario-v2-aprovacao`, criada sem alterar a branch anterior `codex/sanitario-v2-ativacao`. Base remota confirmada por fetch: `1125fb6a21bbf95546ef38a2a51ec2c9aacd54c5`. Na conferência final, main avançou para `b748a5941d513ef3a293e5e8a98f31eb051dfeb6` (PR #213: somente dois arquivos financeiros). Os oito commits locais foram rebaseados nessa main sem conflitos. O payload de banco do candidato foi comparado antes/depois e permaneceu idêntico. Os sete commits sanitários anteriores foram reaplicados sem conflitos; `git range-diff bf43c63..2def7bc 1125fb6..22efd83` mostrou os sete patches equivalentes. Main e PRs #211 de sync, #212 e #213 de Financeiro estão preservados. O checkout original, com trabalho concorrente, não foi modificado.

## Oito conjuntos e decisão pendente

| Conjunto | Itens e versões propostas | Estado verificável | Aprovação ou evidência restante |
|---|---|---|---|
| B19 | `b19_femeas_3_8_meses` v3 | Pronto para submissão: 1 avaliação genérica | Revisor global aprova elegibilidade, janela e requisito de classe com fontes normativas registradas; UF conhecida, exclusão de SC e histórico preservados. Execução continua exigindo requisitos do PNCEBT/SVE e comprovação aplicável. |
| CLO | Primovacinação dose 1 v2; dose 2 v3; anual v2 | 3 dependentes de produto | Fortress 7/Zoetis: registro histórico 5.893/1997. Faltam vigência atual, critério etário/categoria e restrições de gestação/lactação comprovadas. Não há vínculo comercial aprovado. |
| LEP | Dose 1 v2; reforço anual/semestral v2 | 2 dependentes de produto | Leptoferm 5/2 mL/Zoetis: licença histórica 5.037/1995. Faltam vigência, critério etário/categoria e contexto reprodutivo. A bula registrada não sustenta generalizar dose 2 bovina ou reforço semestral. |
| IBR | Dose 1 v2; dose 2 v3 | 2 dependentes de evidência comercial | Poliguard/página MSD; lista histórica registra Vallée S/A, 9.299/2007. Faltam titular/vigência atuais, bula integral vigente e lactação. Não há equivalência presumida com outro produto. |
| PAR | `recria_maio`, `recria_julho`, `recria_setembro`, v2 | Prontas para submissão: 3 avaliações, UF DF | Decisão global sobre fonte e cobertura registradas de calendário 5/7/9. Plano exige adoção regional, sistema/manejo e animais elegíveis; não autoriza vermífugo. |
| DES | `pre_desmama_situacional` v2 | Pronta para submissão: 1 avaliação, UF DF | Decisão global com cobertura `pre_weaning_criteria`; plano exige contexto intensivo/leiteiro ou orientação referenciada. Não é rotina medicamentosa universal. |
| CONF | `pre_confinamento_dose_unica` v2 | Pronta para submissão: 1 avaliação, UF DF | Decisão global com cobertura `pre_confinement_criteria`; data, referência, alvos e manejo previstos continuam requisitos individuais. O nome lógico legado não autoriza dose. |
| PARTO | `matrizes_pre_parto_antiparasitario` v2 | Pronta para submissão: 1 avaliação, UF DF | Decisão global com cobertura `pre_partum_criteria`; fêmea, contexto pré-parto, data/referência e alvos reais exigidos na geração. Não comprova gestação/parto nem autoriza medicamento. |

**Contagem:** 7/14 candidatos prontos para aprovação, em cinco conjuntos; outros 7/14 dependem de evidência comercial, em três conjuntos. Permanecem seis restrições automáticas: três itens de raiva apenas sugestões com `no_agenda_auto`, dois de aftosa informativos/bloqueados e LEP2 canônica bloqueada. Todos os 20 itens estão contemplados no pacote. Os 14 demonstrados anteriormente com fontes sintéticas não equivalem a 14 itens prontos para publicação: nesta entrega, sete versões foram aprovadas pelo publicador real em fixtures isoladas.

A fonte regional Embrapa continua `guideline_apoio`, `strength=apoio`, `evidence_status=PRECISA_VALIDAR`; não foi promovida para norma/bula. As coberturas existentes `regional_applicability_5_7_9` e `pre_partum_criteria` permanecem parciais. A revisão individual auditada permite somente avaliação genérica, limitada ao DF. Ampliação para outra região requer outra versão com fonte aplicável. Não foi exigida fazenda hipotética nem produto comercial para avaliação.

## Artefatos e contrato de publicação

- [Pacote schema 4](SANITARIO_V2_FECHAMENTO_DECISOES_20261016.json): oito conjuntos candidatos, 14 novos IDs físicos de item, fontes por campo, restrições e decisões ainda não concedidas.
- [Formulário schema 3](SANITARIO_V2_APROVACAO_PENDENTE_20261017.json): versões exatas, hashes do candidato/pacote, responsabilidades A/B/C e envelope eletrônico ainda nulo. Identidade e horário serão preenchidos pelo servidor na ação real.
- [Evidência executada](SANITARIO_V2_APROVACAO_ELETRONICA_TESTES_20261017.json): casos PostgreSQL, HTTP/JWT, baseline funcional e hashes dos artefatos testados.
- [Dry-run atualizado](SANITARIO_V2_ATIVACAO_DRYRUN_20261017.json): CLI real, 144 criações planejadas, quatro rejeições esperadas, oito tabelas vazias após execução. Não é teste de autorização.

O candidato anterior tentava aumentar `protocol.version` mantendo o UUID, em conflito com a identidade natural imutável do importador existente. A proposta foi corrigida preservando UUID **e versão registrada do protocolo**. Somente os itens recebem novos IDs/versões físicas. O importador mantém versões anteriores no banco e retira somente rascunhos explicitamente substituídos; snapshots históricos não são reescritos. A importação continua bloqueada sem autorização própria e não concede aprovação técnica.

`sanitario_catalog_review_preview_v2` devolve o conteúdo exato e seu SHA-256, incluindo protocolo, itens, fontes, coberturas e produtos registrados. A UI exige justificativa e confirmação explícita. `sanitario_catalog_decide_v2` exige usuário autenticado de `app_superadmins`, confere versão/hash e bloqueia versões de item obsoletas e protocolos retirados, bloqueados ou experimentais. A permissão não é inferida da UI e não exige certificado digital ou CRMV do futuro executor.

O servidor usa `auth.uid()` e `transaction_timestamp()`. A referência é `sanitary-v2:<request_id>`. As fontes são reconstruídas do cadastro, com coberturas conferidas por campo. O stamp de revisão identifica ator, horário, protocolo, item, versão e campo, sem promover a natureza da fonte. Protocolo e somente os itens selecionados recebem estados/permissões coerentes na mesma transação da inserção append-only em `app_admin_audit_events`. Não existe tabela paralela de aprovação.

Locks de protocolo/itens/evidências e da permissão do revisor protegem a transação. A intenção persistida por usuário/request_id permite retomada explícita após perda de resposta; pedido idêntico retorna o mesmo recibo. Alteração de conteúdo, versão, ator ou pedido gera conflito. Falha na auditoria reverte a promoção. Rejeição registra decisão sem habilitar automação.

## Evidência local

- `node tests/codex/sanitario-v2-review.postgres.mjs`: 11 cenários passaram em PostgreSQL nativo novo, com todas as migrations. Inclui atualização sobre o catálogo anterior, preservação de IDs/snapshots, versão obsoleta, acesso indevido, alteração isolada de flag, divergência de hash/versão, replay/duplicata, corrida entre revisores, falha intermediária/rollback, rejeição, mudança de fonte e os 13 itens não aprováveis. O banco foi removido.
- `node tests/codex/sanitario-v2-review.supabase.mjs`: baseline funcional existente passou em projeto Supabase local próprio; três casos HTTP com JWT real passaram: não administrador rejeitado, revisor publica B19 e replay retorna recibo idêntico. Projeto e volumes próprios removidos. Não utiliza reset do projeto local compartilhado.
- Vitest focado: 195 testes passaram em 13 arquivos, incluindo 20 itens, writers/Agendas existentes, API, UI e 15 casos usando as linhas realmente aprovadas pelo PostgreSQL. Sete regras geraram Agendas individualmente; cinco regras aplicáveis em julho geraram Agendas na mesma fazenda, com concorrência/reabertura/idempotência. Nenhum Evento ou estoque foi criado pelo planejamento. As demais 13 regras permaneceram sem autorização.
- Após o ajuste de reconexão, os nove testes das duas superfícies do Admin passaram, incluindo o novo caso de retorno online sem envio automático. São 196 testes distintos observados; o rerun dessas superfícies não é somado novamente. Após o rebase final, os 20 testes de contrato e o dry-run passaram; as linhas do payload de banco permaneceram idênticas, sem repetir os cenários PostgreSQL/HTTP inalterados.
- O teste de geração carrega no Dexie as linhas publicadas pela RPC. Ele comprova a compatibilidade do domínio local com a decisão; não certifica distribuição remota automática desse catálogo ou sync multidispositivo.
- Fallow `audit --base origin/main --gate new-only --format json`: passou, zero achados introduzidos. Permanecem 5 achados de código morto, 18 de complexidade e 5 grupos de duplicação classificados como herdados pelo comando.
- `pnpm run lint` e `pnpm run build`: passaram. Build avisou sobre chunks acima de 500 kB. Testes existentes do Admin emitiram avisos de transição futura do React Router.

Reexecução da geração com o catálogo nativo, na mesma sessão PowerShell:

```powershell
node tests/codex/sanitario-v2-review.postgres.mjs
# Use catalog_file retornado pelo comando, sem editar flags/assinaturas do arquivo.
$env:SANITARIO_APPROVED_CATALOG = '<catalog_file retornado>'
pnpm exec vitest run src/lib/sanitario/agenda/__tests__/sanitaryPublishedCatalogV2.test.ts
```

As variáveis Vite exigidas pelos testes/build devem apontar ao backend local; use os valores locais em memória, sem registrá-los em código ou relatórios. Sem `SANITARIO_APPROVED_CATALOG`, os 15 testes de integração entre a RPC e o domínio ficam explicitamente ignorados; a execução relatada usou o arquivo real do harness, sem skips.

## Homologação e publicação em ambiente isolado

**Ambiente remoto:** nenhum staging isolado foi comprovado nesta tarefa. O backend anteriormente chamado staging era compartilhado com produção; não é alvo autorizado. O projeto local temporário validado acima é isolado e foi descartado. Não existe autorização para executar a sequência remota abaixo.

1. Registrar project-ref, endpoints de API/Functions/banco, histórico de migrations e frontends consumidores do novo ambiente. Conferir separação de produção por projeto/backend e roteamento efetivo. Bloquear a execução se ainda houver compartilhamento. Confirmar que o checkout contém main `b748a59` ou posterior e os patches sanitários desta branch.
2. Executar localmente os dois harnesses e gerar candidato/formulário com `node scripts/codex/prepare-sanitario-approval-v2.mjs --validate`, `--out <arquivo-novo.json>` e `--approval-form <formulario-novo.json>`. A importação do candidato de revisão por `--review-candidate --apply` continua expressamente recusada.
3. Após autorização explícita para o ambiente isolado, inspecionar o plano de migrations com `supabase db push --project-ref <REF_ISOLADO> --dry-run --skip-vault`. Aplicar somente o conjunto autorizado usando o mesmo comando sem `--dry-run`. A migration desta entrega é aditiva e não contém seed/aprovadores.
4. Autorizar separadamente a **preparação dos rascunhos no catálogo**, com digest exato do candidato e decisão de importação. Em um commit local revisado, promover o candidato validado para o arquivo canônico fixo usado pelo importador, retirando `review_only` e registrando a autorização em `import_gate.import_real_authorized=true`; manter todos os estados/flags técnicos não aprovados e `execute_import=false`. Não realizar essa promoção nesta entrega. Validar novamente o artefato com `node scripts/codex/import-sanitario-protocols-v2.mjs --validate` e conferir o hash publicado. Isso autoriza importar rascunhos, não aprova regras.
5. Com `DB_URL` do **ambiente isolado conferido** fornecida por canal seguro, rodar `node scripts/codex/import-sanitario-protocols-v2.mjs --dry-run`; exigir ausência de conflitos inesperados. Só após autorização explícita, executar `--apply` com os gates existentes `ALLOW_SANITARIO_IMPORT=1`, `SANITARIO_IMPORT_CONFIRM=13.0.0-canonical-contract` e, se remoto, `ALLOW_SANITARIO_REMOTE_IMPORT=1`. Não registrar conexão/credenciais em comandos persistidos ou logs. Não aplicar o pacote de decisões como payload. A fixture do harness usa entrada privada exclusivamente para dados sintéticos; ela não é o caminho de publicação operacional.
6. Com um revisor real já autorizado no ambiente isolado, abrir Backoffice → Curadoria sanitária, escolher protocolo e IDs/versões do formulário, revisar hash/fontes, justificar, confirmar e aprovar. B19 é um conjunto; PAR pode ser aprovado em uma decisão para os três itens. DES, CONF e PARTO são decisões próprias. CLO/LEP/IBR devem continuar mostrando bloqueios. Não criar aprovador por migration nem preencher ator/horário manualmente.
7. Conferir recibos, `app_admin_audit_events`, IDs/versões selecionados e os 13 itens não autorizados. Testar usuário comum, conteúdo alterado e duas sessões de revisão concorrentes. Validar perda de resposta/repetição com o mesmo request_id. Não alterar apenas flags no banco.
8. Na fazenda de homologação, ativar o plano existente com contexto real e as versões aprovadas, após demonstrar que essas linhas chegaram corretamente ao catálogo local. Conferir elegibilidade B19 e restrição SC; para as seis avaliações regionais usar DF, calendário e contextos individuais. Gerar as cinco regras aplicáveis em julho e as outras duas nos respectivos meses, repetir geração/reabrir, e verificar ausência de duplicação, Evento, estoque e carência. Conferir bloqueios fora de contexto/UF e os seis itens protegidos.

**Contrato multidispositivo residual:** esta entrega não habilita gates remotos nem afirma sync de planos/Agendas V2 entre dispositivos. A chegada do catálogo aprovado ao cliente e o contrato de Agenda/farm-plan remoto precisam ser homologados explicitamente antes de alegar essa capacidade. Clientes anteriores mantêm falha segura para a nova revisão por campo; o histórico e as operações já existentes preservam seus contratos. O plano da fazenda não substitui a decisão global e a decisão global não autoriza procedimento clínico.
