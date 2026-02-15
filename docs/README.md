# Governança da Documentação (/docs)

Este diretório contém a base de conhecimento técnica e de produto do **Gestão Agro**.

## Estrutura Alvo

A documentação é dividida em dois tipos fundamentais:

### 1. Normativos (Fontes de Verdade)

Definem regras, princípios, arquitetura e contratos. São prescritivos.
**Regra de Ouro:** Documentos normativos **NÃO** devem conter inventários (listas de arquivos, versões de libs, rotas de API), pois estes ficam obsoletos rapidamente.

- [**00_MANIFESTO.md**](./00_MANIFESTO.md): Visão do produto, princípios e escopo.
- [**ARCHITECTURE.md**](./ARCHITECTURE.md): Design do sistema, decisões arquiteturais e fluxos.
- [**DB.md**](./DB.md): Modelagem de dados e esquema.
- [**RLS.md**](./RLS.md): Políticas de segurança e acesso.
- [**CONTRACTS.md**](./CONTRACTS.md): Contratos de API e interfaces.
- [**OFFLINE.md**](./OFFLINE.md): Estratégia offline-first e sincronização.
- [**EVENTOS_AGENDA_SPEC.md**](./EVENTOS_AGENDA_SPEC.md): Especificação dos eventos e agenda.
- [**E2E_MVP.md**](./E2E_MVP.md): Casos de teste e validação do MVP.

### 2. Derivados (Inventários Pr vivos)

Documentam o estado atual do código. Devem ser gerados ou atualizados frequentemente.

- **REPO_MAP.md**: Mapa da estrutura de pastas e arquivos.
- **STACK.md**: Versões de linguagens, libs e ferramentas.
- **ROUTES.md**: Rotas da aplicação e endpoints.
- **TECH_DEBT.md**: Dívidas técnicas e TODOs.
- [**ROADMAP.md**](./ROADMAP.md): Planejamento de funcionalidades futuras.

---

## Convenções

Todos os documentos devem seguir este cabeçalho padrão:

```markdown
# Título do Documento

> **Status:** [DRAFT | REVIEW | STABLE | DEPRECATED]
> **Fonte de Verdade:** [Código | Este Documento | Outro Doc]
> **Última Atualização:** YYYY-MM-DD
```

## Política de Mudanças

1.  **Doc se curva ao Código:** Na maioria dos casos, o código é a fonte final de verdade. Se o código mudou e funciona (e passou nos testes), a documentação "Derivada" deve ser atualizada para refletir o código.
2.  **Exceção (Manifesto/Roadmap/Contratos):** Documentos como o Manifesto, Roadmap e Contratos definem _o que deve ser_. Mudanças no código que violem estes documentos devem ser rejeitadas ou discutidas antes.
3.  **Links:** Use links relativos para navegar entre os documentos (ex: `[DB](./DB.md)`). Evite duplicar conteúdo; prefira referenciar o documento original.
