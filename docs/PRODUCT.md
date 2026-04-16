# RebanhoSync: Visão de Produto

> **Status:** Normativo
> **Fonte de Verdade:** Este documento
> **Última Atualização:** 2026-04-16

## 1. Visão do Produto

O **RebanhoSync** é uma plataforma de gestão pecuária voltada à operação de campo, com arquitetura **Offline-First**, modelo **Multi-Tenant por fazenda** e foco em **integridade operacional dos dados**.

O sistema permite que produtores rurais (Owners) operem múltiplas fazendas, delegando acesso a gerentes (Managers) e peões (Cowboys) por meio de controle de acesso baseado em funções (RBAC). A operação crítica deve continuar utilizável mesmo sem internet, com sincronização automática quando a conexão for restabelecida.

## 2. Proposta de Valor

O produto busca resolver a gestão operacional do rebanho em ambiente real de campo, priorizando:

- registro confiável das operações diárias
- continuidade de uso offline
- rastreabilidade dos eventos
- agenda operacional utilizável
- consistência entre estado atual e histórico do rebanho
- simplicidade prática para uso no curral e na rotina da fazenda

## 3. Escopo MVP

O MVP cobre o núcleo operacional necessário para uso interno controlado.

### O que entra

- Gestão de animais, lotes, pastos, contrapartes e categorias zootécnicas
- Reprodução completa:
  - cobertura / IA
  - diagnóstico
  - parto
  - pós-parto
  - cria inicial
- Registro de eventos:
  - sanitário
  - pesagem
  - nutrição
  - movimentação
  - financeiro
- Agenda sanitária automática com protocolos, deduplicação e recálculo
- Onboarding guiado da fazenda
- Importação CSV de animais, lotes e pastos
- Telemetria de piloto
- Catálogo global de produtos veterinários
- Operação offline com leitura e escrita locais
- Sincronização bidirecional robusta

### O que não entra

- Gestão financeira complexa
- Fluxo de caixa avançado
- Emissão de NFE / fiscal complexo
- Gestão agrícola (plantio, colheita)
- Integração com balanças eletrônicas via Bluetooth nesta fase
- Marketplace, rede social ou camadas de comunidade

## 4. Princípios Fundamentais

### 4.1 Integridade do rebanho acima de conveniência

O sistema não deve aceitar estados operacionais inconsistentes em troca de facilidade de uso.

Exemplos:
- um animal não pode “teleportar” entre lotes sem justificativa histórica
- fatos passados não devem ser corrigidos por edição destrutiva de negócio
- regras de integridade prevalecem sobre atalhos de UI

### 4.2 Offline-First como requisito estrutural

A ausência de internet é tratada como condição normal de operação, não exceção.

As operações críticas devem continuar possíveis localmente, com sincronização posterior preservando integridade, idempotência e rastreabilidade.

### 4.3 Auditabilidade operacional

Mudanças críticas devem ser rastreáveis:
- quem fez
- o que foi feito
- quando foi feito
- em qual fazenda
- com qual contexto transacional

### 4.4 Separação entre estado atual e histórico

O produto diferencia:
- estado operacional atual
- fatos históricos append-only
- intenções futuras da agenda

Essa separação é central para confiabilidade, reconciliação e leitura operacional.

## 5. Situação Atual do Produto

O produto já se encontra em **beta interno**, com o núcleo funcional principal implementado.

A frente atual de engenharia está concentrada em **hardening arquitetural operacional**, ou seja:
- restaurar fronteiras de responsabilidade em hotspots relevantes
- reduzir acoplamento entre UI, domínio, infraestrutura e reconciliação
- tornar o sistema mais previsível, testável e sustentável

Esse foco de engenharia **não altera o escopo do produto**; ele melhora a forma como o escopo já implementado é sustentado.

## 6. Referências Técnicas

Para detalhes de implementação e operação, consulte:

- [**CURRENT_STATE.md**](./CURRENT_STATE.md) — snapshot executivo do estado atual
- [**PROCESS.md**](./PROCESS.md) — fluxo capability-centric e disciplina de execução
- [**SYSTEM.md**](./SYSTEM.md) — arquitetura, banco, offline-first e contratos
- [**REFERENCE.md**](./REFERENCE.md) — mapas do repositório, rotas, stack e comandos úteis
- [**IMPLEMENTATION_STATUS.md**](./IMPLEMENTATION_STATUS.md) — matriz atual de capacidades
- [**ROADMAP.md**](./ROADMAP.md) — próximos marcos e frentes
- [**TECH_DEBT.md**](./TECH_DEBT.md) — backlog técnico e problemas abertos, quando aplicável