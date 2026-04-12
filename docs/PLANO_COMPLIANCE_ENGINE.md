# Sanitary Regimen & Compliance Engine: Action Plan & Release Note

> **Status:** Proposed Expansion
> **Data:** 2026-04-12
> **Contexto:** Evolução do módulo Sanitário (MVP) para um Compliance Engine robusto, integrando monitoramento ambiental, validações complexas e dashboards em tempo real.

Este documento aborda o status atual, as lacunas em relação ao novo escopo regulatório e delineia o plano de ação detalhado para expandir o RebanhoSync.

---

## 1. Inventário de Pendências (Gap Analysis)

O MVP atual atende os fluxos básicos operacionais (notificação de suspeita, bloqueio de lote, feed-ban básico). Para alcançar um nível de Compliance Engine automatizado, precisamos endereçar os seguintes Gaps:

### Novos Recursos (Gaps Abertos)
- **Gap 1 [sanitario.integracao_api]:** Integração de APIs de Monitoramento Ambiental (CAR, Ibama, Inpe) para validação cruzada do fornecedor/contraparte.
- **Gap 2 [sanitario.validacao_dinamica]:** Motor de Regras complexas de transito com base em risco epidemiológico mutável e atualizações estaduais automatizadas.
- **Gap 3 [sanitario.dashboard_realtime]:** Painéis e alertas instantâneos (WebSocket/Supabase Realtime) focados exclusivamente nas pendências e embargos da fazenda matriz e fornecedores.

### Correções e Refatorações Técnicas
- **Refatoração A:** Migração do gerenciador local de restrições (`regulatoryReadModel`) para delegar blocos complexos à Edge Functions, evitando bypass no frontend ou spoofing.
- **Refatoração B:** Expandir a cobertura do E2E (`test:e2e`) para simular fluxos completos onde o lote de origem entra em "Quarentena" ambiental e reage aos embargos.

---

## 2. Priorização

Utilizando uma matriz de Impacto na Conformidade vs. Esforço de Complexidade:

| Pendência / Gap | Prioridade | Impacto (Risco Regulatório) | Complexidade |
| --- | --- | --- | --- |
| **Gap 2** (Motor de Regras Dinâmicas) | **ALTA** | Crítico (bloqueio sanitário estadual) | Alta (Backend + Sync) |
| **Gap 1** (Integração APIs Ambientais) | **ALTA** | Alto (Multas/Responsabilidade Solidária) | Média (Edge Functions) |
| **Refat. A** (ReadModel -> Edge Function) | **MÉDIA** | Médio (Segurança / Spoofing) | Alta (Migração Backend) |
| **Gap 3** (Dashboard Realtime) | **BAIXA** | Baixo (Apenas visibilidade/Conveniência) | Baixa (Frontend / Supabase) |
| **Refat. B** (Cobertura de Testes E2E) | **MÉDIA** | Médio (Qualidade e Prevenção de Regressão) | Média (Vitest) |

---

## 3. Distribuição de Papéis

Equipe designada para a execução da Milestone "Compliance Engine":

- **Engenheiro de Backend (BE):** Responsável pelas *Edge Functions* de integração de APIs ambientais e reestruturação do Motor de Regras (migração de lógica cliente -> servidor).
- **Engenheiro de Frontend / UX (FE):** Construção do *Dashboard Realtime*, aprimoramento da interface de conformidade (alertas, mapas de calor) e integração via WebSockets.
- **Especialista em QA (QA):** Definição e execução de testes unitários (`vitest`), E2E (`playwright`/`testing-library`) garantindo cenários de falha na integração com API externa.
- **Engenheiro DevOps/Infra (DO):** Configuração de webhooks seguros, chaves de API secretas no Supabase Vault, Rate Limiting e pipelines de Deploy Automático.
- **Especialista de Compliance / Agro (CO):** Validação das regras de negócio (Defesa Sanitária, embargos ambientais) e aprovação final da "veracidade" agronômica do motor de regras.

---

## 4. Plano de Ação

### Fase 1: Integração de APIs Externas (Monitoramento Ambiental)
- **Tarefa 1.1:** Criar Edge Function `sync-compliance-api` no Supabase para buscar o status das fazendas conectadas (via CAR/Inpe).
- **Tarefa 1.2:** Configurar cache seguro e programado das respostas (TTL diário) para não sobrecarregar conexões em áreas de baixa latência (Offline-First compromise).
- **Responsável:** Backend / DevOps.

### Fase 2: Ajustes na Lógica de Validação
- **Tarefa 2.1:** Expandir a tabela `fazenda_sanidade_config` e criar novas camadas (`overlays_ambientais`).
- **Tarefa 2.2:** Centralizar bloqueios contextuais no backend para garantir que as operações do frontend (`Registrar.tsx`) falhem no `sync-batch` caso haja um embargo vigente verificado no Edge.
- **Responsável:** Backend / Compliance.

### Fase 3: Qualidade (Testes)
- **Tarefa 3.1:** **Testes Unitários:** Validar os retornos mockados da API Externa dentro do módulo em `src/lib/sanitario/`.
- **Tarefa 3.2:** **Testes de Integração:** Simular o fluxo bidirecional (`sync-batch` -> IndexedDB) injetando um evento de "Embargo".
- **Tarefa 3.3:** **Testes de Aceitação (E2E):** Validar na UI o comportamento de restrição de movimentação e alertas quando há bloqueio.
- **Responsável:** QA.

### Fase 4: Documentação
- **Tarefa 4.1:** Atualizar `SYSTEM.md` para incluir a arquitetura do webhook e comunicação da Edge Function com terceiros.
- **Tarefa 4.2:** Atualizar `PRODUCT.md` com o novo "Trilho de Compliance Ambiental".
- **Responsável:** Backend / Frontend.

---

## 5. Cronograma (Milestones)

- **Marco 1 (M1) - Setup Infra & Contratos [S+1]:** Infraestrutura das Edge Functions criadas e testadas unitariamente (Mock CAR/Inpe).
- **Marco 2 (M2) - Motor Dinâmico de Compliance [S+2]:** Bloqueios migrados para o backend, sincronização de regras estaduais rodando.
- **Marco 3 (M3) - Frontend e UX [S+3]:** Dashboard Realtime e alertas visuais de embargo/restrição integrados no `Dashboard.tsx` e `LoteDetalhe.tsx`.
- **Marco 4 (M4) - E2E & UAT [S+4]:** Testes automatizados verdes. Validação do Especialista em Compliance. Liberação para o Beta Interno.

---

## 6. Métricas & Monitoramento

- **Latência de Integração API Externa (P99):** Monitorar tempo de resposta e falhas da API do governo.
- **Taxa de Conflito de Sincronização (Rejeições de Sync):** Acompanhar via log de `metrics_events` a % de operações rejeitadas localmente devido a um embargo ambiental desconhecido no momento do registro.
- **Dashboard de Conformidade:** Painel dedicado exibindo: `% de fazendas em conformidade`, `Lotes Retidos`, `Tempo Médio de Resolução de Quarentenas`.
- **Logs de Auditoria:** Rastreabilidade na tabela `audit_logs` sobre "*Quem liberou um lote com suspeita de embargo ambiental*" via "Override Manager Role".

---

## 7. Apresentação Final (Draft Release Note)

# 🚀 RebanhoSync v2.0 - Sanitary Regimen & Compliance Engine

A evolução estrutural da nossa suíte de sanidade está aqui! O RebanhoSync agora atua como o seu copiloto de **Conformidade Total e Ambiental**.

### 🎯 O que mudou?
- **Integração Ambiental Direta:** O sistema agora cruza informações de CAR e listas de áreas embargadas em tempo real (via sincronização periódica Edge). Nenhuma compra ou trânsito externo passa despercebido.
- **Motor de Regras Inteligentes:** Atualizações estaduais agora afetam as permissões locais de transito e vacinas de maneira invisível.
- **Monitoramento em Tempo Real:** Novo painel exclusivo que condensa alertas operacionais (`feed-ban`, quarentena sanitária, risco ambiental) num único farol tático para a administração.

### 🛡️ Benefícios (Risk Mitigation)
Chega de sustos com embargos retroativos. Com validações movidas para a nossa arquitetura `sync-batch` blindada por RLS, nós barramos operações inseguras, protegendo o seu tenant de riscos judiciais severos ligados à sustentabilidade da cadeia.

*(Este Release será liberado ao fim da M4 e será acompanhado de 100% de cobertura de código no fluxo E2E de compra validada).*
