import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Map as MapIcon, Layers, PawPrint } from "lucide-react";

const PastoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const pasto = useLiveQuery(
    () => (id ? db.state_pastos.get(id) : undefined),
    [id],
  );

  const lotes = useLiveQuery(
    () => (id ? db.state_lotes.where("pasto_id").equals(id).toArray() : []),
    [id],
  );

  const animaisCount = useLiveQuery(async () => {
    if (!id || !lotes) return 0;
    let total = 0;
    for (const lote of lotes) {
      const count = await db.state_animais
        .where("lote_id")
        .equals(lote.id)
        .count();
      total += count;
    }
    return total;
  }, [id, lotes]);

  if (!id || !pasto) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/pastos")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Pasto não encontrado</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pastos")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{pasto.nome}</h1>
        </div>
        <Link to={`/pastos/${id}/editar`}>
          <Button variant="outline" size="sm">
            Editar
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              Área & Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex justify-between items-baseline">
                <p className="text-3xl font-bold">{pasto.area_ha}</p>
                {pasto.tipo_pasto && (
                  <Badge variant="outline" className="capitalize">{pasto.tipo_pasto}</Badge>
                )}
             </div>
            <p className="text-sm text-muted-foreground">hectares</p>
          </CardContent>
        </Card>

        {pasto.capacidade_ua && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">Capacidade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{pasto.capacidade_ua}</span>
                <span className="text-sm text-muted-foreground">UA</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
           <CardHeader>
             <CardTitle className="text-base flex items-center gap-2">
               <PawPrint className="h-4 w-4" />
               Lotação Atual
             </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-3xl font-bold">{animaisCount || 0}</p>
             <p className="text-sm text-muted-foreground">animais</p>
           </CardContent>
         </Card>
      </div>

      {/* Infraestrutura */}
      {pasto.infraestrutura && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Infraestrutura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cochos */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  🥣 Cochos
                </h3>
                <div className="space-y-1">
                  <p>Quantidade: {pasto.infraestrutura.cochos?.quantidade || 0}</p>
                  <p>Tipo: {pasto.infraestrutura.cochos?.tipo || "Não informado"}</p>
                  <p>
                    Capacidade: {pasto.infraestrutura.cochos?.capacidade || 0} m
                  </p>
                  <Badge variant={pasto.infraestrutura.cochos?.estado === 'ruim' ? 'destructive' : 'outline'}>
                    Estado: {pasto.infraestrutura.cochos?.estado || "N/A"}
                  </Badge>
                </div>
              </div>

              {/* Bebedouros */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  💧 Bebedouros
                </h3>
                <div className="space-y-1">
                  <p>
                    Quantidade: {pasto.infraestrutura.bebedouros?.quantidade || 0}
                  </p>
                  <p>
                    Tipo: {pasto.infraestrutura.bebedouros?.tipo || "Não informado"}</p>
                  <Badge variant={pasto.infraestrutura.bebedouros?.estado === 'ruim' ? 'destructive' : 'outline'}>
                    Estado: {pasto.infraestrutura.bebedouros?.estado || "N/A"}
                  </Badge>
                </div>
              </div>

               {/* Cerca */}
               <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  🚧 Cerca
                </h3>
                <div className="space-y-1">
                  <p>
                    Tipo: {pasto.infraestrutura.cerca?.tipo || "Não informado"}
                  </p>
                  <Badge variant={pasto.infraestrutura.cerca?.estado === 'ruim' ? 'destructive' : 'outline'}>
                    Estado: {pasto.infraestrutura.cerca?.estado || "N/A"}
                  </Badge>
                  {pasto.infraestrutura.cerca?.comprimento_metros && (
                    <p>Comprimento: {pasto.infraestrutura.cerca.comprimento_metros}m</p>
                  )}
                </div>
              </div>
            </div>
            
            {(pasto.infraestrutura.curral?.possui_brete || pasto.infraestrutura.curral?.possui_balanca) && (
               <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">
                    Curral
                  </h3>
                   <div className="flex gap-4">
                      {pasto.infraestrutura.curral.possui_brete && <Badge>Possui Brete</Badge>}
                      {pasto.infraestrutura.curral.possui_balanca && <Badge variant="secondary">Possui Balança</Badge>}
                   </div>
               </div>
            )}
          </CardContent>
        </Card>
      )}

      {lotes && lotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Lotes neste Pasto ({lotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {lotes.map((lote) => (
                <Link
                  key={lote.id}
                  to={`/lotes/${lote.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{lote.nome}</p>
                    {lote.status && (
                      <Badge
                        variant={
                          lote.status === "ativo" ? "default" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {lote.status}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!lotes || lotes.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum lote alocado neste pasto</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PastoDetalhe;
