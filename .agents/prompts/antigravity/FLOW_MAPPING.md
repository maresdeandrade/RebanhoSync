```markdown
# Antigravity Prompt — Flow Mapping
Atualizado em: 2026-06-04  
Versão: 1.1.0

Use para mapear fluxo funcional ou jornada do app.

## Objetivo

Mapear detalhadamente o comportamento, transições e regras de um fluxo específico do sistema:

```txt
[NOME_DO_FLUXO]

```

### Escopo inicial

* `[ARQUIVOS_OU_PASTAS_SE_CONHECIDOS]`

## Regras e Diretrizes

### Estratégia de Leitura:

* Não ler o repositório inteiro.
* Começar estritamente pelos arquivos raiz ou componentes iniciais do fluxo informado.
* Usar o `Graphify` para mapear dependências se houver relação transversal complexa.

### Critério de Análise:

* **Fato Confirmado:** Aquilo que está explicitamente implementado e verificado no código.
* **Inferência:** Comportamentos implícitos deduzidos pela arquitetura ou padrões.
* **Lacuna:** O que está ausente, mal documentado ou gera incerteza.

---

## Itens a Mapear

1. **Entrada do usuário:** Ações, cliques, inputs e interações iniciais;
2. **Tela/componente inicial:** Ponto de entrada na interface de usuário;
3. **Estado local usado:** Hooks, contexts ou estados locais que gerenciam a memória da tela;
4. **Validações:** Regras aplicadas antes do processamento (schema validation, validação de domínio);
5. **Fonte de verdade:** Onde o dado reside primariamente;
6. **Persistência local/remota:** Estratégia de armazenamento (IndexedDB, PouchDB, Supabase);
7. **Contratos envolvidos:** Identificar o papel exato de Evento, Agenda, `state_*` ou Protocolo;
8. **Sync/Rollback:** Estratégia adotada em caso de falha de conectividade ou concorrência;
9. **Erros e exceções:** Como o sistema captura, trata e expõe falhas no fluxo;
10. **Testes existentes:** Arquivos de testes unitários ou de integração vinculados;
11. **Lacunas:** Gargalos de performance, lógica obscura ou falta de tratamento de borda.

---

## Tabela de Mapeamento do Fluxo

| Etapa | Arquivo | Responsabilidade | Fonte de Verdade | Risco Identificado | Teste Existente |
| --- | --- | --- | --- | --- | --- |
| [Ex: 1. Clique] | `path/to/file.tsx` | [O que o componente faz] | [Local / Remota] | [Vazamento, Trava] | `file.test.ts` |

---

## Entrega

Após a consolidação dos dados estruturados, responder com:

* **Diagrama textual do fluxo:** [Representação em texto/ASCII ou Mermaid do fluxo de dados e estados]
* **Fragilidades:** [Pontos fracos da implementação atual, race conditions ou acoplamento excessivo]
* **Melhorias incrementais:** [Sugestões pontuais e de baixo impacto para sanar as fragilidades]
* **Testes recomendados:** [Cenários críticos ou edge cases que necessitam de nova cobertura de testes]
* **Próximos passos:** [Plano de ação imediato para prosseguir com o desenvolvimento ou correção]

```

```