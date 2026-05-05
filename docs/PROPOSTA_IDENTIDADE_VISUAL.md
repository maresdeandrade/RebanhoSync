# RebanhoSync: Proposta de Identidade Visual Evolutiva

> **Data:** Maio 2024
> **Estágio do Produto:** MVP → SLC (Simple, Lovable, Complete)
> **Natureza:** Proposta Modular e Progressiva

---

## 1. Diagnóstico do Estado Visual Atual

Com base na análise do repositório (`README.md`, `docs/PRODUCT.md`, `src/globals.css`, bibliotecas UI e código-fonte), o diagnóstico do estágio visual é o seguinte:

### Hipóteses e Confirmações
| Categoria | Achado |
|---|---|
| **Confirmado** | Stack baseada em `shadcn/ui` + `TailwindCSS` + `lucide-react`. O app foca em offline-first (Dexie), alta densidade operacional e multi-tenant (várias fazendas). |
| **Confirmado** | Tema visual atual em `globals.css` baseia-se em HSL neutros (`background`, `surface`), com accent neutro e cores semânticas para alertas (`destructive`, `success`, `warning`). A interface usa classes como `app-surface` e `app-surface-muted`. |
| **Inferido** | Existe risco de "poluição visual" em formulários complexos (como reprodução e sanitário) devido a dependência de cores fortes ou ausência de uma hierarquia semântica mais clara para os badges e eventos. |
| **Hipótese** | Produtores rurais (owners/managers/cowboys) acessam o app primariamente pelo celular, debaixo de sol (ambiente externo), exigindo alto contraste e leitura rápida para evitar erros (ex: aplicar remédio errado). |

### Diagnóstico Visual

| Área | Achado | Impacto | Prioridade | Recomendação |
|---|---|---|---|---|
| **Contraste & Acessibilidade** | As cores padrão do `shadcn/ui` muitas vezes têm baixo contraste em ambientes externos (curral sob o sol). | Alto | Alta | Refinar a paleta para aumentar a relação de contraste de textos em badges e botões de ação. |
| **Hierarquia de Cards** | O app foca em listas de animais (ex: matriz e cria). A densidade visual pode sobrecarregar o usuário se tudo tiver o mesmo peso. | Médio | Alta | Padronizar a distinção entre "Card de Navegação" e "Card de Ação" através de sombras suaves (`shadow-soft` já existente) vs. bordas sólidas. |
| **Iconografia** | Uso de `lucide-react` está confirmado, porém, a espessura e a consistência semântica de alguns ícones podem variar. | Baixo | Média | Definir um grid fixo (ex: 20x20) e `strokeWidth` de 2px ou 1.5px (para telas densas) para todos os ícones. |
| **Identidade / Branding** | Não existe uma cor de marca definida, o app parece um "admin genérico" de SaaS. | Médio | Média | Injetar discretamente "vida" no produto através de um tom primário que não canse, como um tom terroso/couro ou um verde-oliva técnico, fugindo do azul-tech ou do verde-alface comum. |

**Riscos de criar uma marca fechada agora:** O produto ainda está em consolidação arquitetural e de UX. Gastar muito esforço com logotipos complexos, ilustrações 3D ou sistemas de marketing vai gerar retrabalho.
**O que padronizar agora:** Paleta de cores base, tipografia escalável, estilo de inputs/buttons, hierarquia de cards (Surface).
**O que esperar:** Manuais de marca para impressão, campanhas completas, ilustrações customizadas.

---

## 2. Posicionamento Visual da Marca

*   **Propósito:** Garantir que o produtor rural tenha o domínio total e ininterrupto sobre os dados vitais do seu rebanho, em qualquer lugar.
*   **Promessa central:** O app que funciona onde a fazenda acontece, sem frescura e sem perder dados.
*   **Personalidade:** Pragmática, robusta, confiável, enxuta, trabalhadora.
*   **Percepção desejada:** Ferramenta indispensável e inquebrável. Não é um brinquedo, nem um sistema para contadores. É uma ferramenta para quem calça bota.
*   **Público-alvo primário:** Pequenos e médios produtores rurais (Owners) de gado de corte (100-800 cabeças).
*   **Público-alvo secundário:** Gerentes e peões de campo que operam o dia a dia.
*   **O que transmitir:** Clareza, contraste, estabilidade, tecnologia transparente (ela ajuda, não atrapalha).
*   **O que evitar:** Parecer um ERP de contabilidade complexo (tabelas infinitas pequenas), parecer um app infantil/gamificado, parecer uma agrotech genérica (verde-bandeira com folhinhas).

---

## 3. Direções Criativas Possíveis

### Caminho 1: "Agrotech Moderna" (O Clichê)
*   **Descricão:** Uso de verde brilhante, branco puro, ícones com preenchimento. Foco na inovação.
*   **Sensação:** Startup de tecnologia, "sistema na nuvem".
*   **Paleta:** Verde Esmeralda, Branco, Cinza Claro.
*   **Riscos:** Distante da poeira do curral. Muito sensível a condições de sol forte (falta contraste).
*   **Adequação MVP:** Média.

### Caminho 2: "Caderneta Bruta" (A Ferramenta)
*   **Descricão:** Estética que remete a blocos de anotações, pranchetas. Foco absoluto no dado e na leitura. Monocromático com poucos pontos de cor.
*   **Sensação:** Utilitário puro, resistência, analógico-digital.
*   **Paleta:** Tons de papel (off-white, bege muito sutil), tipografia forte preta, toques de sépia ou vermelho-ferrugem para alertas.
*   **Riscos:** Pode parecer rústico demais ou inacabado se mal executado.
*   **Adequação MVP:** Alta, pois é muito fácil de implementar com `shadcn/ui`.

### Caminho 3: "Gestão Forte (Pecuária de Corte)" (Recomendado)
*   **Descricão:** Uma abordagem que mistura o peso de um utilitário com cores da realidade do campo, mas de forma profissional. O "Verde Oliva" e "Terra/Ferrugem" substituem os azuis genéricos e os verdes-limão de startup.
*   **Sensação:** Confiável, feito para a realidade pesada do curral (corte), mas organizado e limpo.
*   **Paleta:** Verde Oliva/Musgo como cor primária (robusto), fundos `off-white/gray-50` (evita brilho excessivo no sol), Alertas semânticos vibrantes.
*   **Riscos:** A cor primária deve ser bem calibrada para não parecer militar, e sim agronegócio sério.
*   **Adequação MVP:** Altíssima. Pode ser injetada nos tokens do Tailwind imediatamente. Fácil aplicação. Boa legibilidade mobile.

**Direção Escolhida: Caminho 3 - Gestão Forte.**
Motivo: Foge do excesso de estilo corporativo, adapta-se ao `shadcn/ui` alterando apenas as variáveis base de cor, melhora o contraste para uso externo e comunica imediatamente maturidade operacional.

---

## 4. Proposta de Logo Conceitual

Este é um direcional para ser executado no Figma posteriormente.

*   **Conceito do Símbolo:** O símbolo deve representar a união de **Ciclo/Continuidade (Sync)** e **Rebanho (Marcação)**.
*   **Racional Visual:** Em vez de usar um desenho realista de um boi ou um sinal clássico de Wi-Fi, o logotipo pode brincar com o conceito da *marca de fogo (identificação)* do animal combinada com formas de iteração. Uma forma geométrica e sólida (como as marcas de gado rurais: losangos, círculos com traços), porém desenhada com traços modernos e contínuos.
*   **Composição:** Uma letra "R" ou um pictograma estilizado (como a cabeça de um bovino de corte muito simplificada — apenas os ângulos do topo da cabeça e orelhas) envolto por duas setas ou um traço circular semiaberto (ciclo/sync).
*   **Evitar:** Bois desenhados em estilo cartoon, ícone de nuvem com uma vaca dentro, verde-alface brilhante, sinal de rede (`rss/wifi`).
*   **Versão horizontal:** Símbolo à esquerda, "RebanhoSync" em fonte sem-serifa grotesca e pesada (ex: Inter SemiBold ou Roboto Mono para um ar mais utilitário). "Rebanho" com peso Regular e "Sync" com peso Bold (ou vice-versa para destacar).
*   **App Icon:** Apenas o símbolo em fundo Verde Oliva. Traço do símbolo em Off-White. Sólido, alta visibilidade na tela do celular.
*   **Tamanho mínimo:** O símbolo deve ser perfeitamente legível num favion 16x16.
*   **Recomendação de Execução:** Use SVG com `stroke-width` constante e ângulos de 45° ou 90° para transmitir robustez e estabilidade.

---

## 5. Paleta de Cores (Caminho "Gestão Forte")

Esta paleta foi pensada para uso intensivo (baixa fadiga visual) e alto contraste outdoor.

### Cores Principais
| Token | Nome | HEX | RGB | HSL | Uso |
|---|---|---|---|---|---|
| `--color-primary` | Verde Campo | `#3F523B` | `63, 82, 59` | `110, 16%, 28%` | Brand, Botões primários, Nav ativa. |
| `--color-primary-hover` | Verde Fundo | `#2F3D2C` | `47, 61, 44` | `110, 16%, 20%` | Hover do botão primário. |
| `--color-primary-muted` | Verde Lavado | `#E8EBE7` | `232, 235, 231` | `105, 12%, 91%` | Fundos de destaque suave, Badges de marca. |
| `--color-accent` | Terra/Ferrugem | `#9A4C32` | `154, 76, 50` | `15, 51%, 40%` | Detalhes sutis, ícones especiais, ilustrações. |

### Neutros
| Token | Nome/Uso | HEX | HSL Tailwind Suggestion |
|---|---|---|---|
| `--color-background` | Fundo principal da aplicação | `#F8FAFC` | `210, 40%, 98%` |
| `--color-surface` | Fundo de Cards (Branco puro) | `#FFFFFF` | `0, 0%, 100%` |
| `--color-surface-muted` | Fundo de Cards Inativos/Agrupadores | `#F1F5F9` | `210, 40%, 96%` |
| `--color-border` | Bordas e Divisórias | `#E2E8F0` | `214, 32%, 91%` |
| `--color-border-strong` | Bordas ativas/foco | `#CBD5E1` | `214, 32%, 84%` |
| `--color-text-primary` | Texto Principal (`foreground`) | `#0F172A` | `222, 47%, 11%` |
| `--color-text-secondary`| Texto Secundário (`muted-fg`) | `#64748B` | `215, 16%, 47%` |
| `--color-disabled` | Texto/Fundo desabilitado | `#94A3B8` | `215, 14%, 65%` |

### Cores Semânticas
Diferenciar visualmenteações, alertas e estados sanitários é vital na pecuária.

| Token | Nome/Uso | HEX | HSL Sugerido | Obs |
|---|---|---|---|---|
| `--color-success` | Sincronizado, Saúde OK | `#059669` | `161, 94%, 30%` | (Emerald 600) Mais legível que verde-limão. |
| `--color-warning` | Cuidado, Carência Sanitária | `#D97706` | `38, 92%, 44%` | (Amber 600) Evita amarelo puro que some no fundo branco. |
| `--color-error` | Aborto, Morte, Erro Crítico | `#DC2626` | `0, 72%, 51%` | (Red 600) Evidente e destrutivo. |
| `--color-info` | Informação, Destaque neutro | `#0284C7` | `200, 98%, 39%` | (Sky 600) Para badges de Categoria, Macho/Fêmea. |

**Orientações Específicas para Pecuária:**
*   **CTAs Principais:** Sempre `--color-primary` (Verde Campo).
*   **Badges de Macho/Fêmea:** Azul (Info) e Roxo suave (ou Laranja suave) para fugir do rosa/azul clichê de bebê, mas mantendo distinção.
*   **Estados Reprodutivos:** `Cobertura/IA` (Verde/Success), `Diagnóstico Pendente` (Warning/Amarelo), `Parto` (Azul/Info), `Aborto` (Error/Vermelho).

---

## 7. Tipografia

Hierarquia tipográfica prática, priorizando fontes limpas, gratuitas e de alta densidade de leitura (números legíveis).

| Uso | Fonte (Google Fonts) | Peso | Tamanho | Line-height | Observação |
|---|---|---|---|---|---|
| **App UI (Geral)** | **Inter** | Regular (400) | `14px` (text-sm) | `1.5` | Fonte base. Excelente legibilidade em telas pequenas. |
| **Cabeçalhos / Titles** | **Inter** | SemiBold (600) | `18px-24px` | `1.2` | Títulos de seções, modais e telas. |
| **Números/Dados (IDs)**| **JetBrains Mono** | Medium (500) | `12px` (text-xs) | `1.4` | Ideal para `Macho_ID`, números de brincos e pesagem. Evita ambiguidades entre 0 e O. |
| **Kickers / Badges** | **Inter** | Bold (700) | `11px-12px` | `1.2` | Maiúsculas, Tracking expandido (ex: `.app-kicker`). |

*   **Critérios:** Alta legibilidade no mobile. Dados tabulares e pesos (ex: 125,5 kg) devem sempre usar variantes numéricas tabulares ou monospaced para não deslocar colunas.

---

## 8. Iconografia

Sistema de iconografia coerente baseado na stack atual.

*   **Biblioteca:** `lucide-react` (Já em uso no projeto).
*   **Estilo:** Outline, limpo e direto. Sem preenchimento duplo.
*   **Espessura de linha (`strokeWidth`):** `2px` para botões e CTAs, `1.5px` para ícones decorativos ou em listas muito grandes.
*   **Arredondamento:** Padrão do Lucide.
*   **Tamanho padrão:** `20px` ou `24px` para ações, `16px` para badges e metadados (`w-4 h-4` no Tailwind).

### Ícones Essenciais (Estágio Atual)

| Ícone Lucide | Conceito visual | Onde usar | Risco de ambiguidade |
|---|---|---|---|
| `CalendarClock` | Agenda de intenções / Cronograma. | Aba Agenda, itens de protocolos. | Não usar apenas `Calendar`, a ideia de tempo é essencial. |
| `PlusCircle` ou `Edit3`| Ação central de Registrar evento. | FAB button, telas de Registro. | |
| `Beef` | Animal individual / Cabeça. | Ficha do animal. | (Baixo) Lucide `Beef` remete a boi. |
| `Layers` | Lotes / Agrupamentos de rebanho. | Telas de Lotes. | Pode confundir com pastos. |
| `Map` | Pastos / Localização física. | Telas de Pastos, transferências. | |
| `Syringe` | Sanitário / Vacina / Remédio. | Evento Sanitário. | Universal. |
| `HeartPulse` | Reprodução (Parto, IA, Monta). | Dashboard Reprodutivo, Eventos. | Evite ícones abstratos. |
| `Scale` | Pesagem. | Evento Pesagem. | (Baixo). |
| `Move` | Movimentação (Troca de lote/pasto). | Eventos de manejo. | |
| `DollarSign` ou `Banknote`| Financeiro operacional básico. | Venda/Compra/Custos. | |
| `RefreshCw` | Sync / Sincronização offline-first. | Topbar, Status do banco de dados. | Muito padrão. |
| `WifiOff` | Estado Offline ativo (sem conexão). | Banner global. | |
| `Users` | Membros / RBAC. | Configurações da Fazenda. | |

---

## 9. Sistema Visual para UI

Recomendações práticas usando a semântica do `shadcn/ui` já existente no repositório.

| Componente | Uso | Estilo recomendado / Tokens | Observação |
|---|---|---|---|
| **Cards (Surface)** | Container principal de conteúdo (ex: Ficha animal). | Branco (`bg-surface`), borda sutil (`border-border`), `shadow-sm` ou `shadow-soft` (já existe). Arredondamento `rounded-2xl` para toque moderno. | Evitar shadow muito grande, tira o foco dos dados. |
| **Botões Primários** | Ação principal (Registrar, Salvar). | Fundo `--color-primary`, Texto branco. Tamanhos grandes (`h-12`) no mobile para touch. | 1 CTA primário por tela no máximo. |
| **Botões Secundários**| Cancelar, Voltar, Filtrar. | Fundo transparente ou `bg-surface`, Borda evidente (`border-input`). | |
| **Badges** | Status reprodutivo, Carência. | Fundo Muted (ex: `bg-warning-muted`), Texto (ex: `text-warning`). Arredondamento `rounded-full` ou `rounded-md`. | Nunca usar cores sólidas berrantes para badges decorativos. |
| **Inputs / Selects** | Formulários de registro e manejo. | Borda limpa, Label fora do input. Fundo branco. Tamanho de toque `min-h-[44px]` (Mobile). | Em ambiente rural, campos minúsculos causam erros. |
| **Modais/Drawers** | Seleção rápida em celular. | Usar `Drawer` de baixo para cima (já no shadcn/vaul) em mobile. Modais centrados apenas no Desktop. | Melhor alcance do polegar. |
| **Toasts** | Feedback de ação ("Salvo offline"). | Fundo escuro (inverso) para sobressair no fundo claro, posicionados no **Bottom-Center** no mobile. | |
| **Listas Mobile** | Listas de Animais / Lotes. | Divider simples (`border-b`), Sem shadow por item (para não pesar), padding amplo (`p-4`). | Muito shadow em 100 itens trava a renderização e pesa a UI. |
| **Empty States** | Sem dados cadastrados. | Ícone cinza lavado (`w-12 h-12 text-muted`), título curto, CTA primário evidente. | Não usar desenhos/ilustrações complexas nesta fase. |

---

## 10. Aplicações Prioritárias

Foco estrito no produto atual (MVP/SLC).

### Alta Prioridade (Produto)
*   **Dashboard/Visão Inicial:** Usar os novos tokens para Metric Cards (`bg-surface`, título `text-muted-foreground`, número em destaque numérico).
*   **Registrar Evento:** Melhorar legibilidade de botões (ex: botões de "Parto", "IA" da `ReproductionForm` devem usar os tons primários ou semânticos de forma acessível).
*   **Card de Animal / Lista de Animais:** Distinguir a tipografia do brinco/ID (Mono) do nome/raça.
*   **Estado Offline/Sync:** O componente `SyncStatusPanel` deve ter destaque claro, usando warning para "Offline com pendências" e Verde/Muted para "Sincronizado".
*   **App Icon:** Quadrado sólido (Verde Campo) com o símbolo conceitual em branco. (Facilmente exportável no Figma para PWA/App).

### Média/Baixa Prioridade (No momento)
*   *Landing page futura, capa de doc, relatórios em PDF.* (A base deve estar focada no app primeiro).

---

## 11. Tom Visual e Verbal (Microcopy)

*   **Tom:** Direto, Operacional, Confiável. Sem excesso de jargão dev (nada de "Erro 500 no endpoint"), mas fiel à rotina da fazenda (nada de "Ops, sua vaquinha sumiu!").
*   **Evitar palavras:** "Cadastrar" (use *Registrar* ou *Adicionar*), "Excluir" sem aviso (use *Remover da fazenda* ou *Lançar morte* dependendo do contexto).

### Exemplos de Microcopy:
*   **Boas-vindas:** "Visão geral do seu rebanho."
*   **Sem dados cadastrados:** "Nenhum animal neste lote. Adicione animais ou faça uma movimentação."
*   **Agenda vazia:** "Nenhuma atividade agendada para hoje."
*   **Evento concluído (Toast):** "Registro salvo com sucesso. [Ícone Check]"
*   **Modo offline (Banner/Panel):** "Você está offline. Os registros estão salvos no aparelho e serão sincronizados automaticamente."
*   **Erro operacional (Ex: peso menor que o anterior):** "Atenção: O peso atual é menor que o último registro. Deseja manter mesmo assim?"
*   **Confirmação de exclusão (Destrutiva):** "Atenção: Esta ação não pode ser desfeita e removerá o histórico associado. Confirmar remoção?"

---

## 12. Tokens de Design (Proposta Técnica)

Mapeamento atualizado para `globals.css` baseando-se no caminho **Gestão Forte**.
Isso serve de base para o arquivo CSS e configuração do Tailwind.

```css
:root {
  /* Fundo e Superfícies (Limpo, alto contraste) */
  --background: 210 40% 98%;      /* #F8FAFC (Slate 50) */
  --foreground: 222 47% 11%;      /* #0F172A (Slate 900) */
  --surface: 0 0% 100%;           /* #FFFFFF */
  --surface-muted: 210 40% 96%;   /* #F1F5F9 (Slate 100) */

  /* Cores de Marca (Verde Campo) */
  --primary: 110 16% 28%;         /* #3F523B */
  --primary-foreground: 0 0% 100%;

  --secondary: 110 16% 95%;       /* Fundo suave verde */
  --secondary-foreground: 110 16% 20%;

  --accent: 15 51% 40%;           /* #9A4C32 (Ferrugem) */
  --accent-foreground: 0 0% 100%;

  /* Semântico (Alertas visíveis) */
  --destructive: 0 72% 51%;       /* #DC2626 */
  --destructive-foreground: 0 0% 100%;

  --success: 161 94% 30%;         /* Emerald 600 */
  --success-foreground: 0 0% 100%;
  --success-muted: 161 40% 95%;

  --warning: 38 92% 44%;          /* Amber 600 */
  --warning-foreground: 0 0% 100%;
  --warning-muted: 38 60% 95%;

  --info: 200 98% 39%;            /* Sky 600 */
  --info-foreground: 0 0% 100%;
  --info-muted: 200 60% 95%;

  /* UI Base */
  --border: 214 32% 91%;          /* Slate 200 */
  --input: 214 32% 91%;
  --ring: 110 16% 28%;            /* Primary ring */

  --radius: 0.75rem;              /* Arredondamento suave mas não bolha */
}
```

*Nota: O `tailwind.config.ts` do repositório já está bem estruturado e herda essas variáveis via classe. A aplicação será imediata apenas ajustando o CSS base.*

---

## 13. Plano Incremental de Implementação

| Fase | Objetivo | Arquivos prováveis | Risco | Critério de pronto |
|---|---|---|---|---|
| **1. Fundamento Visual** | Atualizar paleta core e padronizar cantos/sombras. | `globals.css`, `tailwind.config.ts`, `index.html` (fontes). | **Muito Baixo**. Nenhuma lógica afetada. | Tokens aplicados, botões e cores semânticas refletindo o novo "Verde Campo" e alertas. |
| **2. Tipografia e Microcopy**| Injetar fonte mono para IDs e ajustar textos de placeholders. | `src/components/ui/`, `src/pages/**` (ajustes textuais). | **Baixo**. | Todos os IDs de animais usando fonte Mono; textos padronizados sem jargões soltos. |
| **3. Componentes e Densidade**| Refinar listas mobile, separar cards visuais, arrumar modais de Registro. | `Animais.tsx`, `AnimalDetalhe.tsx`, `Registrar/**` | **Médio** (requer cuidado com refatorações). | Listas renderizando sem excesso de shadow; formulários de celular com touch-targets adequados. |
| **4. Identidade Completa** | Aplicação do Símbolo e Logo. Favicon e capa PWA. | `public/`, `README.md`, `Login.tsx` | **Baixo**. | App icon customizado gerado, favicon alterado, tela de login ostentando o brand. |

---

## Conclusão e Próxima Ação

O **RebanhoSync** não precisa de uma "roupagem de agência digital" no momento, mas sim de uma "vestimenta de utilitário de campo" sólida.
A adoção do caminho **Gestão Forte (Verde Oliva / Terra)** aproveita 100% dos componentes Shadcn atuais do código, exige apenas uma injeção cirúrgica no `globals.css` e melhora imediatamente o conforto e a percepção de estabilidade por parte do produtor.

**Recomendação de Próxima Ação:**
Aprovar os tokens HSL propostos (Fase 1) para gerar um Pull Request apenas de CSS/Tailwind (`globals.css`), consolidando a paleta base no ambiente de desenvolvimento sem interferir no Hardening Arquitetural atual.