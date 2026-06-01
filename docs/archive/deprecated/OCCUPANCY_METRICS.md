# Métricas de Ocupação (Occupancy Metrics)

## Visão Geral

A funcionalidade de **Métricas de Ocupação** fornece uma camada de inteligência operacional sobre os dados históricos de movimentação, pesagem e reprodução do rebanho. Ela permite visualizar o desempenho de lotes e pastos através de indicadores derivados, sem a necessidade de entrada de dados adicional.

## Arquitetura

A implementação segue o padrão de **derivadores puros** e **hooks reativos**, garantindo que as métricas sejam sempre calculadas a partir da fonte de verdade (eventos) e reflitam o estado atual do banco de dados offline (Dexie).

### Localização dos Arquivos

- `src/features/occupancy/`: Núcleo da funcionalidade.
    - `occupancyTypes.ts`: Definições de interfaces e tipos.
    - `buildAnimalOccupancyTimeline.ts`: Lógica de reconstrução da trajetória do animal.
    - `buildWeightGainForOccupancy.ts`: Cálculo de GMD e ganho total.
    - `buildEccMetricsForOccupancy.ts`: Cálculo de variação de ECC.
    - `buildLoteOccupancyMetrics.ts`: Agregador para nível de Lote.
    - `buildPastoOccupancyMetrics.ts`: Agregador para nível de Pasto.
    - `useOccupancyData.ts`: Hook React para consumo na UI.
    - `OccupancyMetricCards.tsx`: Componente visual de cards.
    - `AnimalMovementHistoryTable.tsx`: Componente visual de histórico.

## Lógica de Cálculo

### 1. Linha do Tempo de Ocupação
O sistema analisa todos os eventos de movimentação de um animal e reconstrói seus períodos de permanência em cada par Lote/Pasto.
- **Entrada**: Data do evento de movimentação.
- **Saída**: Data da próxima movimentação ou "Ativo" (data atual).
- **Duração**: Diferença em dias entre entrada e saída.

### 2. Ganho de Peso (GMD)
Para cada período de ocupação, o sistema busca pesagens do animal:
- **Peso Inicial**: Pesagem mais próxima da data de entrada (dentro de uma janela de tolerância).
- **Peso Final**: Pesagem mais próxima da data de saída.
- **GMD (Ganho Médio Diário)**: `(Peso Final - Peso Inicial) / Dias de Ocupação`.

### 3. Escore de Condição Corporal (ECC)
Similar ao peso, o sistema busca avaliações de ECC (eventos de reprodução ou rondas):
- **ECC Inicial**: Valor no início do período.
- **ECC Final**: Valor no final do período.
- **Variação**: Diferença absoluta entre os escores.

## Qualidade dos Dados (Status)

Como os dados dependem de registros históricos, cada métrica possui um status de confiabilidade:
- ✅ **Complete**: Dados suficientes para um cálculo preciso.
- ⚠️ **Partial**: Dados incompletos (ex: apenas peso inicial disponível), resultando em estimativas.
- ❓ **Empty**: Sem dados suficientes para o cálculo.

## Integração na UI

### LoteDetalhe.tsx
Exibe métricas focadas na performance do agrupamento de animais:
- Tempo médio de permanência no lote.
- GMD médio do lote.
- Cobertura de avaliações de ECC.

### PastoDetalhe.tsx
Exibe métricas focadas na utilização do recurso forrageiro:
- Lotação atual (UA estimada).
- Tempo médio de ocupação do pasto.
- Ganho de peso acumulado no pasto.

## Testes Unitários

A lógica de cálculo é protegida por uma suíte de testes em `src/features/occupancy/__tests__/`, cobrindo:
- Reconstrução de trajetórias complexas.
- Cálculos com dados parciais.
- Agregações de grandes volumes de animais.
- Tratamento de datas e períodos sobrepostos.

---
*Documentação gerada em 25/05/2026 como parte da Fase 4 de consolidação SLC.*
