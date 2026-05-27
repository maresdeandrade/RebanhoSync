# Brand Direction — RebanhoSync

Status: Direção visual aplicada parcialmente na UI atual e expandida por referências aprovadas  
Tipo: Direção de marca e UI, não design system final  
Versão: Sync Técnico / Campo Operacional — maio de 2026

## 1. Escopo

Este documento define a direção visual do RebanhoSync para orientar evolução de UI, documentação, prompts de geração visual e próximos patches de interface.

Este documento não é especificação pixel-perfect, não substitui o código atual e não autoriza criação de regra de negócio.

## 2. Classificação de status

| Status | Significado |
|---|---|
| Implementado no app | Já existe no código atual e foi validado em patch anterior |
| Referência visual aprovada | Existe nas imagens de `docs/design/references/` e orienta a UI futura |
| Recomendado | Deve guiar implementação futura, mas ainda depende de patch específico |
| Não autorizado por referência visual | Não deve ser inferido das imagens |

## 3. Posicionamento

O RebanhoSync é uma ferramenta operacional, mobile-first e offline-first para gestão simples de pecuária de corte.

A marca deve transmitir:

- confiança;
- precisão;
- operação em campo;
- clareza técnica;
- sincronização segura;
- baixa fricção;
- uso prático no curral, pasto e rotina da fazenda.

A marca deve evitar:

- aparência de ERP agro complexo;
- visual corporativo pesado;
- estética genérica de app financeiro;
- aparência de app veterinário hospitalar;
- excesso de verde rural;
- ilustrações decorativas sem função operacional.

## 4. Conceito visual

Direção: **Sync Técnico / Campo Operacional**.

A identidade combina:

- azul petróleo como base institucional;
- azul de ação para navegação e CTAs;
- cards brancos e neutros claros para leitura;
- ícones lineares;
- alertas semânticos fortes;
- ilustrações simples por perfil animal;
- componentes densos, mas legíveis;
- hierarquia clara para uso em campo.

## 5. Logo

Status: **Referência visual aprovada**.

A referência atual de logo usa:

- símbolo monocromático/negativo;
- animal adulto com bezerro;
- movimento circular sugerindo ciclo, rotina e sincronização;
- wordmark “RebanhoSync”;
- aplicação horizontal;
- aplicação reduzida como favicon/app icon;
- boa leitura em fundo escuro.

### Direção aprovada

| Elemento | Direção |
|---|---|
| Símbolo | Animal adulto + bezerro com movimento circular |
| Wordmark | RebanhoSync em peso alto, legível |
| Aplicação | Preferência por fundo azul petróleo ou negativo/monocromático |
| Favicon/app icon | Versão reduzida do símbolo |

### Limites

- O logo de referência não deve ser tratado como asset final de produção se o SVG final ainda não estiver confirmado no repositório.
- Versões antigas conflitantes não devem ser usadas como direção principal.
- O logo não cria regra de negócio nem classificação automática de animal.

## 6. Paleta

Status: **Implementado parcialmente no app** e **referência visual aprovada**.

| Token | HEX | Uso |
|---|---|---|
| Azul petróleo profundo | `#002B45` | Header, marca, navegação, fundo institucional |
| Azul ação | `#0057C2` | CTA, item ativo, ação primária |
| Azul informação | `#2563EB` | Links, badges informativos, destaque secundário |
| Azul claro | `#3B82F6` | Realces e ícones secundários |
| Verde sucesso | `#16A34A` | Sincronizado, concluído, saudável |
| Aviso | `#F59E0B` | Atenção, offline, pendência moderada |
| Erro/crítico | `#DC2626` | Atrasado, rejeição, falha, crítico |
| Fundo | `#F7F9FA` | Background geral |
| Card | `#FFFFFF` | Superfícies e cartões |
| Borda | `#E2E8F0` | Divisores e contornos |
| Texto principal | `#0F172A` | Conteúdo de alta prioridade |
| Texto secundário | `#64748B` | Apoio, metadados e descrições |
| Texto fraco | `#94A3B8` | Metadados fracos e estados auxiliares |

## 7. Tipografia

Status: **Implementado no app**.

Direção aplicada:

- fonte principal: Inter variable font (via `@fontsource-variable/inter` offline-safe);
- fonte mono/tabular: JetBrains Mono para IDs, brincos e pesos;
- escala tipográfica nomeada no `tailwind.config.ts` (`text-display`, `text-h1` a `text-caption`, `text-kicker`);
- títulos com peso 600/700;
- métricas com peso alto e tamanho ampliado;
- labels e metadados com contraste suficiente;
- números operacionais sempre escaneáveis em mobile.

## 8. Iconografia

Status: **Implementado parcialmente no app** e **referência visual aprovada**.

Direção:

- ícones lineares;
- estilo compatível com Lucide;
- traço limpo;
- uso semântico por domínio;
- não depender apenas da cor para comunicar status.

Ícones centrais:

- Home / Hoje;
- Agenda;
- Registrar;
- Animais;
- Lotes;
- Pastos;
- Sanitário;
- Reprodução;
- Pesagem;
- Movimentação;
- Financeiro;
- Sync;
- Offline;
- Alerta;
- Configurações;
- Equipe.

## 9. Sistema visual de perfis animais

Status: **Referência visual aprovada**.  
Não é regra zootécnica automática.

As referências visuais definem ícones/ilustrações por perfil operacional do animal. Elas servem para reconhecimento visual rápido e não devem inferir categoria sem regra de domínio validada.

| Perfil | Representação visual | Uso sugerido | Observação |
|---|---|---|---|
| Touro Reprodutor | Animal adulto robusto, cupim/proporção forte | Perfil animal, lista, cards de rebanho | Deve sugerir robustez e função reprodutiva |
| Boi Engorda | Silhueta larga e musculosa | Perfil, lote de engorda, lista | Deve sugerir volume/terminação |
| Vaca Seca / Solteira | Fêmea adulta sem bezerro ao pé | Perfil e lista de fêmeas adultas | Pode ter silhueta feminina adulta; não usar bezerro |
| Vaca Parida | Matriz com bezerro ao pé | Perfil, cria, listas operacionais | Representa vínculo matriz-bezerro |
| Novilha | Fêmea jovem sem úbere proeminente | Perfil/lista de animais em desenvolvimento | Não deve ter úbere proeminente |
| Bezerro / Bezerra | Animal menor e esguio | Perfil/lista de fase inicial | Deve comunicar porte inicial |

### Limites

- Não inferir estágio, categoria, reprodução, carência ou aptidão comercial apenas por ícone.
- Não usar imagem real como avatar padrão.
- A representação visual deve ser auxiliar, não fonte primária de verdade.

## 10. Direção de componentes

### Header

Status: **Referência visual aprovada**.

- Fundo azul petróleo;
- alta legibilidade;
- logo ou título claro;
- status de sincronização quando relevante;
- ícones de ação no topo.

### Cards

Status: **Implementado no app**.

- Cards brancos sobre fundo claro;
- borda suave;
- sombra discreta;
- raio arredondado;
- informação escaneável;
- hierarquia entre métrica principal e metadados;
- variante `CardField` para listas densas mobile;
- variante `CardStatus` para estados coloridos (`success | warning | info | danger`).

### Badges e status

Status: **Implementado parcialmente**.

- Verde para sucesso/concluído/sincronizado;
- vermelho para atraso/crítico/rejeição;
- laranja/amarelo para atenção/offline;
- azul para informação/hoje/programado;
- texto legível em light/dark mode.

### Bottom Navigation

Status: **Implementado no app**.

- Navegação mobile por barra inferior;
- item ativo claro;
- preservar SideNav em desktop/tablet;
- não ocultar ações críticas.

## 11. Direção por tela

### Home / Hoje

Status: **Implementado parcialmente** e **referência visual aprovada**.

Direção:

- header azul com logo/fazenda/status de sync;
- resumo do dia;
- agenda de hoje;
- ações rápidas;
- alertas importantes;
- Bottom Navigation mobile.

Conceito preservado:

```txt
Home = Hoje / Central Operacional
Agenda = visão completa de pendências
```

### Perfil do Animal

Status: **Referência visual aprovada**, parcialmente alinhado no app.

Direção:

- header azul petróleo;
- cartão principal branco;
- avatar/ilustração por perfil animal, não foto real;
- código do animal em destaque;
- sexo visível;
- raça, idade, brinco e status;
- badge de categoria;
- abas: Resumo, Histórico, Manejos;
- cards de peso, GMD, lote e métrica contextual;
- próximos eventos;
- CTA “Ver histórico completo”.

Limites:

- Não criar regra nova para GMD, previsão de desmame, cobertura, status reprodutivo ou terminação.
- Campos só devem aparecer quando houver fonte confiável no app.

### Lista de Animais

Status: **Referência visual aprovada**.

Direção:

- lista em cards;
- ilustração por perfil;
- símbolo de sexo;
- código animal em destaque;
- badge de categoria;
- idade, peso, GMD e status;
- ação “Novo Animal” como referência visual;
- rodapé de total/atualização.

### Lote

Status: **Referência visual aprovada**.

Direção:

- header azul;
- identidade do lote;
- total de animais;
- status geral;
- cards de peso médio, manejos pendentes e calendário sanitário;
- atividades recentes;
- agenda do lote;
- CTAs: Ver animais, Registrar manejo, Relatório.

Limite: CTA navega; não executa manejo nem gera evento automaticamente.

### Registrar Manejo

Status: **Implementado parcialmente** e **referência visual aprovada**.

Direção:

- header azul;
- stepper Tipo → Detalhes → Revisão;
- seleção de tipo em cards;
- campos organizados em blocos claros;
- botões “Salvar offline” e “Salvar registro”;
- mensagem de revisão antes de salvar.

Regra preservada:

- contexto pode pré-preencher, mas não salva;
- salvamento exige confirmação explícita;
- `pastoId` é informativo e não infere animais.

### Offline / Sincronização

Status: **Referência visual aprovada**.

Direção:

- status da conexão;
- última sincronização;
- pendentes para sincronizar;
- rejeições;
- armazenamento local;
- atividade de sincronização;
- ações “Ver dados locais” e “Sincronizar agora”.

Limite: referência visual não altera comportamento do sync.

### Relatórios / Insights

Status: **Referência visual aprovada**.

Direção:

- indicadores simples;
- filtros por período/lote;
- resumo do período;
- manejos do mês;
- animais por lote;
- pendências da agenda;
- eventos recentes;
- status offline.

Limites:

- Não criar BI complexo;
- não criar predição;
- não criar regra crítica;
- insights devem ser read-only quando usados.

## 12. Tom visual e verbal

Direção:

- direto;
- operacional;
- técnico sem excesso de jargão;
- orientado à ação;
- claro sobre status offline/sync;
- sem prometer automação crítica não existente.

Microcopy preferencial:

- “Sincronizado”;
- “Salvo neste aparelho”;
- “Sincroniza quando houver conexão”;
- “Pendentes para envio”;
- “Registrar manejo”;
- “Ver agenda”;
- “Ver histórico completo”;
- “Salvar offline”;
- “Salvar registro”;
- “Encerrar pendência”;
- “Aplicar protocolo”.

Evitar:

- “ERP”;
- “IA decide”;
- “Concluir direto”;
- “Executar direto”;
- “Pronto para abate”;
- “Livre de carência”.

## 13. Limites explícitos

As referências visuais não autorizam:

- criação de nova regra de negócio;
- inferência automática de perfil animal;
- cálculo de carência;
- venda/abate;
- aptidão comercial;
- geração automática de evento;
- conclusão automática de agenda;
- alteração do sync;
- substituição de fontes primárias por ícones, badges ou ilustrações.
