import { Cloud, CloudOff, RefreshCw, User, Menu, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

interface TopBarProps {
  onMenuClick?: () => void;
}

export const TopBar = ({ onMenuClick }: TopBarProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const pendingCount = useLiveQuery(() => 
    db.queue_gestures.where('status').equals('PENDING').count()
  ) || 0;

  const rejectionCount = useLiveQuery(() => 
    db.queue_rejections.count()
  ) || 0;

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-lg font-bold tracking-tight text-primary">Gestão Pecuária</span>
        </div>

        <div className="flex items-center gap-3">
          {!isOnline ? (
            <Badge variant="destructive" className="gap-1">
              <CloudOff className="h-3 w-3" /> Offline
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <Cloud className="h-3 w-3" /> Online
            </Badge>
          )}
          
          {rejectionCount > 0 && (
            <Link to="/reconciliacao">
              <Button variant="ghost" size="sm" className="gap-2 text-destructive animate-pulse">
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">{rejectionCount} erros</span>
              </Button>
            </Link>
          )}

          {pendingCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-2 text-amber-600">
              <RefreshCw className="h-4 w-4 animate-spin-slow" />
              <span className="hidden sm:inline">{pendingCount} pendentes</span>
            </Button>
          )}

          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};