import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, User } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { BrandMark } from "./BrandMark";
import { navigationItems, navigationSections } from "./navigationConfig";

interface SideNavProps {
  mobile?: boolean;
}

export const SideNav = ({ mobile = false }: SideNavProps) => {
  const { role, farmExperienceMode } = useAuth();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    "Financeiro",
  ]);

  const visibleSections = useMemo(() => {
    const visibleItems = navigationItems
      .filter((item) => {
        if (item.modes && !item.modes.includes(farmExperienceMode))
          return false;
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

    return navigationSections
      .map((section) => ({
        ...section,
        items: visibleItems.filter((item) => item.section === section.key),
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
      "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
      nested && "pl-6",
      active
        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );

  const indicatorClasses = (active: boolean) =>
    cn(
      "h-2 w-2 rounded-full transition-colors",
      active
        ? "bg-sidebar-primary"
        : "bg-sidebar-foreground/50 group-hover:bg-sidebar-foreground/75",
    );

  return (
    <nav
      className={cn(
        "flex flex-col",
        mobile
          ? "w-full bg-transparent"
          : "sticky top-14 hidden h-[calc(100svh-3.5rem)] w-[272px] shrink-0 self-start border-r border-sidebar-border/80 bg-sidebar md:flex",
      )}
      aria-label="Navegacao principal"
    >
      {!mobile ? (
        <div className="border-b border-sidebar-border/80 px-5 py-4">
          <BrandMark showSubtitle />
        </div>
      ) : null}

      <div
        className={cn(
          "flex-1 overflow-y-auto",
          mobile ? "px-4 py-4" : "px-4 py-5",
        )}
      >
        <div className="space-y-6">
          {visibleSections.map((section) => (
            <div key={section.key} className="space-y-1.5">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/62">
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
                          <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-sidebar-foreground/60" />
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
                                  <span
                                    className={indicatorClasses(isActive)}
                                  />
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
                    className={({ isActive }) =>
                      itemClasses({ active: isActive })
                    }
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
