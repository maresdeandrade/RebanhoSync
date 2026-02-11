import {
  Cloud,
  CloudOff,
  RefreshCw,
  Menu,
  AlertTriangle,
  Building2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

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
    useLiveQuery(() =>
      db.queue_gestures.where("status").equals("PENDING").count(),
    ) || 0;

  const rejectionCount = useLiveQuery(() => db.queue_rejections.count()) || 0;

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
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-lg font-bold tracking-tight text-primary">
            RebanhoSync
          </span>

          {activeFarmName && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 ml-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{activeFarmName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Fazenda Atual</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/select-fazenda" className="w-full cursor-pointer">
                    Trocar Fazenda
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/editar-fazenda" className="w-full cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    Editar Fazenda
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isOnline ? (
            <Badge variant="destructive" className="gap-1">
              <CloudOff className="h-3 w-3" /> Offline
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
            >
              <Cloud className="h-3 w-3" /> Online
            </Badge>
          )}

          {rejectionCount > 0 && (
            <Link to="/reconciliacao">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-destructive animate-pulse"
              >
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

          <Link to="/perfil">
            <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarImage src={userAvatar || undefined} />
              <AvatarFallback className="text-sm">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
};
