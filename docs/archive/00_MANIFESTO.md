# Manifesto do Produto (RebanhoSync)

> **Status:** STABLE
> **Fonte de Verdade:** Este Documento
> **Última Atualização:** 2026-04-07

## 1. Visão do Produto

O **RebanhoSync** é uma plataforma de gestão pecuária projetada para a realidade do campo: **Offline-First**, **Multi-Tenant** e focada na integridade dos dados.

O sistema permite que produtores rurais (Owners) gerenciem múltiplas fazendas, delegando acesso a gerentes (Managers) e peões (Cowboys) através de um controle de acesso baseado em funções (RBAC). A operação continua fluida mesmo sem internet, sincronizando dados automaticamente quando a conexão é restabelecida.

## 2. Escopo MVP (Minimum Viable Product)

O MVP foca no essencial para a gestão do ciclo de vida animal e operações diárias.

### O que Entra (In-Scope)

- Reprodução Completa (Cobertura/IA, Diagnóstico, Parto, Pós-parto, Cria Inicial).
- Registro de Nutrição (operacional, sem gestão de estoque).
- Registro Financeiro (lançamentos, sem fluxo de caixa complexo ou NFE).
- Agenda Sanitária Automática com protocolos e deduplicação.
- Importação de Dados por CSV (animais, lotes, pastos).
- Telemetria Local de Piloto.
- Catálogo de Produtos Veterinários (catálogo global compartilhado).
- Funcionalidade Offline Completa (Leitura e Escrita).
- Sincronização Bidirecional Robusta.

### O que Não Entra (Out-of-Scope)

- Gestão Financeira Complexa (Fluxo de Caixa detalhado, NFE).
- Integração com Balanças Eletrônicas via Bluetooth (nesta fase).
- Módulos de Agricultura (Plantio, Colheita).
- Marketplace ou Rede Social.

## 3. Princípios Fundamentais

1.  **Integridade do Rebanho > Conveniência:** Não permitimos estados inconsistentes a favor da facilidade de uso. Um animal não pode estar em dois lugares ao mesmo tempo (Anti-Teleport). Eventos passados são imutáveis; correções são feitas via contra-lançamentos (Event Sourcing light).
2.  **Funcionamento Offline é Cidadão de Primeira Classe:** A falta de internet é a regra, não a exceção. Todas as funcionalidades críticas devem funcionar localmente com a mesma fidelidade do online.
3.  **Auditabilidade:** Quem fez, o que fez e quando fez. Todas as operações críticas são rastreáveis.

## 4. Fontes Técnicas

Para detalhes de implementação, consulte os documentos normativos técnicos:

- [**ARCHITECTURE**](./ARCHITECTURE.md): Visão geral da arquitetura Two Rails e Sync.
- [**DB**](./DB.md): Esquema do banco de dados e modelagem.
- [**CONTRACTS**](./CONTRACTS.md): Interfaces e contratos de dados.
- [**OFFLINE**](./OFFLINE.md): Mecanismos de persistência local e sincronização.
- [**RLS**](./RLS.md): Regras de segurança e políticas de acesso a dados.
