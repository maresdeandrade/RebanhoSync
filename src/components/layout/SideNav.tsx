import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  AlertCircle,
  Baby,
  Beef,
  Calendar,
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileText,
  Handshake,
  History,
  Home,
  Layers,
  LayoutDashboard,
  LayoutList,
  Map,
  PlusCircle,
  Settings,
  Syringe,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { type FarmExperienceMode } from "@/lib/farms/experienceMode";
import { cn } from "@/lib/utils";

type NavItem = {
  icon: LucideIcon;
  label: string;
  path?: string;
  roles?: Array<"cowboy" | "manager" | "owner">;
  modes?: FarmExperienceMode[];
  children?: {
    icon: LucideIcon;
    label: string;
    path: string;
    modes?: FarmExperienceMode[];
  }[];
};

const navItems: NavItem[] = [
  { icon: Home, label: "Hoje", path: "/home" },
  { icon: PlusCircle, label: "Registrar", path: "/registrar" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: FileText, label: "Resumo", path: "/relatorios" },
  { icon: Beef, label: "Animais", path: "/animais" },
  { icon: Layers, label: "Lotes", path: "/lotes" },
  { icon: Map, label: "Pastos", path: "/pastos" },
  { icon: Baby, label: "Reproducao", path: "/reproducao" },
  { icon: History, label: "Eventos", path: "/eventos", modes: ["completo"] },
  {
    icon: DollarSign,
    label: "Financeiro",
    children: [
      { icon: DollarSign, label: "Lancamentos", path: "/financeiro" },
      { icon: Handshake, label: "Parceiros", path: "/contrapartes" },
    ],
  },
  {
    icon: Users,
    label: "Equipe",
    path: "/membros",
    roles: ["manager", "owner"],
  },
  {
    icon: Settings,
    label: "Configuracoes",
    roles: ["manager", "owner"],
    children: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        path: "/dashboard",
        modes: ["completo"],
      },
      { icon: Syringe, label: "Protocolos", path: "/protocolos-sanitarios" },
      {
        icon: LayoutList,
        label: "Categorias",
        path: "/categorias",
        modes: ["completo"],
      },
      {
        icon: AlertCircle,
        label: "Reconciliacao",
        path: "/reconciliacao",
        modes: ["completo"],
      },
    ],
  },
];

export const SideNav = () => {
  const { role, farmExperienceMode } = useAuth();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Financeiro"]);

  const visibleItems = useMemo(() => {
    return navItems
      .filter((item) => {
        if (item.modes && !item.modes.includes(farmExperienceMode)) return false;
        if (!item.roles) return true;
        return role ? item.roles.includes(role) : false;
      })
      .flatMap((item) => {
        if (!item.children) {
          return [item];
        }

        const children = item.children.filter(
          (child) => !child.modes || child.modes.includes(farmExperienceMode),
        );

        if (children.length === 0 && !item.path) {
          return [];
        }

        return [{ ...item, children }];
      });
  }, [farmExperienceMode, role]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label)
        ? prev.filter((value) => value !== label)
        : [...prev, label],
    );
  };

  return (
    <nav className="hidden md:flex flex-col w-64 border-r bg-muted/30 h-[calc(100vh-64px)] sticky top-16">
      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <div key={item.label}>
            {item.children ? (
              <div className="space-y-1">
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted hover:text-foreground text-muted-foreground",
                    expandedGroups.includes(item.label) && "text-foreground",
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
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
