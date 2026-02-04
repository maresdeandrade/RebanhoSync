import { Card, CardContent } from "@/components/ui/card";
import { Beef, Layers, Map, PlusCircle, History, DollarSign, LayoutDashboard, Calendar, AlertCircle, Users } from "lucide-react";
import { Link } from "react-router-dom";

const modules = [
  { icon: PlusCircle, label: "Registrar", path: "/registrar", color: "bg-blue-600" },
  { icon: Beef, label: "Animais", path: "/animais", color: "bg-emerald-600" },
  { icon: Layers, label: "Lotes", path: "/lotes", color: "bg-amber-600" },
  { icon: Map, label: "Pastos", path: "/pastos", color: "bg-indigo-600" },
  { icon: Calendar, label: "Agenda", path: "/agenda", color: "bg-purple-600" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", color: "bg-slate-600" },
  { icon: History, label: "Eventos", path: "/eventos", color: "bg-orange-600" },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro", color: "bg-rose-600" },
  { icon: AlertCircle, label: "Reconciliação", path: "/reconciliacao", color: "bg-red-600" },
  { icon: Users, label: "Membros", path: "/admin/membros", color: "bg-cyan-600" },
];

const Home = () => {
  return (
    <div className="space-y-6">
      <div className="pb-2">
        <h1 className="text-2xl font-bold tracking-tight">Gestão Pecuária</h1>
        <p className="text-muted-foreground text-sm">Fazenda Santa Maria</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {modules.map((mod) => (
          <Link key={mod.path} to={mod.path}>
            <Card className="hover:bg-muted/50 transition-all border-none shadow-sm active:scale-95">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <div className={`p-3 rounded-2xl ${mod.color} text-white mb-3 shadow-lg shadow-inherit/20`}>
                  <mod.icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{mod.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Home;