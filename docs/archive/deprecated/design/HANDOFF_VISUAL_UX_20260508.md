# Handoff Visual/UX — RebanhoSync — 2026-05-20

Status: Handoff operacional  
Tipo: Registro do estado real + referências aprovadas  
Escopo: Visual Sync Técnico, navegação mobile, UX contextual e referências de telas

## 1. Resumo executivo

A frente Visual/UX consolidou a direção **Sync Técnico / Campo Operacional** para o RebanhoSync.

Foram aplicados patches de navegação, tema, contraste, entrada contextual segura no Registrar e compactação visual SLC nas principais superfícies operacionais. As referências visuais em `docs/design/references/` expandem a direção para telas e perfis animais, mas não representam implementação automática nem especificação pixel-perfect.

## 2. Estado real implementado

| Área | Estado |
|---|---|
| Identidade azul Sync Técnico | Aplicada parcialmente via tokens e ajustes visuais |
| Contraste light/dark | Revisado em componentes e telas críticas |
| Bottom Navigation mobile | Implementada |
| SideNav desktop/tablet | Preservada |
| Home / Hoje | Validada como Central Operacional |
| Agenda | Preservada como intenção operacional |
| Eventos | Preservados como fatos históricos |
| Registrar contextual | Implementado com entrada segura por query |
| Resolver de contexto do Registrar | Implementado como read-only |
| CTAs contextuais | Apenas navegam; não executam ação automática |
| `pastoId` | Contexto informativo; não infere animais |
| Compactação visual SLC | Aplicada em Home, Registrar, Animais, Lotes, Pastos, Reproducao, Relatorios, Reconciliacao, Configuracoes, selecao de fazenda e cadastros/fluxos auxiliares |
| Seleção de fazenda | Cards enriquecidos com municipio/UF, area, producao e manejo quando disponiveis |

## 3. Referências visuais aprovadas

As referências em `docs/design/references/` orientam a evolução visual futura.

| Referência | Uso |
|---|---|
| `logo.png` | Logo/wordmark, aplicação negativa e favicon/app icon |
| `ref-blue-sync-home.png` | Home / Hoje / Central Operacional |
| `ref-blue-sync-lista-animais.png.png` | Lista de Animais em cards |
| `ref-blue-sync-lote.png` | Detalhe de Lote |
| `ref-blue-sync-registrar.png` | Registrar Manejo |
| `ref-blue-sync-offline.png` | Offline / Sincronização |
| `ref-blue-sync-relatorio.png` | Relatórios / Insights |
| `ref-blue-sync-bezerro.png.png` | Perfil visual Bezerro |
| `ref-blue-sync-boi-engorda.png.png` | Perfil visual Boi Engorda |
| `ref-blue-sync-novilha.png.png` | Perfil visual Novilha |
| `ref-blue-sync-touro-reprodutor.png.png` | Perfil visual Touro Reprodutor |
| `ref-blue-sync-vaca-parida.png.png` | Perfil visual Vaca Parida |
| `ref-blue-sync-vaca-seca.png.png` | Perfil visual Vaca Seca |

## 4. Diferença entre implementado e referência

| Tema | Implementado no app | Referência visual aprovada | Observação |
|---|---|---|---|
| Logo | Tokens/tema azul aplicados; asset final pode depender de confirmação | Logo negativo com animal adulto + bezerro e ciclo/sync | Não tratar imagem como SVG final se não existir no repo |
| Home | Central Operacional validada | Layout com header azul, status sync, agenda, ações e alertas | Pode receber refinamento fino |
| Bottom Nav | Implementada | Referência usa navegação mobile clara | Estado alinhado |
| Perfil Animal | Parcialmente alinhado | Ilustração por perfil, código forte, abas, métricas e eventos | Futuro patch deve evitar foto real e não criar regra automática |
| Lista de Animais | Parcial/pendente conforme código atual | Cards com ícone por perfil, sexo, categoria, peso/status | Implementar em patch específico |
| Lote/Pasto | Parcialmente alinhado no padrão SLC atual | Header forte, métricas, atividades, agenda e CTAs | CTA deve só navegar |
| Offline/Sync | Parcial/pendente conforme estrutura atual | Tela dedicada de status e sincronização | Não altera motor de sync |
| Relatórios/Insights | Parcial/pendente conforme estrutura atual | KPIs simples/read-only | Não criar BI complexo |

## 5. Fluxos UX consolidados

### 5.1 Navegação mobile

- Bottom Navigation mobile implementada.
- SideNav desktop/tablet preservada.
- Mobile prioriza acesso rápido a Hoje, Rebanho, Manejo, Estrutura/Mais conforme rotas reais.
- Não houve remoção de rotas existentes.

### 5.2 Home / Hoje

Conceito consolidado:

```txt
Home = Hoje / Central Operacional
Agenda = visão completa de pendências
```

A Home deve priorizar:

- pendências atrasadas;
- agenda de hoje;
- status de sync/offline;
- próximos manejos;
- resumo operacional mínimo;
- CTAs seguros para navegação.

### 5.3 Registrar contextual seguro

Entradas contextuais consolidadas:

| Origem | Query | Regra |
|---|---|---|
| Lote | `/registrar?loteId=<id>` | Pré-contexto de lote |
| Pasto | `/registrar?pastoId=<id>` | Contexto informativo; não infere animais |
| Animal | `/registrar?animalId=<id>` | Pré-contexto de animal |
| Agenda | `/registrar?sourceTaskId=<id>` | Mantém contexto de pendência |

Regras:

- contexto é read-only até confirmação;
- nenhum CTA salva;
- nenhum CTA executa manejo;
- nenhum CTA conclui agenda;
- nenhum CTA gera evento;
- salvar continua exigindo ação explícita do usuário.

## 6. Regras de segurança preservadas

- Agenda continua intenção operacional.
- Eventos continuam fatos históricos.
- Protocolo não é execução.
- `pastoId` não infere animais.
- Ilustração de perfil animal não cria categoria automática.
- Badge visual não é fonte primária.
- Cor/status visual não substitui regra técnica.
- Nenhuma regra de carência, venda, abate ou aptidão comercial foi criada.
- Nenhum ajuste visual altera sync, RLS, Supabase, Dexie, migrations ou seed.

## 7. Perfis visuais de animal

Status: **Referência visual aprovada; não implementação automática**.

| Perfil | Direção visual | Limite |
|---|---|---|
| Touro Reprodutor | Robusto, cupim/porte forte | Não implica aptidão reprodutiva automática |
| Boi Engorda | Silhueta volumosa/terminação | Não implica pronto para venda/abate |
| Vaca Seca / Solteira | Fêmea adulta sem bezerro | Não implica status reprodutivo conclusivo |
| Vaca Parida | Matriz com bezerro ao pé | Não cria vínculo factual sem fonte |
| Novilha | Fêmea jovem sem úbere proeminente | Não inferir reprodução/cobertura |
| Bezerro / Bezerra | Menor/esguio | Não inferir estágio sem regra validada |

## 8. Pendências futuras recomendadas

Ordem sugerida:

1. **Auditoria de aderência visual por tela**  
   Comparar o padrão SLC implementado com `docs/design/references/` e registrar apenas gaps que ainda reduzam legibilidade, foco ou consistência.

2. **Perfil Animal**  
   Aplicar avatar/ilustração por perfil sem usar foto real e sem inferência automática.

3. **Lista de Animais**  
   Manter leitura card-first e evoluir avatares/ícones por perfil somente como camada visual segura.

4. **LoteDetalhe / PastoDetalhe**  
   Refinar headers, métricas e CTAs à referência, sem ação automática.

5. **Registrar Manejo**  
   Refinar stepper, cards de tipo e bloco de contexto.

6. **Offline / Sync**  
   Avaliar tela dedicada conforme estrutura real existente.

7. **Relatórios / Insights**  
   Manter simples, read-only e sem predição crítica.

## 9. Não-objetivos

Não está autorizado por esta frente:

- seleção em massa / bandeja global;
- nova regra de negócio;
- cálculo de carência conclusiva;
- venda/abate;
- aptidão comercial;
- predição por IA;
- BI complexo;
- criação automática de evento;
- conclusão automática de agenda;
- inferência automática de categoria animal por ícone;
- persistência de marcadores visuais como fonte primária.

## 10. Checklist para próximos patches

Antes de qualquer patch visual/UX:

```txt
O patch é visual/UX ou muda regra de negócio?
A referência usada está em docs/design/references?
O status implementado vs referência está claro?
Agenda continua intenção?
Eventos continuam fatos?
pastoId continua informativo?
CTAs apenas navegam?
Salvar exige confirmação explícita?
Há teste ou validação visual suficiente?
O diff está pequeno e revisável?
```

## 11. Validação recomendada por patch

Para patches visuais pequenos:

```bash
pnpm run lint
pnpm run build
```

Para patches que toquem componentes compartilhados ou telas centrais:

```bash
pnpm test
```

Para patches de documentação:

```bash
git status --short --untracked-files=all
git diff --stat
```
