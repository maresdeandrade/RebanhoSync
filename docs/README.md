# Governança da Documentação (/docs)

Este diretório contém a base de conhecimento técnica e de produto do **RebanhoSync**.

## Estrutura de Documentação

A documentação é dividida em dois tipos fundamentais, com regras distintas de manutenção.

### 1. Normativos (Fontes de Verdade)

Definem regras, princípios, arquitetura e contratos. São prescritivos e **nunca** devem conter inventários voláteis (versões de libs, listas de arquivos).

- [**00_MANIFESTO.md**](./00_MANIFESTO.md): Visão do produto, princípios e escopo.
- [**ARCHITECTURE.md**](./ARCHITECTURE.md): Design do sistema (Two Rails, Offline, Sync).
- [**DB.md**](./DB.md): Schema de banco de dados e modelagem.
- [**RLS.md**](./RLS.md): Modelo de segurança e permissões.
- [**CONTRACTS.md**](./CONTRACTS.md): Contratos de API (Sync Batch) e reason codes.
- [**OFFLINE.md**](./OFFLINE.md): Implementação do Dexie e Sync Worker.
- [**EVENTOS_AGENDA_SPEC.md**](./EVENTOS_AGENDA_SPEC.md): Regras de negócio de Eventos/Agenda.
- [**E2E_MVP.md**](./E2E_MVP.md): Casos de teste e validação.

### 2. Derivados (Inventários Vivos)

Documentam o estado atual do código. São descritivos e refletem exatamente o que está implementado. Devem ser atualizados sempre que o código mudar.

- [**REPO_MAP.md**](./REPO_MAP.md): Mapa da estrutura de pastas e módulos.
- [**STACK.md**](./STACK.md): Versões de linguagens, libs e ferramentas.
- [**ROUTES.md**](./ROUTES.md): Lista de rotas da aplicação e proteções.
- [**TECH_DEBT.md**](./TECH_DEBT.md): Dívidas técnicas, riscos e TODOs.
- [**ROADMAP.md**](./ROADMAP.md): Planejamento de funcionalidades futuras.

---

## Convenções de Governança

### Cabeçalho Padrão

Todos os documentos devem iniciar com o seguinte bloco:

```markdown
# Título do Documento

> **Status:** [Normativo | Derivado]
> **Fonte de Verdade:** [Código | Este Documento | Outro Doc]
> **Última Atualização:** YYYY-MM-DD
```

### Regra de Ouro

**Documentos normativos NÃO devem conter inventários.**
Se você precisar listar arquivos, rotas ou versões, crie ou atualize um documento Derivado e referencie-o no Normativo.

### Política de Atualização

1.  **Mudou código de infra/core?** Atualize `ARCHITECTURE.md` ou `OFFLINE.md`.
2.  **Mudou schema/RLS?** Atualize `DB.md` ou `RLS.md`.
3.  **Adicionou lib?** Atualize `STACK.md`.
4.  **Criou página?** Atualize `ROUTES.md`.
5.  **Achou dívida técnica?** Registre em `TECH_DEBT.md`.

---

## Links Úteis

- [**Fluxo de Trabalho de Docs**](../.agent/workflows/) (se existir)
- [**Repositório GitHub**](https://github.com/maresdeandrade/RebanhoSync)
