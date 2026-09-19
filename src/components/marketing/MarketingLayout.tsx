import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { marketingNavItems } from "./marketingContent";
import { MarketingContainer, RastroGlyph } from "./MarketingPrimitives";
import "../../marketing.css";

function useMarketingMeta(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} — RebanhoSync`;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [description, title]);
}

function MarketingBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-accent))] focus-visible:ring-offset-2"
      aria-label="RebanhoSync — página inicial"
    >
      <RastroGlyph className={cn("text-brand", compact ? "h-8 w-8" : "h-9 w-9")} />
      <span className="marketing-heading text-lg font-medium tracking-tight text-content-primary sm:text-xl">
        Rebanho<span className="font-semibold">Sync</span>
      </span>
    </Link>
  );
}

function MarketingHeader() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-[hsl(var(--brand-background))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--brand-background))]/90">
      <MarketingContainer className="flex h-16 items-center justify-between lg:h-[72px]">
        <MarketingBrand compact />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
          {marketingNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-muted hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                location.pathname === item.to && "bg-surface-muted text-content-primary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" asChild>
            <Link to="/login">Login</Link>
          </Button>
          <Button
            asChild
            className="bg-brand text-brand-foreground hover:bg-[hsl(var(--brand-primary-hover))] active:bg-[hsl(var(--brand-primary-active))] focus-visible:ring-[hsl(var(--brand-accent))]"
          >
            <Link to="/contato">Solicitar demonstração</Link>
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={isOpen}
          aria-controls="marketing-mobile-nav"
          onClick={() => setIsOpen((value) => !value)}
        >
          {isOpen ? <X /> : <Menu />}
        </Button>
      </MarketingContainer>

      {isOpen ? (
        <div id="marketing-mobile-nav" className="border-t border-border bg-[hsl(var(--brand-background))] lg:hidden">
          <MarketingContainer className="space-y-1 py-4">
            <nav className="flex flex-col" aria-label="Navegação mobile">
              {marketingNavItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg px-3 py-3 text-base font-medium text-content-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/login"
                className="rounded-lg px-3 py-3 text-base font-medium text-content-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Login
              </Link>
            </nav>
            <Button
              asChild
              size="lg"
              className="mt-3 w-full bg-brand text-brand-foreground hover:bg-[hsl(var(--brand-primary-hover))] focus-visible:ring-[hsl(var(--brand-accent))]"
            >
              <Link to="/contato">Solicitar demonstração</Link>
            </Button>
          </MarketingContainer>
        </div>
      ) : null}
    </header>
  );
}

function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[hsl(174_45%_10%)] py-12 text-white">
      <MarketingContainer>
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="inline-flex items-center gap-2.5">
              <RastroGlyph className="h-9 w-9 text-white" />
              <span className="marketing-heading text-xl font-medium">
                Rebanho<span className="font-semibold">Sync</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/75">
              Plataforma operacional de gestão pecuária para conectar o que acontece no campo à informação usada na gestão e decisão.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Produto</p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-white/75">
              <Link className="hover:text-white" to="/produto">Produto</Link>
              <Link className="hover:text-white" to="/como-funciona">Como funciona</Link>
              <Link className="hover:text-white" to="/seguranca-e-confianca">Segurança e confiança</Link>
              <Link className="hover:text-white" to="/faq">FAQ</Link>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Acesso</p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-white/75">
              <Link className="hover:text-white" to="/contato">Solicitar demonstração</Link>
              <Link className="hover:text-white" to="/login">Login</Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/15 pt-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} RebanhoSync.</p>
          <p>Campo → registro → histórico → decisão.</p>
        </div>
      </MarketingContainer>
    </footer>
  );
}

export function MarketingLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  useMarketingMeta(title, description);

  return (
    <div className="marketing-site">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
