import type { ReactNode } from "react";
import { MonitorSmartphone } from "lucide-react";

import { cn } from "@/lib/utils";

export function MarketingContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1240px] px-4 sm:px-5 md:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MarketingSectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
      )}
    >
      {eyebrow ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--brand-accent))]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="marketing-heading text-3xl font-semibold leading-tight text-content-primary sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-base leading-7 text-content-secondary sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function RastroGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className={cn("h-10 w-10", className)}
      fill="none"
    >
      <path
        d="M7 11h12c5 0 8 3 8 8v4c0 5 3 8 8 8h6"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="11" r="4" fill="currentColor" />
      <circle cx="27" cy="23" r="4" fill="currentColor" />
      <circle cx="41" cy="31" r="4" fill="currentColor" />
    </svg>
  );
}

export function TrailConnector({
  vertical = false,
  className,
}: {
  vertical?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative text-[hsl(var(--brand-accent))]",
        vertical ? "h-full min-h-24 w-5" : "h-5 w-full min-w-16",
        className,
      )}
    >
      <span
        className={cn(
          "absolute bg-current",
          vertical
            ? "left-1/2 top-0 h-full w-0.5 -translate-x-1/2"
            : "left-0 top-1/2 h-0.5 w-full -translate-y-1/2",
        )}
      />
      <span
        className={cn(
          "absolute h-2.5 w-2.5 rounded-full bg-current",
          vertical
            ? "left-1/2 top-0 -translate-x-1/2"
            : "left-0 top-1/2 -translate-y-1/2",
        )}
      />
      <span
        className={cn(
          "absolute h-2.5 w-2.5 rounded-full bg-current",
          vertical
            ? "bottom-0 left-1/2 -translate-x-1/2"
            : "right-0 top-1/2 -translate-y-1/2",
        )}
      />
    </div>
  );
}

export function ScreenshotPlaceholder({
  code,
  title,
  description = "Substituir por captura real antes da publicação.",
  className,
}: {
  code: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.25rem] border border-border-strong/70 bg-surface shadow-soft",
        className,
      )}
      data-marketing-placeholder="screenshot"
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface-muted/60 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--brand-accent))]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--brand-secondary))]/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-brand/35" />
      </div>
      <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center sm:min-h-72">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--brand-primary-subtle))] text-brand">
          <MonitorSmartphone className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-content-muted">
          {code}
        </p>
        <p className="marketing-heading mt-2 text-xl font-semibold text-content-primary">
          {title}
        </p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-content-secondary">
          {description}
        </p>
      </div>
    </div>
  );
}
