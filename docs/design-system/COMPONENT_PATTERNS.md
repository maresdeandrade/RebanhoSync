# Component Patterns — RebanhoSync

Atualizado em: 2026-08-24
Status: **Contrato visual alvo da Fase 18 — documental, ainda não implementado**

## Inventário atual

A auditoria encontrou 58 primitives/arquivos em `src/components/ui`. Maiores consumidores por importação: `Button` 92, `StatusBadge` 58, `Card` 58, `Input` 56, `Label` 45, `Select` 44, `PageIntro` 39, `Badge` 31, `FormSection` 20, `Dialog` 17, `Textarea` 16, `Checkbox` 12, `DropdownMenu` 12, `Tabs` 8 e `Toolbar` 8.

| Família pesquisada | Evidência atual | Classificação | Direção |
|---|---|---|---|
| Button, Input, Select, Label, Textarea | primitives tokenizadas e amplamente usadas | CANÔNICO | preservar API; alinhar altura/foco |
| Checkbox, Radio | primitives Radix com alvo visual de 16 px | REUTILIZÁVEL COM AJUSTE | garantir wrapper/alvo de toque ≥44 px |
| Dialog, AlertDialog | primitives canônicas; uso irregular de descrição | REUTILIZÁVEL COM AJUSTE | tornar título/descrição parte do gate |
| Sheet, Drawer | duas soluções de painel; estilo e close divergentes | NEEDS REVIEW | definir usos exclusivos; não duplicar |
| Card, Badge, Tabs, Alert, Tooltip, Skeleton | primitives compartilhadas | CANÔNICO | usar papéis semânticos, não cores locais |
| StatusBadge, SyncStatusBadge | vocabulário operacional parcial | REUTILIZÁVEL COM AJUSTE | ampliar estados sem alterar semântica |
| PageIntro | cabeçalho de página, 39 imports | CANÔNICO | adotar como `PageHeader`; um h1 |
| Toolbar, FilterChips | composição existente para filtros | REUTILIZÁVEL COM AJUSTE | formar `FilterBar`, sem novo equivalente paralelo |
| Table | wrapper responsivo existe, mas importado uma vez | CANÔNICO SUBUTILIZADO | substituir tabelas nativas ao migrar telas |
| EmptyState, LoadingScreen, Skeleton | equivalentes compartilhados existem | CANÔNICO | compor ErrorState sem biblioteca paralela |
| MetricCard | primitive compartilhada existe | CANÔNICO SUBUTILIZADO | remover cards métricos locais por migração |
| DecisionRecommendationsPanel | painel funcional com fontes/limites | REUTILIZÁVEL COM AJUSTE | adotar como base de `DecisionCard` |
| StateBanner | nome não existe; `Alert` e banners locais equivalem | DUPLICADO COMO COMPOSIÇÃO | padronizar receita sobre `Alert` |
| ErrorState | nome não existe; alerts/empty locais equivalem | DUPLICADO COMO COMPOSIÇÃO | receita sobre `Alert`/`EmptyState` |
| navigation | AppShell, TopBar, SideNav, MobileBottomNav | NEEDS REVIEW | F19 define shell e reconcilia modelo mobile |
| AgendaEmptyState | wrapper de domínio sobre `EmptyState` | LOCAL JUSTIFICADO | preservar enquanto traduz regra de agenda |
| Occupancy `MetricCard` local | duplica primitive compartilhada | DUPLICADO | migrar para `ui/metric-card` |

Não foi identificado componente que deva ser marcado `DEPRECATED` antes de validar consumidores na Fase 19.

## Contrato comum

Todo padrão precisa de: nome acessível, estado de loading/disabled quando interativo, foco visível, texto que não dependa de cor, layout mobile e suporte light/dark. Componentes de domínio podem compor primitives, mas não redefinir significado de Agenda, Evento, `state_*`, sync ou autorização.

## Padrões alvo

### PageHeader (`PageIntro`)

- objetivo/anatomia: contexto, único `h1`, descrição, metadados e ações;
- estados: carregamento não substitui o título; erro/indisponível aparece abaixo;
- desktop/mobile: ações à direita no desktop e empilhadas em largura total no mobile;
- acessibilidade: ordem título → descrição → meta → ações;
- variantes: `plain` e `surface`; anti-pattern: cabeçalho local ou dois `h1`.

### SectionHeader

- objetivo/anatomia: `h2/h3`, descrição opcional, status e ação secundária;
- desktop/mobile: ação pode quebrar linha, nunca cobrir título;
- acessibilidade: nível segue hierarquia; ícone é decorativo;
- variantes: seção/card; anti-pattern: texto em caixa alta como único heading.

### Card

- objetivo/anatomia: agrupar uma ideia, com header, conteúdo e footer opcionais;
- estados: neutro por padrão; semantic surface apenas quando todo o card representa o estado;
- desktop/mobile: padding 16–24 px; evitar card dentro de card;
- acessibilidade: não tornar card inteiro clicável quando contém ações internas;
- variantes: informativo, interativo, semântico; anti-pattern: sombra e cor arbitrárias por tela.

### MetricCard

- objetivo/anatomia: rótulo, valor, unidade/período, cobertura/hint e ícone opcional;
- estados: `complete`, `partial`, `unavailable`; zero factual difere de ausência;
- desktop/mobile: 2 colunas no mobile quando legível, 3–4 no desktop; nunca sete cards espremidos;
- acessibilidade: ordem rótulo → valor → contexto; não depender de cor;
- variantes: default/info/success/warning/error; anti-pattern: implementação local duplicada.

### DecisionCard (`DecisionRecommendationsPanel`)

- objetivo/anatomia: recomendação, confiança/qualidade, fontes, limitações, não-autorização e ação segura;
- estados: `unknown`, `ambiguous`, `not_permitted`, stale e partial são explícitos;
- desktop/mobile: resumo primeiro; detalhes colapsáveis; CTA não encobre ressalvas;
- acessibilidade: heading por recomendação e texto completo;
- variantes: lista/painel; anti-pattern: recomendação apresentada como fato ou autorização.

### DataTable e responsive list

- objetivo/anatomia: cabeçalho, caption/escopo, linhas, seleção e paginação;
- estados: loading, vazio filtrado, erro e partial;
- desktop: `Table` canônica com overflow apenas como fallback;
- mobile: transformar cada linha em card/list item com rótulo-valor e ações explícitas; não reduzir fonte para caber;
- acessibilidade: `th`, caption/label, foco e seleção nomeada;
- variantes: tabela comparativa e lista operacional; anti-pattern: tabela nativa sem wrapper ou ação só em hover.

### FilterBar (`Toolbar` + `FilterChips`)

- objetivo/anatomia: busca, filtros primários, resumo ativo, limpar e filtros avançados;
- estados: loading preserva layout; “sem resultado” diferencia filtros de base vazia;
- desktop/mobile: inline no desktop; busca + botão e painel/sheet no mobile;
- acessibilidade: labels, `aria-expanded`, contagem e ordem previsível;
- variantes: simples/avançada; anti-pattern: cinco selects compactos sem hierarquia no mobile.

### StateBanner (`Alert`)

- objetivo/anatomia: ícone, título, explicação, metadado e ação;
- estados: família de `OPERATIONAL_STATES`; um estado prioritário por banner;
- desktop/mobile: CTA quebra abaixo no mobile;
- acessibilidade: `status` para atualização, `alert` só para impeditivo;
- variantes: inline/page/sticky; anti-pattern: `div` colorida sem papel ou texto.

### Forms (`Form`, `FormSection`, fields)

- objetivo/anatomia: título, instrução curta, campos, erro próximo e ações;
- estados: pristine, validating, invalid, read-only, disabled, submitting, partial;
- desktop/mobile: uma coluna por padrão; duas apenas para pares curtos; ação sticky somente em workflow longo;
- acessibilidade: label programático, descrição e erro por `aria-describedby`, primeiro erro focável;
- variantes: cadastro e workflow; anti-pattern: placeholder como label ou validação só por toast.

### Dialog, Sheet e Drawer

- Dialog: decisão curta e focada; título + descrição; máximo de uma ação primária.
- AlertDialog: consequência destrutiva/irreversível; confirmação nomeia o objeto.
- Sheet: contexto auxiliar ou filtros no mobile sem abandonar a tela.
- Drawer: somente gesto/mobile quando acrescenta valor claro; caso contrário, consolidar em Sheet.
- Todos: focus trap, Escape quando seguro, retorno de foco, altura máxima e scroll interno; anti-pattern: formulário extenso em dialog sem progresso.

### EmptyState, LoadingState e ErrorState

- Empty: o que está vazio, por quê quando conhecido e CTA segura;
- Loading: skeleton compatível com a estrutura ou spinner textual;
- Error: causa compreensível, alcance, retry e alternativa; preservar dados já carregados;
- mobile/desktop: centralização não deve esconder navegação nem contexto;
- acessibilidade: regiões anunciáveis sem spam; anti-pattern: substituir tela inteira por toast.

## Gates de uso

- procurar equivalente compartilhado antes de criar componente;
- componente local exige regra de domínio ou composição impossível de generalizar;
- nova variante precisa de papel, não de página consumidora;
- migração visual não move regra de negócio para React.
