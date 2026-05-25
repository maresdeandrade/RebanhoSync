import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

import {
  bottomNavigationItems,
  getBottomNavigationActiveKey,
  type BottomNavigationItem,
} from "./navigationConfig";

type MobileBottomNavProps = {
  onOpenMenu: () => void;
};

export function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const location = useLocation();
  const activeKey = getBottomNavigationActiveKey(location.pathname);

  const itemClasses = (item: BottomNavigationItem) => {
    const isActive = activeKey === item.key;
    const featured = "featured" in item && item.featured;

    return cn(
      "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[12px] font-bold transition-colors min-h-[44px]",
      isActive
        ? "text-primary"
        : "text-foreground hover:text-primary",
      featured &&
        "mx-auto -mt-6 h-16 w-16 rounded-full border-2 border-primary bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95",
      featured && isActive && "ring-4 ring-primary/30 ring-offset-2 ring-offset-background",
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.15)] md:hidden"
      aria-label="Navegacao mobile"
    >
      <div className="mx-auto grid h-20 max-w-md grid-cols-5 items-center gap-1">
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
