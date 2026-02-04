import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, Plus, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const Lotes = () => {
  const lotes = useLiveQuery(() => db.state_lotes.toArray());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lotes</h1>
          <p className="text-sm text-muted-foreground">Gerencie os agrupamentos de animais.</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" /> Novo Lote
        </Button>
      </div>

      {!lotes || lotes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-full bg-muted mb-4">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">Nenhum lote encontrado</h3>
            <p className="text-sm text-muted-foreground mb-6">Crie seu primeiro lote para organizar seu rebanho.</p>
            <Button variant="outline">Criar Primeiro Lote</Button>
          </CardContent>
        </Card>
      ) : (
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
      )}
    </div>
  );
};

export default Lotes;