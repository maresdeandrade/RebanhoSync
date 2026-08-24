# Foundations — RebanhoSync

Atualizado em: 2026-08-24
Status: **Contrato visual alvo da Fase 18 — documental, ainda não implementado**

## Propósito e precedência

Este documento define as fundações visuais alvo do RebanhoSync. Ele orienta a Fase 19 e as migrações posteriores; não modifica código, domínio ou o contrato operacional canônico de [OPERATIONAL_FLOWS](../architecture/OPERATIONAL_FLOWS.md).

Quando houver conflito visual com documentos anteriores em `docs/ux/**`, este conjunto de sete documentos da Fase 18 é a referência alvo. Código e tokens produtivos continuam descrevendo o estado implementado até a migração.

## Baseline auditado

- fonte tipográfica: Inter variável, carregada em `src/main.tsx`;
- tema produtivo: variáveis HSL em `src/globals.css`, com pares light/dark;
- configuração: `tailwind.config.ts`, com escala tipográfica, cores semânticas parciais, radius e sombras;
- shell: largura máxima de 1440 px, navegação lateral a partir de `md` e barra inferior no mobile;
- estilos: não existe `src/styles/**`; o CSS global está centralizado em `src/globals.css`;
- dívida: 63 arquivos usam cores Tailwind hardcoded, com 851 ocorrências; há 265 valores arbitrários;
- inline style: nove ocorrências, em maioria valores dinâmicos de progresso, gráfico, avatar ou largura; não são prioridade de migração por si só;
- drift de tooling: `components.json` aponta para `src/index.css`, enquanto o CSS efetivo é `src/globals.css`. Corrigir somente na Fase 19.

## Tipografia

| Papel | Token alvo | Referência atual | Uso |
|---|---|---|---|
| Display | `text-display` | 2.5rem/3rem | números ou chamadas excepcionais; nunca corpo |
| Título de página | `text-h1` | 2rem/2.5rem | um `h1` por tela |
| Título de seção | `text-h2` | 1.5rem/2rem | blocos principais |
| Título de card | `text-h3` | 1.25rem/1.75rem | cards e painéis |
| Corpo | `text-body` | 1rem/1.5rem | leitura principal |
| Corpo compacto | `text-body-sm` | .875rem/1.25rem | metadados e listas densas |
| Rótulo | `text-label` | .875rem/1.25rem | campos e controles |
| Legenda | `text-caption` | .75rem/1rem | apoio não crítico |
| Kicker | `text-kicker` | .75rem/1rem | contexto curto em caixa alta |

Regras: preservar Inter; usar peso 600 para títulos e ações, 400–500 para corpo; números operacionais devem usar `tabular-nums`; não comprimir texto crítico abaixo de 14 px; manter no máximo 75 caracteres por linha em conteúdo explicativo.

## Espaçamento, dimensões e densidade

- usar a escala Tailwind de 4 px já adotada; preferir `2, 3, 4, 5, 6, 8` (8–32 px);
- gutter de tela: 16 px no mobile, 24 px em `sm`, 32 px em `lg`;
- distância entre blocos principais: 20–24 px; dentro de cards: 12–20 px;
- controles de ação: 48 px padrão; 44 px é o mínimo para campos e alvos de toque;
- densidade `comfortable` é padrão; `compact` só para tabelas/listas operacionais com ações secundárias fora da célula;
- informação técnica deve ser progressiva, não comprimida no primeiro nível.

## Radius, borda e elevação

- radius base existente: `1rem`; usar `rounded-lg` para controles, `rounded-xl` para cards e `rounded-full` apenas para badges/pills;
- borda é o separador padrão; não usar sombra como única fronteira;
- `shadow-soft` para superfície elevada e `shadow-crisp` somente para popover/menu que exija separação forte;
- cards informativos permanecem sem sombra quando a borda resolve a hierarquia;
- dialogs/sheets usam overlay e uma elevação única; evitar múltiplas superfícies empilhadas.

## Superfícies

1. `background`: tela e shell.
2. `surface/card`: conteúdo primário.
3. `surface-muted/muted`: agrupamento, filtros e leitura secundária.
4. `popover`: conteúdo flutuante.
5. superfície semântica: apenas quando o estado tem significado explícito.

Branding não colore automaticamente superfícies de sucesso, confirmação ou sincronização.

## Iconografia

- manter Lucide, 16 px em texto/controle, 20–24 px em ações e 32 px apenas em estados vazios;
- ícone complementa rótulo em estado crítico; nunca substitui texto sem `aria-label`;
- usar uma metáfora por ação em todo o produto;
- ícones decorativos recebem `aria-hidden="true"`.

## Movimento

- duração alvo: 120–180 ms para hover/focus, 180–240 ms para expandir/fechar;
- animação comunica transição, carregamento ou causalidade; não decorar dashboards;
- respeitar `prefers-reduced-motion`;
- loading indeterminado usa spinner com texto ou região `aria-live`; progresso conhecido usa barra com valor.

## Foco e teclado

- foco visível usa `ring` semântico neutro de 2 px e offset perceptível em light/dark;
- ordem de tabulação segue leitura e não depende da disposição visual;
- nenhuma ação crítica fica apenas em hover, swipe ou menu sem alternativa acessível;
- ao fechar dialog/sheet, restaurar foco ao acionador;
- ações destrutivas exigem nome explícito e confirmação com descrição.

## Light e dark

- ambos os temas preservam hierarquia, significado e contraste; dark não é inversão literal;
- texto normal deve atingir WCAG AA 4,5:1; texto grande e ícones essenciais, 3:1;
- superfícies semânticas usam fundo suave + borda + texto/ícone; cor saturada é reservada para ação/estado curto;
- validar foco, disabled, bordas e gráficos separadamente nos dois temas.

## Critério de adoção

Um token é criado somente quando representa papel reutilizável em três ou mais consumidores ou um estado operacional obrigatório. Valor local dinâmico e composição estrutural específica não justificam token global.
