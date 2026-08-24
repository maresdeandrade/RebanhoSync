# Governança e Uso do Fallow 3 — RebanhoSync

Guia normativo para agentes e desenvolvedores sobre a execução, interpretação e limites do Fallow 3.17.0 no RebanhoSync.

---

## 1. Comandos e Finalidades

| Comando | Finalidade | Quando Usar |
|---|---|---|
| `fallow audit --gate new-only` | Quality gate de regressões no diff atual | **Gate obrigatório de PR** e verificação de patches locais |
| `fallow audit --gate all` | Análise do backlog completo nos arquivos tocados | Diagnóstico aprofundado ou auditoria de módulo |
| `fallow dead-code` | Identificação sintática de código/exports/deps mortos | Descoberta dirigida e auditoria de limpeza |
| `fallow dead-code --type-aware` | Identificação semântica com resolução de tipos TypeScript | Verificação exata de contratos e re-exports antes de refatoração |
| `fallow dupes` | Identificação de blocos e famílias de código duplicado | Planejamento de consolidação e análise de reuso |
| `fallow health --score` | Medição global de manutenibilidade, complexidade e deduções | Baseline periódico e verificação de tendências arquiteturais |

---

## 2. Regras Fundamentais de Governança

### 2.1 Proibição de Limpeza Automática (`fallow fix`)
- **É estritamente proibido executar `fallow fix` sem revisão humana/agente explícita item a item.**
- O comando `fallow fix` pode remover exports, tipos ou funções com consumidores indiretos, dinâmicos ou externos (scripts, Deno, SQL).

### 2.2 Candidatos de Investigação vs Autorização
- Relatórios de `dead-code`, `dupes` e `health` produzem **candidatos de investigação**, nunca autorização implícita para deleção ou refatoração imediata.
- Qualquer remoção de código deve ser precedida por confirmação de que o símbolo não é consumido via CLI, scripts externos, fixtures, RPCs ou Edge Functions.

### 2.3 Política de Suppressions
- Não adicionar comentários de supressão (`// fallow-ignore-...`) apenas para silenciar relatórios ou fazer CI passar.
- Suppressions só são aceitas após falso positivo formalmente comprovado e documentado.

### 2.4 Entry Points Operacionais e Scripts
- Scripts em `scripts/` e `scripts/codex/` executados diretamente via `node`, PowerShell ou CI são entry points legítimos.
- Não classificá-los como código morto por ausência de `import` em `src/`.
- Entry points devem ser declarados na configuração oficial (`.fallowrc.json`).

### 2.5 Duplicação Client / Server e Fronteiras de Confiança
- Duplicações entre client e server podem ser intencionais e defensivas, especialmente quando preservam validação independente na fronteira de confiança. Cada caso deve ser verificado antes de consolidar.
- A validação server-side não deve depender da confiança no cliente; o servidor sempre deve validar payloads de forma autônoma.
- Não compartilhar código entre client e server se isso enfraquecer o isolamento de runtime (Browser vs Deno), políticas de RLS ou isolamento multi-tenant.
- Não assumir que toda duplicação client/server é automaticamente aceitável; avaliar risco de drift, divergência de regras, fonte de verdade e contratos antes de propor consolidação.

---

## 3. Fluxo de Validação em Patches

1. Durante o desenvolvimento: executar `fallow audit --gate new-only` para garantir que o diff não introduziu regressões.
2. Em PR / CI: o workflow GitHub Actions valida automaticamente via `pnpm exec fallow audit --gate new-only`.
3. Dívida técnica herdada do merge-base não bloqueia PRs normais.
