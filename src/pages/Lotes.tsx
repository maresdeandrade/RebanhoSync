import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const Lotes = () => {
  const lotes = useLiveQuery(() => db.state_lotes.toArray());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lotes</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lotes?.map(lote => (
          <Link key={lote.id} to={`/lotes/${lote.id}`}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{lote.nome}</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">Clique para ver animais e histórico</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Lotes;