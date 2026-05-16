# RebanhoSync — Referência Interna de Direção de Produto e UX

## 1. Tese de produto

O RebanhoSync não deve ser posicionado como "ERP completo da fazenda".

O posicionamento correto é: **gestão simples e offline para pecuária de corte do pequeno e médio produtor.**

A proposta mais promissora é atender operações com dor operacional real, mas ainda com baixa sofisticação de software, forte dependência de planilha, caderno, memória operacional e comunicação informal.

A experiência do produto deve refletir exatamente isso:

*   simplicidade de implantação;
*   simplicidade de uso em campo;
*   rotina clara;
*   confiança offline;
*   agenda realmente prática;
*   financeiro básico e compreensível;
*   baixo esforço cognitivo.

## 2. Diagnóstico estratégico de aderência

Hoje, o núcleo técnico do produto é forte, mas a superfície da interface ainda transmite, em parte, a sensação de um sistema denso, mais próximo de um SaaS gerencial do que de uma ferramenta prática de rotina pecuária.

O principal problema não está no motor do produto, mas na forma como ele se apresenta:

*   excesso de linguagem técnica;
*   componentes visuais densos demais para uso no celular;
*   navegação pouco orientada à rotina;
*   tabelas e estruturas de leitura pouco adequadas ao uso no curral;
*   concorrência entre informação gerencial e ação operacional.

Para o pequeno e médio produtor, isso reduz percepção de facilidade, aumenta a sensação de curva de aprendizado e enfraquece a promessa de implantação rápida.

### Conclusão do diagnóstico

A aderência atual à proposta é parcial:

*   o produto já tem substância operacional;
*   mas a interface ainda precisa parecer mais simples, mais direta e mais pronta para uso real em campo.

## 3. Princípios de UX que devem orientar o produto

### 3.1 O produto deve parecer simples no primeiro uso
O usuário precisa sentir rapidamente:
*   "eu consigo usar";
*   "não preciso aprender um sistema complicado";
*   "isso me ajuda no dia a dia".

### 3.2 O produto deve ser rápido no uso recorrente
Não basta ser fácil de entender. Precisa ser rápido para repetir:
*   registrar manejo;
*   consultar animal;
*   executar agenda;
*   confirmar o que foi salvo.

### 3.3 O foco principal é operação, não análise
A experiência central deve girar em torno de:
*   o que fazer hoje;
*   o que está pendente;
*   como registrar;
*   como localizar;
*   como confirmar que ficou salvo.

*(Resumo gerencial é importante, mas secundário).*

### 3.4 Offline deve transmitir confiança, não complexidade
O usuário não precisa ver jargão técnico. Mas precisa entender claramente:
*   salvo no aparelho;
*   pendente de envio;
*   sincronizando;
*   sincronizado;
*   erro;
*   ação necessária.

### 3.5 A interface deve ser amigável sem ser lúdica
O produto **não** deve parecer:
*   ERP corporativo pesado;
*   nem app gamificado/social.

A direção correta é:
*   moderna;
*   madura;
*   clara;
*   funcional;
*   com personalidade discreta.

## 4. Direção de navegação

**Decisão:** Mobile é o dispositivo de referência. A navegação principal no mobile deve ser curta, estável e previsível.

**Estrutura recomendada de nível 1:**
*   Início
*   Agenda
*   Registrar
*   Animais
*   Mais

Essa estrutura é suficiente para manter o fluxo principal visível sem sobrecarregar a navegação.

**O que não deve ficar no centro da experiência:**
Deve sair do eixo principal:
*   dashboards densos;
*   relatórios analíticos;
*   configurações profundas;
*   reconciliações técnicas;
*   áreas administrativas menos frequentes.

Esses conteúdos continuam existindo, mas entram em nível secundário, dentro de "Mais" ou em superfícies específicas de gestão.

## 5. Papel de cada superfície principal

### 5.1 Início
A Home não deve ser feed social nem dashboard pesado. Ela deve funcionar como **painel operacional simplificado**.

**Objetivos da Home:**
*   mostrar o que fazer hoje;
*   destacar pendências críticas;
*   dar acesso rápido a registros frequentes;
*   mostrar situação básica do rebanho;
*   comunicar claramente o estado de sync.

**Estrutura recomendada:**
*   status de sync/offline no topo;
*   tarefas do dia;
*   pendências sanitárias/reprodutivas prioritárias;
*   atalhos rápidos;
*   resumo enxuto do rebanho;
*   visão financeira simplificada, se útil.

**O que evitar:**
*   excesso de gráficos;
*   blocos demais competindo entre si;
*   telemetria e linguagem técnica;
*   visual "dashboard-first".

### 5.2 Agenda
A Agenda deve ser uma das peças mais fortes do produto. Ela precisa ser percebida como:
*   organizadora da rotina;
*   redutora de esquecimento;
*   gatilho direto para execução.

**A Agenda só vira diferencial se:**
*   for clara;
*   priorizar o que vence hoje ou atrasou;
*   permitir concluir/adiar/registrar com poucos toques;
*   abrir formulários já contextualizados.

**Regra de ouro:**
Ao tocar numa tarefa da agenda, o usuário deve entrar no fluxo já com o máximo possível de informação preenchida:
*   data;
*   lote ou animal;
*   tipo de manejo;
*   contexto da tarefa.

### 5.3 Registrar
Registrar Evento é um dos centros do produto. O valor percebido do app depende diretamente de quão rápido é registrar um manejo real em campo.

**Direção correta:**
*   fluxo curto;
*   estrutura contextual;
*   poucos campos por vez;
*   toque antes de digitação;
*   defaults fortes;
*   entradas numéricas fáceis;
*   linguagem simples.

**O que priorizar:**
*   segmented controls;
*   toggles;
*   chips;
*   autocomplete quando útil;
*   numpad imediato para peso, quantidade e valor;
*   repetição do último valor quando fizer sentido.

**O que evitar:**
*   muitos dropdowns;
*   dependência de teclado alfanumérico;
*   scroll excessivo;
*   wizard longo como padrão universal.

### 5.4 Animais
A lista de animais deve funcionar bem para rebanhos com centenas de cabeças sem parecer software corporativo pesado.

**Decisão:** No mobile, a lista não deve usar tabela horizontal densa.

**Estrutura ideal:**
Uma lista vertical escaneável, com blocos compactos, contendo:
*   identificação em destaque;
*   lote atual;
*   peso e data da última pesagem;
*   estado ou badges relevantes;
*   atalho para detalhe;
*   acesso rápido a registrar.

**Fotos:** Fotos **não** devem ser premissa da experiência.

**Recurso recomendado:** Usar ícones funcionais por categoria/estado pode ser positivo, desde que:
*   melhorem leitura;
*   sejam consistentes;
*   não pareçam decoração;
*   não infantilizem a interface.

*(Exemplos de uso: categoria do animal, estado reprodutivo, situação sanitária, estágio de vida).*

### 5.5 Financeiro
O módulo financeiro deve parecer básico, útil e compreensível, não contábil ou corporativo.

**O que o produtor precisa entender:**
*   entradas;
*   saídas;
*   saldo;
*   motivo do lançamento;
*   vínculo com animal/lote quando aplicável.

**O que evitar:**
*   jargão contábil desnecessário;
*   formulários longos;
*   aparência de ERP fiscal;
*   excesso de campos técnicos.

**Direção de linguagem:**
Trocar termos abstratos por linguagem direta:
*   "entrada" / "saída";
*   "valor";
*   "descrição";
*   "de quem" / "para quem".

## 6. Onboarding e ativação
A promessa de implantação rápida precisa aparecer na UX. Hoje, um dos maiores riscos é o usuário sentir que precisa configurar demais antes de obter valor.

**Objetivo do onboarding:** Levar o usuário até a primeira utilidade real o mais rápido possível.

**Primeiras vitórias desejadas:**
*   criar o primeiro lote;
*   cadastrar o primeiro animal;
*   registrar a primeira pesagem ou manejo;
*   entender que o dado ficou salvo.

**A experiência inicial deve:**
*   reduzir parametrização;
*   priorizar o essencial;
*   esconder complexidade inicial;
*   usar empty states acionáveis;
*   sugerir próximos passos.

**Meta de ativação:** O usuário deve conseguir fazer o primeiro cadastro relevante, registrar a primeira ação, e perceber valor em poucos minutos.

## 7. Suporte e confiança
Para esse público, confiança pesa quase tanto quanto funcionalidade. A UX deve diminuir insegurança e encurtar a distância entre dúvida e ajuda.

**Direção recomendada:**
*   mensagens claras e humanas;
*   feedback de erro instrucional;
*   ajuda contextual simples;
*   suporte acessível com baixa fricção.

**O que vale incorporar:**
*   link claro para ajuda;
*   suporte rápido via WhatsApp;
*   mensagens que expliquem o que aconteceu e o que fazer agora.

**Exemplo de tom correto:**
*(Em vez de erro técnico)*: "Perdemos a conexão. Seus manejos continuam salvos no aparelho e serão enviados quando o sinal voltar."

## 8. Direção visual
A linguagem visual do RebanhoSync deve comunicar: clareza, robustez, maturidade, simplicidade e velocidade.

**Deve parecer:** produto rural moderno, operacional, confiável, direto, leve sem ser raso.
**Não deve parecer:** painel corporativo pesado, app infantil, rede social, software burocrático.

**Diretrizes visuais:**
*   contraste alto;
*   tipografia legível;
*   componentes grandes o suficiente para toque;
*   pouco ruído visual;
*   ícones funcionais e consistentes;
*   badges claros;
*   listas fortes;
*   cards moderados, não excessivos;
*   semântica visual clara para sucesso, pendência, erro e atenção.

## 9. Prioridades de redesign

### Fase 1 — Navegação e casca principal
*   **Foco:** navegação mobile, Home, status de sync, simplificação da camada principal.
*   **Objetivo:** o produto parecer simples e pronto para uso.

### Fase 2 — Operação em campo
*   **Foco:** lista de animais, registrar evento, atalhos, componentes de toque, fluxo agenda → registrar.
*   **Objetivo:** reduzir fricção real no curral.

### Fase 3 — Aproximação com o dono e acabamento
*   **Foco:** financeiro básico, linguagem do produto, onboarding, ajuda, consistência visual, ajustes em telas secundárias.
*   **Objetivo:** consolidar adoção e compreensão do valor.

## 10. Decisões finais

*   **Promessa que a interface deve comunicar:** Gestão simples da rotina pecuária de corte no celular, mesmo sem sinal.
*   **O que simplificar primeiro:** navegação global, Home, lista de animais, componentes de registrar.
*   **O que deve sair do centro da experiência:** gráficos densos, telemetria, configurações profundas, linguagem técnica, superfícies administrativas não essenciais.
*   **O que deve ser enfatizado:** registrar rápido, agenda do dia, confiança offline, rotina prática, clareza de leitura.
*   **O que deve ser preservado:** robustez do motor offline, lógica operacional do fluxo de registro, agenda como base de ação, profundidade funcional já existente (desde que reposicionada).

## 11. Síntese executiva
O RebanhoSync já tem base funcional forte para atender o nicho certo. O problema principal não é ausência de capacidade. É excesso de aparência de sistema denso para um público que valoriza simplicidade, confiança e velocidade.

A direção correta não é transformar o produto em plataforma ampla, nem em app lúdico. É transformá-lo no **sistema mais simples, claro e confiável para a rotina da pecuária de corte no pequeno e médio produtor**.

Essa deve ser a referência interna de produto e UX para as próximas decisões.
