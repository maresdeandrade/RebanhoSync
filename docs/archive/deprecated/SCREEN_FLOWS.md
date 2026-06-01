# Documentação Completa de Telas e Fluxos de Navegação

> **Status:** Fonte operacional  
> **Fonte de Verdade:** Código fonte (`src/pages/**`, `src/App.tsx`)  
> **Última Atualização:** 2026-05-08

---

## Módulo 1: Autenticação e Onboarding

### 1.1 Tela de Login (`/login`)
**Objetivo:** Autenticar usuário no sistema  
**Elementos de Interface:**
- Campo de email
- Campo de senha
- Botão "Entrar"
- Link para "Criar conta"
- Link para "Esqueci senha"

**Interações:**
- Submissão de credenciais → autenticação via Supabase Auth
- Redirecionamento para `/select-fazenda` após login bem-sucedido

**Transições:**
- → `/signup` (criar conta)
- → `/select-fazenda` (pós-login)

---

### 1.2 Tela de Cadastro (`/signup`)
**Objetivo:** Cadastrar novo usuário  
**Elementos de Interface:**
- Campo de nome completo
- Campo de email
- Campo de senha
- Botão "Criar conta"
- Link para "Já tem conta? Entrar"

---

### 1.3 Seleção de Fazenda (`/select-fazenda`)
**Objetivo:** Selecionar fazenda ativa para operação  
**Elementos de Interface:**
- Lista de fazendas associadas ao usuário
- Botão "Criar nova fazenda"
- Card de boas-vindas para usuários sem fazendas

**Interações:**
- Clique em fazenda → define fazenda ativa e navega para `/home`
- → `/criar-fazenda`

---

### 1.4 Criação de Fazenda (`/criar-fazenda`)
**Objetivo:** Criar nova fazenda no sistema  
**Elementos de Interface:**
- Formulário com campos: nome, município, estado, tipo de produção
- Botão "Criar fazenda"
- Botão "Cancelar"

---

### 1.5 Aceitar Convite (`/invites/:token`)
**Objetivo:** Aceitar convite para membro da fazenda  
**Elementos de Interface:**
- Exibição de detalhes do convite
- Campo para definir senha (se novo usuário)
- Botão "Aceitar convite"

---

## Módulo 2: Home - Painel Tático

### 2.1 Home (`/home`)
**Objetivo:** Responder rapidamente "o que exige atenção agora?" e "qual ação registrar?"

**Elementos de Interface:**

**Seção 1 - Header operacional:**
- Nome da fazenda + subtítulo (tipo produção | localização)
- Badges compactos de perfil, fila local e atenção operacional

**Seção 2 - Prioridade operacional:**
- Pendências atrasadas
- Agenda de hoje
- Estados vazios/limitados com microcopy curta

**Seção 3 - Ação imediata:**
- Registrar manejo
- Abrir agenda
- Ações secundárias rebaixadas

**Seção 4 - Contexto secundário:**
- Transições de estágio quando relevantes
- Central Operacional passiva/read-only
- Alerta passivo de reposição de estoque quando demanda futura e política de ressuprimento indicarem atenção
- Sync e telemetria em leitura discreta

**Interações:**
- CTAs principais levam para registro ou agenda
- Leituras passivas não geram evento, agenda ou alteração de domínio

**Transições:**
- → `/registrar` (botão principal)
- → `/agenda` (visualizar agenda)
- → `/animais` (ver rebanho)
- → `/protocolos-sanitarios` (protocolos)
- → `/onboarding-inicial` (guia)

---

## Módulo 3: Registro de Manejo

### 3.1 Registrar (`/registrar`)
**Objetivo:** Fluxo guiado para escolher intenção, selecionar alvo, preencher o essencial e salvar

**Fluxo principal:**
1. **Escolher intenção**
   - Tiles compactos por tipo de manejo: sanitário, pesagem, movimentação, nutrição, reprodução e financeiro
   - Estado selecionado evidente, sem descrições longas

2. **Selecionar alvo**
   - Busca como controle principal
   - Seleção por animal/lote/pasto conforme tipo de manejo
   - Contagem de selecionados visível

3. **Preencher essencial e salvar**
   - Campos agrupados por tarefa
   - Contexto técnico apenas quando ajuda a decisão
   - Resumo final compacto e CTA primário claro

**Tipos de Manejo Disponíveis:**
- Sanitário (com protocolos e produtos)
- Pesagem
- Movimentação
- Nutrição
- Financeiro (compra/venda/arrendamento/sociedade)
- Reprodução (cobertura, IA, diagnóstico, parto, aborto)
- Alerta sanitário
- Avaliação de pasto

**Interações Especiais:**
- Query params podem pré-selecionar tipo: `?quick=vacinacao`
- Contexto de agenda: `?sourceTaskId=xxx` preenche com dados da agenda

**Transições:**
- → `/animais/:id` (ao abrir ficha do animal)
- → `/agenda` (ao concluir agenda item)
- → `/protocolos-sanitarios` (para protocolos)

---

## Módulo 4: Agenda Operacional

### 4.1 Agenda (`/agenda`)
**Objetivo:** Visualizar e gerenciar agenda de manejos planejados

**Elementos de Interface:**

**Header:**
- Badges: total de itens, conformidade, transições de estágio

**Métricas de Status:**
- Grid compacto de Agendados, Concluídos e Cancelados com destaque numérico e visual.

**Painel de Compliance:**
- Alertas regulatórios e pendências de conformidade integradas.

**Painel de Lifecycle:**
- Transições de estágio e alertas biológicos/estratégicos.

**Toolbar de Filtros (Compacta):**
- Busca por texto (tipo, animal ou lote).
- Modo de agrupamento (animal/evento) em destaque.
- Filtros secundários sutis: Status, Domínio, Calendário.
- Seletor de período (De/Até) integrado e simplificado.

**Conteúdo Agrupado e Cards de Manejo:**
- Barra de navegação crítica para saltar entre grupos atrasados.
- Cards com hierarquia clara: Tipo de manejo como título, contexto de animal/lote/data com ícones.
- Destaque visual para prazos (atrasado/vencendo).
- Detalhes técnicos (IDs, protocolos, origem) recolhidos por padrão (*Progressive Disclosure*).
- Ações primárias claras: "Revisar no Registrar" e "Concluir tarefa".

**Interações:**
- Clique em "Ver detalhes técnicos" → expande metadados de auditoria.
- Botão "Revisar no Registrar" → abre fluxo completo preservando `sourceTaskId`.
- Botão "Concluir tarefa" → conclusão direta (gera evento sanitário se aplicável).
- Menu de ações secundárias (Dropdown): cancelar, ver evento original, abrir ficha do animal.

**Transições:**
- → `/registrar?sourceTaskId=xxx` (executar da agenda)
- → `/animais/:id` (ficha do animal)
- → `/eventos` (histórico)
- → `/protocolos-sanitarios` (conformidade)

---

## Módulo 5: Gestão de Animais

### 5.1 Lista de Animais (`/animais`)
**Objetivo:** Visualizar e filtrar rebanho com dados operacionais

**Elementos de Interface:**

**Header:**
- Total de animais, filtros ativos e ações de cadastro/importação

**Resumo compacto:**
- Base ativa, recorte atual e principais pendências sem competir com a lista

**Card de Restrições Regulatórias:**
- Alertas de compliance (se houver)

**Toolbar de Filtros:**
- Busca por identificação
- Chips/balões apenas para Sexo, Status e Categoria
- Seletores compactos para lote, estado produtivo, impacto regulatório, subárea regulatória, modo de calendário e âncora de calendário
- Botão limpar filtros

**Lista de Animais:**
- Cards escaneáveis como visual primário
- Identificação em destaque
- Categoria/estágio, lote/pasto e badges essenciais
- CTA simples para abrir ficha
- Tabela técnica duplicada não é padrão primário da tela

**Transições:**
- → `/animais/:id` (ficha do animal)
- → `/animais/novo` (cadastrar)
- → `/animais/importar` (importação CSV)
- → `/animais/transicoes` (mutação em lote)

---

### 5.2 Ficha do Animal (`/animais/:id`)
**Objetivo:** Detalhes completos de um animal específico

**Transições:**
- → `/animais/:id/editar` (editar)
- → `/animais/:id/reproducao` (reprodução)
- → `/animais/:id/pos-parto` (pós-parto)
- → `/animais/:id/cria-inicial` (cria inicial)

---

## Módulo 6: Reprodução

### 6.1 Dashboard de Reprodução (`/reproducao`)
**Objetivo:** Painel dedicado a métricas e gestão reprodutiva

### 6.2 Eventos de Reprodução
- `/animais/:id/reproducao` - Diário reprodutivo
- `/animais/:id/pos-parto` - Pós-parto
- `/animais/:id/cria-inicial` - Cria inicial

---

## Módulo 7: Pastagens

### 7.1 Pastos (`/pastos`)
**Objetivo:** Gerenciar pastos e ocupações

**Transições:**
- → `/pastos/novo`
- → `/pastos/:id` (Detalhe do Pasto)
- → `/pastos/:id/editar`
- → `/pastos/importar`

---

### 7.2 Detalhe do Pasto (`/pastos/:id`)
**Objetivo:** Visualizar métricas operacionais, histórico e manejo de um pasto específico.

**Elementos de Interface:**
- **Métricas de Ocupação**: Cards com lotação atual, tempo médio de ocupação, ganho médio de peso (GMD) e ECC médio.
- **Histórico de Movimentação**: Tabela detalhada da trajetória dos animais no pasto.
- **Manejo e Forrageira**: Dados técnicos sobre tipo de pastagem e metas de manejo.
- **Última Ronda**: Resumo da avaliação de pasto mais recente.

**Interações:**
- Registrar ronda
- Manejar no pasto (atalho para Registrar)
- Editar cadastro

---

## Módulo 8: Lotes

### 8.1 Lotes (`/lotes`)
**Objetivo:** Gerenciar lotes de animais

**Transições:**
- → `/lotes/novo`
- → `/lotes/:id` (Detalhe do Lote)
- → `/lotes/importar`

---

### 8.2 Detalhe do Lote (`/lotes/:id`)
**Objetivo:** Gerenciar animais do lote e visualizar desempenho operacional.

**Elementos de Interface:**
- **Métricas de Ocupação**: Cards com quantidade atual, tempo de permanência, peso médio inicial/final, GMD estimado e cobertura de ECC.
- **Histórico de Movimentação**: Tabela da trajetória dos animais deste lote.
- **Conformidade**: Alertas de restrição de movimentação.
- **Lista de Animais**: Cards dos animais vinculados ao lote.

**Interações:**
- Adicionar animais
- Mudar pasto
- Trocar touro
- Manejar lote (atalho para Registrar)

---

## Módulo 9: Protocolos Sanitários

### 9.1 Protocolos (`/protocolos-sanitarios`)
**Objetivo:** Configurar e visualizar protocolos sanitários

---

## Módulo 10: Inventário

### 10.1 Inventário (`/insumos`)
**Objetivo:** Registrar insumos, entradas/ajustes auditáveis e consumo manual vinculado a evento confirmado

**Elementos de Interface:**
- Leitura principal de itens em estoque segmentada por abas de categoria
- Filtros secundários por tipo de insumo, período e busca textual
- Cards de item/lote com quantidade atual, entradas e saídas do período
- Indicador de ressuprimento por item, baseado em estoque mínimo e ponto de ressuprimento configurados no cadastro do insumo
- Formulário de entrada inicial com insumo, apresentação, lote, validade e local
- Formulário de entrada complementar ou ajuste positivo/negativo em lote existente
- Formulário de consumo por evento sanitário, nutrição ou ronda de pasto elegível
- Pré-seleção de evento via `/insumos?sourceEventoId=...`, usada pelo atalho "Baixar do estoque" no histórico de Eventos
- Edição inline de cadastro no card de item/lote
- Relatórios exibem demanda futura estimada por agenda sanitária aberta válida nos próximos 30 dias, com necessidade, saldo, gap por produto e alerta operacional de reposição combinando saldo atual, parâmetros do insumo e demanda futura
- Relatórios exibem medição dos pré-requisitos da Fase 3: eventos sanitários com produto catalogado, produtos com mapeamento confiável para insumo/lote ativo/apresentação compatível e cobertura de consumo assistido já registrada

**Interações:**
- Categoria define a primeira segmentação visual; tipo de insumo é filtro secundário
- Período recalcula somente os lançamentos `+/-`; o saldo permanece a projeção operacional do lote
- Entrada inicial cria insumo, apresentação, lote físico e movimentação de entrada em um gesto
- Entrada complementar e ajuste criam movimentação append-only no lote físico selecionado
- Consumo cria movimentação append-only vinculada ao evento fonte
- Evento sanitário com produto catalogado filtra lotes sanitários pelo mesmo `produto_veterinario_id` antes da baixa assistida
- Edição altera apenas metadados de insumo/apresentação/lote; saldo continua vindo de movimentações
- Edição de estoque mínimo e ponto de ressuprimento altera apenas `payload.inventory_policy` do insumo; não cria movimentação nem baixa automática
- Eventos e protocolos não baixam estoque automaticamente

**Transições:**
- → `/eventos` (histórico operacional usado como fonte de consumo)
- → `/registrar` (registro de eventos que podem originar baixa manual)
- → `/relatorios` (resumo operacional de estoque, demanda futura por agenda válida, CSV e impressão)

---

## Módulo 11: Configurações e Administração

- `/configuracoes`
- `/perfil`
- `/membros`, `/admin/membros`
- `/relatorios`
- `/dashboard`
- `/financeiro`
- `/insumos`
- `/eventos`
- `/contrapartes`
- `/categorias`
- `/categorias/novo`
- `/editar-fazenda`

---

## Fluxos Principais de Navegação

### Fluxo 1: Registro Direto
```
Home → [Registrar manejo] → Registrar → [Confirmar] → Home
```

### Fluxo 2: Execução via Agenda
```
Home → Agenda → [Executar] → Agenda
```

### Fluxo 3: Onboarding
```
Login → Select Fazenda → [Criar fazenda] → Home → [Checklist de setup]
```

### Fluxo 4: Reprodução com Continuidade
```
Animal → Reprodução → Parto → Pos-parto → Cria Inicial
```

---

## Arquitetura de Informação

### Entidades Principais:
- `fazenda` - Fronteira de isolamento
- `animal` - Entidade central
- `agenda_item` - Intenção futura (Rail 1)
- `evento` - Fato passado (Rail 2)

### Relacionamentos:
- Fazenda 1:N Animais
- Fazenda 1:N Lotes, Pastos
- Animal 1:N Agenda Itens, Eventos
