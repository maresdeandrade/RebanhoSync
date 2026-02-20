import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, LayoutList } from "lucide-react";
import { getActiveFarmId } from "@/lib/storage";

const Categorias = () => {
  const navigate = useNavigate();
  const fazendaId = getActiveFarmId();

  const categorias = useLiveQuery(async () => {
    if (!fazendaId) return [];
    return await db.state_categorias_zootecnicas
      .where("fazenda_id")
      .equals(fazendaId)
      .filter((c) => !c.deleted_at)
      .toArray();
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
        {categorias?.map((cat) => (
          <Card key={cat.id} className="hover:border-primary transition-colors">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{cat.nome}</CardTitle>
                <Badge variant={cat.ativa ? "default" : "secondary"}>
                  {cat.ativa ? "Ativa" : "Inativa"}
                </Badge>
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
            </CardContent>
          </Card>
        ))}
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
