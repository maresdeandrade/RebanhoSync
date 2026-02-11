import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Agenda = () => {
  const navigate = useNavigate();
  const itens = useLiveQuery(() =>
    db.state_agenda_itens.orderBy("data_prevista").toArray(),
  );

  // Show empty state if no items
  if (!itens || itens.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Agenda de Manejo</h1>
          <Button size="sm" onClick={() => navigate("/registrar")}>
            <Plus className="h-4 w-4 mr-2" /> Novo Item
          </Button>
        </div>
        <EmptyState
          icon={Calendar}
          title="Agenda vazia"
          description="Sua agenda de manejo está vazia. Comece registrando atividades sanitárias ou criando lembretes de manejo."
          action={{
            label: "Registrar Atividade",
            onClick: () => navigate("/registrar"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agenda de Manejo</h1>
        <Button size="sm" onClick={() => navigate("/registrar")}>
          <Plus className="h-4 w-4 mr-2" /> Novo Item
        </Button>
      </div>
      <div className="space-y-3">
        {itens.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium capitalize">
                    {item.tipo.replace("_", " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.data_prevista).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Badge>{item.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Agenda;
