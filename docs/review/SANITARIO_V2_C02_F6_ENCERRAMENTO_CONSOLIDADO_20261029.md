# C02/C07 — Encerramento consolidado F6

Data: **29/10/2026**. **Curadoria consolidada executada e deltas confirmados persistidos; sem liberação operacional.** Uma matriz dos 39 produtos, uma candidata canônica, um ensaio transacional e um recibo de aplicação/replay. Os 39 cadastros não foram reaplicados.

## Resultado observado

| Medida | Quantidade |
| --- | ---: |
| Produtos F6 | 39 |
| Campos comuns avaliados: composição, apresentação, dose, via, espécie, restrições, carne, leite, registro | 351 |
| CONFIRMADO documental | **288** |
| Confirmados com representação persistida conferida | **283** |
| Confirmados já representados antes | 260 |
| Novos campos com proveniência de registro persistida | 23 |
| Confirmados ainda sem representação estruturada suficiente | 5 |
| DIVERGENTE / retenção regulatória | **19** |
| SEM_EVIDENCIA suficiente | **44** |
| Linhas inseridas / atualizadas / aprovações operacionais | **43 / 0 / 0** |
| Replay remoto | **85 skips** |

Os 19 campos D se dividem em **quatro conflitos técnicos materiais** e **15 retenções regulatórias**: quatro registros cancelados e 11 registros cujo painel informa Ativo com vencimento passado. Cancelamento é fato regulatório, não divergência de composição; data contraditória não foi tratada como irregularidade presumida. Há ainda dois subcampos de dose explicitados no JSON: neonatal P05 sem evidência suficiente e condição de infestação grave P33 documentada, sem predicado executável. Não entram novamente nos totais de nove campos comuns.

**C não significa completude universal ou permissão de uso:** caracteriza o valor e contexto documental explícitos, principalmente bovino. Restrições representam o trecho transcrito, sem afirmar ausência de outras precauções. Leite sem informação nunca vira zero. Fonte de apoio pode caracterizar um dado documental, mas permanece insuficiente para o consumidor operacional que exige prova forte da regra selecionada.

## Matriz única e exceções

- [Matriz dos 39 produtos, nove campos por produto](evidence/SANITARIO_V2_C02_F6_CLOSURE_MATRIX_20261029.md).
- [CSV da matriz, com valores e representação persistida](evidence/SANITARIO_V2_C02_F6_CLOSURE_MATRIX_20261029.csv).
- [JSON detalhado, fontes, motivos, subcampos e recibo](evidence/SANITARIO_V2_C02_F6_CLOSURE_MATRIX_20261029.json).
- [Somente os 63 campos D/S, com motivo e ação necessária](evidence/SANITARIO_V2_C02_F6_CLOSURE_EXCEPTIONS_20261029.csv).

| Exceção | Produtos/campos | Ação específica |
| --- | --- | --- |
| Conflitos técnicos | P33 leite: 2 versus 3 dias; P40 composição/unidade BPO, carne 74 versus 6 dias e leite vedado versus 24 h | Obter versões nacionais reconciliadas do fabricante; nenhum desses valores foi escolhido por inferência |
| Registros cancelados encontrados no recorte | P03 Raivacel Multi `7.686/2001`; registro provável P06 Bovilis Poli-Start T `9.765/2013`; P16 B19 Labovet `3.785/1991`; P25 Cattlemaster 4 `5.341/1995` | P06 exige confrontar a licença na bula, pois a grafia do painel difere de Poli-Star T; não atribuir cancelamento ao produto comercial por semelhança. Nos demais, confirmar licença aplicável antes de uso; não migrar automaticamente para +TE, outro Cattlemaster ou outra B19 |
| Ativo com vencimento anterior à consulta | P13, P29, P30, P31, P33, P34, P37, P39, P40, P41, P42 | Confirmação individual MAPA/renovação, em uma solicitação consolidada; não presumir vigência nem irregularidade |
| Identidade individual não localizada | P28 Poli-Star | Obter número da licença e reconciliar formulação; não substituir por Poli-Star T ou +TE |
| Carne não comprovada | P01, P03, P06, P15, P17–P23, P27, P28, P41 | Bula nacional com prazo/proibição expressos para abate; nenhuma analogia entre vacinas |
| Leite não comprovado | P01, P02, P03, P05–P09, P15, P17–P28, P41 | Declaração específica de leite; ausência não é zero |
| Outras lacunas | P02/P08/P27/P31 apresentação; P15 composição quantitativa; P41 concentração; P06 via primária | Documento específico/apresentação ou leitura visual; não inferir concentração de CE25 ou via de outro Poli-Star |

Cinco campos C continuam documentais, sem regra estruturada completa: **P06 dose**, por falta de via primária suficiente; **P40 dose/via**, por necessidade de preservar teto de 60 mL; **P41 dose/via**, por diluição em água sem base equivalente no contrato atual. Não foi introduzida arquitetura para forçar esses valores. As restrições e referências já existentes permaneceram preservadas.

## Evidência e identidade regulatória em lote

Reutilizada a caracterização dos 39 produtos no [consolidado F6 de 26/10](SANITARIO_V2_C02_LOTE_F6_CONSOLIDADO_20261026.md), a candidata canônica F6, P38 e a candidata P33. Não se repetiu pesquisa individual dos campos já concluídos. P04/P10/P35 continuam excluídos do F6.

Consultados os painéis oficiais MAPA de [produtos farmacêuticos](https://mapa-indicadores.agricultura.gov.br/publico/extensions/Produtos_Farmaceuticos/Produtos_Farmaceuticos.html), atualizado **29/10/2026 05:50:26**, e [produtos biológicos](https://mapa-indicadores.agricultura.gov.br/publico/extensions/Produtos_Biologicos/Produtos_Biologicos.html), atualizado **29/10/2026 06:00:52**. Seleção por famílias em lote e conferência por número individual, nome e titular; duas licenças Labovet completadas conjuntamente por número. A exportação XLS do painel não forneceu download verificável; foram preservadas as linhas visíveis paginadas em [farmacêuticos](evidence/SANITARIO_V2_C02_F6_MAPA_PHARMA_RAW_20261029.json) e [biológicos](evidence/SANITARIO_V2_C02_F6_MAPA_BIO_RAW_20261029.json), com capturas PNG homônimas. Isso não é auditoria universal de todos os registros do MAPA.

Foram confirmadas **23 identidades individuais**, com vínculos documentais produto/fonte/`registration`. Cada cobertura enumera explicitamente produto UUID, registro, titular e situação. As colunas `registro_numero`/`registro_orgao` e metadata dos cadastros aprovados não foram reescritas; a persistência é de proveniência documental, não de autorização operacional. `SIM_NORMA` identifica a evidência oficial do registro; não transforma o painel em bula nem prova dose/carência.

A expressão da tabela de biológicos apresenta EM RENOVAÇÃO como VIGENTE. A confirmação documental refere-se ao status público exibido pelo painel, sem certificar um ato administrativo além dessa evidência. P06 não integra os 23 registros confirmados: a identidade da licença provável precisa ser confrontada com a bula/embalagem.

Variantes não foram confundidas: P38 usa `SP0001290-8`, sem importar o homônimo `-7`; P12 usa o registro atual `SP0000361-76`, separado do antigo MG cancelado; P05 Covexin 9 é separado de Covexin 9 BR; P17 usa Rabmune herbívoros `10.101/2015`, sem substituir pela liofilizada `2.694/1987`. P23 diferencia proprietário Ceva/fabricante Labovet e P39 titular Sespo/fabricante Ipanema, conforme as bulas já examinadas.

Nova bula parcial [Ripercol L Injetável](https://www.zoetis.com.br/global-assets/private/ripercol_l_injetavel_1.pdf), página única, baixada e renderizada para exame visual, SHA256 `9966748778e078f81a025ea1507da803e1d357ab96a99aafe24380dce58d3ab5`: confirma composição, volume de dose, espécies e vias descritas; termina durante armazenamento e **não contém quadro de carência**. A nova fonte não recebeu cobertura withdrawal. A bula Ticson localizada permaneceu sem texto e o download retornou 403; não foi promovida como prova forte de carência. Formulações estrangeiras e comércio não foram usados como substitutos.

## Candidata, transação e pós-condições

[Candidata única](evidence/SANITARIO_V2_C02_F6_CLOSURE_CANDIDATE_20261029.json), SHA256 **`f09d9ebc4c4873693740b2afe218ce75ceff4cff3c66218a4e5be4bf6d4389bb`**. Referencia os 39 produtos integrais, sem mudar metadata, dose, autorizações por espécie ou flags. Import gates da candidata continuam false; autorização vem da solicitação explícita de encerramento consolidado, referência `C02-F6-20261029-EXPLICIT-USER-CONSOLIDATED-CLOSURE`, limitada ao projeto `zqloazqzhwauamcejmuz`.

Foi ampliada somente a entrada fechada do writer para `--c02-f6-closure`, vinculada a esse digest, 85 operações, 39 referências cadastrais skip e 43 inserts. Reutilizados `buildPlan`, `applyTransaction`, `writeOperation` e compilador MCP existentes. Não foi criado writer paralelo ou endpoint remoto genérico.

SQL emitido após PostgreSQL descartável gerenciado e rollback: [pacote transacional](evidence/SANITARIO_V2_C02_F6_CLOSURE_APPLY_20261029.sql), SHA256 **`e557118904fb039b218899c2425c2f88c3888b3247a40e2fcf4e0c64708fef36`**. Advisory lock, locks das oito tabelas, assinatura de contratos/privilégios, CAS integral, contagem de DML e pós-imagem; atomicidade preservada. O primeiro ensaio falhou por enum UF incompleto na fixture; corrigido somente no harness local. Nenhuma falha de preparação alcançou o remoto.

Reconsulta às **18:02:02 UTC / 15:02:02 BRT**: [pré-aplicação](evidence/SANITARIO_V2_C02_F6_CLOSURE_PREAPPLY_20261029.json) integralmente igual ao snapshot do ensaio. Aplicação: **43 create / 0 update / 42 skip / 0 reject / 0 approved**. Replay do mesmo SQL: **replay=true / 85 skip**. [Recibo e estado posterior](evidence/SANITARIO_V2_C02_F6_CLOSURE_REMOTE_RESULT_20261029.json), leitura às **18:03:23 UTC / 15:03:23 BRT**. Todas as linhas anteriores permaneceram byte a byte equivalentes no JSON; três cadastros fora do F6 presentes no snapshot global também foram preservados.

| Tabela global | Antes | Depois | Delta |
| --- | ---: | ---: | ---: |
| Fontes | 60 | 64 | +4 |
| Coberturas | 298 | 305 | +7 |
| Produtos | 42 | 42 | 0 |
| Autorizações por espécie | 39 | 39 | 0 |
| Vínculos produto/fonte | 215 | 243 | +28 |
| Doses | 39 | 39 | 0 |
| Regras de carência | 39 | 41 | +2 |
| Vínculos regra/fonte | 39 | 41 | +2 |

As 43 linhas representam **23 novos campos de proveniência regulatória** e fortalecimento documental de seis campos existentes (P34 composição/dose/via/espécie; abate P33 e P38), além das respectivas fontes/coberturas/vínculos. Não são 43 produtos ou 43 campos técnicos inéditos.

Novas regras: **P33 bovino/corte/SC, sete dias**, UUID `2651d9d7-390e-50ed-8065-4c4ba7b1ed1c`; **P38 bovino/corte/SC, 12 dias**, UUID `04012eb3-618b-5813-a387-a16f769d2a64`. Ambas `precisa_validar`, leite null e vínculo específico à bula correspondente. P38 leite zero, já persistido anteriormente, não foi reaplicado. Regras anteriores sem via permanecem pendentes; não ativar indiscriminadamente versões sobrepostas.

## Infraestrutura e validação única

Branch `codex/optimize-agent-infrastructure`, HEAD `4aacd94facbfb67dabc188c6a5df0553dfcba764`, uma worktree e staged vazio. Main remota reconfirmada `20140c074b34857e5f4343f47778f5560e2e2482`. Alterações concorrentes de backlog, reprodução, test farm e UX preservadas.

Os **oito arquivos runtime P38 mantêm os hashes do manifesto validado**. Dexie v34, pull-only, isolamento, tombstones, zero por finalidade e proveniência selecionada não foram refeitos. Reutilizada evidência válida **397/397**, sem 39 rodadas de testes; comparação TypeScript **233 baseline / 233 atual / nenhum novo por arquivo/código/mensagem**. O typecheck global continua falho; não foi repetido sem delta TS.

Deployment Vercel reconfirmado `dpl_6P2kx5yMarubVmWsiHKGsbpmcvVQ`, produção READY, mesmo Git `main@20140c07`: contém Dexie v33 e contrato anterior. **Compatibilidade insuficiente para ativação P38/F6**. Nenhum deploy foi executado.

Validação desta continuidade: **33/33 testes em três arquivos**, comando `pnpm test -- tests/codex/sanitario-f6-closure.test.mjs tests/codex/sanitario-c02-p38.test.mjs tests/codex/sanitario-c02-p33.test.mjs --reporter=dot`; contrato canônico, UUIDv5/colisões, 39 identidades, 351 células, conflitos isolados, proveniência específica, estado pendente, cálculo sintético de corte 7/12 dias, leite desconhecido, aplicação e replay observados. O classificador documental exige evidência primária para C: presença de valor ou zero, isoladamente, não confirma um campo; controle negativo falhou antes do ajuste e passou depois. ESLint dos quatro JS tocados e diff check: saída 0. Ensaio: `node tests/codex/sanitario-f6-closure.local.mjs`, 43 create/42 skip, convergência do planner antes de rollback. [Recibo local](evidence/SANITARIO_V2_C02_F6_CLOSURE_LOCAL_RESULT_20261029.json). Sem build/E2E/regressão global ou migration/RLS/RPC alterados.

Gate: **READY WITH CAVEAT para a entrega documental e persistência pendente**, com typecheck global herdado. **Sem liberação operacional.** Estado remoto real: regras novas pendentes → carne/leite unknown. Cópias sintéticas ativas com fonte específica → corte P33 sete dias/P38 12 dias, leite unknown; o teste anterior de P38 continua demonstrando leite zero sem carne zero.

## Bloqueios reais e próxima ação consolidada

1. A implantação não contém os contratos P38 e as regras técnicas/autorizações continuam pendentes; ativação exige compatibilidade implantada comprovada e decisão específica sobre dose, espécie, restrições e versão aplicável. Não se derivou histórico, Agenda ou Evento desta curadoria.
2. Resolver conjuntamente as 15 retenções regulatórias, a identidade P28 e os quatro conflitos técnicos P33/P40, com prova material MAPA/fabricantes; os 44 S permanecem desconhecidos por finalidade/campo, sem bloquear a persistência dos demais.
3. Os cinco C sem representação exigem contexto suficiente ou capacidade contratual mínima antes de virar regra executável; não se perdeu teto, diluição ou via para fechar números.

**Próxima ação consolidada:** obter as confirmações regulatórias e bulas reconciliadas para a lista única de exceções; integrar a infraestrutura já validada por fluxo explícito de publicação antes de qualquer decisão de ativação. Não é necessário repetir os 39 cadastros ou o processo individual P38.
