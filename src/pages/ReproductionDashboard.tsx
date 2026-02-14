import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";
import { Animal } from "@/lib/offline/types";
import { computeReproStatus, AnimalReproStatus } from "@/lib/reproduction/status";
import { getReproductionEventsJoined } from "@/lib/reproduction/selectors";
import { ReproStatus } from "@/lib/reproduction/types";
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
      .filter((a) => a.sexo === "F" && a.status === "ativo")
      .toArray();

    // 2. Fetch All Reproduction Events (Joined)
    const allEvents = await getReproductionEventsJoined(fazendaId);
    
    // 3. Group Events by Animal
    const eventsByAnimal = new Map<string, typeof allEvents>();
    
    allEvents.forEach((evt) => {
      if (!evt.animal_id) return;
      if (!eventsByAnimal.has(evt.animal_id)) {
        eventsByAnimal.set(evt.animal_id, []);
      }
      eventsByAnimal.get(evt.animal_id)?.push(evt);
    });

    // 4. Derive Status for each Animal
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
    paridas: dashboardData.filter(a => a.reproStatus.status === 'PARIDA_PUERPERIO').length,
    abertas: dashboardData.filter(a => a.reproStatus.status === 'VAZIA').length,
  };

  // Filter Data based on Tab and Search
  const filteredAnimals = dashboardData.filter((animal) => {
    // Search Filter
    if (searchTerm) {
      if (!animal.identificacao.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    }

    // Tab Filter
    const s = animal.reproStatus.status;
    const days = animal.reproStatus.daysSinceEvent || 0;
    const lastType = animal.reproStatus.lastEventType;

    switch (activeTab) {
      case 'active':
        return ['SERVIDA', 'PRENHA', 'PARIDA_PUERPERIO'].includes(s); 
      case 'servida':
        return s === 'SERVIDA';
      case 'prenha':
        return s === 'PRENHA';
      case 'parida':
        // Parida = Puerperio OR "Parida Aberta" hint (Vazia w/ Parto 61-240 days ago)
        if (s === 'PARIDA_PUERPERIO') return true;
        if (s === 'VAZIA' && lastType === 'parto' && days >= 61 && days <= 240) return true;
        return false;
      case 'aberta':
        // Aberta = Vazia. (Exclude Puerperio).
        // Optionally exclude "Parida Aberta" from here if we want strict separation, 
        // but physically they are Open, so keeping them in 'aberta' is also correct.
        // User request: "Parida (Aberta)" is a visual hint, base status is VAZIA.
        return s === 'VAZIA';
      default:
        return true;
    }
  });

  const getStatusBadge = (status: ReproStatus, lastType: string | null, days: number | null) => {
    switch (status) {
      case 'PRENHA': return <Badge className="bg-green-600">Prenha</Badge>;
      case 'SERVIDA': return <Badge className="bg-yellow-600">Servida</Badge>;
      case 'PARIDA_PUERPERIO': return <Badge className="bg-purple-600">Parida (Puerpério)</Badge>;
      case 'VAZIA': 
        if (lastType === 'parto' && days !== null && days >= 61 && days <= 240) {
             return <Badge className="bg-purple-400">Parida (Aberta)</Badge>;
        }
        return <Badge variant="outline">Vazia</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reprodução</h1>
          <p className="text-muted-foreground">Monitoramento do ciclo reprodutivo (V1)</p>
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
            <CardTitle className="text-sm font-medium">Paridas</CardTitle>
            <Baby className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.paridas}</div>
            <p className="text-xs text-muted-foreground">Com cria</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vazias/Abertas</CardTitle>
            <AlertCircle className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.abertas}</div>
            <p className="text-xs text-muted-foreground">Disponíveis Repro.</p>
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
                    <TableCell>{getStatusBadge(animal.reproStatus.status, animal.reproStatus.lastEventType, animal.reproStatus.daysSinceEvent)}</TableCell>
                    <TableCell>
                       <div className="flex flex-col">
                          <span>{animal.reproStatus.lastEventType?.toUpperCase() ?? '-'}</span>
                          <span className="text-xs text-muted-foreground">
                             {animal.reproStatus.lastEventDate ? new Date(animal.reproStatus.lastEventDate).toLocaleDateString() : '-'}
                          </span>
                       </div>
                    </TableCell>
                    <TableCell>
                       {animal.reproStatus.daysSinceEvent !== null ? `${animal.reproStatus.daysSinceEvent} dias` : '-'}
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
