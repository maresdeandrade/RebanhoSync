import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Beef,
  Layers,
  Map,
  Calendar,
  PlusCircle,
  History,
  DollarSign,
  LayoutDashboard,
  Users,
  Settings,
  AlertCircle,
  LayoutList,
  ChevronDown,
  ChevronRight,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  icon: LucideIcon;
  label: string;
  path?: string;
  children?: {
    icon: LucideIcon;
    label: string;
    path: string;
  }[];
};

const navItems: NavItem[] = [
  { icon: Home, label: "Início", path: "/home" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Beef, label: "Animais", path: "/animais" },
  { icon: Layers, label: "Lotes", path: "/lotes" },
  { icon: Map, label: "Pastos", path: "/pastos" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: PlusCircle, label: "Registrar", path: "/registrar" },
  { icon: History, label: "Eventos", path: "/eventos" },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro" },
  { icon: Users, label: "Equipe", path: "/membros" },
  {
    icon: Settings,
    label: "Configurações",
    children: [
      { icon: LayoutList, label: "Categorias", path: "/categorias" },
      { icon: AlertCircle, label: "Reconciliação", path: "/reconciliacao" },
    ],
  },
];

export const SideNav = () => {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Configurações"]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  return (
    <nav className="hidden md:flex flex-col w-64 border-r bg-muted/30 h-[calc(100vh-64px)] sticky top-16">
      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <div key={item.label}>
            {item.children ? (
              <div className="space-y-1">
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted hover:text-foreground text-muted-foreground",
                    expandedGroups.includes(item.label) && "text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                  {expandedGroups.includes(item.label) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {expandedGroups.includes(item.label) && (
                  <div className="pl-4 space-y-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )
                        }
                      >
                        <child.icon className="h-4 w-4" />
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to={item.path!}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            )}
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <NavLink
          to="/perfil"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <User className="h-4 w-4" /> Meu Perfil
        </NavLink>
      </div>
    </nav>
  );
};
