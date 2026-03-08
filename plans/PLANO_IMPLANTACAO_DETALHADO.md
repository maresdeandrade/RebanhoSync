# Plano Detalhado de Implantação: Fases 1, 2 e 3

**Data:** 2026-02-27
**Contexto:** Evolução do Capability Score de 78.9% (15/19 capabilities) para 100% (19/19 capabilities), endereçando 6 itens de Technical Debt pendentes e Gaps mapeados (sanitario.registro, pesagem.historico, movimentacao.registro, reproducao.registro, RBAC e Performance).

---

## 1. Visão Geral e Estratégia de Implantação Gradual

Este plano define a execução estratégica para mitigar os 6 itens de Technical Debt atuais (TD-003, TD-004, TD-011, TD-015, TD-019, TD-020) divididos em 3 Fases de Implantação. A promoção entre as fases será gradativa, baseada em "Quality Gates", garantindo que a base de código e os dados de produção mantenham 100% de integridade.

### Tratamento dos Gaps Não-Bloqueantes
Os gaps de UX (TD-011: Produtos Sanitários), RLS (TD-003: RBAC DELETE) e Performance (TD-004: Índices, TD-015: GMD) foram distribuídos nas fases conforme sua criticidade. O RLS é tratado imediatamente (Fase 1) por seu impacto na segurança, enquanto gaps de Performance e UX são tratados na Fase 3, de forma paralela, pois não bloqueiam os fluxos principais de dados (Fases 1 e 2).

---

## 2. Descrição das Fases de Implantação

### Fase 1: Segurança e RLS (RBAC)
**Foco:** Garantir que as operações destrutivas estejam limitadas aos perfis adequados.
*   **Capacidade Alvo:** Base para todas as capabilities (Segurança).
*   **Gaps/TDs:** TD-003 (RBAC DELETE).
*   **Dependências:** Nenhuma. Funciona como base para as próximas alterações.
*   **Alocação de Recursos:** 1 Desenvolvedor Backend / DB, 1 QA.

### Fase 2: Integridade Referencial (Foreign Keys)
**Foco:** Reforçar a consistência de dados históricos e relações entre tabelas core.
*   **Capacidade Alvo:** `movimentacao.registro` (G-03) e `reproducao.registro` (G-04).
*   **Gaps/TDs:** TD-019 (FK Movimentação) e TD-020 (FK Reprodução).
*   **Dependências:** Fase 1 concluída (recomenda-se TD-003 estabelecido). Compartilham padrão arquitetural.
*   **Alocação de Recursos:** 1 Desenvolvedor Backend / DB, 1 QA.

### Fase 3: UX e Performance (Gaps Não-Bloqueantes)
**Foco:** Melhorar a experiência de uso (autocomplete) e o tempo de carregamento de relatórios pesados.
*   **Capacidade Alvo:** `sanitario.registro` (G-01), `pesagem.historico` (G-02) e Otimização Geral de DB.
*   **Gaps/TDs:** TD-011 (Produtos Sanitários), TD-004 (Índices) e TD-015 (GMD).
*   **Dependências:** TD-015 depende diretamente de TD-004 (criação de índices para suportar a view/pesquisa).
*   **Alocação de Recursos:** 1 Desenvolvedor Frontend (TD-011), 1 Desenvolvedor Backend / DB (TD-004 e TD-015), 1 QA.

---

## 3. Cronograma e Milestones

| Milestone | Fase | Duração Estimada | Data-Alvo Sugerida | Entregáveis Principais |
| :--- | :--- | :--- | :--- | :--- |
| **M1** | Fase 1 | 3 dias | 2026-03-02 | Políticas RLS ajustadas. Testes E2E de permissões. |
| **M2** | Fase 2 | 7 dias | 2026-03-11 | FKs aplicadas em lotes e reprodução. Relatório de dados órfãos limpos. |
| **M3** | Fase 3 | 12 dias (paralelo) | 2026-03-25 | UI autocomplete sanitário, novos índices DB, cálculo GMD otimizado. |

---

## 4. Sequência Lógica de Implementação

1.  **Auditoria Inicial:** Extração de relatórios de dados órfãos atuais em Movimentação e Reprodução.
2.  **Desenvolvimento Fase 1 (TD-003):** Criação das migrations RLS e validação no ambiente de Staging.
3.  **Gate 1:** Aprovação de segurança.
4.  **Desenvolvimento Fase 2 (TD-019 e TD-020):** Limpeza de dados inválidos. Aplicação das constraints FK `VALIDATE`.
5.  **Gate 2:** Aprovação de integridade referencial.
6.  **Desenvolvimento Fase 3 (TD-004, TD-015, TD-011):**
    *   *Trilha A (Backend):* Aplicação de índices (TD-004), seguido da otimização do GMD (TD-015).
    *   *Trilha B (Frontend):* Implementação do autocomplete de produtos sanitários (TD-011).
7.  **Gate 3:** Aprovação de UX e Performance.

---

## 5. Critérios de Aceite por Fase

**Fase 1 (RBAC)**
*   Usuários com perfil 'Cowboy' recebem HTTP 403 ao tentar excluir animais.
*   Usuários 'Owner'/'Manager' executam deleções normalmente.
*   Testes automatizados cobrem as políticas RLS.

**Fase 2 (FKs)**
*   Scripts de migration rodam com sucesso sem perda de dados válidos.
*   As FKs `eventos_movimentacao(from_lote_id)`, `eventos_movimentacao(to_lote_id)` e `eventos_reproducao(macho_id)` constam ativas no schema.
*   Inserções de IDs inexistentes nestas tabelas falham retornando erro de constraint.

**Fase 3 (UX e Performance)**
*   *TD-011:* Campo de produto sugere itens via autocomplete; funciona offline/online.
*   *TD-004:* Índices compostos `(fazenda_id, occurred_at)` e `(animal_id, occurred_at)` em produção.
*   *TD-015:* O painel de GMD (Dashboard) carrega em menos de 2 segundos para volumes de 5.000+ animais. O cálculo mantém 100% de precisão.

---

## 6. Estratégia de Testes e Validação

*   **Testes Unitários:** Expansão da cobertura para os utilitários de cálculo de GMD e componentes de Autocomplete UI.
*   **Testes de Integração:** Validação em Staging (Supabase Local/Test) das policies de RLS simulando diferentes JWTs de perfis.
*   **Teste de Migrations:** Usar dump anonimizado de Produção no ambiente de Testes para garantir que as constraints (FKs) não falharão por dados sujos inesperados.
*   **Testes de Carga:** Simulação no Dashboard com 10.000 animais falsos para atestar o ganho de performance (TD-015 vs TD-004).

---

## 7. Estratégia de Rollback

**Para cada fase, é exigido um plano de rollback testado antes do deployment:**

*   **Fase 1:** Migration `down` reverte as policies RLS para o estado "permissivo" anterior.
*   **Fase 2:** Migration `down` realiza o `ALTER TABLE DROP CONSTRAINT`. Dados marcados como excluídos ou alterados para "limpeza de órfãos" deverão ter backup pré-migration caso seja necessário restaurá-los manualmente.
*   **Fase 3:**
    *   *Índices (TD-004):* `DROP INDEX`.
    *   *GMD (TD-015):* Reverter a view materializada ou query para a lógica antiga.
    *   *UI (TD-011):* Feature flag desabilitando o novo componente ou reversão do commit de frontend.

---

## 8. Promoção Gradativa e Gates de Aprovação

A transição entre fases requer aprovação documentada (Gates).

*   **Gate 1 (Fase 1 -> Fase 2):**
    *   *Requisito:* 48 horas em Produção sem tickets de suporte relacionados a "perda de acesso indevida" (falsos positivos do RLS).
    *   *Aprovação:* Tech Lead e Product Owner.
*   **Gate 2 (Fase 2 -> Fase 3):**
    *   *Requisito:* Migrations de FK executadas; queries de extração de relatórios essenciais testadas em Produção e operantes.
    *   *Aprovação:* DBA/Engenheiro de Dados e Tech Lead.
*   **Gate 3 (Encerramento da Fase 3):**
    *   *Requisito:* Performance do Dashboard dentro do SLA (< 2s) e Feedback positivo do uso offline do Autocomplete.
    *   *Aprovação:* Product Owner e QA.

---

## 9. Plano de Comunicação e Treinamento

*   **Comunicação com Usuários Finais:**
    *   O impacto da Fase 1 e 2 é invisível em cenários ideais. Se houver falhas, mensagens amigáveis devem ser exibidas ("Operação não permitida. Contate o administrador da Fazenda").
    *   Para a Fase 3 (Autocomplete), adicionar um pequeno tooltip de "Novo!" na UI durante os primeiros 15 dias após o deploy.
*   **Treinamento Interno (Suporte/CS):**
    *   Preparar a equipe de suporte para os novos códigos de erro (ex: 403 para Cowboy tentando deletar e erros de restrição FK caso ferramentas internas tentem forçar injeção de dados inválidos).
    *   Instruir sobre a melhoria de performance no carregamento de GMD, orientando-os a comunicar o benefício aos clientes VIP que relatavam lentidão.