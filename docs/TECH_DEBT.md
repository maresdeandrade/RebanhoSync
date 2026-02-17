# Tech Debt (Derivado)

- Status: Derivado
- Baseline: 0bb8829
- Última Atualização: 2024-03-24
- Derivado por: Antigravity Regen vNext Consolidado — Rev D

## OPEN (Prioritized)

### P2 (Observabilidade / UX)

#### [TD-001] sanitario.historico
- **Capability:** `sanitario.historico`
- **Risco:** Baixo (dados existem, apenas visualização é pobre). Dificulta auditoria rápida.
- **Evidência:** `src/pages/AnimalDetalhe.tsx:333` (Timeline mostra apenas "Procedimento sanitario" ou observações, sem nome do protocolo/vacina).
- **Ação:** Enriquecer `AnimalDetalhe.tsx` para mostrar `eventos_sanitario.payload` (protocolo, dose).
- **Critério de Aceite:** Timeline exibe nome da vacina/protocolo e data de aplicação corretamente.

#### [TD-002] pesagem.historico
- **Capability:** `pesagem.historico`
- **Risco:** Baixo. Usuário vê "Pesagem" na timeline mas não vê o peso sem clicar ou ver o card "Peso Atual".
- **Evidência:** `src/pages/AnimalDetalhe.tsx:333` (Timeline genérica para domínio `pesagem`).
- **Ação:** Enriquecer `AnimalDetalhe.tsx` para mostrar `eventos_pesagem.peso_kg`.
- **Critério de Aceite:** Timeline exibe valor do peso (kg) diretamente no card do evento.

#### [TD-003] nutricao.historico
- **Capability:** `nutricao.historico`
- **Risco:** Baixo.
- **Evidência:** `src/pages/AnimalDetalhe.tsx:333` (Timeline genérica para domínio `nutricao`).
- **Ação:** Enriquecer `AnimalDetalhe.tsx` para mostrar detalhes nutricionais (dieta, quantidade).
- **Critério de Aceite:** Timeline exibe detalhes do evento de nutrição.

#### [TD-004] movimentacao.historico
- **Capability:** `movimentacao.historico`
- **Risco:** Baixo.
- **Evidência:** `src/pages/AnimalDetalhe.tsx:333` (Timeline genérica para domínio `movimentacao`).
- **Ação:** Enriquecer `AnimalDetalhe.tsx` para mostrar origem/destino (lote/pasto).
- **Critério de Aceite:** Timeline exibe "De: X Para: Y".

## CLOSED (History)

*(Nenhum item fechado nesta revisão)*
