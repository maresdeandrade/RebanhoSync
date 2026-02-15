import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { type Lote, type Pasto } from "@/lib/offline/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Plus, ChevronRight, MapPin, Beef } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { useLotes } from "@/hooks/useLotes";

// Componente para card individual de lote
const LoteCard = ({ lote }: { lote: Lote }) => {
  const pasto = useLiveQuery(
    () => (lote.pasto_id ? db.state_pastos.get(lote.pasto_id) : null),
    [lote.pasto_id],
  );

  const touro = useLiveQuery(
    () => (lote.touro_id ? db.state_animais.get(lote.touro_id) : null),
    [lote.touro_id],
  );

  // Contagem de animais no lote
  const totalAnimais = useLiveQuery(
    () => db.state_animais.where("lote_id").equals(lote.id).count(),
    [lote.id],
  );

  return (
    <Link to={`/lotes/${lote.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{lote.nome}</CardTitle>
            {lote.status && (
              <Badge
                variant={lote.status === "ativo" ? "default" : "secondary"}
                className="text-[10px]"
              >
                {lote.status}
              </Badge>
            )}
          </div>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pasto && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{pasto.nome}</span>
              </div>
            )}
            {touro && (
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <Beef className="h-3 w-3" />
                <span>Touro: {touro.identificacao}</span>
              </div>
            )}
            {typeof totalAnimais === "number" && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {totalAnimais} {totalAnimais === 1 ? "animal" : "animais"}
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                Ver detalhes
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const Lotes = () => {
  const navigate = useNavigate();
  // P2.4 FIX: Use centralized useLotes hook (filtered by fazenda_id + deleted_at)
  const lotes = useLotes();

  // Show empty state if no lotes
  if (!lotes || lotes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lotes</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os agrupamentos de animais.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate("/lotes/novo")}>
            <Plus className="h-4 w-4 mr-2" /> Novo Lote
          </Button>
        </div>
        <EmptyState
          icon={Layers}
          title="Nenhum lote cadastrado"
          description="Organize seu rebanho criando lotes para agrupar animais por categoria, fase ou localização."
          action={{
            label: "Criar Primeiro Lote",
            onClick: () => navigate("/lotes/novo"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lotes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os agrupamentos de animais.
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/lotes/novo")}>
          <Plus className="h-4 w-4 mr-2" /> Novo Lote
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lotes.map((lote) => (
          <LoteCard key={lote.id} lote={lote} />
        ))}
      </div>
    </div>
  );
};

export default Lotes;
