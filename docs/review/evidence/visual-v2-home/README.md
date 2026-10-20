# Visual V2 — Home / Central Operacional

Atualizado em: 2026-10-20
**Baseline Commit:** `c8cf774e9ee32eecb71085b6507fc89b3ab3c418`

## Baseline e escopo

Branch `codex/visual-v2-home`, criada de `origin/main` após fetch. PR #232 confirmado como MERGED com Required validation SUCCESS. Checkout original e worktree de Registrar preservados.

Runtime alterado somente em `src/pages/Home.tsx`. Testes em `src/pages/__tests__/Home.test.tsx`. Dashboard, queries, adaptadores, serviços de domínio, persistência, sync e contratos remotos permanecem sem alteração. O bloco existente do efeito de metadados e da consulta Dexie foi comparado com o baseline e permaneceu idêntico.

## Diagnóstico e decisões de UX

- Sync aparecia no fim da Home e painéis auxiliares antecediam alertas operacionais. Agora: cabeçalho com fazenda e ação principal, conexão/sync, prioridades e alertas, panorama, próximas atividades, histórico e atalhos. Insights, recomendações e acompanhamento complementar ficam sob demanda em disclosures nativos.
- Eventos recentes eram consultados, mas não exibidos. A seção Histórico recente usa os mesmos registros factuais já carregados, sem derivar execução de Agenda ou estado atual.
- `proximosItens` contém os seis primeiros itens da Agenda, enquanto `agendaHoje` e `agendaAtrasada` já contêm os totais. A apresentação agora usa esses totais existentes e explica quantos itens aparecem no recorte. A consulta e seu limite foram preservados; a Agenda completa permanece acessível.
- A nova composição reinicia o estado transitório por fazenda e só apresenta snapshots atribuídos à fazenda ativa pelo seletor canônico existente. Isso evita mostrar dados anteriores e respostas antigas de metadados durante farm-switch, sem mudar consultas ou autenticação.
- Atalhos permitem quebra de texto e informam navegação para revisão, sem afirmar que o clique executa operação. Linhas repetidas da Agenda foram compostas em `HomeAgendaItems`, componente estritamente local de apresentação.
- Loading, ausência de fazenda, erro com retry e offline explícitos. Conteúdo de painéis auxiliares expandidos recebe ajustes de quebra no wrapper local para caber em 320 px.

## Evidência funcional e visual

Fixture Chromium/Playwright isolada em localhost, usando a Home real, React, fonte Inter, queries/adaptadores e Dexie reais. Usuário, fazendas, animais, Agenda, eventos e filas são fictícios. Metadados remotos e autenticação foram substituídos na fixture; loading e falha de leitura foram injetados na fronteira de consulta local. Nenhuma conexão com dados reais.

- 320, 390 e 1280 px, claro/escuro: carregado, vazio, metadados ausentes/dados parciais, loading, erro de leitura, offline e auxiliares expandidos. **42 verificações de largura sem overflow horizontal**.
- Fixture carregada: 8 pendências atrasadas, 2 tarefas de hoje e recorte de 6 atrasadas. A interface mostra os totais corretos e orienta consultar as tarefas de hoje fora do recorte.
- Seis percursos de farm-switch A → B: a fazenda B não apresenta contagens, eventos ou erro de sync da A. Teste unitário adicional cobre resposta de metadados A resolvendo depois de B.
- Seis retries recuperaram a Home após falha injetada, sem converter erro em vazio.
- Tab alcançou o CTA Registrar manejo; hrefs de Agenda, Eventos, Rebanho e atalhos conferidos contra as rotas existentes. Disclosures foram abertos/fechados e os painéis expandidos também passaram nas checagens de largura.
- Antes/depois da consulta, expansão e passagem para offline: **3 eventos, 2 gestos e 0 operações**, sem alteração nas seis combinações. A Home não executou fatos nem modificou a fila.
- Contagens e estados observados em [results.json](results.json).

## Validação local

- `pnpm test -- src/pages/__tests__/Home.test.tsx src/features/operationalInsights/__tests__ src/features/decisionAssistance/__tests__/DecisionRecommendationsPanel.test.tsx src/components/offline/__tests__/SyncHealthViews.test.tsx --maxWorkers=2`: **6 arquivos / 53 testes aprovados**.
- Após consolidar a apresentação das linhas de Agenda: Home revalidada, **14 testes aprovados**.
- `pnpm run lint`: aprovado.
- Prettier nos dois arquivos TSX alterados: aprovado.
- `pnpm exec fallow audit --gate new-only`: aprovado, nenhum achado novo, sem exclusões/supressões/configurações novas. O Fallow emite aviso de node_modules durante a atribuição no snapshot base; a instalação local foi concluída.
- `pnpm run build`: aprovado; avisos de Browserslist desatualizado, chunks grandes e importação estática/dinâmica de Dexie.
- `git diff --check`: aprovado.

As primeiras checagens identificaram expectativas antigas de texto, duplicação das listas e token fixo realocado; foram corrigidos. Falhas do harness de loading e tipagem da fixture foram resolvidas sem alterar configuração de qualidade. O resultado remoto de Required validation deve ser consultado no PR; este relatório descreve evidência local.

## Capturas revisadas

| Largura / tema | Estado |
| --- | --- |
| 320 / claro | [Carregada, prioridade e sync](320-light-loaded.png) |
| 320 / escuro | [Vazia](320-dark-empty.png) |
| 390 / claro | [Metadados ausentes / parcial](390-light-partial.png) |
| 390 / escuro | [Offline e erro real da fila fictícia](390-dark-offline.png) |
| 1280 / claro | [Prioridades e recorte](1280-light-loaded.png) |
| 1280 / escuro | [Histórico factual e atalhos](1280-dark-historico.png) |
| 320 / claro | [Falha de leitura](320-light-error.png) |
| 390 / escuro | [Loading sem contagem vazia](390-dark-loading.png) |
| 320 / claro | [Auxiliares sob demanda](320-light-auxiliares.png) |

## Limitações e riscos residuais

- Sessão real, RLS, confirmação remota e dispositivos Android/iOS físicos não foram exercitados. Nenhum desses contratos foi alterado. As capturas não incluem o chrome global da aplicação.
- O limite existente de seis itens da Agenda continua compartilhado entre atrasados, hoje e futuros. A Home esclarece esse recorte; não foi ampliada a consulta nem criada uma nova regra de priorização.
- Os blocos de alertas sanitários, regulatórios e de estoque foram preservados. Os testes da Home exercitam alertas sanitários e de estoque; não foi feita execução em navegador de todo cenário de domínio.
