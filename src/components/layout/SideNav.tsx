import { NavLink } from "react-router-dom";
import { 
  Home, Beef, Layers, Map, Calendar, PlusCircle, 
  History, DollarSign, LayoutDashboard, Users, Settings, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Início", path: "/home" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Beef, label: "Animais", path: "/animais" },
  { icon: Layers, label: "Lotes", path: "/lotes" },
  { icon: Map, label: "Pastos", path: "/pastos" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: PlusCircle, label: "Registrar", path: "/registrar" },
  { icon: History, label: "Eventos", path: "/eventos" },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro" },
  { icon: AlertCircle, label: "Reconciliação", path: "/reconciliacao" },
  { icon: Users, label: "Membros", path: "/admin/membros" },
];

export const SideNav = () => {
  return (
    <nav className="hidden md:flex flex-col w-64 border-r bg-muted/30 h-[calc(100vh-64px)] sticky top-16">
      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="p-4 border-t">
        <NavLink to="/perfil" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <Settings className="h-4 w-4" /> Configurações
        </NavLink>
      </div>
    </nav>
  );
};