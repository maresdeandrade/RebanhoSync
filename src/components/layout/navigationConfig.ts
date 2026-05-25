import {
  Activity,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  Handshake,
  History,
  Home,
  Layers,
  LayoutDashboard,
  ListTree,
  Map,
  Menu,
  PackageSearch,
  PlusCircle,
  SlidersHorizontal,
  Settings,
  Syringe,
  Users,
  type LucideIcon,
} from "lucide-react";

import { type FarmExperienceMode } from "@/lib/farms/experienceMode";

export type NavigationSectionKey = "operacao" | "estrutura" | "gestao";

export type NavigationRole = "cowboy" | "manager" | "owner";

export type NavigationChildItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  modes?: FarmExperienceMode[];
};

export type NavigationItem = {
  icon: LucideIcon;
  label: string;
  section: NavigationSectionKey;
  path?: string;
  roles?: NavigationRole[];
  modes?: FarmExperienceMode[];
  children?: NavigationChildItem[];
};

export type NavigationSection = {
  key: NavigationSectionKey;
  label: string;
};

export const navigationSections: NavigationSection[] = [
  { key: "operacao", label: "Operacao" },
  { key: "estrutura", label: "Estrutura" },
  { key: "gestao", label: "Gestao" },
];

export const navigationItems: NavigationItem[] = [
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
      { icon: PackageSearch, label: "Inventario", path: "/insumos" },
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

export function getNavigationItemByLabel(label: string) {
  return navigationItems.find((item) => item.label === label) ?? null;
}

export type BottomNavigationKey =
  | "hoje"
  | "rebanho"
  | "manejo"
  | "estrutura"
  | "mais";

export type BottomNavigationLinkItem = {
  key: Exclude<BottomNavigationKey, "mais">;
  label: string;
  path: string;
  icon: LucideIcon;
  featured?: boolean;
};

export type BottomNavigationMenuItem = {
  key: "mais";
  label: string;
  icon: LucideIcon;
};

export type BottomNavigationItem =
  | BottomNavigationLinkItem
  | BottomNavigationMenuItem;

function requireNavigationPath(label: string) {
  const item = getNavigationItemByLabel(label);

  if (!item?.path) {
    throw new Error(`Navigation item "${label}" must define a path.`);
  }

  return {
    path: item.path,
    icon: item.icon,
  };
}

const todayNavigation = requireNavigationPath("Hoje");
const animalsNavigation = requireNavigationPath("Animais");
const registerNavigation = requireNavigationPath("Registrar");
const pasturesNavigation = requireNavigationPath("Pastos");

export const bottomNavigationItems: BottomNavigationItem[] = [
  {
    key: "hoje",
    label: "Hoje",
    path: todayNavigation.path,
    icon: todayNavigation.icon,
  },
  {
    key: "rebanho",
    label: "Rebanho",
    path: animalsNavigation.path,
    icon: animalsNavigation.icon,
  },
  {
    key: "manejo",
    label: "Manejo",
    path: registerNavigation.path,
    icon: registerNavigation.icon,
    featured: true,
  },
  {
    key: "estrutura",
    label: "Estrutura",
    path: pasturesNavigation.path,
    icon: pasturesNavigation.icon,
  },
  {
    key: "mais",
    label: "Mais",
    icon: Menu,
  },
];

export function getBottomNavigationActiveKey(
  pathname: string,
): BottomNavigationKey {
  if (pathname === "/registrar" || pathname.startsWith("/registrar/")) {
    return "manejo";
  }

  if (
    pathname === "/animais" ||
    pathname.startsWith("/animais/") ||
    pathname === "/lotes" ||
    pathname.startsWith("/lotes/")
  ) {
    return "rebanho";
  }

  if (pathname === "/pastos" || pathname.startsWith("/pastos/")) {
    return "estrutura";
  }

  if (
    pathname === "/home" ||
    pathname === "/agenda" ||
    pathname.startsWith("/agenda/")
  ) {
    return "hoje";
  }

  return "mais";
}
