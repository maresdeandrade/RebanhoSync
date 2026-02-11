# Especificações Completas do Módulo de Eventos e Agenda - RebanhoSync

**Versão:** 1.0  
**Data:** Fevereiro de 2026  
**Módulo:** Eventos e Agenda  
**Dependências:** Rebanho, Inventário, Configurações de Fazenda

---

## 1. Visão Geral do Módulo

O módulo de Eventos e Agenda do RebanhoSync é o núcleo central de rastreabilidade e planejamento de manejos da propriedade rural. Este módulo integra dois conceitos fundamentais da arquitetura do sistema: o **Rail de Eventos** (imutável, append-only) para registro histórico de ocorrências, e o **Rail de Agenda** (mutável) para planejamento e acompanhamento de tarefas futuras.

A proposta central deste módulo é fornecer uma interface unificada que permita aos usuários visualizar tanto o histórico de eventos já realizados quanto as atividades agendadas, mantendo total rastreabilidade de todas as operações realizadas no rebanho. O sistema foi projetado para operar em режим offline-first, garantindo funcionalidade completa mesmo em áreas rurais sem conectividade, com sincronização automática quando a conexão for restabelecida.

A arquitetura técnica subjacente segue o paradigma de Two Rails documentado em [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), onde eventos representam fatos imutáveis do passado e agenda representa intenções mutáveis do futuro. Esta separação permite Queries eficientes para cada tipo de operação, mantendo a integridade dos dados através de validações no servidor e constraints de banco de dados.

---

## 2. Estrutura do Banco de Dados

### 2.1 Tabela de Eventos (`eventos`)

A tabela de eventos constitui o registro central de todos os ocorrências significativas no sistema de gestão pecuária. Cada evento representa um fato imutável que ocorreu em um momento específico, seja uma aplicação de vacina, uma pesagem, uma movimentação entre lotes, um procedimento reprodutivo ou uma transação financeira.

A estrutura atual da tabela já contempla os campos essenciais para rastreabilidade completa, conforme documentado em [`docs/DB.md`](DB.md) e [`docs/ANALISE_CAMPOS_REBANHO.md`](ANALISE_CAMPOS_REBANHO.md). Os campos principais incluem o identificador único, o domínio do evento, o timestamp de ocorrência, referências opcionais a animal ou lote, e um campo de payload para dados específicos.

O sistema de domínios permite categorizar eventos em seis tipos principais: sanitário (vacinações, vermifugações, medicamentos), pesagem (registros de peso), nutrição (alimentação), movimentação (transferências entre lotes ou pastos), reprodução (cobertura, IA, diagnósticos, partos) e financeiro (compras e vendas). Esta categorização facilita tanto a filtragem quanto a geração de relatórios específicos por área de manejo.

A política de append-only implementada através do trigger `prevent_business_update` garante que uma vez registrado, um evento não pode ter seus campos de negócio modificados. Qualquer correção deve ser feita através de um novo evento que referencia o original através do campo `corrige_evento_id`, mantendo assim o histórico completo de todas as alterações.

```
Estrutura da tabela eventos:
├── id                    → UUID (PK)
├── fazenda_id           → UUID (FK, tenant isolation)
├── dominio              → dominio_enum
├── occurred_at          → timestamptz (data/hora do evento)
├── animal_id            → UUID (FK opcional)
├── lote_id              → UUID (FK opcional)
├── source_task_id       → UUID (FK para agenda_itens)
├── corrige_evento_id    → UUID (self-FK para correções)
├── observacoes          → text
├── payload              → jsonb
├── client_id            → text (identidade do cliente)
├── client_op_id         → UUID (idempotência)
├── client_tx_id        → UUID (agrupamento de transação)
├── client_recorded_at   → timestamptz
├── server_received_at   → timestamptz
├── deleted_at           → timestamptz (soft delete)
├── created_at           → timestamptz
└── updated_at           → timestamptz
```

### 2.2 Tabela de Agenda (`agenda_itens`)

A tabela de agenda itens gerencia tarefas e lembretes de manejo, representando o planejamento futuro das atividades da propriedade. Diferentemente dos eventos, os itens de agenda são mutáveis e podem ter seu status alterado, ser adiados ou cancelados conforme a evolução das operações.

O sistema de agenda suporta duas origens principais para seus itens: criação manual por usuários (source_kind = 'manual') e geração automática através de protocolos sanitários (source_kind = 'automatico'). A geração automática utiliza o campo `dedup_key` para evitar duplicação de tarefas quando protocolos são executados múltiplas vezes, respeitando o índice único parcial definido no banco de dados.

A referência ao domínio permite categorizar tarefas da mesma forma que eventos, facilitando a visualização integrada de planejado versus executado. O campo `protocol_item_version_id` conecta itens de agenda aos templates de protocolos, permitindo rastreabilidade de qual protocolo originou determinada tarefa.

A constraint `ck_agenda_alvo` garante que cada item de agenda possui pelo menos uma referência a um animal ou um lote, evitando tarefas sem destinatário definido. Esta validação é importante para manter a integridade do sistema de planejamento.

```
Estrutura da tabela agenda_itens:
├── id                       → UUID (PK)
├── fazenda_id              → UUID (FK, tenant isolation)
├── dominio                 → dominio_enum
├── tipo                    → text
├── status                  → agenda_status_enum
├── data_prevista           → date
├── animal_id               → UUID (FK opcional)
├── lote_id                 → UUID (FK opcional)
├── dedup_key               → text (deduplicação)
├── source_kind             → agenda_source_kind_enum
├── source_ref              → jsonb
├── source_client_op_id     → UUID
├── source_tx_id           → UUID
├── source_evento_id        → UUID (evento que concluiu a tarefa)
├── protocol_item_version_id → UUID
├── interval_days_applied   → int
├── observacoes             → text
├── payload                 → jsonb
├── client_id               → text
├── client_op_id            → UUID
├── client_tx_id            → UUID
├── client_recorded_at      → timestamptz
├── server_received_at      → timestamptz
├── deleted_at              → timestamptz
├── created_at              → timestamptz
└── updated_at              → timestamptz
```

### 2.3 Tabelas de Detalhes de Eventos

Cada domínio de evento possui sua própria tabela de detalhes que armazena informações específicas do tipo de ocorrência. Estas tabelas mantêm relacionamento 1:1 com a tabela principal de eventos através de chave composta (evento_id, fazenda_id), garantindo isolamento por tenant.

A tabela `eventos_sanitario` armazena dados específicos de procedimentos sanitários, incluindo tipo de procedimento, produto aplicado, fabricante, lote do produto, data de validade, dose, unidade, via de administração, local de aplicação e responsáveis. A documentação completa destes campos está disponível em [`docs/ANALISE_EVENTOS_SANITARIOS.md`](ANALISE_EVENTOS_SANITARIOS.md).

A tabela `eventos_pesagem` registra o peso do animal no momento do evento, com validação de valor positivo através de constraint check. Esta informação é fundamental para acompanhamento de desempenho e cálculos de ganho de peso.

A tabela `eventos_movimentacao` registra transferências de animais entre lotes ou pastos, mantendo referências de origem e destino para reconstrução completa do histórico de movimentação de cada animal.

As tabelas `eventos_reproducao`, `eventos_nutricao` e `eventos_financeiro` seguem o mesmo padrão, armazenando dados específicos de cada domínio de evento.

---

## 3. Wireframes e Protótipos de Baixa Fidelidade

### 3.1 Tela Principal de Agenda (Listagem)

A tela principal de agenda apresenta uma visão consolidada das atividades planejadas, organizadas cronologicamente por data prevista. O layout prioriza a visualização rápida do que precisa ser executado, com indicadores visuais claros de status e urgência.

O cabeçalho da página contém o título "Agenda de Manejo" seguido de filtros rápidos por domínio (todos, sanitário, pesagem, movimentação, reprodução, nutrição, financeiro). Um seletor de período permite visualizar agendas do dia, da semana ou do mês. O botão principal de ação "Nova Tarefa" fica posicionado no canto superior direito.

A lista de itens de agenda é apresentada em cards horizontais, cada um contendo a data prevista destacada, o tipo de tarefa com ícone representativo do domínio, a descrição resumida, e badges de status (agendado em amarelo, concluído em verde, cancelado em cinza). Para tarefas com animal associado, o brinco e identificação aparecem com destaque. Para tarefas de lote, o nome do lote é exibido.

Ações contextuais em cada card permitem concluir, editar ou cancelar a tarefa diretamente da listagem. Um indicador de sincronização mostra se o item está pendente de upload para o servidor (ícone de nuvem com ponto de exclamação).

```
┌─────────────────────────────────────────────────────────────────────┐
│  RebanhoSync    [Dashboard]  [Animais]  [Lotes]  [Agenda]  [Config] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Agenda de Manejo                                       [+ Nova Tarefa] │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ [Filtros: ○ Todos  ● Sanitário  ○ Pesagem  ○ Movimentação]  │   │
│  │ [Período: ○ Hoje  ○ Semana  ● Mês  ○ Personalizado]        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ HOJE - Quinta-feira, 6 de Fevereiro de 2025                  │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ● [08:00] Vacinação Aftosa - Lote Bezerros 2024              │   │
│  │    🟡 Agendado | 🔄 Offline | 📋 15 animais                  │   │
│  │    [Concluir] [Editar] [Cancelar]                           │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ● [10:00] Vermifugação - Vaca Matriz A-100                   │   │
│  │    🟡 Agendado | 🔄 Offline | 🐄 A-100                       │   │
│  │    [Concluir] [Editar] [Cancelar]                           │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ● [14:00] Pesagem - Lote Novilhas 12-18 meses                │   │
│  │    🟡 Agendado | 🔄 Offline | 📋 22 animais                 │   │
│  │    [Concluir] [Editar] [Cancelar]                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  AMANHÃ - Sexta-feira, 7 de Fevereiro de 2025                     │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ● [09:00] Aplicação Antiinflamatório - BO-245               │   │
│  │    🟡 Agendado | 🔄 Offline | 🐄 BO-245                      │   │
│  │    [Concluir] [Editar] [Cancelar]                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Status: ● Online  ○ Offline  ↻ Sincronizando...]                │
│└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Tela de Criação/Edição de Evento

A tela de registro de eventos é o ponto central para captura de dados de manejo. O formulário é organizado em seções lógicas, iniciando pelos dados básicos do evento, seguidos pelos detalhes específicos do domínio, e concluindo com informações adicionais.

O cabeçalho apresenta o título dinâmico conforme o tipo de operação (Novo Registro de Evento ou Editar Evento), com botão de cancelamento e ação principal de salvar. Um indicador de progresso mostra em qual etapa o usuário está (dados básicos, detalhes, confirmação).

A primeira seção coleta informações obrigatórias: domínio do evento através de abas ou dropdown, tipo específico dentro do domínio, data e hora da ocorrência (com preset para "agora"), e seleção de alvo (animal individual ou lote). A seleção de animal utiliza um componente de busca com autocomplete que consulta a tabela de animais localmente.

A segunda seção exibe campos específicos conforme o domínio selecionado. Para eventos sanitários, aparecem campos de produto, fabricante, lote do produto, dose, via de administração e local de aplicação. Para pesagem, apenas o campo de peso em quilogramas. Para movimentação, campos de origem e destino. Esta dinâmica de campos é implementada através de formulários condicionais.

A terceira seção permite adicionar observações textuais e visualizar o payload JSON que será enviado ao servidor. Opcionalmente, ao concluir um item de agenda, campos de associação permitem vincular o evento à tarefa original.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Novo Registro de Evento                                [✕] [Salvar] │
├─────────────────────────────────────────────────────────────────────┤
│  [Passo 1/3: Dados Básicos]  [Passo 2/3: Detalhes]  [Passo 3/3: Confirmação] │
│  ───────────────────────────────────────────────────────────────   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ DOMÍNIO DO EVENTO                                           │   │
│  │ ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────────┐   │   │
│  │ │Sanitário│ │  Pesagem  │ │Movimentação│ │   Reprodução   │   │   │
│  │ └─────────┘ └───────────┘ └──────────┘ └─────────────────┘   │   │
│  │ ┌─────────┐ ┌───────────┐                                   │   │
│  │ │ Nutrição│ │Financeiro│                                   │   │
│  │ └─────────┘ └───────────┘                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ TIPO DE EVENTO                                             │   │
│  │ [Vacinação                    ▼]                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ DATA E HORA DA OCORRÊNCIA                                   │   │
│  │ [06/02/2025] [14:30] [✓ Usar data atual]                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ALVO DO EVENTO                                              │   │
│  │ ○ Animal Individual     ○ Lote                              │   │
│  │ [Buscar animal...        🔍]  [Seleccionar do mapa]         │   │
│  │                                                            │   │
│  │ Animais Selecionados:                                       │   │
│  │ ● BO-245 (Macho, 18 meses)                                  │   │
│  │ ● BO-248 (Fêmea, 18 meses)  [+ Adicionar mais]              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [← Voltar]                                     [Próximo →]         │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Visualização de Timeline de Eventos

A tela de timeline apresenta o histórico cronológico de eventos de um animal ou lote específico, permitindo análise retrospectiva completa do histórico de manejos. O layout segue o padrão de feed vertical, com eventos mais recentes no topo.

O cabeçalho exibe informações resumidas do animal ou lote, incluindo identificação, idade calculada a partir da data de nascimento, sexo, lote atual e status. Um badge indica se o animal está "ativo", "vendido" ou "morto".

A timeline é apresentada como uma linha vertical com marcadores de data e hora. Cada evento é representado por um card contendo o timestamp formatado de forma relativa ("há 2 dias", "ontem às 14:30"), o domínio através de ícone colorido (sanitário em verde, pesagem em azul, movimentação em roxo, etc.), o tipo específico do evento, e badges de informações relevantes.

Para eventos sanitários, o card inclui detalhes como produto aplicado, dose e responsável. Para pesagens, o peso registrado e o ganho desde a última medição. Para movimentações, origem e destino com seta indicativa. Para eventos com correções, um indicador mostra que existe um evento de correção posterior.

Ícones de ação permitem quick links para registrar novo evento do mesmo tipo ou visualizar detalhes completos. Filtros no topo permitem ocultar categorias específicas de eventos para limpeza visual.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Timeline de Eventos                                    [📊 Relatório] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🐄 BO-245 | Macho | 18 meses | Lote Novilhas 2024 | ✅ Ativo │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [Filtrar: ☑ Sanitário  ☑ Pesagem  ☑ Movimentação  ☑...]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ╔═════════════════════════════════════════════════════════════╗   │
│  ║  HOJE - Quinta-feira, 6 de Fevereiro de 2025                 ║   │
│  ╠═════════════════════════════════════════════════════════════╣   │
│  ║                                                             ║   │
│  ║  ●━━━╮  14:30 - Vacinação                                    ║   │
│  ║  │   ╰  Produto: Vacina Aftosa Oleosa                        ║   │
│  ║  │       Fabricante: Vallée S/A                             ║   │
│  ║  │       Dose: 2ml - Via: Subcutânea                         ║   │
│  ║  │       [➕ Novo Evento Similar]  [Ver Detalhes]             ║   │
│  ║  ╰───────────────────────────────────────────────────────────╯   │
│  ║                                                             ║   │
│  ║  ●━━━╮  10:00 - Pesagem                                      ║   │
│  ║  │   ╰  Peso: 245 kg                                         ║   │
│  ║  │       Ganho: +12 kg (desde 15/01/2025)                    ║   │
│  ║  │       [➕ Nova Pesagem]  [Ver Detalhes]                   ║   │
│  ║  ╰───────────────────────────────────────────────────────────╯   │
│  ║                                                             ║   │
│  ╠═════════════════════════════════════════════════════════════╣   │
│  ║  15 DIAS ATRÁS - 22 de Janeiro de 2025                       ║   │
│  ╠═════════════════════════════════════════════════════════════╣   │
│  ║                                                             ║   │
│  ║  ●━━━╮  09:15 - Movimentação                                 ║   │
│  ║  │   ╰  De: Curral A → Para: Lote Novilhas 2024              ║   │
│  ║  │       [➕ Nova Movimentação]  [Ver Detalhes]              ║   │
│  ║  ╰───────────────────────────────────────────────────────────╯   │
│  ║                                                             ║   │
│  ╠═════════════════════════════════════════════════════════════╣   │
│  ║  3 MESES ATRÁS - 6 de Novembro de 2024                       ║   │
│  ╠═════════════════════════════════════════════════════════════╣   │
│  ║                                                             ║   │
│  ║  ●━━━╮  10:30 - Entrada no Rebanho                           ║   │
│  ║  │   ╰  Origem: Compra - GTA: 2024-08923                     ║   │
│  ║  │       Peso Entrada: 180 kg                                ║   │
│  ║  │       [Ver Detalhes]                                      ║   │
│  ║  ╰───────────────────────────────────────────────────────────╯   │
│  ╚═════════════════════════════════════════════════════════════╝   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.4 Tela de Calendário Visual

A visualização em calendário oferece uma visão macro do planejamento mensal, permitindo identificação rápida de períodos concentrados de atividades e melhor distribuição de tarefas ao longo do tempo.

O cabeçalho do calendário exibe navegação entre meses (janeiro, fevereiro, março de 2025) com botões de anterior, próximo e botão para retornar ao mês atual. Um seletor de ano facilita navegação para longe períodos. Dropdown de filtros permite visualizar apenas domínios específicos.

Cada dia do calendário é representado por uma célula contendo o número do dia e indicadores de quantas tarefas estão agendadas. Códigos de cores representam o domínio predominante: verde para sanitário, azul para pesagem, roxo para movimentação, laranja para reprodução, cinza para outros. Quando há muitas tarefas em um dia, um indicador numérico mostra a quantidade total.

Clicar em um dia expande um panel lateral ou modal mostrando a lista completa de tarefas daquele dia, permitindo ações diretas sem navegar para outra página. O dia atual é destacado com borda colorida. Dias com tarefas vencidas (data_prevista menor que hoje) são destacados em vermelho claro como indicador de pendência.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  [< Fevereiro 2025 >]  [Hoje]                          [📅 Mês ▼] │
│                                                                     │
│  Dom:  ┌────┬────┬────┬────┬────┬────┬────┐                       │
│        │ 26 │ 27 │ 28 │ 29 │ 30 │ 31 │ 1  │                       │
│        │    │    │    │    │ 🟢3│    │ 🟢1│                       │
│  Seg:  ├────┼────┼────┼────┼────┼────┼────┤                       │
│        │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │                       │
│        │ 🟢2│    │ 🔴1│ 🟢5│ 🔴2│ 🟢3│ 🟢1│  ← Hoje              │
│  Ter:  ├────┼────┼────┼────┼────┼────┼────┤                       │
│        │ 9  │ 10 │ 11 │ 12 │ 13 │ 14 │ 15 │                       │
│        │ 🟢1│ 🟢4│    │ 🟢2│    │ 🟢6│    │                       │
│  Qua:  ├────┼────┼────┼────┼────┼────┼────┤                       │
│        │ 16 │ 17 │ 18 │ 19 │ 20 │ 21 │ 22 │                       │
│        │ 🟢2│    │ 🟢3│ 🔵1│ 🟢1│ 🟢2│ 🟢4│                       │
│  Qui:  ├────┼────┼────┼────┼────┼────┼────┤                       │
│        │ 23 │ 24 │ 25 │ 26 │ 27 │ 28 │ 1  │                       │
│        │ 🟢1│    │ 🟢2│ 🟢3│ 🟢5│ 🟢2│    │                       │
│  Sex:  └────┴────┴────┴────┴────┴────┴────┘                       │
│  Sáb:  [Legenda: 🟢 Sanitário 🔵 Pesagem 🟣 Movimentação 🟠 Reprodução 🔴 Vencido] │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 6 de Fevereiro de 2025 (Quinta-feira)                       │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ● 08:00 - Vacinação Aftosa - Lote Bezerros 2024 (12 itens) 🟡 │   │
│  │ ● 10:00 - Vermifugação - Vacas Matriz (8 itens) 🟡           │   │
│  │ ● 14:00 - Aplicação Antibiótico - BO-245 🐄 🟡              │   │
│  │ ● 16:00 - Pesagem - Lote Novilhas 2024 (22 itens) 🔵        │   │
│  │ ● 16:30 - Pesagem - BO-248 🐄 🔵                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Especificações de UI/UX

### 4.1 Princípios de Design

O design do módulo de Eventos e Agenda segue princípios fundamentais de usabilidade adaptados para o contexto de uso em campo, considerando que usuários podem estar em condições adversas de iluminação, utilizarem dispositivos móveis com telas pequenas, e necessitarem de operações rápidas e eficientes.

O princípio de feedback imediato garante que toda ação do usuário produza uma resposta visual instantânea. Operações em modo offline são confirmadas imediatamente com indicador visual de "pendente de sincronização", transmitindo confiança de que os dados estão salvos localmente e serão sincronizados quando possível.

A hierarquia visual estabelece clara distinção entre elementos interativos e informativos. Ações principais (salvar, concluir) utilizam cores saturadas e posicionamento proeminente, enquanto informações secundárias utilizam cores mais neutras e tamanhos menores.

A consistência com o sistema de design shadcn/ui existente no projeto é mantida através do uso de componentes padronizados (Button, Card, Dialog, Select, etc.) e tokens de design do Tailwind CSS. A documentação de componentes está disponível no diretório [`src/components/ui/`](src/components/ui/).

### 4.2 Hierarquia de Informações

A organização da informação segue uma estrutura hierárquica clara que permite navegação eficiente entre diferentes níveis de detalhe. O primeiro nível compreende visões gerais (dashboard de agenda, calendário mensal), onde o usuário obtém contexto amplo da situação atual. O segundo nível apresenta listas filtradas (agenda do dia, eventos de um lote) para planejamento operacional. O terceiro nível fornece detalhes completos (formulário de registro, timeline de animal) para análise aprofundada.

Elementos críticos como data, hora e status utilizam destaque visual consistente em todas as telas. Datas de tarefas vencidas utilizam cor vermelha. Ícones coloridos por domínio permitem identificação rápida sem necessidade de ler texto. Badges de status seguem convenções universais: verde para concluído, amarelo para pendente, cinza para cancelado/inativo.

### 4.3 Fluxos de Navegação

O sistema de navegação entre telas do módulo segue padrões estabelecidos na arquitetura de rotas documentada em [`docs/ARCHITECTURE.md`](ARCHITECTURE.md). A navegação principal é realizada através da barra lateral (`SideNav`) que contém links para as principais funcionalidades do sistema.

A partir da tela de agenda, o usuário pode navegar para: criação de nova tarefa através do botão de ação principal, visualização de calendário através de toggle de visualização, detalhe de item de agenda para edição ou conclusão, registro de novo evento através de link secundário, e visualização de animal/lote através de cliques nos alvos dos itens.

A partir da tela de timeline de animal (acessível através de links em agenda ou diretamente pela lista de animais), a navegação permite: registro de novo evento através de botão no topo, acesso ao detalhe completo do animal através de informações de cabeçalho, visualização de lotes através de links nos eventos de movimentação, e exportação de histórico através de menu de ações.

### 4.4 Componentes de Interface

O módulo reutiliza e estende os componentes de interface existentes no projeto. A lista a seguir detalha os componentes principais e sua aplicação específica no contexto de Eventos e Agenda.

O componente `Card` é utilizado extensivamente para representar itens de agenda e eventos na timeline. Extensões de estilo adicionam suporte para bordas coloridas por domínio e badges de status incorporados. O componente `Dialog` serve como base para formulários de criação/edição de eventos, com variações de tamanho (pequeno para tarefas rápidas, médio para formulários padrão, grande para formulários complexos com múltiplos animais). O componente `Calendar` (do shadcn/ui) é utilizado tanto para seleção de datas quanto para visualização mensal, com customização de renderização para exibir indicadores de tarefas.

Componentes específicos do domínio incluem: `TimelineEventCard` para representação de eventos na timeline, `AgendaItemCard` para itens de agenda com ações contextuais, `AnimalBadgeSelector` para seleção de múltiplos animais com busca em tempo real, e `BatchSelector` para seleção de lotes inteiros com contagem de animais.

---

## 5. Regras de Negócio

### 5.1 Validações de Eventos

As validações de eventos são executadas em múltiplas camadas do sistema para garantir integridade dos dados tanto no frontend quanto no backend. A primeira camada de validação ocorre no formulário de registro, impedindo submissão de dados incompletos ou inválidos.

Validações obrigatórias incluem: domínio do evento deve ser um dos valores definidos no enum `dominio_enum`, timestamp de ocorrência não pode ser futura (exceto允许ção de até 5 minutos para compensação de f Horowitz), pelo menos um dos campos animal_id ou lote_id deve estar preenchido, e tipo específico deve ser válido para o domínio selecionado.

Validações específicas por domínio incluem: para sanitário, produto é obrigatório e dose deve ser maior que zero; para pesagem, peso_kg deve ser maior que zero; para movimentação, ou from_ ou to deve estar preenchido; para financeiro, valor deve ser maior que zero e contraparte é obrigatória para transações.

A camada de validação no servidor, implementada através de triggers e constraints PostgreSQL, garante que dados inválidos não persistam mesmo se a validação frontend for contornada. A trigger `prevent_business_update` documentada em [`docs/DB.md`](DB.md) protege a integridade append-only dos eventos.

### 5.2 Estados de Eventos

Os eventos no sistema seguem o paradigma append-only onde uma vez criados, não podem ter seus campos de negócio modificados. O único "estado" que muda ao longo do tempo é o campo `deleted_at` utilizado para soft delete.

O ciclo de vida de um evento compreende os seguintes estados: criação (INSERT), onde todos os campos são definidos e validados; persistência (soft delete), onde deleted_at é preenchido sem remover fisicamente o registro; e correção (novo evento), onde um novo evento é criado com corrige_evento_id referenciando o original.

A estrutura de eventos corrigidos permite rastreabilidade completa de alterações. Quando um evento precisa ser corrigido (por exemplo, peso registrado incorretamente), um novo evento é criado com domínio "correcao" ou "ajuste", populando o campo corrige_evento_id com o ID do evento original. Ambos os eventos permanecem visíveis na timeline, com indicação visual de que existe uma correção.

### 5.3 Estados de Agenda

Os itens de agenda possuem um ciclo de vida mais complexo, refletindo a natureza mutável do planejamento. O campo `status` do tipo `agenda_status_enum` define o estado atual com os valores possíveis: 'agendado' (pendente de execução), 'concluido' (executado com sucesso), e 'cancelado' (cancelado antes da execução).

Transições de estado seguem regras específicas: de 'agendado' para 'concluido' requer vinculação de pelo menos um evento através do campo source_evento_id; de 'agendado' para 'cancelado' requer justificativa textusalguardada em observacoes; transições reversas ('concluido' para 'agendado' ou 'cancelado' para 'agendado') são bloqueadas para evitar confusão operacional.

Itens de agenda podem ser criados manualmente por qualquer membro da equipe (conforme permissões em [`docs/RLS.md`](RLS.md)) ou automaticamente através de protocolos sanitários. Items automáticos recebem source_kind = 'automatico' e populam os campos de referência ao protocolo original.

### 5.4 Sistema de Deduplicação

O sistema de deduplicação previne a criação de tarefas duplicadas quando protocolos automáticos disparam múltiplas vezes ou quando usuários registram eventos offline e online simultaneamente. A implementação utiliza o índice parcial único `ux_agenda_dedup_active` documentado em [`docs/CONTRACTS.md`](CONTRACTS.md).

A chave de deduplicação (dedup_key) é construída concatenando informações únicas do contexto: animal_id ou lote_id, tipo de evento, data prevista e identificador do protocolo quando aplicável. O formato típico é `{animal_id}:{tipo}:{data_prevista}:{protocolo_id}` para eventos de protocolo ou `{lote_id}:{tipo}:{data_prevista}` para eventos manuais.

Quando uma operação de INSERT encontra conflito de dedup_key, o servidor retorna status 'APPLIED_ALTERED' com código 'collision_noop', indicando que a tarefa já existe e não foi criado um novo registro. O cliente interpreta este retorno como sucesso e mantém o item existente.

### 5.5 Permissões por Função

O sistema de permissões segue a matriz de roles documentada em [`docs/RLS.md`](RLS.md), com três papéis principais: cowboy (operador de campo), manager (gestor da fazenda) e owner (dono/proprietário).

Para leitura de eventos e agenda, todos os papéis possuem acesso completo aos dados da fazenda onde são membros. A função helper `has_membership(fazenda_id)` valida o acesso em tempo de query.

Para criação de eventos, todos os papéis podem registrar eventos de qualquer domínio, incluindo financeiro. Esta decisão de design reconhece que decisões de compra em campo podem ser tomadas por qualquer colaborador e devem ser registradas imediatamente.

Para criação de agenda, todos os papéis podem criar tarefas, porém apenas owner e manager podem criar tarefas com source_kind = 'automatico' (geração por protocolos) e editar tarefas criadas por outros usuários.

Para edição de eventos (correções), todos os papéis podem criar novos eventos que referenciem eventos existentes como correções. A exclusão (soft delete) de eventos é restrita a owner e manager.

### 5.6 Sincronização Offline

O sistema de sincronização offline implementado através do paradigma de Two Rails documentado em [`docs/OFFLINE.md`](OFFLINE.md) permite operação completa sem conectividade.

Durante operação offline, eventos e agenda são armazenados localmente nas stores Dexie correspondentes (`event_eventos`, `event_eventos_*`, `state_agenda_itens`). Cada operação gera um gesture com client_tx_id único, armazenado em `queue_gestures`, e operações individuais em `queue_ops`.

O sync worker tenta sincronizar gestos pendentes a cada 5 segundos. Falhas de rede resultam em retry automático até 3 vezes. Após 3 tentativas malsucedidas, o gesto vai para estado ERROR e requer intervenção manual através da tela de reconciliação.

Rejeições de servidor (por exemplo, validação anti-teleporte falhando) resultam em rollback determinístico usando snapshots capturados antes da aplicação otimista. O registro é removido da store local e um registro de rejeição é criado em `queue_rejections` para notificação ao usuário.

---

## 6. Casos de Uso Detalhados

### 6.1 CU-01: Registrar Evento Sanitário Individual

**Objetivo:** Registrar a aplicação de um produto sanitário em um animal individual.

**Ator:** Cowboy, Manager ou Owner.

**Pré-condições:** Animal está cadastrado no sistema, usuário possui membership ativo na fazenda, animal está com status ativo.

**Fluxo Principal:**

O usuário acessa a funcionalidade através do menu "Registrar" ou do botão rápido na página do animal. Na tela de registro, o usuário seleciona domínio "Sanitário" e o tipo específico (Vacinação, Vermifugação ou Medicamento). O sistema exibe campos específicos para o tipo selecionado.

O usuário seleciona o animal através da busca por brinco, nome ou identificação parcial. O sistema exibe informações resumidas do animal (sexo, idade, lote atual) e sugere produtos frequentemente utilizados no histórico do animal.

O usuário preenche os detalhes do evento: produto (com autocomplete de produtos já utilizados na fazenda), fabricante (opcional), lote do produto (opcional), dose com unidade, via de administração e local de aplicação. Campos específicos como data de validade do lote são validados contra a data atual.

Ao confirmar, o sistema cria um gesto local com INSERT nas tabelas `eventos` e `eventos_sanitario`, aplica otimisticamente nas stores locais, e enfileira para sincronização. O usuário recebe feedback visual de sucesso com indicação de "pendente de sincronização".

**Fluxos Alternativos:**

Se o produto informado não existe no histórico, o sistema permite cadastro inline do novo produto, que será sincronizado junto com o evento.

Se a conexão está indisponível no momento do registro, o gesto permanece pendente com indicador visual, e a sincronização ocorre automaticamente quando a conexão for restabelecida.

**Pós-condições:** Evento registrado localmente, sincronização pendente, timeline do animal atualizada visualmente.

### 6.2 CU-02: Registrar Vacinação em Lote

**Objetivo:** Registrar aplicação de vacina ou medicamento em todos os animais de um lote específico.

**Ator:** Cowboy, Manager ou Owner.

**Pré-condições:** Lote está cadastrado no sistema, lote contém pelo menos um animal ativo.

**Fluxo Principal:**

O usuário acessa a funcionalidade de registro e seleciona domínio "Sanitário". Alternativamente, acessa a página do lote e utiliza a ação rápida "Vacinar Lote".

O usuário seleciona o lote de destino através de dropdown filtrado por lotes ativos. O sistema exibe a lista de animais do lote com checkboxes para seleção, além de contadores de selecionados/total.

O usuário pode selecionar todos os animais ou escolher individualmente. O sistema valida se pelo menos um animal foi selecionado.

O usuário preenche os detalhes do produto sanitário: tipo de procedimento, produto, fabricante, dose, via de aplicação e local. Para produtos já utilizados em eventos anteriores do lote, o sistema sugere os valores mais recentes.

Ao confirmar, o sistema gera um gesture com múltiplas operações: um INSERT na tabela `eventos` para cada animal selecionado (com o mesmo timestamp), INSERTs correspondentes em `eventos_sanitario`, e UPDATE em cada animal para registrar a última data de procedimento sanitário no campo de metadata.

O sistema aplica otimisticamente todos os eventos na timeline local e agenda a sincronização batch.

**Pós-condições:** Eventos criados para cada animal, agenda do lote atualizada se aplicável, dados pendentes de sincronização.

### 6.3 CU-03: Agendar Tarefa de Manejo

**Objetivo:** Criar uma nova tarefa na agenda para execução futura.

**Ator:** Cowboy, Manager ou Owner.

**Pré-condições:** Nenhuma pré-condição específica.

**Fluxo Principal:**

O usuário acessa a página de agenda e clica no botão "Nova Tarefa" ou utiliza a ação "Agendar" disponível em diversas telas do sistema.

Na tela de criação, o usuário seleciona o domínio da tarefa e o tipo específico. Para tarefas relacionadas a protocolos, o sistema oferece sugestão de tipos baseados nos protocolos ativos da fazenda.

O usuário define a data prevista para execução, podendo utilizar presets de "hoje", "amanhã", "próxima semana" ou selecionar data específica no calendário.

O usuário seleciona o alvo da tarefa: animal individual (com busca), lote (com seleção), ou múltiplos animais através de filtros. O sistema exibe preview da quantidade de alvos afetados.

Opcionalmente, o usuário pode associar a tarefa a um protocolo existente (para tarefas de protocolo) ou adicionar observações e instruções para execução.

Ao confirmar, o sistema cria o registro em `agenda_itens` com status 'agendado', source_kind = 'manual' se criado manualmente, e gera a dedup_key baseada nos parâmetros selecionados.

**Pós-condições:** Item de agenda criado, visível na listagem e calendário, sincronização pendente.

### 6.4 CU-04: Concluir Tarefa da Agenda

**Objetivo:** Marcar uma tarefa da agenda como concluída, vinculando os eventos de execução.

**Ator:** Cowboy, Manager ou Owner.

**Pré-condições:** Item de agenda existe com status 'agendado'.

**Fluxo Principal:**

O usuário acessa a página de agenda e localiza a tarefa a ser concluída. Na listagem ou visualização de dia específico, cada item tem ação "Concluir" disponível.

Ao clicar em concluir, o sistema apresenta um dialog com duas opções: registrar eventos de execução imediatamente ou marcar como concluído sem eventos (para tarefas administrativas).

Se a primeira opção é escolhida, o sistema navega para o formulário de registro de evento, pré-populando com os dados do item de agenda (domínio, tipo, alvo). O usuário confirma ou ajusta os dados do evento.

Após o registro do evento, o sistema atualiza o item de agenda: status = 'concluido', source_evento_id = ID do evento criado, updated_at = timestamp atual.

Se a segunda opção é escolhida, o sistema solicita confirmação e observação justificando a conclusão sem evento registrado.

**Pós-condições:** Item de agenda marcado como concluído, evento(s) criado(s), timeline atualizada, sync pendente.

### 6.5 CU-06: Visualizar Timeline de Animal

**Objetivo:** Acessar o histórico completo de eventos de um animal específico.

**Ator:** Cowboy, Manager ou Owner.

**Pré-condições:** Animal existe no sistema.

**Fluxo Principal:**

O usuário acessa a lista de animais através do menu ou utiliza busca global. Na lista, o usuário localiza o animal desejado por brinco, nome ou filtros, e clica para acessar o detalhe.

Na página de detalhe do animal, a seção de timeline exibe todos os eventos em ordem cronológica inversa (mais recentes primeiro). O usuário pode utilizar filtros por domínio para focar em tipos específicos de eventos.

Cada item da timeline exibe data/hora, domínio com ícone, tipo do evento e detalhes específicos. O usuário pode expandir itens para visualizar informações completas ou colapsar para visualização resumida.

Para eventos de um mesmo tipo em sequência (por exemplo, pesagens), o sistema calcula e exibe ganhos/perdas entre eventos consecutivos.

Ações disponíveis incluem: registrar novo evento do mesmo tipo (ícone de mais), registrar correção (ícone de editar), exportar histórico (menu de ações).

**Pós-condições:** Timeline exibida com eventos sincronizados.

### 6.6 CU-07: Cancelar Item de Agenda

**Objetivo:** Cancelar uma tarefa agendada que não será mais executada.

**Ator:** Manager ou Owner (cowboy pode cancelar apenas suas próprias tarefas).

**Pré-condições:** Item de agenda existe com status 'agendado'.

**Fluxo Principal:**

O usuário acessa a agenda e localiza o item a ser cancelado. No card do item, clica na ação "Cancelar".

O sistema apresenta dialog de confirmação solicitando justificativa textusalguardada em observacoes. O campo de justificativa é obrigatório.

Ao confirmar, o sistema atualiza o item: status = 'cancelado', observacoes = justificativa informada, updated_at = timestamp atual.

O item permanece visível na agenda com indicador visual de cancelado (badge cinza, texto tachado), preservando o histórico de planejamento.

**Pós-condições:** Item marcado como cancelado, justificativa registrada, sync pendente.

### 6.7 CU-08: Sincronizar Dados Offline

**Objetivo:** Garantir que dados registrados offline sejam sincronizados com o servidor quando a conectividade for restabelecida.

**Ator:** Sistema (automático) ou Cowboy (manual).

**Pré-condições:** Existem gestos pendentes de sincronização no Dexie local.

**Fluxo Principal:**

O sync worker executa em intervalos regulares (a cada 5 segundos) verificando gestos com status 'PENDING'. Para cada gesto, o worker obtém o JWT do Supabase Auth e monta o payload de sincronização.

O payload é enviado para a Edge Function `/functions/v1/sync-batch` documentada em [`docs/CONTRACTS.md`](CONTRACTS.md). O servidor valida autenticação, membership e executa as operações.

Para cada operação, o servidor retorna status: 'APPLIED' (sucesso), 'APPLIED_ALTERED' (sucesso com modificação, ex: dedup), ou 'REJECTED' (falha de regra de negócio).

O sistema processa os resultados: gestos totalmente aplicados são marcados como 'DONE' e removidos da queue; gestos com rejeição executam rollback local e são marcados como 'REJECTED'.

A interface exibe indicadores de status: ícone de nuvem para pendentes, checkmark para sincronizados, alerta para rejeitados.

**Pós-condições:** Dados sincronizados com servidor ou rejeições notificadas ao usuário.

### 6.8 CU-09: Corrigir Evento Errado

**Objetivo:** Registrar correção para um evento com dados incorretos.

**Ator:** Cowboy, Manager ou Owner.

**Pré-condições:** Evento existe no sistema.

**Fluxo Principal:**

O usuário localiza o evento incorreto na timeline de um animal ou na listagem de eventos. Na visualização expandida do evento, clica na ação "Corrigir".

O sistema apresenta formulário pré-populado com os dados do evento original, permitindo edição. O título indica claramente que é uma "Correção de Evento".

O usuário ajusta os campos necessários (por exemplo, corrige peso de 245kg para 255kg). O sistema calcula automaticamente a diferença e pode exibir comparação visual.

Ao confirmar, o sistema cria um novo evento: evento_id único, corrige_evento_id = ID do evento original, occurred_at = timestamp atual (ou data da correção), payload com valores corrigidos e optionally diff dos valores anteriores.

Na timeline, o evento original e a correção são exibidos com indicador visual de correção. Cálculos de ganho/perda subsequentes consideram o valor corrigido.

**Pós-condições:** Evento de correção criado, histórico preservado, sync pendente.

### 6.9 CU-10: Gerar Agenda a partir de Protocolo

**Objetivo:** Criar automaticamente itens de agenda baseados em protocolos sanitários existentes.

**Ator:** Manager ou Owner.

**Pré-condições:** Protocolo sanitário existe com itens configurados para geração de agenda.

**Fluxo Principal:**

O usuário acessa a seção de protocolos sanitários e seleciona um protocolo ativo. Na visualização do protocolo, clica na ação "Gerar Agenda".

O sistema exibe dialog de configuração com opções: selecionar animais ou lotes alvo (ou usar as definições do protocolo), definir data de início do cronograma, e confirmar geração.

Ao confirmar, o sistema processa cada item do protocolo: calcula a data de aplicação baseada na data de início mais intervalos configurados, verifica se já existem tarefas com dedup_key equivalente (para evitar duplicação), e cria os itens de agenda com source_kind = 'automatico', source_ref = referência ao protocolo, e protocol_item_version_id = versão atual do item.

O sistema fornece feedback do número de tarefas criadas versus tarefas já existentes (colisões de dedup).

**Pós-condições:** Itens de agenda criados para os animais/lotes selecionados, protocolo tem rastreabilidade de aplicações geradas.

### 6.10 CU-11: Visualizar Agenda por Período

**Objetivo:** Obter visão consolidada das tarefas planejadas para um período específico.

**Ator:** Cowboy, Manager ou Owner.

**Pré-condições:** Nenhuma pré-condição.

**Fluxo Principal:**

O usuário acessa a página de agenda e seleciona o modo de visualização desejado: lista (padrão), calendário mensal ou lista por dia.

Na visualização por período (semana ou mês), o sistema agrupa tarefas por data, exibindo contadores de tarefas por domínio. Tarefas vencidas são destacadas com indicador visual.

O usuário pode filtrar por domínio, status, alvo (animal ou lote), ou texto de busca. Filtros ativos são indicados com badges na barra de filtros.

Para cada dia, o sistema calcula métricas resumidas: total de tarefas, distribuição por domínio, tarefas concluídas vs pendentes.

Ações disponíveis incluem: expandir dia para visualizar todas as tarefas, quick jump para data específica, exportação do período filtrado.

**Pós-condições:** Usuário obtém visão consolidada do planejamento.

---

## 7. Integração com Módulos Existentes

### 7.1 Integração com Módulo Rebanho

O módulo de Eventos e Agenda mantém integração estreita com o módulo de Rebanho, que gerencia a tabela `animais`. Esta integração é fundamental para rastreabilidade completa do ciclo de vida de cada animal.

A referência a animais em eventos e agenda utiliza a chave composta (id, fazenda_id) documentada nas constraints de FK em [`docs/DB.md`](DB.md). Quando um animal é selecionado para um evento ou tarefa, o sistema valida que o animal pertence à fazenda ativa através da membership verificada pela função `has_membership()`.

O campo `lote_id` em eventos e agenda permite operações em nível de grupo, reduzindo a necessidade de registrar eventos individuais quando múltiplos animais passam pelo mesmo procedimento. A seleção de lote utiliza o componente `BatchSelector` que consulta a tabela `lotes` e exibe contagem de animais ativos.

A timeline de eventos na página de detalhe do animal integra-se com o módulo de Rebanho para exibir informações contextuais: dados básicos do animal (nascimento, sexo, status), lote atual, categoria zootécnica quando implementada, e links para páginas relacionadas.

Operações que afetam o estado do animal (como eventos de movimentação que alteram o lote) utilizam o padrão anti-teleporte documentado em [`docs/CONTRACTS.md`](CONTRACTS.md), garantindo que toda alteração de lote seja precedida por evento de movimentação no mesmo batch de sincronização.

### 7.2 Integração com Módulo Inventário

A integração com o módulo de Inventário, através das tabelas `pastos` e `lotes`, permite operações de movimentação que referenciam tanto lotes quanto áreas físicas de pastagem.

Eventos de movimentação podem incluir referências a pastos de origem e destino através dos campos `from_pasto_id` e `to_pasto_id` na tabela `eventos_movimentacao`. Esta granularidade é importante para rastreabilidade de lotação por área e planejamento de capacidade de pastagem.

A seleção de alvo em tarefas de agenda pode utilizar tanto animais individuais quanto lotes inteiros. Quando um lote é selecionado, o sistema consulta a tabela `lotes` para obter a lista de animais e verifica o pasto atual através da relação `lotes.pasto_id → pastos.id`.

O módulo de inventário também fornece dados para cálculos de capacidade: área total do pasto (`area_ha`), capacidade em unidades animal (`capacidade_ua`), e benfeitorias disponíveis (`benfeitorias`). Estes dados podem ser exibidos em tarefas de movimentação para auxiliar decisões de destino.

### 7.3 Integração com Configurações de Fazenda

O módulo de Configurações de Fazenda fornece contexto essencial para a operação de eventos e agenda, incluindo timezone da propriedade, preferências de formato de data, e dados cadastrais.

O timezone definido na tabela `fazendas` (campo `timezone`, default 'America/Sao_Paulo') é utilizado para conversão de timestamps de eventos. Quando um evento é registrado offline, o timestamp local é armazenado com informação de timezone, e na sincronização é convertido para o timezone da fazenda.

Os dados de localização da fazenda (`municipio`, `estado`, `cep`) são utilizados em relatórios de eventos para contextualização geográfica e potencialmente para integração com sistemas oficiais que requerem informação de origem.

O sistema de membership documentado em [`docs/RLS.md`](RLS.md) integra-se através da validação de permissões: antes de criar ou editar eventos/agenda, o sistema verifica o papel do usuário na fazenda ativa através da função `role_in_fazenda()`.

### 7.4 Integração com Protocolos Sanitários

Os protocolos sanitários funcionam como templates para geração automática de agenda, conforme documentado na análise de eventos sanitários em [`docs/ANALISE_EVENTOS_SANITARIOS.md`](ANALISE_EVENTOS_SANITARIOS.md).

A estrutura de protocolos em duas tabelas (`protocolos_sanitarios` para cabeçalho e `protocolos_sanitarios_itens` para itens) permite templates flexíveis com múltiplos procedimentos em sequência.

Quando um item de protocolo tem `gera_agenda = true`, o sistema utiliza o `dedup_template` configurado para construir a chave de deduplicação. O formato típico inclui tipo de evento, identificador do protocolo e intervalo, permitindo rastreabilidade de aplicações por protocolo.

A vinculação bidirecional entre agenda e protocolo permite: da agenda para protocolo (identificar qual protocolo originou a tarefa através de `source_ref`) e do protocolo para agenda (identificar quais tarefas foram geradas através de `protocol_item_version_id`).

---

## 8. Considerações de Implementação

### 8.1 Estrutura de Arquivos

A implementação do módulo deve seguir a estrutura de pastas estabelecida no projeto, organizando componentes, páginas e hooks em diretórios coerentes com o domínio de Eventos e Agenda.

Os componentes específicos do domínio devem ser criados em `src/components/events/` e `src/components/agenda/`, separando claramente funcionalidades de registro de eventos, visualização de agenda e componentes compartilhados.

Hooks customizados para operações de eventos e agenda devem ser implementados em `src/hooks/useEvents.ts` e `src/hooks/useAgenda.ts`, encapsulando lógica de negócio e integrando com o sistema de sync.

Pages do módulo incluem: `Agenda.tsx` para a página principal de agenda, `Registrar.tsx` para registro de eventos, `Eventos.tsx` para listagem e filtros de eventos.

### 8.2 Tipos TypeScript

Os tipos TypeScript devem refletir exatamente a estrutura do banco de dados, utilizando os enums definidos para domínios e status. A documentação de contratos em [`docs/CONTRACTS.md`](CONTRACTS.md) e tipos existentes em [`src/lib/offline/types.ts`](src/lib/offline/types.ts) servem como referência para tipagem.

```
// Tipos principais para o módulo de Eventos e Agenda

type Dominio = 'sanitario' | 'pesagem' | 'nutricao' | 
                'movimentacao' | 'reproducao' | 'financeiro';

type AgendaStatus = 'agendado' | 'concluido' | 'cancelado';

type SourceKind = 'manual' | 'automatico';

interface Evento {
  id: UUID;
  fazenda_id: UUID;
  dominio: Dominio;
  occurred_at: Timestamp;
  animal_id?: UUID;
  lote_id?: UUID;
  source_task_id?: UUID;
  corrige_evento_id?: UUID;
  observacoes?: Text;
  payload: Jsonb;
  // campos de sistema...
}

interface AgendaItem {
  id: UUID;
  fazenda_id: UUID;
  dominio: Dominio;
  tipo: Text;
  status: AgendaStatus;
  data_prevista: Date;
  animal_id?: UUID;
  lote_id?: UUID;
  dedup_key?: Text;
  source_kind: SourceKind;
  source_ref?: Jsonb;
  source_evento_id?: UUID;
  protocol_item_version_id?: UUID;
  // campos de sistema...
}
```

### 8.3 Integração com Sync

A integração com o sistema de sync offline deve seguir o padrão estabelecido em [`docs/OFFLINE.md`](OFFLINE.md), utilizando as funções de gesto e operações documentadas.

Para criação de evento com detalhes relacionados (por exemplo, evento sanitário com informações de produto), o gesture deve incluir múltiplas operações na ordem correta: primeiro INSERT em `eventos`, depois INSERT na tabela de detalhe específica, e finalmente UPDATE em animal se aplicável.

A função `createGesture()` deve ser utilizada para todas as operações de escrita, garantindo idempotência através de client_op_id e rastreabilidade através de client_tx_id.

### 8.4 Testes e Validação

O módulo deve ser validado através dos fluxos E2E documentados em [`docs/E2E_MVP.md`](E2E_MVP.md), especificamente os fluxos de registro de eventos offline e sincronização.

Casos de teste prioritários incluem: registro de evento sanitário individual e em lote, criação e conclusão de tarefas de agenda, operação offline e posterior sincronização, correção de eventos, e validação de permissões por papel.

---

## 9. Referências e Documentação Relacionada

Este documento de especificação complementa a documentação técnica existente do projeto, que deve ser consultada para implementação detalhada.

| Documento | Descrição | Relevância |
|-----------|-----------|------------|
| [`docs/DB.md`](DB.md) | Schema completo do banco de dados | Estrutura de tabelas e constraints |
| [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | Arquitetura Two Rails | Paradigma de design |
| [`docs/CONTRACTS.md`](CONTRACTS.md) | Contratos de sincronização | API de sync-batch |
| [`docs/OFFLINE.md`](OFFLINE.md) | Estratégia offline-first | Implementação Dexie |
| [`docs/RLS.md`](RLS.md) | Permissões e RLS | Matriz de papéis |
| [`docs/ANALISE_CAMPOS_REBANHO.md`](ANALISE_CAMPOS_REBANHO.md) | Análise de campos | Campos de animais e lotes |
| [`docs/ANALISE_EVENTOS_SANITARIOS.md`](ANALISE_EVENTOS_SANITARIOS.md) | Eventos sanitários | Detalhes específicos |
| [`docs/E2E_MVP.md`](E2E_MVP.md) | Testes end-to-end | Validação de fluxos |

---

*Documento preparado conforme padrões de especificação técnica RebanhoSync*  
*Baseado em análise de documentação existente e requisitos do sistema*  
*Versão 1.0 - Fevereiro 2026*
