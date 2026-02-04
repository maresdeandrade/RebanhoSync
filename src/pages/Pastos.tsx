import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, Plus, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const Pastos = () => {
  const pastos = useLiveQuery(() => db.state_pastos.toArray());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pastos</h1>
          <p className="text-sm text-muted-foreground">Gerencie as áreas de pastagem da fazenda.</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" /> Novo Pasto
        </Button>
      </div>

      {!pastos || pastos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-full bg-muted mb-4">
              <MapIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">Nenhum pasto encontrado</h3>
            <p className="text-sm text-muted-foreground mb-6">Cadastre as áreas da sua fazenda para controle de lotação.</p>
            <Button variant="outline">Cadastrar Primeiro Pasto</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pastos.map(pasto => (
            <Link key={pasto.id} to={`/pastos/${pasto.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{pasto.nome}</CardTitle>
                  <MapIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{pasto.area_ha} ha</div>
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

export default Pastos;