import { useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Beef, Scale, Syringe, Move, History, Calendar } from "lucide-react";

const AnimalDetalhe = () => {
  const { id } = useParams();
  const animal = useLiveQuery(() => db.state_animais.get(id!), [id]);
  const lote = useLiveQuery(() => animal ? db.state_lotes.get(animal.lote_id) : null, [animal]);
  
  const eventos = useLiveQuery(() => 
    db.event_eventos.where('animal_id').equals(id!).reverse().sortBy('occurred_at')
  , [id]);

  const agenda = useLiveQuery(() => 
    db.state_agenda_itens.where('animal_id').equals(id!).toArray()
  , [id]);

  if (!animal) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Beef className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{animal.identificacao}</h1>
            <p className="text-muted-foreground">Lote: {lote?.nome || 'Sem lote'}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-1">
          {animal.sexo === 'M' ? 'Macho' : 'Fêmea'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Peso Atual</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-5 w-5 text-muted-foreground" />
              435 kg
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Status Reprodutivo</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Vazia</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Próxima Vacina</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">15/06</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="timeline" className="gap-2"><History className="h-4 w-4" /> Timeline</TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2"><Calendar className="h-4 w-4" /> Agenda</TabsTrigger>
        </TabsList>
        
        <TabsContent value="timeline" className="mt-6">
          <div className="space-y-4">
            {eventos?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum evento registrado.</p>
            ) : (
              eventos?.map((evt) => (
                <div key={evt.id} className="flex gap-4 relative pb-6 last:pb-0">
                  <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border" />
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    evt.dominio === 'sanitario' ? 'bg-blue-100 text-blue-600' :
                    evt.dominio === 'pesagem' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {evt.dominio === 'sanitario' ? <Syringe className="h-5 w-5" /> :
                     evt.dominio === 'pesagem' ? <Scale className="h-5 w-5" /> :
                     <Move className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold capitalize">{evt.dominio}</h4>
                      <span className="text-xs text-muted-foreground">
                        {new Date(evt.occurred_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{evt.observacoes || 'Manejo de rotina'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="agenda" className="mt-6">
          <div className="grid gap-3">
            {agenda?.map((item) => (
              <Card key={item.id} className={item.status === 'agendado' ? 'border-amber-200 bg-amber-50/30' : ''}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{item.tipo}</p>
                      <p className="text-xs text-muted-foreground">Previsto: {new Date(item.data_prevista).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge variant={item.status === 'agendado' ? 'default' : 'secondary'}>
                    {item.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnimalDetalhe;