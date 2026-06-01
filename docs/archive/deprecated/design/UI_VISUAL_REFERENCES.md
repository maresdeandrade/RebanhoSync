# UI Visual References — RebanhoSync

Status: Referências visuais aprovadas  
Tipo: Direção de UI, não especificação pixel-perfect  
Versão: Sync Técnico / Campo Operacional — maio de 2026

## 1. Objetivo

Este documento inventaria as referências visuais localizadas em `docs/design/references/` e define como elas devem orientar a evolução de UI do RebanhoSync.

As imagens orientam layout, hierarquia, linguagem visual, ilustrações e estados visuais. Elas não substituem o código atual, não criam regras de negócio e não devem ser tratadas como pixel-perfect.

## 2. Classificação de status

| Status | Significado |
|---|---|
| Implementado no app | Já existe no código atual |
| Referência visual aprovada | Existe nas imagens e orienta a UI futura |
| Recomendado | Deve guiar implementação futura |
| Não autorizado por referência visual | Não deve ser inferido das imagens |

## 3. Como usar as imagens

Usar as referências para:

- orientar hierarquia visual;
- definir proporção de cards e seções;
- alinhar tom azul “Sync Técnico”;
- orientar ilustrações por perfil animal;
- orientar padrões de badges, métricas e CTAs;
- guiar prompts para Stitch ou outros geradores visuais;
- apoiar patches incrementais de UI.

Não usar as referências para:

- implementar pixel-perfect;
- criar funcionalidades novas;
- inferir regra de negócio;
- alterar banco ou sync;
- substituir o código atual;
- prometer telas ou campos ainda não implementados.

## 4. Inventário de referências

| Referência | Arquivo | Status | O que orienta | Não autoriza |
|---|---|---|---|---|
| Logo | `logo.png` | Referência visual aprovada | Logo horizontal, negativo/monocromático, símbolo adulto + bezerro com ciclo/sync | Asset final sem validação; regra de domínio |
| Home / Hoje | `ref-blue-sync-home.png` | Referência visual aprovada | Header azul, resumo do dia, agenda de hoje, ações rápidas, alertas, bottom nav | Remover Agenda completa; criar ações automáticas |
| Lista de Animais | `ref-blue-sync-lista-animais.png.png` | Referência visual aprovada | Cards densos, ícones por perfil, sexo, categoria, peso/status | Inferir categoria automaticamente por imagem |
| Lote | `ref-blue-sync-lote.png` | Referência visual aprovada | Header de lote, métricas, atividades, agenda do lote, CTAs | Gerar evento ou manejo automaticamente |
| Registrar | `ref-blue-sync-registrar.png` | Referência visual aprovada | Stepper, cards de tipo, campos em blocos, salvar offline/salvar registro | Salvar sem confirmação |
| Offline / Sync | `ref-blue-sync-offline.png` | Referência visual aprovada | Status offline, pendentes, rejeições, armazenamento, ações de sync | Alterar regra de sincronização |
| Relatórios / Insights | `ref-blue-sync-relatorio.png` | Referência visual aprovada | KPIs simples, filtros, gráficos, pendências e eventos recentes | BI complexo, predição ou regra crítica |
| Bezerro | `ref-blue-sync-bezerro.png.png` | Referência visual aprovada | Perfil animal de fase inicial, menor/esguio | Regra automática de estágio |
| Boi Engorda | `ref-blue-sync-boi-engorda.png.png` | Referência visual aprovada | Perfil de engorda, silhueta volumosa | Aptidão comercial/venda/abate |
| Novilha | `ref-blue-sync-novilha.png.png` | Referência visual aprovada | Fêmea jovem sem úbere proeminente | Regra reprodutiva automática |
| Touro Reprodutor | `ref-blue-sync-touro-reprodutor.png.png` | Referência visual aprovada | Animal robusto/cupim/função reprodutiva | Aptidão reprodutiva automática |
| Vaca Parida | `ref-blue-sync-vaca-parida.png.png` | Referência visual aprovada | Matriz com bezerro ao pé | Vínculo factual matriz-bezerro sem fonte |
| Vaca Seca | `ref-blue-sync-vaca-seca.png.png` | Referência visual aprovada | Fêmea adulta sem bezerro | Status reprodutivo automático |

## 5. O que está aprovado

### Identidade visual

- Azul petróleo como base de header e marca.
- Cards brancos/neutros claros sobre fundo claro.
- Estados semânticos com verde, vermelho, azul e laranja/amarelo.
- Ícones lineares.
- Métricas grandes e escaneáveis.
- UI mobile-first.
- Componentes densos, mas legíveis.

### Navegação

- Bottom Navigation mobile como referência e implementação atual.
- SideNav desktop/tablet preservada.
- Home como “Hoje / Central Operacional”.
- Agenda completa como visão separada de pendências.

### Animais

- Uso de ilustração/ícone por perfil animal.
- Não usar foto real como avatar padrão.
- Categoria visual exibida como badge quando houver dado seguro.
- Sexo visível quando houver dado.

### Registrar

- Fluxo com etapas claras.
- Contexto visual antes de salvar.
- Salvar offline e salvar registro como ações explícitas.
- Revisão antes de salvar.

## 6. O que não está aprovado automaticamente

As referências não autorizam:

- criação de nova regra de negócio;
- inferência automática de categoria animal;
- inferência de animais por `pastoId`;
- cálculo automático de GMD, cobertura, desmame ou terminação sem fonte;
- venda/abate;
- carência sanitária conclusiva;
- aptidão comercial;
- geração automática de evento;
- conclusão automática de agenda;
- alteração de sync;
- criação de BI preditivo;
- uso de imagens como contrato funcional.

## 7. Mapa por tela

| Tela | Direção visual | Status | Próxima aplicação sugerida |
|---|---|---|---|
| Home / Hoje | Header azul, resumo, agenda do dia, alertas, ações rápidas | Implementado parcialmente | Ajustar aderência fina à referência em patch visual isolado |
| Agenda | Filtros/chips claros, seções atrasadas/hoje/próximas | Implementado parcialmente | Refinar hierarquia visual sem mudar regra |
| Registrar | Stepper, cards de tipo, contexto, salvar offline/salvar registro | Implementado parcialmente | Refinar bloco de contexto e cards de tipo |
| Perfil do Animal | Ilustração por perfil, código em destaque, abas, métricas, próximos eventos | Referência aprovada | Implementar avatar por perfil sem regra automática |
| Lista de Animais | Cards por animal com ilustração, sexo, categoria e status | Referência aprovada | Substituir qualquer foto/avatar genérico por ícone/ilustração segura |
| Lote | Header azul, métricas, atividades, agenda do lote, CTAs | Referência aprovada | Ajustar layout de detalhe de lote por patch próprio |
| Offline / Sync | Painel dedicado de sync/offline, pendências e rejeições | Referência aprovada | Avaliar aderência com estado real do sync |
| Relatórios / Insights | KPIs simples e read-only | Referência aprovada | Manter escopo simples/read-only |

## 8. Mapa por perfil animal

| Perfil | Direção visual | Observação de segurança |
|---|---|---|
| Touro Reprodutor | Robusto, cupim/porte forte | Não implica aptidão reprodutiva automática |
| Boi Engorda | Volume/terminação | Não implica pronto para venda/abate |
| Vaca Seca / Solteira | Fêmea adulta sem bezerro | Não implica status reprodutivo conclusivo |
| Vaca Parida | Matriz com bezerro ao pé | Não cria vínculo factual sem fonte |
| Novilha | Fêmea jovem sem úbere proeminente | Não inferir gestação/cobertura |
| Bezerro / Bezerra | Menor/esguio | Não inferir estágio sem regra validada |

## 9. Restrições permanentes

- Agenda é intenção operacional, não histórico factual.
- Eventos são fatos históricos.
- Protocolo não é execução.
- `pastoId` é contexto informativo e não infere animais.
- CTAs contextuais apenas navegam.
- Salvamento no Registrar exige confirmação explícita.
- Ilustração, badge e cor são auxiliares visuais, não fontes primárias.

## 10. Próximas aplicações sugeridas

Ordem recomendada para próximos patches visuais:

1. Perfil do Animal com avatar/ilustração por perfil, sem foto real.
2. Lista de Animais em cards alinhados às referências.
3. LoteDetalhe com header e cards de métrica mais próximos da referência.
4. Registrar com refinamento visual do stepper e bloco de contexto.
5. Offline/Sync como tela dedicada, se já houver rota/estrutura compatível.
6. Relatórios/Insights mantendo caráter read-only.

Cada aplicação deve ser feita em patch pequeno, sem alteração de regra de negócio.
