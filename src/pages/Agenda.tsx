import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

const Agenda = () => {
  const itens = useLiveQuery(() => db.state_agenda_itens.orderBy('data_prevista').toArray());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agenda de Manejo</h1>
      <div className="space-y-3">
        {itens?.map(item => (
          <Card key={item.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium capitalize">{item.tipo.replace('_', ' ')}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.data_prevista).toLocaleDateString()}</p>
                </div>
              </div>
              <Badge>{item.status}</Badge>
            </CardContent>
          </Card>
        ))}
        {itens?.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum item na agenda.</p>}
      </div>
    </div>
  );
};

export default Agenda;