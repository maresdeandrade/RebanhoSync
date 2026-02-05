import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, Plus, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";

const Lotes = () => {
  const navigate = useNavigate();
  const lotes = useLiveQuery(() => db.state_lotes.toArray());

  // Show empty state if no lotes
  if (!lotes || lotes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lotes</h1>
            <p className="text-sm text-muted-foreground">Gerencie os agrupamentos de animais.</p>
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
            onClick: () => navigate("/lotes/novo")
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
          <p className="text-sm text-muted-foreground">Gerencie os agrupamentos de animais.</p>
        </div>
        <Button size="sm" onClick={() => navigate("/lotes/novo")}>
          <Plus className="h-4 w-4 mr-2" /> Novo Lote
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lotes.map(lote => (
          <Link key={lote.id} to={`/lotes/${lote.id}`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{lote.nome}</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Ver detalhes</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Lotes;