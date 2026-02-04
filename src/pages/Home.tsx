import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Beef, Layers, Map, PlusCircle, History, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";

const quickActions = [
  { icon: PlusCircle, label: "Registrar Manejo", path: "/registrar", color: "bg-blue-500" },
  { icon: Beef, label: "Animais", path: "/animais", color: "bg-emerald-500" },
  { icon: Layers, label: "Lotes", path: "/lotes", color: "bg-amber-500" },
  { icon: Map, label: "Pastos", path: "/pastos", color: "bg-indigo-500" },
  { icon: History, label: "Histórico", path: "/eventos", color: "bg-slate-500" },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro", color: "bg-rose-500" },
];

const Home = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Olá, Operador</h1>
        <p className="text-muted-foreground">Fazenda Santa Maria • Setor Norte</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Link key={action.path} to={action.path}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-none shadow-sm bg-card">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <div className={`p-3 rounded-2xl ${action.color} text-white mb-3`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="text-sm font-semibold">{action.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próximas Atividades</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">Nenhuma atividade agendada para hoje.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo do Rebanho</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total de Cabeças</span>
              <span className="text-2xl font-bold">452</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;