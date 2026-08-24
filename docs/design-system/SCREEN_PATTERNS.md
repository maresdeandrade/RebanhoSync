# Screen Patterns — RebanhoSync

Atualizado em: 2026-08-24
Status: **Contrato visual alvo da Fase 18 — documental; P0 responsivo aplicado pontualmente**

## Estrutura comum

Toda tela responde nesta ordem: onde estou; o que exige atenção; qual é a ação segura; qual é a evidência; quais limitações existem. O shell não substitui o `PageHeader`, e estados operacionais não podem ficar escondidos apenas em toast, cor ou menu.

## Dashboard

- hierarquia: PageHeader → estado operacional prioritário → 3–5 métricas → tarefas/alertas → leitura auxiliar;
- CTA: uma ação primária; atalhos secundários agrupados;
- densidade: não colocar sete métricas equivalentes na mesma linha;
- desktop/mobile: grid progressivo; no mobile, agenda/alertas precedem métricas de baixa ação;
- loading/empty/error: skeleton por bloco; fonte indisponível afeta o bloco, não apaga o restante.

## List

- hierarquia: PageHeader → busca/filtros → resultado/contagem → lista/tabela → paginação;
- CTA: criar/importar no header; ação por item explícita;
- status: na linha com texto e ícone quando crítico;
- desktop/mobile: tabela ou cards densos no desktop; responsive list no mobile;
- empty: diferenciar sem dados, sem resultado e acesso indisponível.

## Detail

- hierarquia: identidade + estado atual → ação primária → riscos/bloqueios → métricas → seções → histórico;
- CTA: ação operacional visível; destrutivas dentro de menu apenas se ainda descobríveis e confirmadas;
- status: fonte, data e limitação próximas do valor;
- desktop/mobile: tabs roláveis ou substituídas por seletor quando não couberem; ações empilham;
- loading/error: identidade permanece quando uma seção falha.

## Form

- hierarquia: contexto → seções → validação local → revisão quando crítica → confirmação;
- CTA: salvar/avançar persistente em fluxo longo; secundária visualmente menor;
- desktop/mobile: uma coluna no mobile, duas para pares curtos no desktop;
- estados: dirty, invalid, submitting, salvo localmente, aplicado, parcial e rejeitado;
- error: próximo do campo e resumo focável; nunca só toast.

## Agenda

- hierarquia: visão do período → atraso/hoje → compliance → filtros → grupos/itens;
- CTA: registrar execução leva ao Registrar; concluir Agenda não deve fingir Evento sem contrato;
- status: intenção futura distinta de fato executado;
- desktop/mobile: grupos colapsáveis, ações por item com alvo ≥44 px, filtros avançados em painel;
- empty/error: agenda vazia não equivale a “sem manejo necessário”.

## Report

- hierarquia: escopo/período/timezone → cobertura → métricas → visualização → exportação;
- CTA: exportar é secundária à compreensão;
- status: `complete`, `partial`, `unavailable`, fonte e cutoff visíveis;
- desktop/mobile: gráficos simplificam e tabelas viram lista/scroll controlado;
- empty/error: ausência factual e falha de fonte são mensagens diferentes.

## Operational Workflow

- hierarquia: contexto imutável → progresso → escolha → detalhes → revisão → resultado;
- CTA: verbo factual (`Registrar`, `Confirmar envio`); impedir duplo submit;
- status: offline/pending/syncing/applied/partial/rejected após o gesto;
- desktop/mobile: barra de ação sticky pode ser usada sem cobrir campos/bottom nav;
- escolhas críticas com rótulos longos empilham até haver largura útil comprovada; não comprimir, truncar nem permitir sobreposição para manter colunas;
- error: preservar entrada e explicar escopo por operação; não transformar sucesso parcial em sucesso global.

Evidência aplicada na F18: o contexto do Registrar empilha abaixo de 1024 px e volta a duas colunas em `lg+`; o P0 foi marcado **RESOLVED** após validação 390/768/1024 em light/dark.

## Configuração

- hierarquia: escopo/fazenda → grupos de configuração → impacto → salvar;
- CTA: por seção quando mudanças são independentes;
- status: read-only/permissão com motivo;
- desktop/mobile: navegação por seções ou tabs roláveis; evitar formulários monolíticos;
- error: não perder valores editados.

## Padrões cruzados

- PageHeader é canônico em toda tela real; aliases/redirects não criam cabeçalho.
- Primary CTA é única por contexto; ações paralelas usam outline/ghost/menu.
- filtros ativos permanecem visíveis e removíveis.
- conteúdo auxiliar pode colapsar, risco operacional não.
- light/dark preservam significado; mobile preserva todas as ações críticas.
