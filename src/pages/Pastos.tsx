import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map as MapIcon } from "lucide-react";

const Pastos = () => {
  const pastos = useLiveQuery(() => db.state_pastos.toArray());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pastos</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pastos?.map(pasto => (
          <Card key={pasto.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{pasto.nome}</CardTitle>
              <MapIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pasto.area_ha} ha</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Pastos;