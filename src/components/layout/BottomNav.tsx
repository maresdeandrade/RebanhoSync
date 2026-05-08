import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

import {
  bottomNavigationItems,
  getBottomNavigationActiveKey,
  type BottomNavigationItem,
} from "./navigationConfig";

type BottomNavProps = {
  onOpenMenu: () => void;
};

export function BottomNav({ onOpenMenu }: BottomNavProps) {
  const location = useLocation();
  const activeKey = getBottomNavigationActiveKey(location.pathname);

  const itemClasses = (item: BottomNavigationItem) => {
    const isActive = activeKey === item.key;
    const featured = "featured" in item && item.featured;

    return cn(
      "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors",
      isActive
        ? "text-primary"
        : "text-muted-foreground hover:text-foreground",
      featured &&
        "mx-auto -mt-4 h-14 w-14 rounded-full border border-primary/20 bg-primary text-primary-foreground shadow-crisp hover:bg-primary/95 hover:text-primary-foreground",
      featured && isActive && "ring-2 ring-primary/20 ring-offset-2 ring-offset-background",
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
      aria-label="Navegacao mobile"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center gap-1">
        {bottomNavigationItems.map((item) => {
          const isActive = activeKey === item.key;
          const Icon = item.icon;

          if (item.key === "mais") {
            return (
              <button
                key={item.key}
                type="button"
                className={itemClasses(item)}
                aria-current={isActive ? "page" : undefined}
                onClick={onOpenMenu}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              to={item.path}
              className={itemClasses(item)}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
