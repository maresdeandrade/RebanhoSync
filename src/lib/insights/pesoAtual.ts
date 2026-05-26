/**
 * Read-only derivation of current animal weight from pesagem events.
 * Pure function — mirrors the SQL view `vw_animais_peso_atual`.
 */

export interface PesagemEvent {
  animal_id: string | null;
  fazenda_id: string;
  dominio: string;
  occurred_at: string;
  deleted_at?: string | null;
  peso_kg: number;
  detail_deleted_at?: string | null;
}

export interface CurrentWeight {
  animal_id: string;
  fazenda_id: string;
  peso_kg: number;
  pesado_em: string;
  dias_desde_pesagem: number;
  stale: boolean;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

export function resolveCurrentWeight(
  events: PesagemEvent[],
  asOf: Date = new Date(),
): CurrentWeight | null {
  const eligible = events.filter(
    (e) =>
      e.dominio === "pesagem" &&
      e.animal_id != null &&
      !e.deleted_at &&
      !e.detail_deleted_at &&
      e.peso_kg != null,
  );

  if (eligible.length === 0) return null;

  const latest = eligible.reduce((best, current) => {
    const bestTs = new Date(best.occurred_at).getTime();
    const currentTs = new Date(current.occurred_at).getTime();
    return currentTs > bestTs ? current : best;
  }, eligible[0]);

  const pesadoEm = new Date(latest.occurred_at);
  const diasDesde = daysBetween(pesadoEm, asOf);

  return {
    animal_id: latest.animal_id!,
    fazenda_id: latest.fazenda_id,
    peso_kg: latest.peso_kg,
    pesado_em: latest.occurred_at,
    dias_desde_pesagem: diasDesde,
    stale: diasDesde > 90,
  };
}
