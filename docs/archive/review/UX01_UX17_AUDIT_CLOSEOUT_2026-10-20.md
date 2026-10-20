# Encerramento da auditoria UX01–UX17 — RebanhoSync

Atualizado em: 2026-10-20

**Baseline Commit:** `7feb3a876d28415d41ad7d07f3e54b9b13eb294f`

**Resultado:** `AUDIT_CLOSED`

## Decisão e escopo

A auditoria UX original está encerrada neste baseline: **16 achados CLOSED / INTEGRATED e UX10 NOT_REPRODUCED**. Não há problema funcional conhecido pendente entre os achados e cenários auditados, dentro das limitações registradas abaixo. Isso não afirma ausência de defeitos em estados não exercitados.

Este documento consolida o encerramento de UX01–UX17 em um único registro. A busca pelos identificadores e por “auditoria UX” nos documentos versionados, inclusive arquivados, não encontrou acompanhamento anterior; o índice de UX e os registros ativos de revisão também foram consultados. Não foram alterados índices, roadmap, status de outras fases ou contratos normativos.

A localização em `docs/archive/review/` preserva o resultado como histórico de evidências da auditoria encerrada. Este documento não substitui código, testes ou contratos atuais e não inicia uma nova auditoria.

## Integração confirmada

O GitHub confirmou o [PR #230](https://github.com/maresdeandrade/RebanhoSync/pull/230) como `MERGED` em **2026-10-20T09:10:45Z**, com merge `bbbcca978bf0de0fe39c38df752d31fe4f69a7bc`.

A API de branches e `git fetch origin main` confirmaram o HEAD final da `main` em **`7feb3a876d28415d41ad7d07f3e54b9b13eb294f`**, após o [PR #229](https://github.com/maresdeandrade/RebanhoSync/pull/229). Esse avanço altera apenas `src/pages/Eventos.tsx` e `src/pages/__tests__/Eventos.test.tsx`, sem sobreposição com os arquivos dos PRs da auditoria; não motivou repetição das suítes já aprovadas.

Todos os merges da tabela abaixo pertencem à ancestralidade desse baseline. Os resultados de CI foram consultados nos jobs originais; testes completos não foram repetidos para este fechamento documental.

| PR integrado | Merge na main | Required validation |
| --- | --- | --- |
| [#210 — UX01/UX02](https://github.com/maresdeandrade/RebanhoSync/pull/210) | `51fed3705ecfd0dd2a42e78723d833348adc237a` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/38947423389) |
| [#212 — UX03](https://github.com/maresdeandrade/RebanhoSync/pull/212) | `1125fb6a21bbf95546ef38a2a51ec2c9aacd54c5` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39012169619) |
| [#214 — UX05](https://github.com/maresdeandrade/RebanhoSync/pull/214) | `350955f91c2b06859ba7d093926d3f5b27389b86` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39044378969) |
| [#217 — UX04](https://github.com/maresdeandrade/RebanhoSync/pull/217) | `613c89dfcce04ec4b312173a404fb006b82caee7` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39227090067) |
| [#221 — UX08](https://github.com/maresdeandrade/RebanhoSync/pull/221) | `8d83c0d322453f4cedab6184fc6e2ef81a7b2b0b` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39307842504) |
| [#222 — UX07](https://github.com/maresdeandrade/RebanhoSync/pull/222) | `315dcbce1537414e6273dc29d066012aed80367d` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39311730685) |
| [#223 — UX06](https://github.com/maresdeandrade/RebanhoSync/pull/223) | `db860bd76c7d8b94811450fbce45efa136564aa2` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39330440932) |
| [#224 — UX09A](https://github.com/maresdeandrade/RebanhoSync/pull/224) | `62208c611cf89453bdd5f49739a3fb59753f3578` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39353027237) |
| [#226 — UX09B](https://github.com/maresdeandrade/RebanhoSync/pull/226) | `9a0eba02cedbfe0726681fe84c9e21a0a2f6bfd2` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39363139974) |
| [#227 — UX10/UX11/UX12/UX15](https://github.com/maresdeandrade/RebanhoSync/pull/227) | `35d5b3914686ed9c8275df4983f122f5f19830ae` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39365882560) |
| [#228 — UX13/UX14/UX16](https://github.com/maresdeandrade/RebanhoSync/pull/228) | `65618d4cc4b2af121dc286b42a8a6ba07e924d99` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39384602074) |
| [#230 — UX17](https://github.com/maresdeandrade/RebanhoSync/pull/230) | `bbbcca978bf0de0fe39c38df752d31fe4f69a7bc` | [SUCCESS](https://github.com/maresdeandrade/RebanhoSync/actions/runs/39388061194) |

Nos 12 jobs acima, as etapas `Fallow audit`, `Test` e `Build` foram confirmadas como `SUCCESS`.

**Ressalva de rastreabilidade do PR #210:** o corpo do PR está vazio e o check [Fill PR description](https://github.com/maresdeandrade/RebanhoSync/actions/runs/38947423386) terminou em `FAILURE`. Não se declara que todos os checks históricos desse PR estavam verdes. A evidência de UX01/UX02 vem do diff integrado, dos testes versionados de Registrar e do job funcional aprovado; o fechamento não altera retroativamente esse PR.

## Matriz dos 17 achados

As evidências locais abaixo são as registradas nas entregas originais, complementadas pela conferência de integração, código/testes presentes no baseline e CI. Não representam novas execuções nesta reconciliação.

| Achado | Classificação | Correção ou resultado confirmado | Evidência rastreável |
| --- | --- | --- | --- |
| UX01 — fluxo contextual de pesagem | CLOSED / INTEGRATED | A URL preenche a entrada sem reaplicar ação/seleção em cada interação; nova entrada contextual continua sendo aceita. | [PR #210 — diff](https://github.com/maresdeandrade/RebanhoSync/pull/210/files); [Registrar.test.tsx](../../../src/pages/Registrar/__tests__/Registrar.test.tsx), casos de contexto e navegação; CI #210 acima. |
| UX02 — revisão dos pesos | CLOSED / INTEGRATED | Confirmação lista identificação, peso e unidade de cada animal; voltar/avançar preserva preenchimento. | [PR #210 — diff](https://github.com/maresdeandrade/RebanhoSync/pull/210/files); [PesagemResumoConfirmacao.tsx](../../../src/pages/Registrar/components/PesagemResumoConfirmacao.tsx) e teste de confirmação contextual; CI #210. |
| UX03 — data no Financeiro | CLOSED / INTEGRATED | Data é validada antes da conversão ISO, com feedback acessível e formulário preservado; UTC, submissão única e retry mantidos. | [PR #212](https://github.com/maresdeandrade/RebanhoSync/pull/212); [FinanceiroSubmit.test.tsx](../../../src/pages/__tests__/FinanceiroSubmit.test.tsx) e [dateInput.test.ts](../../../src/lib/finance/__tests__/dateInput.test.ts); 32 testes focados após extração, seis cenários Chromium originais; CI #212. |
| UX04 — fechamento do menu mobile | CLOSED / INTEGRATED | Seleção de destino e mudança programática fecham o menu; cancelamento e navegação restauram foco conforme o percurso. | [PR #217](https://github.com/maresdeandrade/RebanhoSync/pull/217); [AppShellNavigation.test.tsx](../../../src/components/layout/__tests__/AppShellNavigation.test.tsx), [ux04-mobile-navigation.spec.ts](../../../e2e/ux04-mobile-navigation.spec.ts); 28 testes focados e quatro cenários Chromium registrados; CI #217. |
| UX05 — ações dos formulários mobile | CLOSED / INTEGRATED | Rodapés respeitam a área da navegação inferior/safe area e permitem quebra; ações essenciais continuam alcançáveis. | [PR #214](https://github.com/maresdeandrade/RebanhoSync/pull/214); [MobileFormActions.tsx](../../../src/components/layout/MobileFormActions.tsx); 288 observações Chromium e 566 verificações de campos registradas, 14 testes focados; regressão dirigida também em #227; CI #214. |
| UX06 — continuidade do convite | CLOSED / INTEGRATED | Destino interno validado acompanha Login/Cadastro; aceite continua explícito. Contexto é encaminhado em emailRedirectTo. | [PR #223](https://github.com/maresdeandrade/RebanhoSync/pull/223); [InviteAuthContinuity.test.tsx](../../../src/pages/__tests__/InviteAuthContinuity.test.tsx) e [inviteRedirect.test.ts](../../../src/lib/auth/__tests__/inviteRedirect.test.ts); 56 testes e três percursos Chromium registrados; limite de e-mail remoto abaixo; CI #223. |
| UX07 — erro ao consultar fazendas | CLOSED / INTEGRATED | Falha, timeout, carregamento e ausência real de vínculos são distintos; retry e descarte de respostas antigas preservam o contexto. | [PR #222](https://github.com/maresdeandrade/RebanhoSync/pull/222); [SelectFazenda.test.tsx](../../../src/pages/__tests__/SelectFazenda.test.tsx), 17 casos registrados; CI #222. |
| UX08 — saída com lote não salvo | CLOSED / INTEGRATED | Navegação confirma descarte; cancelamento, salvamento pendente e falha/retry preservam os valores. Recarga usa confirmação nativa. | [PR #221](https://github.com/maresdeandrade/RebanhoSync/pull/221); [LoteNovo.navigation.test.tsx](../../../src/pages/__tests__/LoteNovo.navigation.test.tsx) e [ux08-unsaved-lote.spec.ts](../../../e2e/ux08-unsaved-lote.spec.ts); 12 testes e nove cenários Chromium registrados; CI #221. |
| UX09 — nomes acessíveis dos controles | CLOSED / INTEGRATED | UX09A associa pesagens a identificação/unidade/erro e nomeia RFID simulado; UX09B associa os três switches a seus rótulos. Estados, teclado, dependências e permissões preservados. | [PR #224](https://github.com/maresdeandrade/RebanhoSync/pull/224) e [PR #226](https://github.com/maresdeandrade/RebanhoSync/pull/226); [RegistrarPesagemSection.test.tsx](../../../src/pages/Registrar/__tests__/RegistrarPesagemSection.test.tsx), [AnimalEditarAccessibility.test.tsx](../../../src/pages/__tests__/AnimalEditarAccessibility.test.tsx), [EditarFazenda.test.tsx](../../../src/pages/__tests__/EditarFazenda.test.tsx); 9 e 13 testes, respectivamente, e Chromium dirigido; CI #224/#226. |
| UX10 — overflow em AnimalDetalhe | NOT_REPRODUCED | Não reproduzido no baseline exercitado. Nenhum patch especulativo em AnimalDetalhe/AnimalDetailHeader; rolagem intencional das abas preservada. | [PR #227](https://github.com/maresdeandrade/RebanhoSync/pull/227); [mobile-responsive.spec.ts](../../../e2e/mobile-responsive.spec.ts) e [fixture](../../../e2e/support/mobile-responsive.tsx); cinco viewports, identificador de 122 caracteres, nome/lote extensos e cinco abas. Limite específico abaixo. |
| UX11 — conteúdo longo na prévia CSV | CLOSED / INTEGRATED | Quebra local de conteúdo e mínimos flexíveis impedem ampliação da página, mantendo informação completa e estado da importação. | [PR #227](https://github.com/maresdeandrade/RebanhoSync/pull/227); [AnimaisImportar.tsx](../../../src/pages/AnimaisImportar.tsx) e suíte mobile; overflow anterior de 1238 px em viewport de 320 px, contido após correção nos cinco tamanhos; CI #227. |
| UX12 — painel do onboarding | CLOSED / INTEGRATED | Painel fluido no mobile, grade/etapas adaptáveis e ações com quebra; sequência e progresso preservados. | [PR #227](https://github.com/maresdeandrade/RebanhoSync/pull/227); [OnboardingInicial.tsx](../../../src/pages/OnboardingInicial.tsx) e suíte mobile; overflow anterior de 378 px em 320 px, seis etapas e progresso 3/6 = 50% exercitados; CI #227. |
| UX13 — vazio do dashboard reprodutivo | CLOSED / INTEGRATED | Abre em todas as matrizes elegíveis; diferencia vazio real de filtro/busca e oferece Ver todas as matrizes, mantendo prioridade de atenção. | [PR #228](https://github.com/maresdeandrade/RebanhoSync/pull/228); [ReproductionDashboard.test.tsx](../../../src/pages/__tests__/ReproductionDashboard.test.tsx), cinco casos com seleção/Agenda/histórico, mais Chromium dirigido; CI #228. |
| UX14 — códigos técnicos expostos | CLOSED / INTEGRATED | Telas e HTML usam explicações em português; falta de cobertura não vira zero e resultado observado não vira lucro. Cálculos, números e CSV canônicos preservados. | [PR #228](https://github.com/maresdeandrade/RebanhoSync/pull/228); [operationalSummaryPresentation.test.ts](../../../src/lib/reports/__tests__/operationalSummaryPresentation.test.ts); coberturas disponível/parcial/insuficiente/conflitante e quatro hashes CSV idênticos registrados; CI #228. |
| UX15 — botão do menu comprimido | CLOSED / INTEGRATED | Menu/perfil não encolhem e indicadores podem quebrar linha; seletor e ações continuam disponíveis. | [PR #227](https://github.com/maresdeandrade/RebanhoSync/pull/227); [TopBar.tsx](../../../src/components/layout/TopBar.tsx) e suíte mobile; menu passou de 18×48 para 48×48 px em 320 px, perfil 44×44 px, offline/erro e sincronização exercitados; CI #227. |
| UX16 — página 404 | CLOSED / INTEGRATED | Título, mensagem e retorno em português; Link do roteador e navegação Tab/Enter preservados. | [PR #228](https://github.com/maresdeandrade/RebanhoSync/pull/228); [NotFound.test.tsx](../../../src/pages/__tests__/NotFound.test.tsx) e Chromium dirigido; CI #228. |
| UX17 — isolamento da simulação | CLOSED / INTEGRATED | Resultado retido só é apresentado se corresponder à rota/fazenda ativa; identidade do simulador reinicia premissas ao trocar animal/fazenda. | [PR #230](https://github.com/maresdeandrade/RebanhoSync/pull/230); [AnimalSimulacao.isolation.test.tsx](../../../src/pages/__tests__/AnimalSimulacao.isolation.test.tsx) e [ux17-simulation-isolation.spec.ts](../../../e2e/ux17-simulation-isolation.spec.ts); 37 testes focados e quatro Chromium aprovados na entrega; CI #230. |

Os 11 cenários UX17 incluem: A em A; A em B; A→B→A; consulta antiga após troca; mudança da rota; animal excluído; nenhuma fazenda ativa; ausência de sessão/vínculo; históricos factuais distintos; recarga; troca de contexto com premissas preenchidas. Leituras reais de Dexie/IndexedDB em ambiente descartável verificaram também pesagem atrasada e ausência de escrita pelo simulador.

A suíte responsiva de #227 exercitou **320×568, 360×800, 390×844, 768×1024 e 1280×900**. Foram registrados 25 cenários novos e quatro cenários existentes de UX04 aprovados; os testes focados relacionados totalizaram 70 casos. A entrega #228 registrou 68 casos focados únicos para UX13/UX14/UX16 e contratos relacionados.

## UX10 — classificação e limites

`NOT_REPRODUCED` encerra o achado original sem afirmar uma correção que não ocorreu. No baseline de reprodução `9a0eba02cedbfe0726681fe84c9e21a0a2f6bfd2`, o documento permaneceu contido em 320 px com os dados extremos descritos na matriz. A rolagem horizontal das abas foi mantida e exercitada.

A fixture usa **animal sintético macho**; não cobre todas as combinações sanitárias, reprodutivas ou de dados reais. O resultado não certifica todos os estados possíveis de AnimalDetalhe. Evidência futura reproduzível pode motivar outro achado, sem reclassificar este fechamento como correção funcional.

## Riscos residuais e alcance da certificação

1. **Fixtures e dados representativos:** parte da validação usa autenticação/API/serviços simulados e IndexedDB descartável. A cobertura prova os cenários descritos, sem equivaler ao uso integral com dados e serviços reais. A limitação particular de UX10 permanece explícita.
2. **Hardware e tecnologias assistivas:** não há certificação em dispositivos físicos, teclado nativo mobile, Safari/iOS ou leitores de tela reais. Semântica acessível e teclado automatizados não substituem experiência com leitores de tela.
3. **Backend, RLS e entrega remota:** os fluxos avaliados não receberam certificação integral ponta a ponta do backend/RLS. Em UX06, allowlist, templates e entrega real de e-mail dependem da configuração remota não observada. Esses limites não são apresentados como defeitos reproduzidos nem como validações concluídas.

## Método deste fechamento

- Consultados estado, merge e checks dos 12 PRs no GitHub e HEAD remoto da main.
- Confirmada ancestralidade dos 12 merges e presença dos trechos/testes pertinentes no baseline; o diff de UX17 está efetivamente integrado.
- Consultadas as evidências originais de testes focados, Chromium, lint, Fallow e CI, preservando as limitações de cada entrega.
- A consolidação é exclusivamente documental. Não houve nova execução de suítes completas, build funcional, alterações de domínio ou ações em banco.
- A aprovação/publicação deste registro não executa merge, deploy ou migrations.
