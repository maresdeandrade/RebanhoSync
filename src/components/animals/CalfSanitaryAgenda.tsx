import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "@/lib/offline/db";
import { readTenantSensitive } from "@/lib/offline/localReadBoundary";
import { Button } from "@/components/ui/button";

/** Read-only view; execution remains in the Central's sanitary commands. */
export function CalfSanitaryAgenda({
  fazendaId,
  animalIds,
}: {
  fazendaId: string | null;
  animalIds: string[];
}) {
  const key = animalIds.join(",");
  const agendas = useLiveQuery(async () => {
    if (!fazendaId) return [];
    return (
      (await readTenantSensitive(async () => {
        const targets = await db.ops_sanitario_agenda_animais_v2
          .where("fazenda_id")
          .equals(fazendaId)
          .filter((row) => animalIds.includes(row.animal_id))
          .toArray();
        const rows = await db.ops_sanitario_agenda_v2.bulkGet([
          ...new Set(targets.map((row) => row.agenda_id)),
        ]);
        return rows.filter(
          (row) =>
            row &&
            row.fazenda_id === fazendaId &&
            !row.deleted_at &&
            row.metadata?.journey === "cria",
        );
      })) ?? []
    );
  }, [fazendaId, key]);
  if (!fazendaId) return null;
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <p>{agendas?.length ?? 0} atividade(s) sanitária(s) na Central.</p>
      <p className="text-sm text-muted-foreground">
        Consulte e registre os manejos na Central Sanitária. Planejamento não
        comprova execução.
      </p>
      <Button variant="outline" asChild>
        <Link to="/protocolos-sanitarios?tab=agenda">
          Abrir Central Sanitária
        </Link>
      </Button>
    </div>
  );
}
