# UI Visual References — RebanhoSync

Status: Referência visual aprovada  
Tipo: Direção de UI, não especificação pixel-perfect  
Versão: v1 — Azul Sync Técnico

## 1. Objetivo

As imagens nesta pasta orientam a evolução visual do app RebanhoSync.

Elas devem inspirar:

- layout;
- hierarquia;
- paleta;
- componentes;
- estados visuais;
- navegação mobile;
- uso de cards operacionais;
- comunicação de offline/sync.

Elas não substituem a estrutura real do app e não autorizam criação de funcionalidades novas.

## 2. Referências esperadas

| Tela | Arquivo | Observação |
|---|---|---|
| Board geral | `references/ref-blue-sync-board-v1.png` | visão geral da direção |
| Home/Hoje | `references/ref-blue-sync-home-v1.png` | central operacional |
| Agenda | `references/ref-blue-sync-agenda-v1.png` | pendências e filtros |
| Registrar | `references/ref-blue-sync-register-v1.png` | fluxo de registro |
| Registro sanitário | `references/ref-blue-sync-sanitary-register-v1.png` | formulário operacional |
| Animal | `references/ref-blue-sync-animal-profile-no-photo-v1.png` | sem foto real |
| Lista de animais | `references/ref-blue-sync-animal-list-v1.png` | cards sem foto |
| Lote | `references/ref-blue-sync-lote-v1.png` | visão operacional |
| Offline/Sync | `references/ref-blue-sync-offline-v1.png` | sincronização e rejeições |
| Relatórios/Insights | `references/ref-blue-sync-reports-v1.png` | KPIs simples |

Se alguma imagem ainda não existir, manter o nome como referência esperada.

## 3. Implementado e Aprovado

- **Identidade Azul**: Aplicada (`Sync Técnico`).
- **Header**: Azul petróleo profundo.
- **Cards**: Brancos em light mode; tons de cinza/azul profundo em dark mode.
- **Contraste**: Revisado para legibilidade técnica em ambos os temas.
- **Navegação Híbrida**: 
  - `Bottom Navigation` mobile (Hoje, Rebanho, Manejo, Estrutura, Mais).
  - `SideNav` desktop/tablet preservada.
- **Home**: Consolidada como Central Operacional ("Hoje").
- **Ícones**: Lineares Lucide.
- **Logo**: Escudo/hexágono com boi branco.
- **Fichas**: Sem foto real de animal como avatar padrão.

## 4. Não aprovado automaticamente

- Textos exatos das imagens.
- Datas e números fictícios.
- Layout pixel-perfect.
- Componentes idênticos aos gerados.
- Funcionalidades não existentes.
- Regras de negócio novas.
- Carência sanitária conclusiva.
- Aptidão para venda/abate.
- Uso de foto real de animal como avatar.
- Substituição da estrutura real do app.

## 5. Direção de fluxo incorporada

As referências devem evoluir com esta reorganização UX:

```txt
Hoje | Rebanho | Manejo | Estrutura | Mais
```

### Home / Hoje

Deve funcionar como Central Operacional.

Priorizar:

- pendências de hoje;
- atrasadas;
- próximas ações;
- status de sync/offline;
- rejeições;
- atalhos de manejo;
- contexto resumido do rebanho.

### Agenda

Deve permanecer como visão completa de pendências.

Usar para:

- filtros;
- agrupamentos;
- próximos períodos;
- gestão ampla da agenda.

Não tratar como histórico factual.

### Manejo

Deve ser acesso rápido ao Registrar.

Permitir evolução para fluxo contexto-primeiro:

- por lote;
- por pasto;
- por animal;
- por item da agenda.

Contexto pré-preenche alvo, mas não salva automaticamente.

### Rebanho

Deve agrupar acesso a:

- animais;
- lotes;
- busca rápida;
- seleção operacional futura.

### Estrutura

Deve agrupar:

- pastos;
- fazenda/estrutura operacional;
- mapa/locais, se existente.

### Mais

Deve agrupar:

- relatórios;
- configurações;
- equipe;
- itens secundários.

## 6. Uso correto das imagens

Usar as imagens para orientar:

- paleta;
- hierarquia;
- linguagem visual;
- densidade;
- bottom navigation;
- estados de sync/offline;
- ausência de foto real de animal.

Não usar para:

- copiar pixel-perfect;
- criar telas sem rota existente;
- alterar lógica de negócio;
- criar novas tabelas;
- inferir regra crítica;
- decidir carência, venda, abate ou aptidão.

## 7. Checklist de promoção de nova referência

Antes de adicionar nova imagem como referência aprovada:

```txt
A imagem respeita a identidade azul?
Respeita a estrutura atual do app?
Evita foto real de animal como avatar?
Não cria funcionalidade fora do escopo?
Não sugere regra crítica inexistente?
Melhora legibilidade mobile?
Mantém foco operacional?
```

## 8. Nomeação de arquivos

Usar:

```txt
ref-blue-sync-[tela]-v[versao].png
```

Exemplos:

```txt
ref-blue-sync-home-v1.png
ref-blue-sync-agenda-v1.png
ref-blue-sync-animal-profile-no-photo-v1.png
```

Evitar:

```txt
final.png
nova-ui.png
design-final.png
imagegen.png
```
