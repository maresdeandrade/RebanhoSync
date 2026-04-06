import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Cloud,
  CloudOff,
  Menu,
  RefreshCw,
  SlidersHorizontal,
  Settings,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/lib/offline/db";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface TopBarProps {
  onMenuClick?: () => void;
}

export const TopBar = ({ onMenuClick }: TopBarProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { activeFarmId } = useAuth();
  const [activeFarmName, setActiveFarmName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const pendingCount =
    useLiveQuery(async () => {
      if (!activeFarmId) return 0;

      const gestures = await db.queue_gestures
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray();

      return gestures.filter(
        (gesture) =>
          gesture.status === "PENDING" || gesture.status === "SYNCING",
      ).length;
    }, [activeFarmId]) || 0;

  const rejectionCount =
    useLiveQuery(async () => {
      if (!activeFarmId) return 0;
      return db.queue_rejections.where("fazenda_id").equals(activeFarmId).count();
    }, [activeFarmId]) || 0;

  useEffect(() => {
    const fetchFarmName = async () => {
      if (!activeFarmId) {
        setActiveFarmName(null);
        return;
      }

      const { data, error } = await supabase
        .from("fazendas")
        .select("nome")
        .eq("id", activeFarmId)
        .is("deleted_at", null)
        .single();

      if (!error && data) {
        setActiveFarmName(data.nome);
      }
    };

    fetchFarmName();
  }, [activeFarmId]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setUserAvatar(profile.avatar_url || null);
        setUserName(profile.display_name);
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
            aria-label="Abrir navegacao"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden min-w-0 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              RebanhoSync
            </p>
            <p className="truncate text-sm font-medium text-foreground/80">
              Operacao offline-first da fazenda
            </p>
          </div>

          {activeFarmName ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-0 max-w-[320px] justify-between rounded-full px-3.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{activeFarmName}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Fazenda atual</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/select-fazenda" className="w-full cursor-pointer">
                    Trocar fazenda
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/configuracoes" className="w-full cursor-pointer">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Configuracoes
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/editar-fazenda" className="w-full cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Editar fazenda
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <StatusBadge tone={isOnline ? "success" : "danger"}>
            {isOnline ? (
              <Cloud className="h-3.5 w-3.5" />
            ) : (
              <CloudOff className="h-3.5 w-3.5" />
            )}
            {isOnline ? "Conectado" : "Offline"}
          </StatusBadge>

          {pendingCount > 0 ? (
            <Link to="/reconciliacao">
              <StatusBadge tone="warning" className="hover:opacity-90">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                {pendingCount} na fila
              </StatusBadge>
            </Link>
          ) : null}

          {rejectionCount > 0 ? (
            <Link to="/reconciliacao">
              <StatusBadge tone="danger" className="hover:opacity-90">
                <AlertTriangle className="h-3.5 w-3.5" />
                {rejectionCount} pendencia{rejectionCount > 1 ? "s" : ""}
              </StatusBadge>
            </Link>
          ) : null}

          <Link to="/perfil" aria-label="Abrir perfil">
            <Avatar className="h-9 w-9 border border-border/70 shadow-soft transition-transform hover:scale-[1.02]">
              <AvatarImage src={userAvatar || undefined} />
              <AvatarFallback className="bg-secondary text-sm font-medium text-secondary-foreground">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
};
