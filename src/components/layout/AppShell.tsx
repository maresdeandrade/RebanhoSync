import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";
import { startSyncWorker, stopSyncWorker } from "@/lib/offline/syncWorker";

import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";

export const AppShell = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { activeFarmId } = useAuth();

  useEffect(() => {
    startSyncWorker();

    return () => {
      stopSyncWorker();
    };
  }, []);

  useEffect(() => {
    void trackPilotMetric({
      fazendaId: activeFarmId,
      eventName: "page_view",
      route: location.pathname,
      status: "info",
      payload: {
        pathname: location.pathname,
      },
    });
  }, [activeFarmId, location.pathname]);

  return (
    <div className="min-h-screen bg-transparent">
      <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <SideNav />

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>

      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-[290px] border-r border-sidebar-border/80 bg-sidebar p-0 shadow-crisp"
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-sidebar-border/80 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                RebanhoSync
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                Navegacao da fazenda
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SideNav mobile />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
