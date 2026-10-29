# C02/C07 — Integração definitiva e encerramento F6

Data: 29/10/2026. **C02/F6 encerrado no escopo cadastral e documental realizado. Segurança sanitária consolidada em commit local específico; publicação e ativações não executadas.**

## Integração e estado de publicação

Commit de segurança **`3f3c960`**, `fix(sanitario): scope withdrawal evidence by rule and purpose`: **17 arquivos, 395 inserções/40 remoções**, nove runtime e oito testes. [Diff transportável](evidence/SANITARIO_V2_C02_F6_SECURITY_20261029.patch). Nenhum arquivo de reprodução, test farm, UX ou writer administrativo integra esse commit.

Baseline da revisão `bc31073565a3c7b15d396c610dd239f382b08db6`, branch `codex/optimize-agent-infrastructure`, uma worktree e staged vazio na entrada. O avanço concorrente desde `4aacd94f` altera somente `CalfInitialEditor.tsx`/`postPartum.ts`; não houve conflito nos arquivos sanitários. Main inicial `20140c07`; na conferência final, main remota avançou para **`c752c9a24e604fdab1f92ed2807b7dc2b8e75706`** pelo PR concorrente #257. Sua árvore é idêntica à baseline bc310735 (`899b55ddc6e24112f76e6f4393aafea2b79fd5a7`), sem alteração sanitária; a evidência permanece aplicável. O patch dos 17 arquivos passou `git apply --cached --unidiff-zero --check` sobre a main inicial e sobre a main final c752c9a em índice temporário, sem alterar o checkout ou criar branch/worktree no repositório compartilhado.

Preservados: Dexie **v34** aditivo, PK composta do vínculo regra–fonte, pull-only paginado com instalação transacional, retenção do cache anterior em falha, tombstones dos pais, isolamento por fazenda, prova forte **da regra selecionada**, zero explícito na finalidade correta e snapshots factuais/replay inalterados. Carne/leite desconhecidos não viram ausência explícita.

Validação nova do recorte integrado: **162/162 em 11 arquivos** (upgrade antigo com fila pendente/reabertura, reconnect, replay, falha antes do commit, execução/correção e histórico). ESLint dos 17 arquivos: saída 0. Após extrair apenas a leitura de evidência compartilhada para remover uma duplicação introduzida, os 70 testes de execução/correção passaram novamente. Foram reaproveitados os controles administrativos/curatoriais **33/33** anteriores, sem repetir os 397 testes ou a curadoria. A matriz de habilitação tem mais **3/3 testes** locais e não altera dados remotos.

TypeScript no novo HEAD: **233 baseline / 233 patch / zero novos diagnósticos por arquivo, código e mensagem**, preservando multiplicidade. Comparação read-only por Compiler API de `tsconfig.app.json`, substituindo os oito runtime anteriores pelos bytes de bc310735 no baseline e excluindo desse baseline o novo leitor compartilhado, sem remover deltas concorrentes. [Inventários completos e comparação](evidence/SANITARIO_V2_C02_F6_INTEGRATION_TYPESCRIPT_20261029.json). O typecheck global continua falho; não se corrigiu esse passivo fora do escopo.

Produção reconfirmada após o avanço concorrente: **`dpl_5WH9Q3rMUKkDsJfzjaXiqz7FBybH`**, READY, Git `main@c752c9a`, ainda v33; a árvore base sanitária não mudou. O deployment anterior era dpl_6P2kx5yMarubVmWsiHKGsbpmcvVQ/main@20140c07. Nenhuma publicação foi executada por esta tarefa. O commit local é transportável; **não está publicado ou implantado**. Os ancestrais de reprodução já integram a main final. Ainda assim, transportar os commits específicos em checkout limpo evita capturar deltas locais concorrentes da branch compartilhada.

## C02/F6 encerrado

39 cadastros aprovados para catálogo; curadoria consolidada concluída no recorte documental; 288 campos confirmados, 283 representados, cinco sem representação estruturada suficiente. Persistência anterior de **43 novas linhas**, zero updates, zero aprovações operacionais; replay remoto com **85 skips**. [Matriz, exceções e recibos](SANITARIO_V2_C02_F6_ENCERRAMENTO_CONSOLIDADO_20261029.md). Nenhum cadastro, fonte, licença ou importação foi reconsultado/reaplicado nesta integração.

`MASTER_BACKLOG.md`, `MASTER_BACKLOG_EXECUTION_PLAN.md` e `PROJECT_STATUS.md` registram esse encerramento. C07 conserva a publicação e as habilitações específicas; C03 permanece separado. Aprovação cadastral permite catálogo/consulta e não autoriza aplicação, automação, venda ou abate.

## Restrições por impacto

| Classe | Recorte efetivamente afetado | Tratamento mínimo |
| --- | --- | --- |
| BLOQUEIO_TECNICO | Habilitação dependente do novo consumidor enquanto produção usa v33 | Publicar o commit pelo fluxo existente e comprovar SHA/v34; cadastro e consulta continuam independentes |
| BLOQUEIO_TECNICO localizado | Regra sem via delimitada; fonte selecionada ausente/ambígua; cinco campos sem representação (P06 dose; P40 dose/via com teto; P41 dose/via por diluição) | Delimitar versão/cobertura/contexto no contrato canônico; não perder teto/diluição nem preencher zero por ausência. Não bloqueia outros produtos/regras |
| RESTRICAO_ESPECIFICA | Leite expressamente vedado em P11/P14/P30/P31/P36/P37/P39/P42; divergência leite P33 e carências/composição P40 | Manter restrição por finalidade; não estender divergência leiteira para carne comprovada |
| RESTRICAO_ESPECIFICA | Cancelamento individual comprovado P03/P16/P25 | Restringir uso prospectivo dessas identidades; não bloquear o catálogo inteiro. P06 tem correspondência provável a confirmar, sem atribuir cancelamento por semelhança |
| RESTRICAO_ESPECIFICA | Vigência contraditória/não localizada e contexto clínico insuficientemente delimitado | Resolver somente a identidade/contexto apontados na matriz. P38 já tem bula e vigência: falta qualificar a autorização pendente com suas precauções conhecidas, sem nova pesquisa |
| PENDENCIA_DOCUMENTAL | Apresentação P02/P08/P27/P31, documentação adicional e subcampo neonatal P05 fora do recorte comprovado | Não condicionar cadastro/consulta, regra adulta independente ou outra finalidade à completude universal. Quando o campo for indispensável à operação específica, tratá-lo apenas naquele recorte |

Falta de carência impede afirmar prazo/ausência naquela finalidade; não inventa proibição universal de registrar fato já ocorrido. Os contratos existentes do registro factual continuam aplicáveis. Nenhum bloqueio novo foi inserido no runtime nesta tarefa.

## Habilitação por regra e finalidade

[CSV objetivo](evidence/SANITARIO_V2_C02_F6_ENABLEMENT_20261029.csv) e [JSON com motivos/ações](evidence/SANITARIO_V2_C02_F6_ENABLEMENT_20261029.json): **80 recortes**, sendo 41 regras existentes e 39 ausências por finalidade, distribuídos pelos 39 produtos. Não são 80 regras persistidas ou novas ativações.

| Estado técnico | Recortes |
| --- | ---: |
| ELEGIVEL | **1** |
| RESTRITO | **17** |
| INCOMPLETO | **62** |

**Elegível:** P11/Cydectin 1%, bovino/corte/SC, carência de 28 dias, regra `59c1a4d7-f0bd-5011-9f2e-88faa19c95ee`; dose documentada 1 mL/50 kg, prova forte específica e registro individual confirmado. Contexto exclui produtoras de leite para consumo humano e preserva a bula ART-21644 v2. Leite permanece RESTRITO; não impede avaliar a regra independente de carne.

ELEGIVEL significa requisitos documentais/técnicos da regra delimitada satisfeitos para submissão à decisão específica após implantação compatível. **Não significa regra ativa**, automação liberada, execução clínica certificada ou autorização comercial. Status pendente e ausência do patch em produção foram separados da análise por finalidade, sem tornar todas as linhas incompletas por uma condição global única.

Para P38, leite zero e corte SC de 12 dias têm prova exata, mas a autorização pendente ainda contém limitações antigas e não qualifica as precauções da P12073 V00: segurança não avaliada abaixo de cinco meses, sensibilidade e orientação MV. Ação mínima é incorporar/qualificar essas condições conhecidas e a decisão clínica no contrato/contexto aplicável; não inventar 150 dias ou transformar falta de avaliação em proibição mais ampla. A versão antiga de corte sem via também não deve ser ativada junto da nova por conveniência.

Para os demais INCOMPLETO, o CSV enumera apenas falta indispensável: prazo/proibição da finalidade, versão com via explícita, prova forte/vínculo da regra, cobertura única de dose/via/espécie, representação ou vigência específica. Nenhuma lacuna de leite gera motivo de restrição na linha de carne P33. A fonte primária P34 soma-se à de apoio anterior e requer delimitar a cobertura de cada campo antes de habilitação; não se presume ausência de ambiguidade.

## Procedimento concreto de publicação

Pré-condições: autorização explícita para push/PR/merge/deploy; checkout de publicação limpo baseado na main remota atual; transportar **somente os commits sanitários específicos**, preservando o checkout compartilhado e seus deltas concorrentes. Não usar reset, stash destrutivo ou push da branch inteira.

1. No checkout limpo de publicação, executar `git fetch origin` e `git cherry-pick 3f3c960` (commit de segurança). Transportar separadamente o commit documental/curatorial específico registrado na entrega; não reaplicar os SQLs de recibo.
2. Conferir diff contra `origin/main`, template atual de PR e required checks do fluxo existente `.github/workflows/antigravity-validate.yml`/`auto-pr-description.yml`. Os checks remotos não foram executados nesta tarefa; o passivo TypeScript e o recorte validado devem acompanhar o PR. Mudança de baseline exige somente rever a evidência afetada.
3. Somente após autorização e CI requerido, integrar pelo fluxo normal. Depois, conferir na Vercel o **SHA efetivamente implantado**, não apenas o estado READY.
4. Verificação posterior: cliente atualizado abre v34 com dados/fila anteriores; pull instala vínculos completos; cenário sintético P38 leite zero/carne unknown e corte com prova específica retorna 12 dias; reconnect/replay preservam fatos. Não editar Eventos antigos nem ativar regras para testar produção.
5. Habilitações remotas são outra ação expressamente autorizada, por regra/contexto elegível, com CAS, recibo e replay canônicos; não são efeito do merge ou do deploy. Nenhuma ativação foi feita aqui.

Classificação local: **READY WITH CAVEAT** pelo typecheck global herdado; nenhuma regressão TS nova identificada. Commit de segurança preparado para integração, sem afirmar CI remoto, deploy ou liberação operacional concluídos.

Check estático exigido pelo fluxo: Fallow new-only **passou no snapshot sanitário isolado**, com zero achados introduzidos; 5 de dependências, 15 de complexidade e 12 grupos de duplicação herdados não foram reabertos. Os achados concorrentes de calfJourney/testFarm não integraram o snapshot. Extrações locais ficaram limitadas à leitura compartilhada da evidência e à materialização comum dos dois harnesses; suas entradas foram registradas explicitamente no Fallow, sem suppressions. Ambos os ensaios geraram exatamente os hashes SQL históricos, com rollback, sem conexão remota. O snapshot foi exportado para diretório temporário e repositório Git local independente, sem branch/worktree novos no repositório compartilhado; o wrapper pnpm recusou operar o junction de dependências, portanto o check foi executado diretamente pelo binário instalado, sem instalação ou remoção de dependências.
