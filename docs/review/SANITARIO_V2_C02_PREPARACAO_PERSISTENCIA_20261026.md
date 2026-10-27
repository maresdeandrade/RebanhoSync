# C02 — INTEGRAÇÃO TÉCNICA E PREPARAÇÃO DE PR

26/10/2026. **P11 revisado e caminho local ampliado aos 38 produtos restantes, no escritor existente.** PostgreSQL 17.6 descartável: 592 creates + 38 updates + 22 skips, partindo do piloto persistido e de uma fonte/cobertura equivalentes. Replay: 652 skips. Nenhuma promoção curatorial/operacional ou conexão remota.

**Resultado vigente: seção 11.** A seção 10 preserva a expansão local anterior. As seções 1–8 registram a preparação histórica e a seção 9, o piloto anterior. As limitações históricas sobre ausência de entrada C02, ausência de SQL e exclusividade P11 foram superadas localmente pela implementação descrita na seção 10. Não se declara C02 globalmente concluída, curadoria completa de todos os campos ou caminho remoto autorizado.

## 1. Baseline e escopo

- Branch `codex/sanitario-v2-functional-validation`; HEAD `1a4a72c4fb65a448b628659fc341ca13fc8e0286`; main remota confirmada por `git ls-remote` em `6f1b8dcec93254d60be73757a6515193240e208c`.
- Worktree atual e os três worktrees adicionais preservados. Working tree iniciou com os mesmos 13 tracked modificados e sete untracked em `src/lib/testFarm/`, além dos dois relatórios C02 já produzidos; staged vazio.
- Pesquisa anterior reutilizada do [consolidado F6](SANITARIO_V2_C02_LOTE_F6_CONSOLIDADO_20261026.md) e da [ficha P11](SANITARIO_V2_C02_PRIMEIRO_PRODUTO_20261026.md). Identidades e recibos F6/F9 reaproveitados; nenhum hash histórico, consulta MAPA ou publicação foi repetido.
- Investigação externa limitada a P05, P06, P34, P40 e P41. A diferença em P33 apareceu incidentalmente na página adjacente à ficha P34 do catálogo oficial; foi registrada sem abrir pesquisa adicional do produto.
- Skills aplicadas: `sanitario-catalogo-regulatorio-compliance`; apoio Supabase para leitura dos contratos existentes; reconciliação documental conforme o procedimento já carregado. Não foram alterados schema, migrations, RLS, RPC, writers ou runtime.

## 2. Resultado das lacunas prioritárias

| Produto/campo | Evidência nova, em 26/10 | Resultado e decisão de preparação |
| --- | --- | --- |
| **P05 — esquema neonatal** | [Resumo MSD](https://www.msd-saude-animal.com.br/produto/covexin-9/), tabela após “Crias de mães não vacinadas”; HTML bruto obtido. A mesma célula contém três idades sem separadores estruturais; a célula seguinte traz três volumes separados por `<br>`. Não há três linhas idade/dose. | **Não resolvido por insuficiência de associação explícita.** Não converter ordem textual em associação garantida nem criar três regras. Preservar esquema neonatal como trecho documental com limitação; manter aproveitáveis os demais campos, inclusive a dose geral bovina de 3 mL SC. A versão resumida do resultado de busca omite a tabela e não resolve a associação. |
| **P06 — via** | [Publicação do perfil MSD Saúde Animal](https://pt.linkedin.com/posts/msdsaudeanimal_com-uma-%C3%BAnica-aplica%C3%A7%C3%A3o-subcut%C3%A2nea-bovilis-activity-6727953656945106944-SjCV), abertura sobre Bovilis Poli-Star T, explicita aplicação subcutânea. O resumo da bula já lido não expressa a via. | **SC documentada em comunicação do fabricante.** Pode ser transcrita com essa proveniência. Para o contrato de regra crítica, não rotular postagem como `bula`/`SIM_BULA`: fonte de apoio, `bibliografia`/`apoio`, enquanto não houver fonte forte correspondente. Isso retém somente a materialização da regra crítica de via/dose, não a ficha do produto. |
| **P34 — carências** | [Catálogo Zoetis 2025][Z2025], página impressa e PDF **26**, ficha Ripercol L Injetável, “Período de carência e precauções”. Arquivo baixado e trecho extraído localmente porque a ferramenta web recusou o tamanho. | **Documentadas: abate 4 dias; leite 24 horas após última aplicação.** A mesma ficha descreve bovinos e via SC. O catálogo histórico usado antes descrevia bovinos/suínos e SC/IM; há diferença real de escopo entre documentos. Preparar o recorte bovino SC da ficha 2025, com proveniência; não herdar suíno/IM nem atribuir irregularidade. A seleção de uma regra histórica incompatível fica retida, sem bloquear os novos campos explícitos. |
| **P41 — carências** | [Resumo MSD](https://www.msd-saude-animal.com.br/produto/butox-p-ce25/), HTML bruto e conteúdo público consultados; nenhum quadro de carência ou link para bula técnica integral localizado. | **Não resolvidas com fonte oficial suficiente.** Resultados comerciais apresentaram prazos contraditórios e não foram promovidos a prova. Nenhum prazo ou zero será preparado. Nome, ativo, apresentação e diluição documentados continuam aproveitáveis. Não houve consulta MAPA. |
| **P40 — composição** | [Bula oficial COMBO 5 L P12163 V00][COMBO5], p.1, fórmula. A extração do documento expressa cipermetrina 5,0 g, clorpirifós 7,0 g e butóxido de piperonila 1,0 mL/100 mL; o resumo indexado do mesmo arquivo apresenta a última unidade como g. | **Parcialmente resolvida:** cipermetrina 5 g e clorpirifós 7 g por 100 mL podem ser documentados. BPO tem quantidade 1, mas a unidade precisa de leitura visual do original: conflito de extração, sem prova de mudança da formulação. Não converter mL em g nem apresentar os dois como equivalentes. O download direto retornou 403; a ferramenta web disponibilizou texto, mas não uma imagem inspecionável nesta execução. |

**Conflitos reais surgidos nesse recorte:**

- **P40, carências:** [texto técnico Ceva sobre berne][BERNE] informa 6 dias para abate e 24 h para leite; o rótulo P50316 V103 já lido no consolidado informa 74 dias e restrição leiteira. O novo PDF 5 L não trouxe carência no texto extraído. **Reter somente a escolha/materialização de carências P40**, conservar ambos os documentos e pedir esclarecimento técnico específico do detentor se necessário. Não escolher automaticamente o menor prazo, o maior prazo ou o documento com nome aparentemente mais recente. A fórmula e os demais campos documentados continuam aproveitáveis.
- **P33, leite:** [catálogo histórico Zoetis][ZANTIGO], página impressa 84, informa 48 h; [catálogo 2025][Z2025], p.25, informa 3 dias. O mesmo trecho novo identifica a equivalência em levamisol **base**, enquanto o antigo escrevia cloridrato. Não realizar conversão de sal adicional nem escolher uma carência por inferência. **Retenção do leite P33 e da equivalência farmacológica**, sem impedir cadastro, fontes, apresentação ou demais dados. Não foi investigado fora da leitura adjacente já necessária.

Esses achados atualizam o veredito histórico “nenhuma divergência técnica positiva identificada”. Não são uma declaração de irregularidade regulatória nem razão para reconfirmar todos os registros.

## 3. Papéis empresariais

| Produto | Valor genérico F6 | Papel expresso na fonte já lida | Preparação sem schema novo |
| --- | --- | --- | --- |
| P23 BOTULINOMAX | `fabricante=Ceva` | Bula T00016 V301: proprietário Ceva Saúde Animal; fabricante Labovet Produtos Veterinários Ltda. | Propor `fabricante=Labovet Produtos Veterinários Ltda.`; preservar proprietário/grupo e referência da bula nas notas documentais/`metadata.semantic_review_notes`, chave já existente no F6. |
| P37 Puritec Gold | `fabricante=Ceva` | Bula P10015 V09: proprietário/fabricante Sespo Indústria e Comércio Ltda., grupo Ceva. | Propor `fabricante=Sespo Indústria e Comércio Ltda.`; manter a relação com Ceva na nota existente. |
| P39 FLURON Gold | `fabricante=Ceva` | Cartucho P11974 V02: proprietário Sespo, grupo Ceva; fabricante Ipanema Indústria de Produtos Veterinários Ltda. | Propor `fabricante=Ipanema Indústria de Produtos Veterinários Ltda.`; proprietário/grupo na nota existente. |

Não mudar nome, UUID, product_key ou registro por essa qualificação. São propostas documentais; nenhum dos três cadastros foi atualizado. Não foram criados campos `proprietario`, `grupo` ou nova entidade empresarial.

## 4. Matriz de mapeamento canônico

Contratos consultados: [tipos de produto](../../src/lib/sanitario/rules/sanitaryProductV2.ts), [tipos de fonte](../../src/lib/sanitario/rules/sanitarySourceV2.ts), [migration ativa de produto/fonte](../../supabase/migrations/20260608090000_sanitario_protocol_product_source_v2.sql), [validador de artefatos](../../scripts/codex/sanitario-v2-contract.mjs) e [planner/importador](../../scripts/codex/import-sanitario-protocols-v2.mjs). A nomenclatura abaixo é a existente, não um contrato novo.

| Dado documental | Coleção/tabela existente | Mapeamento/limite |
| --- | --- | --- |
| Identidade, nome, fabricante, ativo e apresentação | `product_rows` → `sanitario_produtos_v2` | UUID F6 preservado; `nome_comercial`, `fabricante`, `principio_ativo`, `apresentacao`; composição/concentração podem ser expressas no texto de `principio_ativo`, preservando unidade original. Não há necessidade de normalizar cada componente em nova tabela. |
| Registro expresso na bula | `registro_orgao`, `registro_numero`; menção já existente em metadata | **Representável no schema, mas não atualizar cegamente pelo planner atual:** a identidade natural de produto inclui nome+órgão+número, e trocar null por número no mesmo UUID é rejeitado como outra identidade. Manter a menção documental atual até preparar uma operação específica autorizada que preserve identidade. Isso não pede reconfirmação MAPA. |
| Bula, emissor, versão, publicação/acesso, URL, jurisdição, limitações | `source_rows` → `sanitario_fontes_tecnicas_v2` | `kind`, `scope`, `fazenda_id`, `title`, `issuer`, `version`, `published_at`, `accessed_at`, `url`, `jurisdiction_country`, `strength`, `evidence_status`, `limitations`, `metadata`. Data de arte interna não vira data de registro ou vigência. Fonte global: `scope=global`, `fazenda_id=null`. |
| Prova específica por campo | `coverage_rows` e `product_source_rows` | `sanitario_fonte_cobertura_campos_v2` e `sanitario_produto_fontes_v2`; chaves de campo existentes como `dose`, `route`, `species_authorization`, `presentation`, `withdrawal`; cobertura não se presume a partir da URL genérica. Localizador e limite no documento/notas existentes. |
| Espécie, aptidão e restrições aplicáveis | `product_authorization_rows` → `sanitario_produto_especie_autorizacao_v2` | `species_code`, `aptitude`, `sexo`, `idade_min_dias`, `idade_max_dias`, `lactacao_permitida`, `gestacao_permitida`, `requires_mv_responsavel`, `limitations`, `metadata`. Usar somente o contexto expresso. Não converter meses em dias por fator arbitrário; não agregar ovino/caprino/suíno em `outro` como se fossem uma autorização equivalente; bubalino não herda bovino. |
| Dose/via por produto/contexto | `dose_rule_rows` → `sanitario_produto_dose_rules_v2` | `route`, `dose_quantity`, `dose_unit`, `dose_basis`, espécie/aptidão, limites de peso e `limitations`; status `precisa_validar`. Para base por peso, normalização aritmética explícita é possível: 1 mL/50 kg = 0,02 mL/kg. Não deduzir frequência da duração da eficácia. |
| Carência carne/leite | `withdrawal_rule_rows` e `withdrawal_source_rows` | `sanitario_produto_carencia_rules_v2` e `sanitario_produto_carencia_fontes_v2`; dias/horas separados, `applicability=period/zero/not_permitted/unknown/not_applicable`. Separar contexto de carne do leite quando a semântica diverge; `mista` não é inferida. Zero exige fonte explícita. Ausência fica ausente, sem substituir por zero. |
| Indicações, contraindicações, intervalos e detalhes sem atributo dedicado | Texto existente de produto e `limitations`/notas da fonte/regra pertinente | Preservação documental, sem interpretar texto livre/metadata como regra crítica ou criar nova agenda/protocolo. Recorrência vacinal não cabe integralmente numa dose simples: manter documentada e não alterar protocolos nesta tarefa. |
| Diluição em água e limite de volume por ponto | Documento e `limitations` | P41 exige volume por calda e técnica de pulverização; isso não equivale às bases existentes `animal/kg_peso_vivo/dose`. P40 tem teto de volume contextual. Não reduzir esses dados a uma regra linear que perca o limite ou a base. |

**Pode avançar sem migration:** campos textuais de produto, fontes, cobertura/vínculos, autorizações documentais e regras que caibam integralmente nos tipos atuais. **Representável não equivale a autorizado nem já persistido.** Produtos/regras continuam `precisa_validar`; piloto mantém espécie em `PRECISA_VALIDAR`, sem novo estado. Dados de apoio continuam de apoio; não viram `SIM_BULA` por conveniência.

O reader [executedProductTechnicalSnapshotV2.ts](../../src/lib/sanitario/execution/executedProductTechnicalSnapshotV2.ts) exige produto `ativo` e filtra regras de dose `ativo`. O piloto preserva estados pendentes e flags operacionais false; não cria fatos nem carência ativa.

## 5. Inventário aproveitável por produto

O [inventário CSV de 39 linhas](evidence/SANITARIO_V2_C02_FIELD_INVENTORY_20261026.csv) conserva código, UUID, product_key, nome, fontes e os destinos canônicos por família de campo para **cada produto**, com carência por finalidade e retenções explícitas. Os valores completos já documentados continuam no consolidado, identificado por Pxx; o CSV é inventário de preparação, não um novo catálogo de runtime ou arquivo autorizado para importação.

Para todos os 39 podem ser preparados os campos comerciais/documentais sustentados, sem esperar completude de dose/carência. Regras e autorizações entram somente no contexto coberto; nenhuma célula “não informado” cria regra zero. São retidos separadamente P05 neonatal, P06 regra crítica de via enquanto a evidência é apenas de apoio, P33 leite, P40 unidade BPO/carências e P41 carências/normalização de diluição. P34 passa a ter carências bovinas SC com a fonte 2025.

## 6. Piloto canônico e simulação local

Artefatos:

- [Candidata P11](evidence/SANITARIO_V2_C02_P11_REVIEW_CANDIDATE_20261026.json): contrato `13.0.0-canonical-contract`, UUID de produto F6; novos UUIDs propostos estáveis por UUIDv5/namespace URL e chave semântica de P11. São identidades propostas para linhas novas, sujeitas a confronto com o destino antes de escrita.
- [Harness reproduzível](evidence/SANITARIO_V2_C02_DRY_RUN_20261026.mjs): invoca apenas o validador e `buildPlan` existentes, sem chamar o writer. O módulo importador não inicia sua CLI quando importado.
- [Resultado observado](evidence/SANITARIO_V2_C02_DRY_RUN_RESULT_20261026.json), incluindo hash da candidata, operações e limites.

Comando executado:

```text
node docs/review/evidence/SANITARIO_V2_C02_DRY_RUN_20261026.mjs
```

**Resultado observado, saída 0:** contrato canônico válido; primeira simulação **19 create + 1 update**, replay sobre projeção local **20 skip**. Vinte linhas: 1 fonte, 6 coberturas, 1 produto, 1 autorização pendente, 6 vínculos produto/fonte, 1 dose pendente, 2 carências pendentes e 2 vínculos carência/fonte. A única atualização proposta é o enriquecimento de ativo/apresentação de P11, preservando seus campos e flags de pesquisa; registro canônico continua null para não alterar identidade.

Controles negativos observados: produto preexistente `ativo` rejeita alteração; alteração de registro mantendo UUID é rejeitada; zero sem fonte forte é rejeitado; todos os estados/flags pendentes permanecem. O cliente de simulação recusa qualquer consulta diferente de `SELECT`, não aceita `FOR UPDATE` e não abre conexão. A projeção de replay só altera um segundo objeto em memória.

**Limite exato:** é um **dry-run do planner em memória**, com transporte SQL simulado e fixture histórica P11 F6; assume demais linhas técnicas ausentes apenas para a simulação. Não é a CLI `--dry-run`, nem consulta atual do destino, nem teste PostgreSQL/RLS, atomicidade, CAS ou concorrência. Não se extrapola esse resultado aos outros 38 produtos. Não foram executados `INSERT`, `UPDATE` ou transações em banco local/remoto.

## 7. Plano incremental de persistência técnica

1. **Congelar a candidata de cada incremento.** Reutilizar identidades F6 de produto. Fontes/coberturas/regras novas recebem identidade estável explícita por conteúdo/versão/contexto, conservada no arquivo; repetir o mesmo arquivo conserva IDs. Manter `review_only=true`, `execute_import=false` e autorizações de escrita false até uma autorização específica futura. Publicação F6/F9 permanece histórica e intocada.
2. **Confrontar somente o alvo real do próximo incremento.** Antes de futura escrita, obter snapshot somente leitura das identidades afetadas, estado curatorial, conteúdo e tombstones. Resolver chaves já existentes por fonte/UUID e conferir produto de origem; não assumir que a fixture histórica descreve o banco atual. Reusar fonte já existente quando mesma identidade/versão for comprovada, sem duplicação. Comparar baseline antes de qualquer mutação para não sobrescrever conteúdo concorrente.
3. **Primeiro incremento: fontes/coberturas e campos comerciais sustentados.** Segmentar os 39 em lotes pequenos, começando pelo piloto P11. Preservar campos de metadata desconhecidos e flags, qualificar empresas P23/P37/P39 pelas fontes. Registros novos nos campos canônicos demandam tratamento explícito da identidade pelo writer, não um segundo cadastro do mesmo produto. Não atualizar registros por comando genérico que o planner rejeita.
4. **Segundo incremento: espécie/dose/carência por campo apto.** Inserir somente regras plenamente representáveis e com fonte adequada. Deixar estados pendentes; não ativar produto/regra, protocolo, agenda ou seleção automática. Não materializar conflitos P33/P40 nem o neonatal P05; fonte de apoio P06 não autoriza regra forte. Regras independentes com dados explícitos não aguardam essas exceções. Não converter meses em dias por fator arbitrário nem reduzir limites/diluições a números incompletos. Catálogos e comunicados sem bula identificável devem conservar sua natureza de bibliografia/apoio; seus dados documentais podem ser preservados sem promovê-los a prova forte de execução.
5. **Replanejar e verificar idempotência no banco local descartável antes de pedir aplicação.** Após existir entrada autorizada para C02 no escritor, usar transação, locks/releitura e comparação do baseline do lote; rejeitar identidade ambígua, tombstone ou mudança concorrente. Executar a simulação contra o snapshot local real, depois replay sem duplicatas e controles negativos. Essa etapa SQL ainda não foi feita; não afirmar certificação por causa do dry-run em memória. Não resetar banco/worktree compartilhado.
6. **Somente com autorização futura específica:** revisar diff exato, destino e digest; aplicar a transação do lote pelo escritor canônico, conferir ACK/convergência de IDs/conteúdo e repetir o mesmo pedido em caso de resposta perdida. Falha intermediária deve reverter o lote; sucesso de lote anterior não autoriza o seguinte. Preservar fontes e histórico; não compensar com exclusão destrutiva. O próximo lote é gerado do estado efetivo após o anterior, sem reprocessar toda a curadoria.

**Limitação de integração comprovada:** `buildPlan` consegue projetar as coleções, porém a CLI deste checkout impõe formatos/contagens do pacote 12F10 ou deltas especializados. O caminho `--incremental` trata produtos/fontes como referências e os pula; não é um enriquecedor genérico de produto. A candidata C02 não deve ser passada cegamente a `--review-candidate`, `--incremental`, `--commercial-products` ou `--apply`. Antes de escrever será necessário delimitar uma entrada técnica C02 no writer existente, sob autorização de implementação específica, ou provar uma entrada já suportada que preserve essas condições. **Não é lacuna de schema e nenhum writer foi alterado nesta preparação.**

## 8. Validação e pendências concretas

Executado: estado Git/worktrees/main; leitura dos contratos ativos pertinentes; pesquisa focalizada e inspeção HTML/PDF; validador canônico e simulação/replay/controles negativos do piloto. Não foram repetidos recibos ou pesquisas de outros produtos. As fontes técnicas novas não foram promovidas a prova regulatória de situação cadastral.

Conferência final observada: inventário CSV com 39/39 códigos, UUIDs e product_keys iguais ao F6; retidos ausentes; retenções P33/P40 e valores P34 consistentes; hash da candidata igual ao registrado no resultado; 15 links locais válidos; estrutura e whitespace dos artefatos conferidos por Python sem falhas. `node --check docs/review/evidence/SANITARIO_V2_C02_DRY_RUN_20261026.mjs` e `git diff --check` retornaram saída 0; staged continua vazio. Os 13 tracked modificados preexistentes mantêm o mesmo numstat. Não foram executados testes de runtime ou build, pois não houve alteração de implementação operacional.

Pendências com impacto concreto, agrupadas:

1. **Campos técnicos:** associação neonatal P05, fonte forte da via P06 para regra crítica, unidade BPO e carências P40, carências/diluição P41; conflito do leite P33. Cada retenção é por campo, não pelo produto inteiro.
2. **Escritor/identidade:** entrada técnica C02 e tratamento controlado do enriquecimento de registro, sem modificar identidade ou sobrescrever estados curados; snapshot efetivo/concorrência devem ser confrontados antes de escrita.
3. **Validação de aplicação:** transação/dry-run SQL/replay no ambiente local descartável e posterior autorização de destino/lote. A simulação atual cobre somente o planner P11.

Nenhuma exigência de reconfirmação MAPA, última versão universal ou revisão humana para transcrição foi reintroduzida. Não houve commit, push, PR, merge, deploy ou escrita remota. A preparação termina nos documentos e artefatos locais vinculados, sem aprovação operacional.

## 9. Implementação e validação local P11 — registro anterior

### Arquivos alterados nesta execução

- [Escritor canônico](../../scripts/codex/import-sanitario-protocols-v2.mjs): entrada CLI `--c02-p11`, validação restrita, proteção de baseline/metadata e reutilização da transação existente.
- [Testes focados C02](../../tests/codex/sanitario-c02-p11.test.mjs): nove casos pela CLI, sem nova API pública de writer/validador.
- [Ensaio SQL reproduzível](../../tests/codex/sanitario-c02-p11.local.mjs): fixture local própria, dry-run, aplicação, concorrência, replay e controles negativos.
- [Resultado SQL observado](evidence/SANITARIO_V2_C02_P11_SQL_RESULT_20261026.json): PostgreSQL, digest da candidata, contagens e doze verificações observadas.
- Este relatório e o [consolidado C02](SANITARIO_V2_C02_LOTE_F6_CONSOLIDADO_20261026.md): atualização do resultado P11 sem abrir nova fase ou gate independente.

A candidata e o resultado anterior em memória permanecem inalterados e identificados como evidência anterior. Nenhum recibo F6/F9, migration, RLS, RPC, contrato canônico ou modo legado foi modificado. Alterações concorrentes, incluindo novos arquivos de pós-parto já presentes no início, foram preservadas.

### Implementação realizada

O caminho C02 é interceptado separadamente na CLI e aceita somente `--validate`, `--dry-run` ou `--apply-local`, com arquivo `--c02-p11` e porta local explícita para acesso ao banco. O arquivo é conferido pelo SHA-256 da candidata já revisada e pelo validador canônico. O escopo não admite outro produto, dose alterada, duplicação de linhas, promoção de estado ou troca do registro. O hash fixa os bytes da candidata; alterações de conteúdo ou serialização exigem revisão explícita, não são aceitas silenciosamente.

Conexão de banco fixa em `127.0.0.1`, usuário local `postgres`, database `rebanhosync_c02_p11`; exige comentário de banco `C02_P11_DISPOSABLE_LOCAL_ONLY`. Não lê DB_URL/arquivo de ambiente, não recebe hostname/URL, não aceita `--apply` genérico e ignora a autorização genérica de importação remota. A opção `--validate` não abre conexão.

No dry-run SQL, a transação é somente leitura e termina em rollback. Na aplicação local, reutiliza a transação privada existente, advisory lock, leituras `FOR UPDATE`, replanejamento e conferência de convergência antes de commit. O produto P11 precisa existir, estar não tombstonado e continuar `precisa_validar`. Identidade e campos não enriquecidos devem coincidir com a candidata; ativo/apresentação só podem estar vazios ou já iguais ao alvo. Metadata atual é preservada integralmente, inclusive chaves independentes adicionadas após o baseline documental. Estados ou flags operacionais alterados são rejeitados, sem tentar revertê-los.

O plano pode criar/pular as linhas técnicas exatas da candidata e atualizar apenas o enriquecimento P11. Conteúdo técnico existente diferente é rejeitado antes de qualquer escrita. Nenhum novo writer foi exportado; a lista de exports anterior permanece igual. Os modos anteriores passam pela mesma lógica de antes, com a opção C02 desabilitada por padrão.

### Testes e resultados observados

**TDD:** a primeira execução dos testes novos apresentou falhas pela ausência da entrada C02 e do validador. A implementação foi feita depois desse resultado. Uma tentativa de exportar o validador também foi rejeitada pelo teste existente de superfície pública; a exportação foi removida e os testes novos passaram a usar a CLI.

```text
pnpm exec vitest run tests/codex/sanitario-c02-p11.test.mjs tests/codex/sanitario-v2-publisher.test.mjs --maxWorkers=1
```

**162/162 testes passaram**: 9 C02 e 153 do publicador existente. Cobrem candidata íntegra, entrada malformada/adulterada, produto diferente, flags/estado, quantidade, duplicação de regra, registro MAPA, validação sem DB_URL e argumentos remotos/genéricos recusados. A suíte existente verifica os caminhos legados e a ausência de API alternativa de escrita.

```text
node tests/codex/sanitario-c02-p11.local.mjs rebanhosync-c02-p11-sql-2026102602 61452
```

**Saída 0, PostgreSQL 17.6 real:**

1. Dry-run SQL: 19 criações + 1 atualização propostas, snapshot persistido idêntico antes/depois.
2. Falha injetada na tabela de vínculos de carência, depois de escritas anteriores: rollback devolveu todas as oito tabelas e o enriquecimento do produto ao snapshot anterior.
3. Duas aplicações concorrentes: uma fez 19 creates + 1 update; a outra retornou 20 skips, sem rejeição ou duplicidade.
4. Replay explícito: 20 skips; conteúdo e contagens iguais.
5. Preservação de UUID, registro null, metadata adicional/note concorrente, produto/regras `precisa_validar`, espécie `PRECISA_VALIDAR` e flags false; zero protocolos inseridos.
6. Produto curado rejeitado em apply e dry-run; registro alterado, ativo inesperado, regra técnica conflitante e flag operacional preexistente rejeitados sem alteração parcial.
7. Índice ativo de identidade da fonte rejeitou UUID diferente com a mesma chave natural (SQLSTATE 23505); snapshot permaneceu igual.
8. Banco local sem o marcador foi recusado, inclusive com override genérico de importação remota presente no ambiente de teste.

Contagens finais nas oito tabelas, na ordem fonte/cobertura/produto/espécie/vínculo produto/dose/carência/vínculo carência: **1/6/1/1/6/1/2/2**.

O ensaio usa DDL real de tipos, tabelas, constraints e índices das duas migrations ativas indicadas no JSON de evidência. Dependências externas de FK foram montadas como fixtures mínimas. Não certifica RLS, autenticação, triggers de produção ou schema integral do Supabase. Um gatilho exclusivamente de teste foi criado para injetar a falha e desabilitado após o controle; nenhum arquivo de migration foi alterado. A primeira montagem interrompeu por permissão insuficiente desse gatilho; a fixture foi corrigida e toda a bateria final passou em container novo, sem reset/descarte do anterior.

Também executados: ESLint focal nos três arquivos JavaScript, sem apontamentos; `git diff --check`, sem apontamentos. Não foram rodados build, E2E ou regressão global: o delta é uma entrada de importador exclusivamente local, sem alteração de UI/runtime operacional.

### Pendências reais e continuidade

- O caminho implementado é **local e exclusivo do P11**. Não oferece importação remota, não aceita os outros 38 produtos e não libera produto/regra para execução. Nenhum dos conflitos de curadoria dos demais produtos foi reaberto.
- Uso remoto futuro exige autorização e desenho de entrada próprio; não remover hostname/marker/digest para reutilizar este piloto em outro destino. Não foi feita certificação RLS/auth ou implantação completa do Supabase.
- Os containers próprios de ensaio foram parados, com dados preservados; não houve remoção destrutiva de containers, volumes, banco ou arquivos concorrentes. Para repetir o harness é necessário um container/database novo: ele recusa reset de fixture existente.

**Recomendação:** revisar este patch localizado e a evidência SQL P11 antes de decidir um próximo escopo. O aceite local do piloto foi comprovado; isso não autoriza commit, publicação, persistência remota ou expansão aos 38 produtos restantes. Nenhum commit, push, PR, merge ou deploy foi realizado.

## 10. Revisão do P11 e expansão local F6 — resultado vigente

### Decisão, baseline e revisão

Patch local tecnicamente consistente após as correções abaixo. Branch e HEAD permaneceram `codex/sanitario-v2-functional-validation` / `1a4a72c4fb65a448b628659fc341ca13fc8e0286`. Identidades reutilizadas de main conhecida `6f1b8dcec93254d60be73757a6515193240e208c`, sem reconfirmar recibos ou pesquisar os produtos novamente. Worktree, staged vazio e alterações concorrentes em governança, reprodução, UI, auth e offline foram preservados.

Revisão independente do diff P11 e da evidência anterior: nenhum defeito crítico identificado. A ampliação foi feita no mesmo writer e na mesma transação. Na revisão da expansão surgiram dois defeitos médios, corrigidos neste trabalho:

- O guard generalizado inicialmente comparava os campos vazios do P11 com a candidata preenchida. Restaurada a regra original nulo-ou-alvo para o piloto; o F6 compara baseline-ou-alvo. P11 foi reexecutado em PostgreSQL novo: 19 creates + 1 update e replay de 20 skips, com 12 controles observados.
- A candidata expandida omitira ressalvas reprodutivas da coluna de decisões do consolidado para P09/P24/P26. Incluídas literalmente nas limitations de espécie, dose e carência: vacinação prévia IBR/BVDV em 12 meses para P09; restrições de prenhes/amamentação/contato até 30 dias para P24; segurança da fração bacteriana não estabelecida em prenhes para P26. Teste reproduziu a omissão antes da correção. Revisão independente confirmou o ajuste e encerrou o achado.

Também foi corrigida, antes de executar a candidata, a atribuição das composições/carências P36/P38: as regras e vínculos apontam ao texto/comunicado técnico oficial correspondente, sem atribuir sua leitura à bula não extraída.

### Implementação e arquivos afetados

| Arquivo | Delta neste trabalho |
| --- | --- |
| [Writer canônico](../../scripts/codex/import-sanitario-protocols-v2.mjs) | Entrada `--c02-f6`, guard compartilhado localizado, reuso de fontes/coberturas equivalentes, mantendo `--c02-p11` e todos os modos legados. Sem novos exports. |
| [Candidata F6](evidence/SANITARIO_V2_C02_F6_REVIEW_CANDIDATE_20261026.json) | Pacote fechado dos 39 UUIDs F6; baseline histórica explícita; P11 integralmente reaproveitado; retenções por campo. |
| [Testes F6](../../tests/codex/sanitario-c02-f6.test.mjs) | Dez casos: identidade, exclusão dos retidos, campos retidos, compatibilidade P11, ressalvas, adulteração e recusa de argumentos remotos/genéricos. |
| [Harness SQL existente](../../tests/codex/sanitario-c02-p11.local.mjs) | Mesmo harness aceita escopo opcional `f6`; fixture P11 já persistido, fonte/cobertura equivalentes com outro UUID/key e notas próprias; controles positivos e negativos. |
| [Evidência SQL F6](evidence/SANITARIO_V2_C02_F6_SQL_RESULT_20261026.json) | Resultado real final, contagens, versão PostgreSQL, digest e controles observados. |
| [Evidência SQL P11](evidence/SANITARIO_V2_C02_P11_SQL_RESULT_20261026.json) | Atualizada pela reexecução local após generalizar o guard, sem alterar a candidata P11. |
| Este relatório e [consolidado C02](SANITARIO_V2_C02_LOTE_F6_CONSOLIDADO_20261026.md) | Reconciliação do resultado vigente; nenhuma nova fase documental. |

A candidata F6 tem SHA-256 **6270981bb7c2f8e22eb547c8512f788d8191e7015e912cf62d5abd2350351367**. O digest fixa os bytes revisados e o validador canônico verifica os contratos existentes. Não há novo schema, estado, migration, RLS, RPC, writer paralelo ou contrato de execução. Os três candidatos retidos P04/P10/P35 seguem ausentes.

A conexão F6 é fixa em `127.0.0.1`, database `rebanhosync_c02_f6`, marcador `C02_F6_DISPOSABLE_LOCAL_ONLY` e porta explícita. P11 mantém seu database/marcador próprios. Não lê DB_URL, hostname, arquivo de ambiente ou escape remoto; `--validate` não conecta. `--apply` genérico e argumentos de host são recusados. Esse caminho é exclusivamente de ensaio local.

Produtos precisam existir, continuar pendentes, não tombstonados, com identidade correspondente ao F6. Princípio/apresentação/fabricante só mudam do baseline conhecido para o alvo documentado ou permanecem no alvo já aplicado. UUID, nome, classe/tipo, registro, metadata integral atual e flags false são preservados. P23 passa a fabricante físico Labovet; P37, Sespo; P39, Ipanema. Proprietário/grupo e proveniência permanecem nas limitações/fontes, sem eliminar metadata histórica Ceva.

Fontes do próprio pacote são deduplicadas por URL. No banco, o reuso exige fonte global equivalente em URL, versão, tipo, força, estado de evidência, jurisdição e limitações. Mantém ID/key, título, emissor, datas e metadata existentes, reescrevendo apenas as referências da candidata em memória. Cobertura equivalente mantém ID e notas existentes. Ambiguidade, tombstone e diferenças de conteúdo são rejeitados, sem fusão ou sobrescrita. Conteúdo técnico já existente diferente também é rejeitado; não há atualização silenciosa de dose/carência.

Dry-run usa transação read-only e rollback. Apply local usa o advisory lock existente, locks de produtos em ordem estável, replanejamento sob FOR UPDATE e verificação de convergência antes de commit; qualquer falha reverte o lote inteiro. As regras ficam `precisa_validar`, espécies `PRECISA_VALIDAR`, autorizações false. Zero protocolos/Agenda/Eventos/estoque criados.

### Resultados observados

TDD: a entrada F6 nova apresentou cinco falhas por ausência do caminho; após a implementação, passou. O teste das ressalvas P09/P24/P26 falhou antes do ajuste e passou depois. Resultado final:

```text
pnpm exec vitest run tests/codex/sanitario-c02-f6.test.mjs tests/codex/sanitario-c02-p11.test.mjs tests/codex/sanitario-v2-publisher.test.mjs --maxWorkers=1
```

**172/172 passaram**: 10 F6 + 9 P11 + 153 do publicador legado. ESLint focal nos quatro JavaScript envolvidos e node --check do writer/harness: saída 0. Git diff --check: saída 0; staged vazio. Build, E2E e regressão global não executados: alteração localizada de CLI, sem impacto identificado no aplicativo operacional.

```text
node tests/codex/sanitario-c02-p11.local.mjs rebanhosync-c02-p11-sql-2026102603 63338
node tests/codex/sanitario-c02-p11.local.mjs rebanhosync-c02-f6-sql-2026102604 63426 f6
```

Ambos retornaram **saída 0**, PostgreSQL 17.6. A execução final F6, com o digest acima, observou:

| Controle | Resultado |
| --- | --- |
| Dry-run, com P11 já persistido | 592 creates + 38 updates + 22 skips; snapshot persistido idêntico. Os 22 skips são as 20 linhas P11 e fonte/cobertura equivalentes. |
| Apply concorrente | Uma aplicação fez o enriquecimento; a segunda serializou pelo lock e retornou 652 skips, sem duplicidade. |
| Replay explícito | 652 skips; snapshot das oito tabelas inalterado. |
| Falha intermediária SQL injetada no vínculo de carência | Todas as escritas anteriores e enriquecimentos revertidos; snapshot igual ao anterior. |
| UUID/metadata/registro/estados | Conferidos nos 39 produtos, inclusive notas adicionais na fixture simulando atualização concorrente; campos enriquecidos iguais à candidata; autorizações pendentes e flags false preservadas. |
| Vacina/antiparasitário | Conferência SQL de P05 3 mL SC e P13 5 mg/kg oral, além de contagens e replay de todas as regras; campos retidos ausentes. |
| Fonte/cobertura equivalentes | ID/key, título, metadata e notas preexistentes mantidos; uma fonte por URL na fixture. |
| Conflitos de evidência | Fonte com força diferente, fonte ambígua, tombstone e cobertura incompatível rejeitados sem escrita parcial. |
| Conflitos de produto/regra | Produto curado em apply/dry-run, registro alterado, composição inesperada, dose conflitante e autorização true rejeitados sem sobrescrita. |
| Duplicidade/destino | Índice de identidade recusou chave duplicada (23505); banco sem marcador recusado mesmo com override remoto genérico no ambiente. |

Contagens finais: **41 fontes, 206 coberturas, 39 produtos, 39 autorizações pendentes por espécie, 212 vínculos de produto, 39 regras pendentes de dose, 38 de carência e 38 vínculos de carência**. São linhas por contexto/via, não quantidade de produtos aprovados.

DDL de tabelas/tipos/constraints/índices foi extraído sem alterações das duas migrations ativas identificadas na evidência. FKs externas são fixtures mínimas. O ensaio não certifica RLS/auth, triggers de produção ou schema completo Supabase. A primeira fixture F6 parou por chave de fonte de teste sem prefixo SRC_; corrigido somente o fixture, sem relaxar constraint. Ensaios subsequentes acompanharam a evolução do patch; resultado final corresponde à candidata acima. Nenhum banco compartilhado foi resetado; containers próprios de ensaio foram parados com dados preservados.

### Retenções, limites e continuidade

| Produto | Somente campos retidos |
| --- | --- |
| P05 | Associação neonatal idade/volume. Dose geral bovina preservada. |
| P06 | Regra crítica de dose/via: SC consta em apoio, não na bula consultada. Restante caracterizado. |
| P33 | Carência leiteira 48 h versus 3 dias, equivalência sal/base e dose condicional para infestação grave. Dose geral e carne aproveitadas. |
| P40 | Unidade BPO, escolha de carências conflitantes e regra de dose que perderia teto de 60 mL acima de 600 kg. Composição legível, apresentação e demais informações preservadas. |
| P41 | Concentração/carências ausentes; dose em diluição/volume de calda não reduzida artificialmente ao contrato por animal/kg. |
| P38 | Leite zero documentado em comunicação de apoio, sem materializar regra zero que requer fonte forte no contrato. Carne permanece documentada. |

As demais ausências não viraram zeros, irregularidades ou exigência de completude universal. Não foram inferidos intervalos de reaplicação a partir de duração de eficácia, conversões sal/base, meses em dias, espécies adicionais ou permissões gestacionais. O inventário e o consolidado anteriores permanecem a base documental; não houve repetição da curadoria.

**Recomendação:** manter esta entrada restrita ao ensaio local e aproveitar a candidata consolidada para a próxima decisão explícita de persistência. Resolver somente os campos retidos que sejam necessários ao uso pretendido. Não remover proteções locais para apontar o comando a outro destino. Um destino remoto, sua autorização e validação de integração não fazem parte deste aceite local.

Nenhum impedimento crítico remanescente foi identificado no escopo testado. A caracterização e o ensaio local dos 39 produtos não os aprovam nem encerram C02 globalmente. Não houve commit, push, PR, merge, deploy, pesquisa MAPA ou operação no banco remoto.

## 11. Integração sobre main e preparação de PR — resultado vigente

### Resultado e isolamento

Patch isolado no worktree `C:/Users/mares/.codex/worktrees/c02-f6-pr-preparation/GestaoAgro`, branch `codex/c02-f6-local-integration`, HEAD/base `6f1b8dcec93254d60be73757a6515193240e208c`. Main vigente confirmada por `git ls-remote origin refs/heads/main`. Nenhum commit foi criado. O checkout original em `C:/Users/mares/dyad-apps/GestaoAgro`, seus arquivos C02 e alterações concorrentes foram preservados.

Foram selecionados somente 14 arquivos exclusivos do C02: writer, três testes, três relatórios e sete artefatos de evidência. Acrescentou-se uma evidência SQL de integração: **15 arquivos no diff final**. Nenhum arquivo de UI, reprodução, offline, auth, governança, configuração ou dependência foi incorporado. Os sete artefatos anteriores foram copiados byte a byte e preservados; não houve repetição da pesquisa documental.

A main contém melhorias comerciais/TLS ausentes no checkout antigo. A integração reaplicou somente os trechos C02, conservando `commercialProductsOnly`, os bloqueios de atualização comercial, conexão e TLS da main. A revisão independente não encontrou regressão no writer integrado nem no modo adicional do harness. A correção final do recibo, abaixo, recebeu autorrevisão e teste de regressão; a tentativa de revisão independente desse último ajuste foi interrompida por limite de uso do agente.

### Correções comprovadas

- **Recibo SQL:** `summaries.find(s => s.skip)` podia selecionar a primeira aplicação F6, que já tem 22 skips, como replay. O harness agora grava o resumo do replay explícito e exige create/update/reject zero e 652 skips. Teste reproduziu o JSON incorreto antes da correção. A evidência de integração foi regenerada por execução real em banco novo; os recibos SQL anteriores permaneceram inalterados.
- **Fixture de integração:** o primeiro bootstrap tentou aplicar comentários sobre tabelas legadas ausentes. O recorte exclui somente esses comentários externos; políticas e triggers sanitários permanecem integrais. Bootstrap passou a ser transacional. Não se alterou migration nem constraint para viabilizar teste.

### Validação e compatibilidade SQL

```text
node node_modules/vitest/vitest.mjs run tests/codex/sanitario-c02-f6.test.mjs tests/codex/sanitario-c02-p11.test.mjs tests/codex/sanitario-v2-publisher.test.mjs --maxWorkers=1
node node_modules/eslint/bin/eslint.js scripts/codex/import-sanitario-protocols-v2.mjs tests/codex/sanitario-c02-p11.local.mjs tests/codex/sanitario-c02-p11.test.mjs tests/codex/sanitario-c02-f6.test.mjs
node tests/codex/sanitario-c02-p11.local.mjs rebanhosync-c02-f6-sql-2026102613 63053 f6 integration
```

**216/216 testes focados passaram** (196 da main, 9 P11, 11 F6). O pnpm recusou o diretório de dependências compartilhado antes de alterá-lo; os binários já instalados foram executados diretamente por Node. Package/lockfiles não mudaram, não houve reinstalação. Node --check do harness e lint focal também foram executados.

[Resultado SQL da integração](evidence/SANITARIO_V2_C02_F6_INTEGRATION_SQL_RESULT_20261026.json): saída 0, PostgreSQL 17.6, **16 controles observados**. Mantém o digest da candidata F6 `6270981bb7c2f8e22eb547c8512f788d8191e7015e912cf62d5abd2350351367`.

| Verificação | Resultado observado |
| --- | --- |
| Dry-run / primeira aplicação | 592 creates, 38 updates, 22 skips; dry-run sem mudança persistida. |
| Concorrência / replay explícito | Aplicações serializadas; replay com 0 creates, 0 updates, 652 skips, 0 rejects; snapshot igual. |
| Rollback / conflitos | Falha intermediária reverteu todas as oito tabelas; conflitos de identidade, conteúdo, estado, fonte e cobertura recusados sem escrita parcial. |
| Integridade documental | 39 UUIDs, metadata integral, estados pendentes, flags false e retenções individuais preservados; fonte/cobertura equivalentes reaproveitadas. |
| Modelo administrativo real | Sessão postgres, rolsuper=false, rolbypassrls=true; oito tabelas com owner postgres, RLS habilitada e FORCE RLS ausente. |
| Triggers e ACL | Triggers updated_at e policies sanitárias ativos; matriz de 24 combinações role/tabela conferida; authenticated/service_role sem INSERT/UPDATE/DELETE técnico, anon sem SELECT; tentativas SQL negadas com 42501. |

O modo opcional `f6 integration` aplica DDL/policies/triggers sanitários e helpers canônicos de base, projetando a ACL F24 somente nas oito tabelas técnicas da fixture. A sessão administrativa é compatível com esse modelo; isso não oferece caminho de escrita por papel de API. As dependências externas de tenant/auth continuam mínimas: auth.uid() retorna null, sem certificação de login Supabase ou isolamento entre tenants. Nenhum contrato, migration, role ou RLS do produto foi modificado.

Build, E2E, regressão global e validador funcional integral Supabase não foram executados: o patch é CLI local, não muda o aplicativo, schema, RPC ou sync; a verificação SQL foi limitada ao caminho efetivamente alterado. Não há alegação de implantação ou validação remota.

### Arquivos e entrega revisável

- Writer: `scripts/codex/import-sanitario-protocols-v2.mjs`.
- Testes: `tests/codex/sanitario-c02-p11.test.mjs`, `sanitario-c02-f6.test.mjs` e `sanitario-c02-p11.local.mjs`.
- Relatórios: este arquivo, `SANITARIO_V2_C02_LOTE_F6_CONSOLIDADO_20261026.md` e `SANITARIO_V2_C02_PRIMEIRO_PRODUTO_20261026.md`.
- Evidências: inventário CSV; dry-run em memória e resultado; candidatas P11/F6; resultados SQL P11/F6 anteriores e novo resultado SQL de integração, todos com prefixo `SANITARIO_V2_C02_` em `docs/review/evidence/`.

Diff completo e proposta de título/corpo do PR são artefatos locais em `C:/Users/mares/.codex/tmp/c02-f6-pr-preparation-20261026/`. O diff inclui untracked por índice temporário externo, sem staging do checkout nem commit. A descrição segue o template atual; nenhum PR foi criado.

### Riscos residuais e decisão

1. Retenções técnicas P05/P06/P33/P38/P40/P41 continuam por campo; não são aprovação ou bloqueio integral dos produtos.
2. O comando continua exclusivamente local, com loopback, banco/marcador e hash fixos; autenticação/tenants e destino remoto não são certificados ou autorizados.
3. Mudança futura da main ou do conteúdo do patch exige conferir o delta correspondente antes de integrar; não transportar o writer antigo por substituição integral.

Recomendação: decidir sobre commit e abertura do PR a partir deste patch isolado. Nenhuma escrita remota, ativação, commit, push, PR, merge ou deploy foi realizada. Containers próprios foram parados com os dados preservados.

[Z2025]: https://www2.zoetis.com.br/content/pt/pages/Microsites/Portifolio-Zoetis-Atacadistas/_assets/Catalogo-Produtos-Marcas-estabelecidas-Zoetis_Bartofil_29042025_1080x2230.pdf
[ZANTIGO]: https://www.zoetis.com.br/global-assets/private/revista-zoetis-net-paginas-mistas-versao-30-01.pdf
[COMBO5]: https://ruminants.ceva.com/app/uploads/sites/16/2023/10/Combo-Pour-on-5L-Bula.pdf
[BERNE]: https://ruminants.ceva.com/app/uploads/sites/16/2023/10/Berne_em_bovinos.docx.pdf
