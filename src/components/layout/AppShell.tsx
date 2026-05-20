import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { SanitaryNotificationManager } from "@/components/notifications/SanitaryNotificationManager";
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";
import { startSyncWorker, stopSyncWorker } from "@/lib/offline/syncWorker";

import { MobileBottomNav } from "./MobileBottomNav";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";
import { BrandMark } from "./BrandMark";

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
      <SanitaryNotificationManager />
      <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <SideNav />

        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 md:pb-5 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav onOpenMenu={() => setIsMobileMenuOpen(true)} />

      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-[290px] border-r border-sidebar-border/80 bg-sidebar p-0 shadow-crisp"
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-sidebar-border/80 px-5 py-4">
              <BrandMark showSubtitle />
              <p className="mt-2 text-base font-semibold text-sidebar-foreground">
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
