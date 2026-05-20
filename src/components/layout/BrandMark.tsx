import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

const BRAND_LOGO_SRC = "/logo.png";

export function BrandMark({
  className,
  logoClassName,
  textClassName,
  showSubtitle = false,
}: {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  showSubtitle?: boolean;
}) {
  return (
    <Link
      to="/home"
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md text-sidebar-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className,
      )}
      aria-label="Ir para RebanhoSync"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/20 bg-white shadow-sm">
        <img
          src={BRAND_LOGO_SRC}
          alt=""
          className={cn("h-full w-full object-contain", logoClassName)}
        />
      </span>
      <span className={cn("min-w-0 leading-none", textClassName)}>
        <span className="block truncate text-base font-bold tracking-normal text-sidebar-foreground">
          RebanhoSync
        </span>
        {showSubtitle ? (
          <span className="mt-1 block truncate text-[11px] font-medium text-sidebar-foreground/65">
            Campo Operacional
          </span>
        ) : null}
      </span>
    </Link>
  );
}
