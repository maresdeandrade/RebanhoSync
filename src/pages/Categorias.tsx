import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, LayoutList } from "lucide-react";
import { CategoriaPayload } from "@/lib/domain/categorias";

const Categorias = () => {
  const navigate = useNavigate();
  const fazendaId = localStorage.getItem("gestao_agro_active_fazenda_id");

  const categorias = useLiveQuery(async () => {
    if (!fazendaId) return [];
    const list = await db.state_categorias_zootecnicas
      .where("fazenda_id")
      .equals(fazendaId)
      .filter((c) => !c.deleted_at)
      .toArray();

    // Ordenação visual (igual à lógica de classificação)
    return list.sort((a, b) => {
        if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
        const payloadA = a.payload as CategoriaPayload;
        const payloadB = b.payload as CategoriaPayload;
        const orderA = payloadA?.order ?? 9999;
        const orderB = payloadB?.order ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        const minA = a.idade_min_dias ?? 0;
        const minB = b.idade_min_dias ?? 0;
        return minA - minB;
    });
  }, [fazendaId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Categorias Zootécnicas</h1>
        </div>
        <Link to="/categorias/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categorias?.map((cat) => {
          const payload = cat.payload as CategoriaPayload;
          return (
            <Card key={cat.id} className="hover:border-primary transition-colors">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{cat.nome}</CardTitle>
                  <div className="flex flex-col items-end gap-1">
                      <Badge variant={cat.ativa ? "default" : "secondary"}>
                      {cat.ativa ? "Ativa" : "Inativa"}
                      </Badge>
                      {payload?.order && (
                          <span className="text-[10px] text-muted-foreground">
                              Ordem: {payload.order}
                          </span>
                      )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>
                  Sexo:{" "}
                  <span className="font-medium text-foreground">
                    {cat.aplica_ambos
                      ? "Ambos"
                      : cat.sexo === "M"
                      ? "Machos"
                      : "Fêmeas"}
                  </span>
                </p>
                <p>
                  Idade:{" "}
                  <span className="font-medium text-foreground">
                    {cat.idade_min_dias ?? 0} a{" "}
                    {cat.idade_max_dias ? `${cat.idade_max_dias} dias` : "∞"}
                  </span>
                </p>
                {/* Exibir critérios especiais se houver */}
                {payload?.criteria && (
                    <div className="mt-2 pt-2 border-t text-xs">
                      <p className="font-semibold mb-1">Critérios:</p>
                      <pre className="bg-muted p-1 rounded">
                        {JSON.stringify(payload.criteria, null, 2)}
                      </pre>
                    </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {categorias?.length === 0 && (
            <div className="col-span-full text-center py-10 text-muted-foreground">
                Nenhuma categoria cadastrada.
            </div>
        )}
      </div>
    </div>
  );
};

export default Categorias;
