# Sanitário V2 — fechamento dos 20 itens

Atualizado em: 2026-10-17

## Decisão e escopo

**READY para preparação curatorial e homologação local. Nenhuma autorização operacional concedida.** Os 20 itens foram classificados; 14 têm geração automática demonstrada em fixtures aprovadas exclusivamente para teste, três permanecem como sugestões e três têm bloqueio técnico específico. Apenas B19, no escopo de avaliação genérica, dispõe de evidência suficiente para uma decisão curatorial sem novos insumos técnicos. Os demais candidatos exigem os insumos individualizados abaixo.

Este fechamento substitui o estado de integração pendente do relatório `SANITARIO_V2_COBERTURA_INTEGRAL_20261016.md` e amplia as quatro propostas preliminares de `SANITARIO_V2_PROMOCOES_PREPARADAS_20261016.json`. Ambos permanecem como evidência histórica. A fonte operacional continua sendo o payload canônico 12F10: 10 protocolos, 20 itens, todos com `allows_agenda_auto=false`.

## Integração local verificada

- Main remota verificada: `51fed3705ecfd0dd2a42e78723d833348adc237a`, descendente da baseline informada `b38b7368acec160c2c7a4a14ed745fe47978a8cc`.
- Worktree reutilizada: `C:/Users/mares/.codex/worktrees/sanitario-v2-plano-auto/GestaoAgro`; branch `codex/sanitario-v2-fechamento`.
- Base local anterior preservada: `b7c8c9c9c47f2667667a27a3793145e3aadf24a1`, descendente direto do plano `695d5cb`. O A–E original `81bc897` não é ancestral direto dessa base: foi reaplicado como `7f74aa3`, com patch-id idêntico `ee4f9b4a111f529c8ce6f97e9c850bb778342109`, também preservado em `0098195`. A branch anterior não foi removida.
- Integração por reaplicação limpa dos quatro commits sanitários sobre a main: `fe25d7a → 0920568`, `7f74aa3 → 0098195`, `695d5cb → 916334e`, `b7c8c9c → 3302920`. Nenhum conflito, merge ou push.
- HEAD integrado antes deste fechamento: `3302920426cec53257b2b5dfc4aa8e42e5e2b0e3`. A main atual é ancestral desse HEAD. Runtime sanitário, componentes e E2E são idênticos aos da implementação anterior; as oito alterações de AnimalNovo/registro/atomicidade comercial/Registrar da main foram preservadas integralmente.
- A checkout original, em outra branch e com alterações concorrentes em `.codex/config.toml`, `.fallowrc.json` e `tsconfig.node.json`, permaneceu intocada.

## Matriz obrigatória

“Auto/fixture” significa geração observada com autorização sintética isolada, sem aprovação do catálogo real. “PASS” refere-se ao teste parametrizado de elegibilidade/exclusão e ao teste de rejeição da versão canônica sem autorização, para cada um dos 20 itens, em `sanitaryNormalizedAutomationV2.test.ts`. As letras na coluna de aprovação identificam conjuntos de decisão descritos na próxima seção.

| ITEM | REGRA NORMALIZADA | FONTE SUFICIENTE | AUTOMAÇÃO IMPLEMENTADA | APROVAÇÃO NECESSÁRIA | TESTE | BLOQUEIO RESIDUAL |
|---|---|---|---|---|---|---|
| `b19_femeas_3_8_meses` | Fêmea bovina/bubalina, 3–8 meses; UF e histórico | Sim, avaliação genérica: PNCEBT/Portaria/CIDASC | Auto/fixture | B19 | PASS | Assinatura e vínculos por campo; SC excluída; sem autorização de aplicação |
| `clostridial_primovac_dose1` | Inicial da formulação selecionada | Parcial: FORTRESS7 | Auto/fixture | CLO | PASS | Produto/registro, idade elegível e vínculos operacionais |
| `clostridial_primovac_dose2` | 28–42 dias da primeira dose factual compatível | Parcial: FORTRESS7 | Auto/fixture | CLO | PASS | Mesmo produto, histórico factual e insumos de CLO |
| `clostridial_reforco_anual` | Anual após execução factual compatível | Parcial: FORTRESS7 | Auto/fixture | CLO | PASS | Mesmo produto, histórico factual e insumos de CLO |
| `raiva_primovac_dose1` | Contexto regional/espécie; consultiva | Norma para avaliação; não libera automação | Sugestão | RAIVA: manter restrição | PASS | `no_agenda_auto` expresso |
| `raiva_primovac_reforco_30d` | Dose anterior factual + 30 dias | Norma para avaliação; não libera automação | Sugestão | RAIVA: manter restrição | PASS | `no_agenda_auto` e histórico |
| `raiva_reforco_anual_area_risco` | Histórico anual e contexto regional | Norma para avaliação; não libera automação | Sugestão | RAIVA: manter restrição | PASS | `no_agenda_auto` e risco contextual |
| `lepto_primovac_dose1` | Inicial única bovina da formulação | Parcial: LEPTOFERM5 | Auto/fixture | LEP | PASS | Produto/registro, restrições reprodutivas e vínculos |
| `lepto_primovac_dose2` | Segunda dose da variante canônica | Não: referência bovina é inicial única | Bloqueada | LEP2: manter bloqueio | PASS | Esquema incompatível; outra formulação exige variante própria |
| `lepto_reforco_anual_semestral` | Apenas anual na referência selecionada | Parcial: LEPTOFERM5; não sustenta semestre | Auto/fixture | LEP | PASS | Mesmo produto, histórico, restrições e recorrência anual |
| `ibr_bvd_primovac_dose1` | Inicial da formulação selecionada | Parcial: cobertura registrada; fonte em validação | Auto/fixture | IBR | PASS | Identidade/registro comercial, fonte completa e vínculos |
| `ibr_bvd_primovac_dose2` | 21–30 dias da primeira dose factual do produto | Parcial: cobertura registrada; fonte em validação | Auto/fixture | IBR | PASS | Insumos de IBR e histórico do mesmo produto |
| `fmd_historico_contingencia` | Histórico/contingência oficial | Sim para restrição; não para rotina automática | Bloqueada | FMD: manter bloqueio | PASS | Contingência exige decisão e fluxo MAPA/SVE |
| `fmd_bloqueio_vacinacao_rotina` | Bloqueio da vacinação de rotina | Sim para bloqueio | Bloqueada | FMD: manter bloqueio | PASS | Proibição da rotina |
| `recria_maio` | Recria, região/sistema e maio adotado | Apoio regional; falta fonte responsável por campo | Auto/fixture | PAR | PASS | Contexto persistente e fonte/decisão delimitada à fazenda |
| `recria_julho` | Recria, região/sistema e julho adotado | Apoio regional; falta fonte responsável por campo | Auto/fixture | PAR | PASS | Contexto persistente e fonte/decisão delimitada à fazenda |
| `recria_setembro` | Recria, região/sistema e setembro adotado | Apoio regional; falta fonte responsável por campo | Auto/fixture | PAR | PASS | Contexto persistente e fonte/decisão delimitada à fazenda |
| `pre_desmama_situacional` | Bezerro/bezerra; sistema intensivo/leiteiro ou orientação MV | Apoio contextual; falta fonte responsável por campo | Auto/fixture | DES | PASS | Sistema/orientação referenciada e escopo de avaliação |
| `pre_confinamento_dose_unica` | Manejo programado, data/referência/alvos | Apoio contextual; falta fonte responsável por campo | Auto/fixture | CONF | PASS | Data e destino/manejo configurados; não comprova movimentação |
| `matrizes_pre_parto_antiparasitario` | Fêmea, contexto reprodutivo e avaliação programada | Apoio sazonal; não comprova janela individual | Auto/fixture | PARTO | PASS | Data/referência/alvos e intervenção definida; sem inferir parto |

## Aprovações exatamente necessárias

O pacote `SANITARIO_V2_FECHAMENTO_DECISOES_20261016.json` contém 11 conjuntos que cobrem exatamente os 20 itens, sem sobreposição. O nome conserva a data de preparação. Fontes e IDs de cobertura são os já cadastrados no payload; não houve nova validação externa de bulas/normas. Os vínculos propostos são explicitamente propostas, não coverage aprovado.

1. **B19 — um item pronto para decisão:** aprovar avaliação genérica v3, elegibilidade/idade/UF/histórico e os três vínculos propostos para IN MAPA 10/2017, Portaria 1.633/2026 e restrição CIDASC. Excluir SC; não declarar obrigação em UF risco A; não aprovar aplicação, produto comercial, dose ou carência por essa decisão.
2. **CLO — três itens dependentes de produto:** após preencher identidade/registro do produto, critério etário e vínculos por campo, decidir uma vez sobre inicial, segunda dose 28–42 dias e reforço anual da mesma formulação. A referência FORTRESS7 já registra 5 mL SC; não generalizar para outras formulações/espécies nem inferir carência de leite.
3. **LEP — dois itens dependentes de produto:** identificar formulação/registro, resolver restrições de gestação/lactação e vínculos operacionais; decidir conjuntamente inicial única bovina e reforço anual do mesmo produto. LEPTOFERM5 registra 2 mL IM; o sufixo lógico `anual_semestral` não autoriza semestre. A dose 2 canônica está excluída desse conjunto.
4. **IBR — dois itens dependentes de fonte comercial:** completar identidade/registro e resolver a classificação da fonte/bula, atualmente apoio/PRECISA_VALIDAR; formalizar os vínculos por formulação. A cobertura já registra composição, 5 mL SC e 21–30 dias: não se pede revalidar conteúdo sem conflito, nem transportar esquema entre produtos.
5. **PAR — três itens dependentes de contexto/fonte responsável:** aprovar conjuntamente maio/julho/setembro no contexto delimitado de UF, sistema e recria, com fonte/decisão responsável cobrindo os campos críticos. O plano persiste os meses adotados; o guideline de apoio não vira fonte forte global e não escolhe princípio ativo.
6. **DES — um item dependente de contexto/fonte responsável:** aprovar avaliação genérica de bezerros no sistema intensivo/leiteiro ou sob orientação MV referenciada. Excluir universalização ao extensivo; não exige produto comercial para a avaliação genérica.
7. **CONF — um item dependente de contexto/fonte responsável:** aprovar avaliação na entrada programada, com data/referência/alvos/destino ou manejo configurados. Não inferir execução, dose ou carência.
8. **PARTO — um item dependente de contexto/fonte responsável:** aprovar avaliação de matrizes com contexto reprodutivo e data/referência/alvos, distinguindo intenção de comprovação de parto. Intervenção farmacológica exige produto/bula ou decisão MV próprios.
9. **RAIVA — três itens com restrição expressa:** nenhuma habilitação proposta. Uma eventual remoção de `no_agenda_auto` exigiria revisão expressa aprovada/versionada, fora deste fechamento; plano do produtor não a substitui.
10. **FMD — dois itens bloqueados:** manter histórico/informação e bloqueio de rotina. Contingência depende de fluxo e decisão MAPA/SVE próprios.
11. **LEP2 — um item bloqueado:** não aprovar a variante bovina atual. Outra formulação exige variante, produto, fonte, intervalo e versão próprios; a capacidade técnica de variante foi demonstrada apenas em fixture.

São **oito decisões candidatas**, cada qual única por conjunto de regras e condicionada aos insumos indicados, e **três conjuntos de manutenção de restrições**. Nenhuma decisão foi assinada: ator, data e referência continuam nulos.

O pacote prepara oito cabeçalhos de protocolo e 14 novas versões físicas de item, em draft e sem permissão automática, com precondições de ID/versão anterior. Preserva o ID estável do protocolo, necessário para o histórico. As seis versões restritas são cópias inalteradas do canônico. A transição prospectiva de status/aprovação/metadata/permissão só é uma proposta, dependente de assinatura, insumos resolvidos, vínculos materializados e versão esperada: não é uma alteração isolada de `allows_agenda_auto`.

O pacote não é importável e não altera a fonte canônica. SHA-256 do payload preservado: `51df1c3884f463992113d0d3ac89e3c9534ce68726e9829972838cae2132cf73`.

## Demonstração e integridade

O plano persistente por fazenda e os writers existentes foram reutilizados. Não foi criado outro motor. As fixtures carregam os itens reais e acrescentam autorização somente no banco descartável de teste. Geram B19, três etapas de clostridioses, duas de IBR/BVD, duas de leptospirose compatível, três avaliações regionais e as avaliações de pré-desmama, pré-confinamento e pré-parto: **14 itens distintos**. B19 e avaliações de manejo são intenções genéricas; os casos com produto respeitam formulação e história factual compatível.

No Chromium, uma mesma fazenda gera os **12 itens aplicáveis em julho**; maio e setembro são demonstrados nos testes focados nas respectivas janelas. Os 20 itens aparecem no plano, incluindo as três sugestões e os três bloqueios. A fixture contém quatro Eventos factuais de suporte antes da geração e conserva quatro depois; movimentações de estoque permanecem zero. Planejamento não produz Evento, estoque ou carência.

As verificações cobrem identidade persistente por fazenda/animal/regra/versão/janela, concorrência, reprocessamento sem duplicação, falha/retry, offline, reabertura/reconexão, farm-switch, histórico de reforço, cancelamento e reagendamento. O contexto persistente resolve condições da fazenda sem confirmação de cada Agenda. Composições multivalentes sem contrato factual de cobertura não são deduplicadas por suposição.

**Limite remoto:** configuração usa a fila existente; as Agendas locais não ganham sincronização remota por flag. Falta homologar/fechar o contrato de convergência entre plano e Agendas em dispositivos distintos, incluindo identidade/uniqueness remota, conflitos e replay de versões de clientes. Nenhuma certificação multidispositivo, RLS ou importação remota foi alegada.

## Evidências de validação

Executadas na branch integrada sobre `51fed37`:

- `pnpm exec vitest run` com os dez arquivos focados: `sanitaryApprovalPreparationV2`, `sanitaryNormalizedAutomationV2`, `sanitaryAutomaticGenerationV2`, `sanitaryProtocolWindowsV2`, `sanitaryProtocolPrecheckV2`, `sanitaryPlanningPolicyV2`, `sanitaryManualAgendaV2`, `sanitaryComplianceV2`, `ProtocolosSanitarios` e `SanitaryProtocolWindowPanelV2`: **199/199 testes, dez arquivos**. A suíte integral de normalização tem 53 casos, contemplando os 20 itens e a rejeição canônica de cada um.
- Após acrescentar as precondições explícitas de transição e a referência de sucessão à versão canônica imediatamente anterior, repetido somente `sanitaryApprovalPreparationV2.test.ts`: **7/7**. Cobertura exata dos 20, hash canônico, ausência de assinatura, versões, rejeição pelo domínio, fontes existentes e manutenção das seis restrições.
- `pnpm exec playwright test --config e2e/sanitary-planning.config.ts`: **5/5 Chromium**, incluindo plano integral, offline/reload/reconnect, cancelamento, reagendamento e farm-switch. Backend sintético em loopback; nenhuma chamada remota inesperada.
- `pnpm run lint`: **exit 0**.
- `pnpm exec fallow audit --base origin/main --gate new-only --format json`: **exit 0**, zero findings introduzidos; herdados: cinco de código morto, 18 de complexidade e cinco grupos de duplicação.
- `pnpm run build`: **exit 0**, 30,82 s. Avisos de Browserslist desatualizado e chunks acima de 500 kB registrados, sem alteração incidental de dependências/configuração.
- `pnpm run gates:docs`: **exit 0**, cabeçalhos/baselines, continuidade documental e contrato de governança aprovados. ESLint focado do novo teste: **exit 0**.
- `git diff --check` e `git diff --cached --check`: **exit 0**. Gate final: três arquivos novos revisados (relatório, pacote e teste), sem remoções ou mudanças de runtime/migration; nenhum arquivo concorrente incluído. Comparação dos 14 rascunhos com o canônico preservou regras, produtos, fontes, restrições e recorrências.

Logs locais desta execução: `%TEMP%/sanitario-fechamento-tests.txt`, `sanitario-fechamento-pacote-final.txt`, `sanitario-fechamento-chromium.txt`, `sanitario-fechamento-lint.txt`, `sanitario-fechamento-fallow.json` e `sanitario-fechamento-build.txt`. Os comandos de teste/build usaram somente credenciais sintéticas e URLs de loopback. Não foi executada regressão global nem validação remota; não fazem parte do escopo deste fechamento local.

## Conclusão quantitativa

1. **Tecnicamente pronto para aprovação: 1** — B19 para avaliação genérica. Classificação exaustiva: 1 pronto + 5 dependentes de produto/esquema + 2 de fonte comercial + 6 de contexto/fonte responsável + 6 com restrição automática expressa = 20.
2. **Demonstrados em geração automática: 14**, sendo 12 simultaneamente aplicáveis no cenário Chromium de julho.
3. **Restritos a sugestões: 3**, todos de raiva e sem remoção de `no_agenda_auto`.
4. **Bloqueados por fundamento específico: 3** — dois de aftosa e a dose 2 canônica de leptospirose. Com as três restrições consultivas de raiva, são seis sem proposta de habilitação automática.
5. **Aprovações curatoriais:** oito conjuntos candidatos, detalhados acima; somente B19 pronto sem novos insumos. Autorizações concedidas: **zero**; operacionais efetivas: **0/20**.
6. **Integração:** main atual incorporada localmente e integralmente preservada. Branches anteriores e trabalho concorrente mantidos. Nenhum push, merge, deploy, migration ou importação remota.
7. **Entrega local:** pacote versionado de decisões, sete testes de integridade e este relatório; runtime existente reaproveitado sem nova alteração. O commit de fechamento é identificado pelo Git que contém este documento, evitando referência circular ao próprio hash.
