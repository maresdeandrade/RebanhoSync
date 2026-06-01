```markdown
# Codex Prompt — Revisão de Login e Segurança

Use para auditar e melhorar o fluxo de login e autenticação.

## Objetivo

Analisar o processo de login do RebanhoSync e propor melhorias incrementais de segurança, eficiência e UX.

## Escopo

### Áreas prováveis:
```txt
src/pages/Login/**
src/hooks/**
src/lib/auth/**
src/lib/supabase/**
src/contexts/**
supabase/**

```

*Nota: Ajustar os caminhos conforme a estrutura real do repositório.*

## Regras

### Diretrizes de Segurança e Arquitetura:

* **Autenticação:** Preservar o Supabase Auth.
* **Isolamento:** Preservar RLS, *multi-tenant* e isolamento estrito por `fazenda_id`.
* **Chaves:** Nunca expor a `service_role` no *client*.
* **Autorização:** Não utilizar a UI como única fronteira de controle de acesso.
* **Persistência:** Não alterar migrations, policies, RPCs ou seed sem necessidade explicitamente documentada.
* **Resiliência:** Não quebrar o fluxo *offline-first*.
* **Garantias:** Não introduzir brechas de *bypass cross-tenant*.

## Auditoria

### Mapear:

1. Tela de login e captura de credenciais;
2. Criação, recuperação e persistência de sessão;
3. Redirecionamento pós-login;
4. Tratamento de erros e mensagens ao usuário;
5. Estados de *loading* e transição de telas;
6. Fluxo de logout e invalidação de estado;
7. Proteção de rotas (*Guards*);
8. Vínculo estrutural Usuário ↔ Fazenda;
9. Pontos críticos onde o RLS efetivamente protege os dados.

### Procurar Riscos:

* Token exposto ou vazamento de credenciais;
* Sessão inconsistente ou estado de autenticação dessincronizado;
* Loops de redirecionamento (*redirect loops*);
* Usuário órfão (sem fazenda vinculada);
* Usuário com múltiplas fazendas sem seletor ativo;
* Cache local residual de outro *tenant*;
* Dados locais exibidos antes da validação estrita do *tenant*;
* Mensagens de erro inseguras que exponham detalhes da infraestrutura;
* Ausência de *loading state* que permita cliques duplos ou *race conditions*;
* Uso indevido de `localStorage` para dados sensíveis;
* Dependência exclusiva da UI para o bloqueio de acessos protegidos.

## Validação

Antes de concluir, execute o mapeamento de estado local:

```bash
git status --short --untracked-files=all

```

Execute a validação padrão da aplicação:

```bash
rtk pnpm run lint
rtk pnpm test

```

Se houver qualquer alteração que toque na camada do Supabase ou em regras de RLS:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

## Entrega

Responder com a seguinte estrutura de tópicos:

* **Mapa do fluxo atual:** [Descrição analítica do comportamento verificado]
* **Riscos encontrados:** [Lista de vulnerabilidades ou falhas de UX mapeadas]
* **Correções recomendadas:** [Plano de ação para sanar as inconsistências]
* **Patch incremental:** [Bloco de código com a correção aplicada, se seguro]
* **Testes necessários:** [Casos de teste recomendados para validar a alteração]
* **Validações executadas:** [Comandos rodados e seus respectivos retornos]
* **Riscos remanescentes:** [No máximo 3 pontos identificados que necessitam de atenção futura]

```

```