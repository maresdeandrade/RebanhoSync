import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  AlertCircle,
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
  ListTree,
  Map,
  PlusCircle,
  SlidersHorizontal,
  Settings,
  Syringe,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { type FarmExperienceMode } from "@/lib/farms/experienceMode";
import { cn } from "@/lib/utils";

type NavSectionKey = "operacao" | "estrutura" | "gestao";

type NavItem = {
  icon: LucideIcon;
  label: string;
  section: NavSectionKey;
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
  { icon: Home, label: "Hoje", path: "/home", section: "operacao" },
  {
    icon: PlusCircle,
    label: "Registrar",
    path: "/registrar",
    section: "operacao",
  },
  { icon: Calendar, label: "Agenda", path: "/agenda", section: "operacao" },
  {
    icon: Activity,
    label: "Reproducao",
    path: "/reproducao",
    section: "operacao",
  },
  {
    icon: History,
    label: "Eventos",
    path: "/eventos",
    modes: ["completo"],
    section: "operacao",
  },
  {
    icon: FileText,
    label: "Resumo",
    path: "/relatorios",
    section: "operacao",
  },
  { icon: ListTree, label: "Animais", path: "/animais", section: "estrutura" },
  { icon: Layers, label: "Lotes", path: "/lotes", section: "estrutura" },
  { icon: Map, label: "Pastos", path: "/pastos", section: "estrutura" },
  {
    icon: DollarSign,
    label: "Financeiro",
    section: "gestao",
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
    section: "gestao",
  },
  {
    icon: Settings,
    label: "Configuracoes",
    roles: ["manager", "owner"],
    section: "gestao",
    children: [
      {
        icon: SlidersHorizontal,
        label: "Ajustes",
        path: "/configuracoes",
      },
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        path: "/dashboard",
        modes: ["completo"],
      },
      { icon: Syringe, label: "Protocolos", path: "/protocolos-sanitarios" },
      {
        icon: AlertCircle,
        label: "Reconciliacao",
        path: "/reconciliacao",
        modes: ["completo"],
      },
    ],
  },
];

const sectionOrder: NavSectionKey[] = ["operacao", "estrutura", "gestao"];

const sectionLabel: Record<NavSectionKey, string> = {
  operacao: "Operacao",
  estrutura: "Estrutura",
  gestao: "Gestao",
};

interface SideNavProps {
  mobile?: boolean;
}

export const SideNav = ({ mobile = false }: SideNavProps) => {
  const { role, farmExperienceMode } = useAuth();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Financeiro"]);

  const visibleSections = useMemo(() => {
    const visibleItems = navItems
      .filter((item) => {
        if (item.modes && !item.modes.includes(farmExperienceMode)) return false;
        if (!item.roles) return true;
        return role ? item.roles.includes(role) : false;
      })
      .flatMap((item) => {
        if (!item.children) return [item];

        const children = item.children.filter(
          (child) => !child.modes || child.modes.includes(farmExperienceMode),
        );

        if (children.length === 0 && !item.path) return [];

        return [{ ...item, children }];
      });

    return sectionOrder
      .map((section) => ({
        key: section,
        label: sectionLabel[section],
        items: visibleItems.filter((item) => item.section === section),
      }))
      .filter((section) => section.items.length > 0);
  }, [farmExperienceMode, role]);

  useEffect(() => {
    const activeParents = visibleSections.flatMap((section) =>
      section.items
        .filter((item) =>
          item.children?.some((child) =>
            location.pathname.startsWith(child.path),
          ),
        )
        .map((item) => item.label),
    );

    if (activeParents.length === 0) return;

    setExpandedGroups((current) =>
      Array.from(new Set([...current, ...activeParents])),
    );
  }, [location.pathname, visibleSections]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((current) =>
      current.includes(label)
        ? current.filter((value) => value !== label)
        : [...current, label],
    );
  };

  const itemClasses = ({
    active,
    nested = false,
  }: {
    active: boolean;
    nested?: boolean;
  }) =>
    cn(
      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      nested && "pl-4",
      active
        ? "bg-sidebar-accent text-foreground shadow-sm"
        : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground",
    );

  const indicatorClasses = (active: boolean) =>
    cn(
      "h-1.5 w-1.5 rounded-full transition-colors",
      active ? "bg-primary" : "bg-border group-hover:bg-muted-foreground/30",
    );

  return (
    <nav
      className={cn(
        "flex flex-col",
        mobile
          ? "w-full bg-transparent"
          : "hidden w-[272px] shrink-0 border-r border-sidebar-border/80 bg-sidebar/90 md:flex",
      )}
      aria-label="Navegacao principal"
    >
      <div className={cn("flex-1 overflow-y-auto", mobile ? "px-4 py-4" : "px-4 py-5")}>
        <div className="space-y-6">
          {visibleSections.map((section) => (
            <div key={section.key} className="space-y-1.5">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {section.label}
              </p>
              {section.items.map((item) => {
                const groupIsActive =
                  item.children?.some((child) =>
                    location.pathname.startsWith(child.path),
                  ) ?? false;
                const groupIsExpanded =
                  expandedGroups.includes(item.label) || groupIsActive;

                if (item.children) {
                  const groupId = `sidenav-group-${item.label
                    .toLowerCase()
                    .replaceAll(" ", "-")}`;

                  return (
                    <div key={item.label} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.label)}
                        aria-expanded={groupIsExpanded}
                        aria-controls={groupId}
                        className={cn(
                          itemClasses({ active: groupIsActive }),
                          "w-full justify-between",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span className={indicatorClasses(groupIsActive)} />
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </span>
                        {groupIsExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {groupIsExpanded ? (
                        <div id={groupId} className="space-y-1 pl-5">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.path}
                              to={child.path}
                              className={({ isActive }) =>
                                itemClasses({ active: isActive, nested: true })
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  <span className={indicatorClasses(isActive)} />
                                  <child.icon className="h-4 w-4" />
                                  {child.label}
                                </>
                              )}
                            </NavLink>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={item.path}
                    to={item.path!}
                    className={({ isActive }) => itemClasses({ active: isActive })}
                  >
                    {({ isActive }) => (
                      <>
                        <span className={indicatorClasses(isActive)} />
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-sidebar-border/80 p-4">
        <NavLink
          to="/perfil"
          className={({ isActive }) => itemClasses({ active: isActive })}
        >
          {({ isActive }) => (
            <>
              <span className={indicatorClasses(isActive)} />
              <User className="h-4 w-4" />
              Meu Perfil
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
};
