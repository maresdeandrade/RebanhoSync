# Documentação RebanhoSync (/docs)

Bem-vindo à base de conhecimento do projeto **RebanhoSync**.
Este diretório é a fonte única de verdade sobre arquitetura, regras de negócio e planejamento.

> **Regra de Ouro:** Documentos **Normativos** definem regras e não contêm listas voláteis. Documentos **Derivados** são inventários vivos do código atual.

---

## 📚 Índice de Documentação

### 1. Documentos Normativos (Regras & Contratos)

_São a lei do projeto. Definem O QUE deve ser feito e POR QUE._

- [**00_MANIFESTO.md**](./00_MANIFESTO.md)
  - _Propósito, Visão do Produto e Princípios Fundamentais._
- [**ARCHITECTURE.md**](./ARCHITECTURE.md)
  - _Design do sistema, Two Rails, Offline-First e estratégias de Sync._
- [**DB.md**](./DB.md)
  - _Schema do Banco de Dados, Relacionamentos e Modelagem de Dados._
- [**RLS.md**](./RLS.md)
  - _Segurança, Permissões (Roles) e Row Level Security._
- [**CONTRACTS.md**](./CONTRACTS.md)
  - _Contratos de API, Códigos de Erro e Estruturas de Comunicação._
- [**OFFLINE.md**](./OFFLINE.md)
  - _Implementação técnica do Dexie, Sync Worker e Gestão de Estado Local._
- [**EVENTOS_AGENDA_SPEC.md**](./EVENTOS_AGENDA_SPEC.md)
  - _Especificação detalhada das Regras de Eventos e Agenda._
- [**E2E_MVP.md**](./E2E_MVP.md)
  - _Roteiros de teste e critérios de aceitação._

### 2. Documentos Derivados (Inventários & Estado Atual)

_Refletem o código. Definem COMO está implementado HOJE._

- [**REPO_MAP.md**](./REPO_MAP.md)
  - _Mapa da estrutura de pastas e organização do código._
- [**STACK.md**](./STACK.md)
  - _Versões de bibliotecas, frameworks e ferramentas (package.json)._
- [**ROUTES.md**](./ROUTES.md)
  - _Lista de rotas da aplicação, proteções e componentes._
- [**TECH_DEBT.md**](./TECH_DEBT.md)
  - _Dívidas técnicas conhecidas, bugs e riscos._
- [**ROADMAP.md**](./ROADMAP.md)
  - _Planejamento de funcionalidades futuras e fases do projeto._

---

## 🛠️ Como manter esta documentação

### Atualizando Normativos

Modifique apenas quando houver mudança nas **regras de negócio** ou **decisões arquiteturais**.

- _Exemplo: Mudamos de "Two Rails" para "Single Rail"? Atualize ARCHITECTURE.md._
- _Exemplo: Adicionamos tabela nova? Atualize DB.md._

### Atualizando Derivados

Modifique sempre que o **código** mudar significativamente.

- _Exemplo: Instalou nova lib? Atualize STACK.md._
- _Exemplo: Criou nova página? Atualize ROUTES.md._
- _Exemplo: Criou nova pasta? Atualize REPO_MAP.md._

### Convenção de Status

Todo arquivo `.md` deve iniciar com um bloco indicando seu status:

```markdown
> **Status:** Normativo
> **Fonte de Verdade:** [Referência]
```

ou

```markdown
> **Status:** Derivado (Inventário)
> **Fonte de Verdade:** [Caminho do Código]
```
