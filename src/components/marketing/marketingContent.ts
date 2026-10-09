export const marketingNavItems = [
  { label: "Produto", to: "/produto" },
  { label: "Como funciona", to: "/como-funciona" },
  { label: "Segurança", to: "/seguranca-e-confianca" },
  { label: "FAQ", to: "/faq" },
] as const;

export const transformationSteps = [
  "Informação fragmentada",
  "Registro estruturado",
  "Histórico confiável",
  "Estado atual",
  "Decisão com contexto",
] as const;

export const howItWorksSteps = [
  {
    title: "Registre no campo",
    description:
      "Manejos, sanidade, peso e movimentação podem ser registrados no celular por quem acompanha a operação.",
    capability: "Operação mobile",
    screenshot: "SP4 • Registrar",
  },
  {
    title: "Continue com conectividade limitada",
    description:
      "Nos fluxos compatíveis com operação offline, os registros permanecem localmente e ficam pendentes de sincronização.",
    capability: "Offline-first + sincronização",
    screenshot: "SP8 • Estados de sincronização",
  },
  {
    title: "Preserve o histórico",
    description:
      "Os fatos executados são registrados no histórico operacional do animal, lote ou contexto correspondente.",
    capability: "Histórico factual estruturado",
    screenshot: "SP3 • Animal Detalhe / Eventos",
  },
  {
    title: "Acompanhe a situação atual",
    description:
      "O estado atual é apresentado separadamente do histórico, sem substituir os fatos que o originaram.",
    capability: "Estado atual / read models",
    screenshot: "SP1 • Dashboard",
  },
  {
    title: "Decida com contexto",
    description:
      "Consulte histórico, peso, indicadores e informações operacionais disponíveis quando precisar gerir ou avaliar uma decisão.",
    capability: "Gestão e decisão",
    screenshot: "SP6 • Relatórios",
  },
] as const;

export const benefits = [
  {
    title: "Saiba o que foi registrado na operação",
    description:
      "Os fatos executados permanecem vinculados ao contexto correspondente e podem ser recuperados posteriormente.",
  },
  {
    title: "Menos dependência da memória",
    description:
      "O histórico operacional deixa de depender exclusivamente de quem estava presente quando algo aconteceu.",
  },
  {
    title: "Mais continuidade entre campo e gestão",
    description:
      "Os registros da operação convergem para uma base comum à medida que os dispositivos sincronizam.",
  },
  {
    title: "Trabalhe com conectividade limitada",
    description:
      "Os fluxos compatíveis com operação offline podem continuar localmente e ser sincronizados posteriormente.",
  },
  {
    title: "Decida com mais contexto",
    description:
      "Histórico, peso, indicadores e situação operacional ficam disponíveis para apoiar decisões quando necessário.",
  },
] as const;

export const productAreas = [
  {
    key: "rebanho",
    title: "Rebanho",
    job: "Acompanhar animais, lotes, peso e movimentações.",
    value:
      "Mantenha uma base estruturada sobre o rebanho e seu histórico operacional.",
    capabilities: ["Animais", "Lotes", "Peso", "Movimentações"],
    screenshot: "SP2 • Animais",
  },
  {
    key: "manejo",
    title: "Manejo",
    job: "Planejar tarefas e registrar fatos executados.",
    value:
      "Agenda e Eventos permanecem separados: o que precisa acontecer não é confundido com o que efetivamente aconteceu.",
    capabilities: ["Sanidade", "Protocolos", "Agenda", "Eventos"],
    screenshot: "SP5 • Agenda + SP3 • Eventos",
  },
  {
    key: "campo",
    title: "Campo",
    job: "Registrar a operação onde ela acontece.",
    value:
      "Fluxos offline suportados podem continuar com conectividade limitada e sincronizar posteriormente.",
    capabilities: ["Mobile", "Offline-first", "Sincronização"],
    screenshot: "SP9 • Registrar mobile",
  },
  {
    key: "comercial",
    title: "Comercial",
    job: "Preservar o contexto das compras e vendas.",
    value:
      "Compras, vendas e registros operacionais relacionados aos animais permanecem disponíveis para consulta.",
    capabilities: ["Compras", "Vendas", "Histórico comercial"],
    screenshot: "SP7 • Comercial",
  },
  {
    key: "gestao",
    title: "Gestão",
    job: "Consultar a operação a partir dos registros disponíveis.",
    value:
      "Histórico, indicadores, situação atual e relatórios dão contexto à gestão.",
    capabilities: ["Indicadores", "Relatórios", "Situação operacional"],
    screenshot: "SP6 • Relatórios",
  },
] as const;

export const useCases = [
  {
    title: "Recuperar o histórico de um animal",
    situation: "Quando preciso saber o que foi registrado sobre este animal?",
    outcome:
      "Consulte eventos e registros vinculados ao animal sem depender exclusivamente da memória da equipe.",
  },
  {
    title: "Organizar o manejo de um lote",
    situation: "O que está previsto e o que já aconteceu?",
    outcome:
      "Mantenha tarefas futuras na Agenda e fatos executados no histórico de Eventos.",
  },
  {
    title: "Registrar fatos sanitários",
    situation: "O manejo aconteceu em uma área com conexão limitada.",
    outcome:
      "Nos fluxos offline suportados, registre localmente e acompanhe a sincronização posterior.",
  },
  {
    title: "Trabalhar em área sem cobertura constante",
    situation: "O sinal desaparece durante a rotina de campo.",
    outcome:
      "A conectividade deixa de ser uma exigência constante para os fluxos compatíveis com operação offline.",
  },
  {
    title: "Avaliar uma decisão comercial",
    situation: "Preciso consultar o contexto disponível antes de decidir.",
    outcome:
      "Acesse peso, histórico e situação operacional sem transformar esses registros em autorização automática de venda ou abate.",
  },
  {
    title: "Múltiplas pessoas, uma base compartilhada",
    situation: "Campo e gestão participam da mesma operação.",
    outcome:
      "Os registros convergem para uma base compartilhada conforme os dispositivos sincronizam e as permissões permitem.",
  },
] as const;

export const trustPillars = [
  {
    title: "Histórico estruturado",
    description:
      "Fatos executados, planejamento e estado atual são tratados como conceitos diferentes no produto.",
  },
  {
    title: "Offline-first",
    description:
      "Fluxos compatíveis podem continuar localmente quando a conectividade é limitada.",
  },
  {
    title: "Sincronização controlada",
    description:
      "Operações locais pendentes podem ser enviadas ao ambiente remoto quando as condições de sincronização permitem.",
  },
  {
    title: "Isolamento entre propriedades",
    description:
      "O modelo de acesso foi projetado para preservar o isolamento dos dados entre propriedades.",
  },
  {
    title: "Controle de acesso",
    description:
      "Autenticação e regras de acesso limitam o que cada contexto autorizado pode consultar ou modificar.",
  },
] as const;

export const faqItems = [
  {
    question: "Precisa de internet para funcionar?",
    answer:
      "Não constantemente. O RebanhoSync possui arquitetura offline-first. Nos fluxos compatíveis, os registros podem permanecer localmente quando não há conexão e ser sincronizados posteriormente. A cobertura exata de cada funcionalidade offline será documentada antes da publicação comercial.",
  },
  {
    question: "Funciona no celular?",
    answer:
      "Sim. As superfícies operacionais foram desenhadas com uso mobile e rotina de campo como requisitos centrais.",
  },
  {
    question: "Quem pode usar?",
    answer:
      "O produto foi desenhado para operações com múltiplas pessoas, incluindo proprietários, gestores e equipes de campo. A matriz pública definitiva de papéis e permissões ainda será congelada antes da publicação.",
  },
  {
    question: "Posso usar com meus funcionários?",
    answer:
      "Sim. O RebanhoSync foi projetado para operações em que diferentes pessoas participam do registro e da gestão, respeitando os controles de acesso aplicáveis.",
  },
  {
    question: "Atende mais de uma propriedade?",
    answer:
      "A arquitetura contempla isolamento entre propriedades. Limites comerciais por conta ainda dependem da política comercial definitiva.",
  },
  {
    question: "Quais informações consigo registrar?",
    answer:
      "A plataforma cobre animais, lotes, peso, movimentações, manejo sanitário, Agenda, Eventos e operações comerciais já disponíveis no produto.",
  },
  {
    question: "Como funciona a sincronização?",
    answer:
      "Operações locais pendentes podem ser enviadas quando a conexão e as demais condições necessárias estão disponíveis. A interface informa o estado de sincronização ao usuário.",
  },
  {
    question: "Como é separado o planejado do que aconteceu?",
    answer:
      "Agenda representa intenção ou tarefa futura. Evento representa fato executado. O RebanhoSync mantém esses dois conceitos separados para que planejamento não seja apresentado como histórico.",
  },
  {
    question: "O histórico pode ser alterado ou apagado?",
    answer:
      "O produto prioriza a preservação do histórico operacional e a rastreabilidade das ocorrências e correções. Claims de imutabilidade absoluta permanecem bloqueados até uma validação técnica completa de todas as rotas de escrita e permissões.",
  },
  {
    question: "Quais áreas da operação a plataforma cobre?",
    answer:
      "Rebanho, manejo, operação de campo, compras e vendas, indicadores e relatórios dentro do escopo atualmente implementado.",
  },
  {
    question: "Como eu começo?",
    answer:
      "Na fase atual, o caminho comercial proposto começa por uma demonstração assistida para entender a operação e apresentar o produto no contexto da fazenda.",
  },
  {
    question: "Quanto custa?",
    answer:
      "A política comercial ainda não está congelada. Nenhum preço será publicado antes dessa definição.",
  },
] as const;
