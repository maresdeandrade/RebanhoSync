import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Map as MapIcon, Plus, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import type { Pasto } from "@/lib/offline/types";

// Componente para card individual de pasto
const PastoCard = ({
  pasto,
}: {
  pasto: Pasto;
}) => {
  // Contagem de lotes usando este pasto
  const lotesNoPasto = useLiveQuery(
    () => db.state_lotes.where("pasto_id").equals(pasto.id).count(),
    [pasto.id],
  );

  // Contagem de animais (lotação atual) neste pasto
  const animaisNoPasto = useLiveQuery(async () => {
    // Buscar todos os lotes deste pasto
    const lotes = await db.state_lotes.where("pasto_id").equals(pasto.id).toArray();
    
    if (lotes.length === 0) return 0;
    
    // Somar animais de todos os lotes
    let total = 0;
    for (const lote of lotes) {
      const count = await db.state_animais.where("lote_id").equals(lote.id).count();
      total += count;
    }
    
    return total;
  }, [pasto.id]);

  return (
    <Link to={`/pastos/${pasto.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
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
            <div className="flex items-center gap-2 flex-wrap">
              {typeof lotesNoPasto === "number" && lotesNoPasto > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {lotesNoPasto} {lotesNoPasto === 1 ? "lote" : "lotes"}
                </Badge>
              )}
              {typeof animaisNoPasto === "number" && animaisNoPasto > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5">
                  🐄 {animaisNoPasto} {animaisNoPasto === 1 ? "animal" : "animais"}
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
  const pastos = useLiveQuery(() => db.state_pastos.toArray());

  // Show empty state if no pastos
  if (!pastos || pastos.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pastos</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie as áreas de pastagem da fazenda.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate("/pastos/novo")}>
            <Plus className="h-4 w-4 mr-2" /> Novo Pasto
          </Button>
        </div>
        <EmptyState
          icon={MapIcon}
          title="Nenhum pasto cadastrado"
          description="Cadastre as áreas de pastagem da sua fazenda para controlar lotação e rotação de animais."
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
            Gerencie as áreas de pastagem da fazenda.
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/pastos/novo")}>
          <Plus className="h-4 w-4 mr-2" /> Novo Pasto
        </Button>
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
