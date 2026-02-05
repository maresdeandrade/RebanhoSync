import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Beef, Scale, Syringe, Move, History, Calendar, ChevronLeft } from "lucide-react";

const AnimalDetalhe = () => {
  const { id } = useParams();
  const animal = useLiveQuery(() => db.state_animais.get(id!), [id]);
  const lote = useLiveQuery(() => animal?.lote_id ? db.state_lotes.get(animal.lote_id) : null, [animal]);
  
  const eventos = useLiveQuery(() => 
    db.event_eventos.where('animal_id').equals(id!).reverse().sortBy('occurred_at')
  , [id]);

  const agenda = useLiveQuery(() => 
    db.state_agenda_itens.where('animal_id').equals(id!).toArray()
  , [id]);

  // Query latest weight from pesagem events
  const ultimoPeso = useLiveQuery(async () => {
    if (!id) return null;
    const eventoPesagem = await db.event_eventos
      .where('animal_id').equals(id)
      .and(e => e.dominio === 'pesagem')
      .reverse()
      .sortBy('occurred_at');
    
    if (!eventoPesagem || eventoPesagem.length === 0) return null;
    
    const detalhes = await db.event_eventos_pesagem.get(eventoPesagem[0].id);
    return detalhes?.peso_kg || null;
  }, [id]);

  // Query next agenda item
  const proximaAgenda = useLiveQuery(async () => {
    if (!id) return null;
    const agendados = await db.state_agenda_itens
      .where('animal_id').equals(id)
      .and(item => item.status === 'agendado')
      .sortBy('data_prevista');
    
    return agendados && agendados.length > 0 ? agendados[0] : null;
  }, [id]);

  if (!animal) return <div className="p-12 text-center text-muted-foreground">Carregando animal...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/animais">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{animal.identificacao}</h1>
            <Badge variant="outline" className="text-sm">
              {animal.sexo === 'M' ? 'Macho' : 'Fêmea'}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {lote ? `Lote: ${lote.nome}` : 'Sem lote definido'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="bg-primary/5 border-none shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Peso Atual</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              {ultimoPeso !== null ? `${ultimoPeso} kg` : 'Sem pesagem'}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-none shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Status</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{animal.status}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-none shadow-none">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Próximo Manejo</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {proximaAgenda ? new Date(proximaAgenda.data_prevista).toLocaleDateString() : 'Sem agenda'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] bg-muted/50 p-1">
          <TabsTrigger value="timeline" className="gap-2 rounded-md"><History className="h-4 w-4" /> Timeline</TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2 rounded-md"><Calendar className="h-4 w-4" /> Agenda</TabsTrigger>
        </TabsList>
        
        <TabsContent value="timeline" className="mt-6">
          <div className="space-y-6 pl-4 border-l-2 border-muted ml-4">
            {eventos?.length === 0 ? (
              <p className="text-muted-foreground py-4">Nenhum evento registrado.</p>
            ) : (
              eventos?.map((evt) => (
                <div key={evt.id} className="relative">
                  <div className={`absolute -left-[25px] h-4 w-4 rounded-full border-2 border-background ${
                    evt.dominio === 'sanitario' ? 'bg-blue-500' :
                    evt.dominio === 'pesagem' ? 'bg-emerald-500' :
                    'bg-slate-500'
                  }`} />
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold capitalize text-sm">{evt.dominio}</h4>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {new Date(evt.occurred_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{evt.observacoes || 'Manejo realizado no campo.'}</p>
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
                      <p className="font-medium text-sm">{item.tipo}</p>
                      <p className="text-[10px] text-muted-foreground">Previsto: {new Date(item.data_prevista).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge variant={item.status === 'agendado' ? 'default' : 'secondary'} className="text-[10px]">
                    {item.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {agenda?.length === 0 && <p className="text-center text-muted-foreground py-8">Sem tarefas agendadas.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnimalDetalhe;