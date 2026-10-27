# C02 — PRIMEIRO PRODUTO CARACTERIZADO

Data da pesquisa: **26/10/2026**, America/Sao_Paulo. Produto: **Cydectin 1% — P11**.

**Atualização de método — 26/10/2026:** por orientação expressa do usuário, a bula oficial é suficiente para caracterização documental. O registro MAPA 6709 fica documentado por T1, sem reconfirmação cadastral rotineira. Certificação da última versão e revisão humana individual não são condições para transcrever informações expressas. Limitações de vigência abaixo delimitam o que foi consultado; não são indício de irregularidade ou bloqueio da curadoria. O [consolidado F6](SANITARIO_V2_C02_LOTE_F6_CONSOLIDADO_20261026.md) substitui a abordagem geral anterior e reaproveita esta matriz.

**Decisão:** primeiro recorte documental de C02 produzido, com identidade F6 rastreada e campos caracterizados conforme a fonte consultada. **Produto não aprovado; C02 permanece aberta.** Nenhum dado deste relatório é autorização de dose, carência, aplicação, protocolo ou automação.

## 1. Baseline e escopo efetivamente consultados

Modo principal: **DIAGNOSIS**, com entrega de relatório documental local. Não houve implementação funcional nem correção do catálogo.

- Repositório remoto confirmado: `maresdeandrade/RebanhoSync`.
- Checkout: `C:/Users/mares/dyad-apps/GestaoAgro`, branch `codex/sanitario-v2-functional-validation`, HEAD `1a4a72c4fb65a448b628659fc341ca13fc8e0286`.
- `git ls-remote origin refs/heads/main` confirmou `6f1b8dcec93254d60be73757a6515193240e208c`. Após `git fetch origin main`, `origin/main` aponta para esse mesmo commit. Não houve checkout, merge ou rebase.
- `git merge-base HEAD origin/main` retornou o HEAD local. Os contratos de produto/fonte e os dois documentos canônicos sanitários consultados não diferem entre HEAD e essa main (`git diff --quiet`, saída 0).
- Working tree já tinha 13 arquivos tracked modificados e sete arquivos untracked em `src/lib/testFarm/`; nada staged. Alterações existentes em governança, reprodução, auth, offline, UI sanitária, bootstrap e cache CLI foram preservadas. O relatório é o único arquivo criado no repositório por esta tarefa.
- Outros worktrees observados: `master-backlog-docs/GestaoAgro` (`codex/a06-method-routing`, `5af2476`), `superpowers-pilot/GestaoAgro` (detached, `3492b6d`) e `conscious-almanac` (detached, `5af2476`). Nenhum foi modificado.

Os artefatos F6/F9 e o backlog mais recentes foram lidos diretamente do objeto Git da main confirmada, via `git show`, pois não estão todos no checkout antigo. As referências abaixo fixam esse commit; não pressupõem arquivos presentes no working tree. Os PRs #247–#251 são contexto histórico, não evidência substituta dos artefatos.

## 2. Identidade e vínculo com a publicação

Fontes internas fixadas em `6f1b8dcec93254d60be73757a6515193240e208c`:

- **R1:** [payload F6](https://github.com/maresdeandrade/RebanhoSync/blob/6f1b8dcec93254d60be73757a6515193240e208c/docs/review/evidence/SANITARIO_V2_F6_PRODUCTS_REVIEW.json), seletor `payload.product_rows`, linha identificada por `metadata.research_lot_code=P11`.
- **R2:** [recibo público F9](https://github.com/maresdeandrade/RebanhoSync/blob/6f1b8dcec93254d60be73757a6515193240e208c/docs/review/evidence/SANITARIO_V2_F9_PUBLIC_RECEIPT.json).
- **R3:** [resumo F6–F9](https://github.com/maresdeandrade/RebanhoSync/blob/6f1b8dcec93254d60be73757a6515193240e208c/docs/review/SANITARIO_V2_F6_F9_PUBLIC_SUMMARY.md).
- **R4:** [backlog, linha C02](https://github.com/maresdeandrade/RebanhoSync/blob/6f1b8dcec93254d60be73757a6515193240e208c/docs/review/MASTER_BACKLOG.md) e [diagnóstico agregado de 25/10](https://github.com/maresdeandrade/RebanhoSync/blob/6f1b8dcec93254d60be73757a6515193240e208c/docs/review/evidence/MASTER_BACKLOG_REMOTE_READONLY_20261025.json).

| Identificador | Valor verificado em R1 |
| --- | --- |
| Código de pesquisa | `P11` |
| Nome | `Cydectin 1%` |
| UUID | `7fc44e31-3373-50de-97fd-58e874938938` |
| product_key | `COMMERCIAL_RESEARCH_F5_P11_CYDECTIN_1` |
| Fabricante proposto | `Zoetis` |
| Status curatorial | `precisa_validar` |
| Origem | `f5_20261023_review_only`, estágio `F5_CANDIDATE_REVIEW_ONLY` |

**FATO CONFIRMADO:** R1 tem 39 `product_rows`, uma única ocorrência de P11 e três retidos separados (`P04`, `P10`, `P35`). O SHA-256 dos bytes de R1, recalculado a partir de `git show`, é `c2ff9fb6b3df3cfc6df668a1fdccd374a3a0ed39abc7f6636d6622c3b7ff159a`, idêntico a `payload_file_sha256` de R2. O recibo registra ACK `F6 commercial products apply OK`, exit code 0, 39 criações e zero update/skip/reject, com persistência dos importados documentada.

Assim, o vínculo individual é **P11/UUID no payload → hash exato do payload no recibo → publicação histórica agregada**. R2 não enumera UUIDs individualmente. Não se alega recibo individual nem nova consulta remota de P11. O hash canônico `a777233b2d8083d4d1b89c93947df74cec210a9ef8571576dbd35dcbac3b84e1` é declarado em R2; não foi recalculado nesta tarefa.

R4 registra 42 produtos `precisa_validar` em observação agregada de 25/10/2026. Essa contagem não identifica quais são os 39 F6 nem muda a cadeia de proveniência acima. Fortress 8, Lepto-Bac 6 e Valbazen 10 Cobalto permanecem fora desta curadoria e fora de R1 `product_rows`.

## 3. Fontes externas, versão e força da evidência

Todas acessadas em 26/10/2026. Não foram usados varejistas ou bulários secundários como prova de campo.

| Ref. | Fonte e localização | Versão, proveniência e limite |
| --- | --- | --- |
| T1 | [Bula brasileira no domínio Zoetis](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Cydectin/pdf/cydectin-bula.pdf), duas páginas; mesma URL de `metadata.source_url` em R1 | Leitura visual integral após renderização; PDF sem texto extraível. Cabeçalho: ART-21644, versão 2.0, aprovação interna 23/09/2016; arte 40013750 / GQ-030. Não equivale a aprovação no RebanhoSync ou renovação de registro. |
| T2 | [Portfólio brasileiro Zoetis — Endectocidas](https://www.zoetis.com.br/especies/bovinos/endectocidas.aspx), seção Cydectin | Corrobora identidade, fabricante, formulação e espécie. Página sem versão/data editorial observada; disponibilidade pública não certifica registro vigente. |
| N1 | [Decreto 5.053/2004, texto consolidado no Planalto](https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5053.htm), anexo, arts. 24 e 39 | Exige registro e descreve conteúdo da rotulagem: composição, indicação, espécie, dose, aplicação, restrições, carência e identificação do registro. É referência normativa geral; não valida especificamente Cydectin. |
| N2 | [MAPA — consulta de registros](https://www.gov.br/agricultura/pt-br/assuntos/registro-de-produtos-e-estabelecimentos/consulta-de-registros) | Orienta consulta de registros e situações cadastrais. Não foi obtido certificado individual atual de P11. |
| N3 | [MAPA — recurso público SIPEAGRO “Produto Veterinário”](https://dados.agricultura.gov.br/dataset/sipeagro/resource/7ce5fac0-9c8f-4e14-82d9-6deab9b5e2e9) | Atualização indicada: 03/10/2026. CSV inspecionado: colunas de estabelecimentos (UF, município, registro de estabelecimento, razão social, atividade etc.), sem coluna de nome/registro de medicamento. Não serve para confirmar vigência do produto. |

Identificação reprodutível de T1 baixada: SHA-256 `a49e7fe7f90fa7ded65414bea53feb402ca775dfe24e3a82685260031fb3a2a0`. Metadados PDF: criação `2016-09-01`, modificação `2024-11-13`. São datas do arquivo, não revisão clínica ou vigência regulatória. O rodapé registra extração interna em 24/04/2019. Não houve confirmação de que esta é a última bula autorizada pelo MAPA.

## 4. Matriz por campo

“Existente” refere-se **ao payload F6 R1**, não ao banco atual. Além das 39 linhas comerciais, todas as outras coleções de R1 estão vazias, inclusive fontes estruturadas, coberturas, autorizações, doses e carências. `metadata.source_url` é uma pista documental; não equivale a vínculo canônico por campo.

Classificações descrevem a evidência documental: **CONFIRMADO** = informação sustentada pela fonte identificada, no seu contexto e versão; **DIVERGENTE** = conflito positivo entre valores; **NÃO COMPROVADO** = fonte insuficiente; **NÃO APLICÁVEL** = item expressamente fora da natureza deste produto. Um `null` no payload é lacuna, não contradição. CONFIRMADO não promove status curatorial nem comprova vigência atual.

| Campo | Valor existente em R1 | Fonte | Evidência/valor caracterizado | Classificação | Decisão proposta, somente documental |
| --- | --- | --- | --- | --- | --- |
| Nome/formulação | Cydectin 1% | T1 p.1; T2 seção Cydectin | Cydectin, injetável, moxidectina 1% | CONFIRMADO | Preservar identidade; tratar 1% como qualificador da formulação. |
| Fabricante | Zoetis | T1 p.2, fabricante; T2 | Zoetis Indústria de Produtos Veterinários Ltda. | CONFIRMADO | Anotar razão social na caracterização; não alterar UUID/chave. |
| Apresentação | `null` | T1 p.2, apresentação | Frascos plásticos: 50, 500 e 1000 mL | CONFIRMADO | Registrar lacuna do payload; confirmar apresentações comerciais atuais antes de cadastro. |
| Composição | `principio_ativo=null` | T1 p.1, fórmula | Moxidectina 1 g/100 mL; veículo q.s.p. | CONFIRMADO | Propor complementação documental, sem gravar no catálogo. |
| Concentração | Sem atributo específico preenchido | T1 p.1, fórmula | 1% p/v | CONFIRMADO | Conservar unidade e formulação na evidência; não extrapolar para outro produto. |
| Espécie | Sem autorização estruturada | T1 p.1, indicações; T2 | Bovinos | CONFIRMADO | Evidência restrita à espécie; não estender a bubalinos. |
| Indicação | `classe/tipo_produto=antiparasitario` | T1 p.1, indicações; T2 | Endectocida bovino; parasitos internos/externos especificados | CONFIRMADO | Manter a bula como lista de referência, sem generalizar eficácia a todo parasito. |
| Dose por peso | Sem regra de dose | T1 p.1, administração/dosagem | 1 mL/50 kg (0,2 mg/kg) | CONFIRMADO | Anotar exclusivamente na matriz; não gerar dose liberada. |
| Via e local | Sem regra de via | T1 p.1, administração | Subcutânea, frente/atrás da escápula | CONFIRMADO | Não usar como instrução operacional aprovada. |
| Intervalo de reaplicação | Ausente | T1 p.1, administração e proteção | Sem intervalo fixo explícito | NÃO COMPROVADO | Não preencher nem converter proteção em recorrência. |
| Carência carne | Sem regra de carência | T1 p.2, quadro de carência | 28 dias após última aplicação | CONFIRMADO | Anotar fonte/contexto; não iniciar contagem ou liberar abate. |
| Leite | Sem regra de carência | T1 p.2, mesmo quadro | Uso vedado em produtoras de leite para consumo humano | CONFIRMADO | Preservar proibição; não representar como zero ou prazo numérico. |
| Gestação/reprodução | Sem autorização estruturada | T1 p.1, segurança | Menção favorável para vacas prenhes/touros | CONFIRMADO | Não elimina a restrição leiteira nem autoriza qualquer contexto por inferência. |
| Precauções clínicas | Ausentes | T1 p.1, segurança | Hipersensibilidade; cuidado prévio com debilitados/infectados | CONFIRMADO | Registrar limites e remeter à bula e ao responsável técnico. |
| Prescrição/orientação | Ausentes | T1 p.2, recomendações | Prescrição e orientação veterinárias | CONFIRMADO | Preservar requisito na eventual revisão futura. |
| Armazenamento | Ausente | T1 p.2, precauções | 15–30 °C, embalagem original, proteção solar | CONFIRMADO | Registrar como informação da fonte, sem criar controle de estoque. |
| Prazo de validade | Ausente | T1 p.2, validade | 48 meses da fabricação | CONFIRMADO | Não confundir com vigência de registro ou validade do lote físico. |
| Registro mencionado | Campos `registro_*` nulos; metadata MAPA/6709 não verificada | T1 p.2, licenciamento | N.º 6709, 08/02/1999 | CONFIRMADO | Confirma a menção na bula; manter separada da vigência atual. |
| Vigência regulatória atual | `registration_current_validity=unknown` | T1; N1–N3 | Certificado/consulta individual atual não obtidos | NÃO COMPROVADO | Manter desconhecido; solicitar prova específica, sem presumir cancelamento. |
| Última revisão técnica vigente | Não informada | T1 cabeçalho/metadados; T2 | Arte interna identificada, atualidade não demonstrada | NÃO COMPROVADO | Reconciliação com bula/registro atual é pendência expressa. |
| Cepa/antígeno vacinal | Não existe neste cadastro antiparasitário | T1 p.1, fórmula | Produto farmacológico | NÃO APLICÁVEL | Não importar atributos de vacina ou protocolo vacinal. |

Nenhuma divergência positiva foi demonstrada entre os campos comerciais preenchidos em R1 e T1/T2. As faltas de apresentação, princípio ativo e regras estruturadas são **lacunas**, não erros confirmados. A caracterização permanece limitada à versão consultada.

## 5. Lacunas de contrato e riscos

**FATOS CONFIRMADOS no código e migration consultados:**

- [sanitaryProductV2.ts](../../src/lib/sanitario/rules/sanitaryProductV2.ts) já separa produto, autorização por espécie, dose e carência; possui `limitations` e fontes. [sanitarySourceV2.ts](../../src/lib/sanitario/rules/sanitarySourceV2.ts) já prevê versão, datas, URL, emissor, cobertura e limitações. Portanto, ausência de vínculo em R1 é lacuna de conteúdo, não ausência dessas estruturas.
- A [migration de produto/fonte V2](../../supabase/migrations/20260608090000_sanitario_protocol_product_source_v2.sql) e esses tipos não oferecem atributo dedicado de concentração normalizada, frequência de reaplicação ou catálogo completo de contraindicações/indicações por agente. Há texto/limitações/metadados existentes. Isso delimita o recorte inspecionado; não prova ausência em todos os outros contratos do sistema.
- `WithdrawalRuleV2` distingue `period`, `zero`, `unknown`, `not_applicable` e `not_permitted`, mas usa uma aplicabilidade comum ao objeto que pode conter carne/leite. Nesta fonte, o prazo para carne e a restrição leiteira exigem preservar contextos separados; não condensar ambos em uma regra genérica. A tarefa não define nova modelagem nem cria regras.
- `SanitaryEvidenceStatusV2`, `status_curatorial` e aprovação de protocolo são conceitos distintos. As quatro classificações desta matriz são rótulos documentais, sem conversão automática para enums ou estados persistidos.

**INFERÊNCIAS e riscos operacionais prioritários:**

1. Uma bula com aprovação interna antiga, mesmo hospedada pelo fabricante e coerente com o portfólio, pode não ser a última versão autorizada. A situação regulatória continua não comprovada.
2. Transformar proteção residual em reaplicação, proibição de leite em carência zero, ou autorização bovina em bubalina produziria decisão técnica sem suporte. Nenhuma dessas transformações foi feita.
3. Interpretar cadastro publicado ou protocolo `approved` como produto validado contornaria o processo de curadoria e os snapshots factuais. R1 mantém `review_only=true`, `approved_for_catalog=false`, `operational_authorization=false`, `allows_agenda_auto=false` e `automatic_product_selection_authorized=false`.

## 6. Recomendação e decisões pendentes

**RECOMENDAÇÃO ATUALIZADA:** aproveitar os campos explícitos de T1 como informação documentada. Não alterar o status persistido nesta tarefa. Não exigir consulta individual de registro, certificação de última versão ou revisão humana para a simples transcrição; decisões operacionais mantêm seus requisitos próprios.

Correções documentais propostas, **não aplicadas aos documentos canônicos ou ao payload histórico**:

1. Em futura ficha curatorial, preservar a razão social, formulação, apresentações e localizadores T1 por campo; acrescentar a ressalva de antiguidade e manter prova da versão consultada. Não reescrever R1/R2, que documentam a publicação histórica.
2. Explicitar que P11 não tem intervalo periódico comprovado e que leite representa restrição de uso. Separar certificado vigente, bula identificada, status curatorial e autorização operacional em qualquer narrativa derivada.
3. Registrar este item como caracterização documental reaproveitada no consolidado F6. Não mudar o estado persistido do produto por este relatório.

Lacuna documental relevante: não há intervalo fixo de reaplicação expresso em T1. Essa ausência não impede aproveitar os demais campos. Investigação cadastral adicional fica reservada a inconsistência concreta ou evidência de irregularidade. Qualquer futura persistência, publicação ou decisão operacional exige escopo e autorização próprios.

Panacur 10% (P13) e Eprecis (P38), antes sugeridos como próximo lote, foram incluídos no consolidado F6, reutilizando as identidades de R1. Os três retidos continuam excluídos. A pesquisa documental não depende da conclusão global de I01/I02; mudança de ownership, schema ou writer permanece fora deste recorte.

## 7. Verificações e limites da entrega

Executadas nesta tarefa:

- Branch, HEAD, merge-base, main remota, lista de worktrees, status tracked/staged/untracked e diff preexistente inspecionados.
- JSON F6/F9 lidos; SHA-256 exato de R1 comparado com R2; contagem 39, unicidade P11, coleções técnicas vazias e exclusão P04/P10/P35 conferidas.
- Contratos canônicos sanitários, backlog C02 e diagnóstico de 25/10 confrontados com os artefatos e tipos diretamente pertinentes.
- Bula T1 baixada e renderizada com Poppler; ambas as páginas inspecionadas visualmente. Extração pypdf retornou páginas sem texto; metadados e hash foram obtidos. Cópias de trabalho ficaram em diretório temporário, sem inclusão no repositório.
- Fontes oficiais do fabricante e documentação normativa consultadas; inspeção do CSV N3 confirmou que sua estrutura não comprova o registro individual do medicamento.
- `git diff --check` e `git diff --cached --check` retornaram saída 0. Como o relatório é untracked, uma conferência Python separada verificou nele ausência de whitespace final, os três links locais e as 21 linhas classificadas da matriz; também repetiu as asserções de hash, identidade, contagem, coleções vazias e exclusão dos retidos, sem falhas. Não são testes do produto.
- Status final observado: os mesmos 13 tracked modificados e sete untracked preexistentes, acrescidos somente deste relatório untracked; nada staged.

Não executados: consulta ao catálogo remoto, certificação regulatória individual, testes de runtime, build, E2E ou regressão global. O escopo é documental e não modifica comportamento. Não foram criados campos, migrations, fontes persistidas, regras operacionais, Eventos, Agenda ou estoque. Não houve alteração de status, publicação, commit, push, PR, merge ou deploy.

Este relatório registra **um produto caracterizado** e mantém sua evidência original. A cobertura dos demais produtos e as exceções estão no consolidado F6. Não concede aprovação operacional nem cria exigências cadastrais adicionais.
