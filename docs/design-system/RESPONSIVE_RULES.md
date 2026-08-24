# Responsive Rules — RebanhoSync

Atualizado em: 2026-08-24
Status: **Contrato visual alvo da Fase 18 — documental; P0 responsivo aplicado pontualmente**

## Breakpoints canônicos

Usar os breakpoints Tailwind existentes, sem variantes por tela: `sm` 640 px, `md` 768 px, `lg` 1024 px, `xl` 1280 px e `2xl` 1536 px. O design é mobile-first; breakpoint responde à falta de espaço do padrão, não a um dispositivo nominal.

| Faixa | Estratégia |
|---|---|
| mobile `<640` | uma coluna, barra inferior, ações empilhadas, filtros compactados |
| tablet `640–1023` | uma ou duas colunas, navegação conforme shell, dialogs contidos |
| notebook `1024–1279` | sidebar + conteúdo, grids moderados, ações inline quando couberem |
| desktop largo `≥1280` | aumentar colunas com limite de leitura; não esticar conteúdo indefinidamente |

## Container e gutters

- shell máximo: 1440 px, alinhado ao `AppShell` atual;
- telas de formulário: máximo aproximado de 1024 px; listas/detalhes podem usar 1280–1440 px;
- gutters: 16 px mobile, 24 px `sm/md`, 32 px `lg+`;
- bottom padding mobile considera barra inferior e safe area;
- não adicionar `max-width` arbitrário tela a tela sem documentar o padrão.

## Stacking e grids

- prioridade de leitura define a ordem no DOM e no mobile;
- métricas: 1–2 colunas mobile, 3–4 desktop; evitar sete colunas de igual peso;
- cards de ação: uma coluna mobile, 2–3 desktop;
- pares curtos de formulário podem usar duas colunas a partir de `sm`; campos longos ficam inteiros;
- escolhas com rótulos longos empilham enquanto a largura útil não comportar conteúdo + padding; no Registrar, o contexto usa uma coluna abaixo de `lg` e duas em `lg+`;
- nunca usar reordenação CSS que prejudique foco ou leitor de tela.

## Tabelas e listas

- desktop: `Table` canônica, header persistente apenas quando não cobre contexto;
- tablet: reduzir colunas secundárias e oferecer detalhe expandido;
- mobile: responsive list com rótulo/valor; overflow horizontal é último recurso;
- seleção e ação por linha permanecem acessíveis por teclado/toque;
- nenhuma decisão depende de coluna escondida.

## Formulários

- campos e botões têm mínimo de 44 px; CTA padrão pode manter 48 px;
- label e erro permanecem junto ao campo;
- teclado virtual não pode cobrir CTA/erro;
- barras sticky respeitam bottom navigation e safe area;
- revisão de operação crítica usa resumo em blocos, não tabela larga.

## Dialogs, sheets e drawers

- mobile: dialog ocupa largura `calc(100%-32px)` e altura máxima segura, com scroll interno; workflow longo migra para página/sheet;
- desktop: largura deriva do conteúdo, com máximo explícito e leitura curta;
- Sheet é padrão para filtros/contexto auxiliar mobile;
- Drawer não duplica Sheet sem gesto/uso justificado;
- footer de ações empilha no mobile e permanece visível sem cobrir conteúdo.

## Navegação

- desktop: sidebar persistente; TopBar mantém fazenda, conectividade e conta;
- mobile: cinco destinos no máximo; rótulo sempre visível; item central não pode mudar semântica por destaque;
- o código atual usa `Hoje/Rebanho/Manejo/Estrutura/Mais`, enquanto `docs/ux/NAVIGATION_MODEL.md` registra `Hoje/Agenda/Registrar/Rebanho/Mais`; F19 deve decidir e registrar um único modelo com teste de tarefas;
- Agenda e Registrar continuam acessíveis em no máximo um toque a partir das jornadas críticas;
- nenhum item crítico fica apenas no menu “Mais”.

## Touch, foco e conteúdo

- alvo mínimo 44×44 px, espaçamento mínimo de 8 px entre ações adjacentes;
- tooltip não é requisito para compreender ação no touch;
- truncamento preserva acesso ao valor completo;
- tabs com cinco itens, como AnimalDetalhe, precisam rolagem, quebra ou seletor no mobile; não comprimir rótulos indefinidamente;
- filtros densos de Animais e Agenda viram painel progressivo no mobile.

## Validação por migração

Para cada tela migrada, validar pelo menos 360×800, 768×1024, 1024×768 e 1440×900, em light/dark. Evidência inclui: sem overflow acidental, CTA crítica visível, foco completo, texto sem corte, dialog utilizável e estado não dependente só de cor.

Evidência de fechamento da F18: o seletor de contexto do Registrar foi revalidado em 390×844, 768×1024 e 1024×768, nos temas claro e escuro, com zero overlap/clipping, rótulos completos, 48 px de altura, foco visível e navegação funcional. O P0 está **RESOLVED**.

## Dívida observada

O código contém 265 valores arbitrários e 483 ocorrências estruturais relacionadas a grid/tabela/overflow responsivo. Valores arbitrários não são erro automático, mas devem ser mantidos apenas quando representam restrição real. Hotspots: AnimalDetalhe (tabs e dialogs densos), Animais (filtros extensos), Registrar (workflow longo e barra sticky), Agenda (filtros/grupos) e detalhes de lote/pasto com muitos estilos locais.
