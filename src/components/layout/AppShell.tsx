import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TopBar } from "./TopBar";
import { SideNav } from "./SideNav";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SideNav as MobileNavContent } from "./SideNav";
import { startSyncWorker, stopSyncWorker } from "@/lib/offline/syncWorker";
import { useAuth } from "@/hooks/useAuth";
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";

export const AppShell = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { activeFarmId } = useAuth();

  useEffect(() => {
    startSyncWorker();

    // Cleanup: stop worker when component unmounts
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
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />

      <div className="flex flex-1">
        <SideNav />

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <div className="h-full flex flex-col">
            <div className="p-6 border-b">
              <span className="text-xl font-bold text-primary">
                Gestão Pecuária
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="py-4 px-4 space-y-1">
                <MobileNavContent />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
