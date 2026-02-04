import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Beef, Calendar, AlertTriangle, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const Dashboard = () => {
  const totalAnimais = useLiveQuery(() => db.state_animais.count()) || 0;
  const pendenciasAgenda = useLiveQuery(() => db.state_agenda_itens.where('status').equals('agendado').count()) || 0;
  const gestosPendentes = useLiveQuery(() => db.queue_gestures.where('status').equals('PENDING').count()) || 0;

  // Mock de dados para gráficos (derivados de eventos em produção)
  const pesagemData = [
    { data: '01/05', media: 420 },
    { data: '05/05', media: 425 },
    { data: '10/05', media: 422 },
    { data: '15/05', media: 430 },
    { data: '20/05', media: 435 },
  ];

  const agendaData = [
    { nome: 'Vacina', qtd: 45 },
    { nome: 'Vermífugo', qtd: 120 },
    { nome: 'Pesagem', qtd: 80 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Animais</CardTitle>
            <Beef className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAnimais}</div>
            <p className="text-xs text-muted-foreground">Cabeças ativas no rebanho</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agenda Pendente</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendenciasAgenda}</div>
            <p className="text-xs text-muted-foreground">Tarefas agendadas para hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sincronização</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${gestosPendentes > 0 ? 'text-destructive animate-pulse' : 'text-emerald-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gestosPendentes}</div>
            <p className="text-xs text-muted-foreground">Gestos aguardando envio</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Evolução de Peso (Média)</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pesagemData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="media" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Agenda por Categoria</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agendaData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="qtd" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;