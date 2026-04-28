/**
 * Feature Flag — Novo Scheduler Sanitário
 *
 * Toggle simples para trocar entre scheduler antigo (legacy) e novo (determinístico).
 * Use para cutover controlado e rollback instantâneo se necessário.
 *
 * ## Como Usar
 *
 * 1. Em dev: True para testar novo scheduler
 * 2. Antes do deploy: Validar com fixtures
 * 3. Em prod: Ativar incrementalmente por ambiente
 * 4. Se houver bug: False para rollback imediato
 *
 * ## Comportamento
 *
 * - **True**: Usar `computeNextSanitaryOccurrence()` (novo, determinístico)
 * - **False**: Usar `legacyCalendarEngine()` (antigo, compatível)
 *
 * Ambas as implementações retornam mesmo contrato, então switch é seguro.
 */

/**
 * Feature flag: Usa novo scheduler determinístico
 *
 * IMPORTANTE: Alterar apenas após validação com fixtures completa.
 */
export const USE_NEW_SANITARY_SCHEDULER = false; // ← MUDE PARA TRUE após validações

/**
 * Helper para acesso programático
 */
export function shouldUseNewSanitaryScheduler(): boolean {
  return USE_NEW_SANITARY_SCHEDULER;
}
