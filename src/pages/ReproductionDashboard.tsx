import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";
import { Animal, Evento, EventoReproducao } from "@/lib/offline/types";
import { computeReproStatus, ReproStatus, AnimalReproStatus } from "@/lib/reproduction/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search, Filter, Baby, Dna, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

type DashboardAnimal = Animal & {
  reproStatus: AnimalReproStatus;
};

export default function ReproductionDashboard() {
  const { activeFarmId } = useAuth();
  const fazendaId = activeFarmId;
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("active"); // active, servida, prenha, parida, all

  const dashboardData = useLiveQuery(async () => {
    if (!fazendaId) return null;

    // 1. Fetch Females
    const animals = await db.state_animais
      .where("fazenda_id")
      .equals(fazendaId)
      .and((a) => a.sexo === "F" && a.status === "ativo")
      .toArray();

    // 2. Fetch All Reproduction Events
    const events = await db.event_eventos
      .where("[fazenda_id+dominio]")
      .between([fazendaId, "reproducao"], [fazendaId, "reproducao"], true, true)
      .toArray();

    // 3. Fetch Details
    const details = await db.event_eventos_reproducao
      .where("fazenda_id")
      .equals(fazendaId)
      .toArray();

    const detailsMap = new Map<string, EventoReproducao>();
    details.forEach((d) => detailsMap.set(d.evento_id, d));

    // 4. Group Events by Animal
    const eventsByAnimal = new Map<string, Array<Evento & { details?: EventoReproducao }>>();
    
    events.forEach((evt) => {
      if (!evt.animal_id) return;
      
      const enrichedEvent = { ...evt, details: detailsMap.get(evt.id) };
      if (!enrichedEvent.details) return; // Should satisfy the type for deriveReproductiveStatus

      if (!eventsByAnimal.has(evt.animal_id)) {
        eventsByAnimal.set(evt.animal_id, []);
      }
      eventsByAnimal.get(evt.animal_id)?.push(enrichedEvent);
    });

    // 5. Derive Status for each Animal
    const result: DashboardAnimal[] = animals.map((animal) => {
      const animalEvents = eventsByAnimal.get(animal.id) || [];
      const status = computeReproStatus(animalEvents);
      return { ...animal, reproStatus: status };
    });

    return result;
  }, [fazendaId]);

  if (!dashboardData) {
    return <div className="p-8 text-center">Carregando dados reprodutivos...</div>;
  }

  // Calculate KPIs
  const kpis = {
    total: dashboardData.length,
    servidas: dashboardData.filter(a => a.reproStatus.status === 'SERVIDA').length,
    prenhas: dashboardData.filter(a => a.reproStatus.status === 'PRENHA').length,
    paridas: dashboardData.filter(a => a.reproStatus.status === 'PARIDA').length,
    lactantes: dashboardData.filter(a => a.reproStatus.status === 'LACTANTE').length,
    abertas: dashboardData.filter(a => a.reproStatus.status === 'ABERTA' || a.reproStatus.status === 'DIAGNOSTICO_PENDENTE').length,
  };

  // Filter Data based on Tab and Search
  const filteredAnimals = dashboardData.filter((animal) => {
    // Search Filter
    if (searchTerm) {
      if (!animal.identificacao.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    }

    // Tab Filter
    switch (activeTab) {
      case 'active':
        return ['SERVIDA', 'PRENHA', 'PARIDA'].includes(animal.reproStatus.status);
      case 'servida':
        return animal.reproStatus.status === 'SERVIDA';
      case 'prenha':
        return animal.reproStatus.status === 'PRENHA';
      case 'parida':
        return ['PARIDA', 'LACTANTE'].includes(animal.reproStatus.status);
      case 'aberta':
        return ['ABERTA', 'DIAGNOSTICO_PENDENTE'].includes(animal.reproStatus.status);
      default:
        return true;
    }
  });

  const getStatusBadge = (status: ReproStatus) => {
    switch (status) {
      case 'PRENHA': return <Badge className="bg-green-600">Prenha</Badge>;
      case 'SERVIDA': return <Badge className="bg-yellow-600">Servida</Badge>;
      case 'PARIDA': return <Badge className="bg-purple-600">Parida (Puerpério)</Badge>;
      case 'LACTANTE': return <Badge className="bg-purple-400">Lactante</Badge>;
      case 'ABERTA': return <Badge variant="outline">Aberta</Badge>;
      case 'DIAGNOSTICO_PENDENTE': return <Badge variant="secondary">Diag. Pendente</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reprodução</h1>
          <p className="text-muted-foreground">Monitoramento do ciclo reprodutivo</p>
        </div>
        <Link to="/registrar">
            <Button>Nova Ocorrência</Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servidas</CardTitle>
            <Dna className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.servidas}</div>
            <p className="text-xs text-muted-foreground">Aguard. Diagnóstico</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prenhas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.prenhas}</div>
            <p className="text-xs text-muted-foreground">Confirmadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paridas/Lact.</CardTitle>
            <Baby className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.paridas + kpis.lactantes}</div>
            <p className="text-xs text-muted-foreground">Crias ao pé</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abertas</CardTitle>
            <AlertCircle className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.abertas}</div>
            <p className="text-xs text-muted-foreground">Disponíveis</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="border-none shadow-sm pb-4">
        <CardHeader className="px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                <TabsList>
                   <TabsTrigger value="active">Em Atividade</TabsTrigger>
                   <TabsTrigger value="servida">Servidas</TabsTrigger>
                   <TabsTrigger value="prenha">Prenhas</TabsTrigger>
                   <TabsTrigger value="parida">Paridas</TabsTrigger>
                   <TabsTrigger value="all">Todas</TabsTrigger>
                </TabsList>
             </Tabs>
             <div className="relative w-full sm:w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                   placeholder="Buscar animal..."
                   className="pl-8"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Animal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Evento</TableHead>
                <TableHead>Dias Decorridos</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead className="text-right pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAnimals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Nenhum animal encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAnimals.slice(0, 100).map((animal) => (
                  <TableRow key={animal.id}>
                    <TableCell className="font-medium pl-6">
                       <div className="flex flex-col">
                          <span>{animal.identificacao}</span>
                          <span className="text-xs text-muted-foreground">{animal.lote_id ?? '-'}</span>
                       </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(animal.reproStatus.status)}</TableCell>
                    <TableCell>
                       <div className="flex flex-col">
                          <span>{animal.reproStatus.lastEventType?.toUpperCase() ?? '-'}</span>
                          <span className="text-xs text-muted-foreground">
                             {animal.reproStatus.lastEventDate ? new Date(animal.reproStatus.lastEventDate).toLocaleDateString() : '-'}
                          </span>
                       </div>
                    </TableCell>
                    <TableCell>
                       {animal.reproStatus.daysSinceServico ? `${animal.reproStatus.daysSinceServico} dias (Serv)` :
                        animal.reproStatus.daysSinceParto ? `${animal.reproStatus.daysSinceParto} dias (Parto)` : '-'}
                    </TableCell>
                    <TableCell>
                        {animal.reproStatus.predictionDate ? (
                           <div className="flex flex-col">
                              <span className="font-medium">
                                 {new Date(animal.reproStatus.predictionDate).toLocaleDateString()}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                 {animal.reproStatus.status === 'SERVIDA' ? 'Diagnóstico' :
                                  animal.reproStatus.status === 'PRENHA' ? 'Parto' : 'Desmame'}
                              </span>
                           </div>
                        ) : '-'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                       <Link to={`/animais/${animal.id}`}>
                          <Button variant="ghost" size="sm">Detalhes</Button>
                       </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
