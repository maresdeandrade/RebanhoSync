import { useLiveQuery } from "dexie-react-hooks";
import { Map as MapIcon, Plus, ChevronRight, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import type { Pasto } from "@/lib/offline/types";

const PastoCard = ({ pasto }: { pasto: Pasto }) => {
  const lotesNoPasto = useLiveQuery(
    () => db.state_lotes.where("pasto_id").equals(pasto.id).count(),
    [pasto.id],
  );

  const animaisNoPasto = useLiveQuery(async () => {
    const lotes = await db.state_lotes.where("pasto_id").equals(pasto.id).toArray();

    if (lotes.length === 0) return 0;

    let total = 0;
    for (const lote of lotes) {
      total += await db.state_animais.where("lote_id").equals(lote.id).count();
    }

    return total;
  }, [pasto.id]);

  return (
    <Link to={`/pastos/${pasto.id}`}>
      <Card className="cursor-pointer transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{pasto.nome}</CardTitle>
          <MapIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{pasto.area_ha} ha</div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            {pasto.capacidade_ua && (
              <div className="text-xs text-muted-foreground">
                Capacidade: {pasto.capacidade_ua} UA
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {typeof lotesNoPasto === "number" && lotesNoPasto > 0 && (
                <Badge variant="secondary" className="px-1.5 text-[10px]">
                  {lotesNoPasto} {lotesNoPasto === 1 ? "lote" : "lotes"}
                </Badge>
              )}
              {typeof animaisNoPasto === "number" && animaisNoPasto > 0 && (
                <Badge variant="outline" className="px-1.5 text-[10px]">
                  {animaisNoPasto} {animaisNoPasto === 1 ? "animal" : "animais"}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const Pastos = () => {
  const navigate = useNavigate();
  const { activeFarmId } = useAuth();
  const pastos = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.state_pastos
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((pasto) => !pasto.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const actions = (
    <div className="flex items-center gap-2">
      <Link to="/pastos/importar">
        <Button size="sm" variant="outline">
          <Upload className="mr-2 h-4 w-4" /> Importar planilha
        </Button>
      </Link>
      <Button size="sm" onClick={() => navigate("/pastos/novo")}>
        <Plus className="mr-2 h-4 w-4" /> Novo Pasto
      </Button>
    </div>
  );

  if (!pastos || pastos.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pastos</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie as areas de pastagem da fazenda.
            </p>
          </div>
          {actions}
        </div>
        <EmptyState
          icon={MapIcon}
          title="Nenhum pasto cadastrado"
          description="Cadastre as areas de pastagem da fazenda para controlar lotacao e rotacao de animais."
          action={{
            label: "Cadastrar Primeiro Pasto",
            onClick: () => navigate("/pastos/novo"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pastos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as areas de pastagem da fazenda.
          </p>
        </div>
        {actions}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pastos.map((pasto) => (
          <PastoCard key={pasto.id} pasto={pasto} />
        ))}
      </div>
    </div>
  );
};

export default Pastos;
