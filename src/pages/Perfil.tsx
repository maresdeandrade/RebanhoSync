import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  Loader2,
  LogOut,
  Moon,
  Sun,
  Trash2,
  Upload,
  User,
} from "lucide-react";

import { FormSection } from "@/components/ui/form-section";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { applyTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";

export const Perfil = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [agendaReminders, setAgendaReminders] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("06:00");
  const [reminderDays, setReminderDays] = useState<number[]>([7, 3, 1]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const { toast } = useToast();

  useEffect(() => {
    void loadProfile();
    void loadSettings();
    // Intentional one-time bootstrap for user-scoped data on page mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name, phone, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name || "");
        setPhone(profile.phone || "");
        setAvatarUrl(profile.avatar_url || "");
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro ao carregar perfil",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: settings } = await supabase
        .from("user_settings")
        .select("theme, notifications, sync_prefs")
        .eq("user_id", user.id)
        .single();

      if (settings) {
        setTheme(settings.theme || "system");

        const notifications = settings.notifications || {};
        setNotificationsEnabled(notifications.enabled ?? true);
        setAgendaReminders(notifications.agenda_reminders ?? true);
        setQuietHoursEnabled(notifications.quiet_hours?.start ? true : false);
        setQuietHoursStart(notifications.quiet_hours?.start || "22:00");
        setQuietHoursEnd(notifications.quiet_hours?.end || "06:00");
        setReminderDays(notifications.days_before || [7, 3, 1]);
      }
    } catch (error: unknown) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_profiles")
        .update({
          display_name: displayName,
          phone: phone || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso",
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const notifications = {
        enabled: notificationsEnabled,
        agenda_reminders: agendaReminders,
        days_before: reminderDays,
        quiet_hours: quietHoursEnabled
          ? { start: quietHoursStart, end: quietHoursEnd }
          : null,
      };

      const { error } = await supabase
        .from("user_settings")
        .update({
          theme,
          notifications,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      applyTheme(theme);

      toast({
        title: "Sucesso",
        description: "Preferencias atualizadas com sucesso",
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      setAvatarUrl(publicUrl);

      toast({
        title: "Sucesso",
        description: "Avatar enviado com sucesso",
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro ao fazer upload",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarUrl("");
      toast({
        title: "Sucesso",
        description: "Avatar removido",
      });
    } catch (error) {
      console.error("Error removing avatar:", error);
    }
  };

  const handleSwitchFarm = () => {
    localStorage.removeItem("activeFarmId");
    navigate("/select-fazenda");
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("activeFarmId");
      await supabase.auth.signOut();

      toast({
        title: "Desconectado",
        description: "Voce foi desconectado com sucesso",
      });

      navigate("/login");
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <PageIntro
        eyebrow="Conta"
        title="Meu perfil"
        description="Gerencie dados pessoais, preferências de interface e ações de conta em uma estrutura previsível."
        meta={
          <StatusBadge tone={notificationsEnabled ? "info" : "neutral"}>
            {notificationsEnabled ? "Notificacoes ativas" : "Notificacoes desativadas"}
          </StatusBadge>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Tema"
          value={theme === "system" ? "Sistema" : theme === "light" ? "Claro" : "Escuro"}
          hint="Preferencia aplicada na interface."
          icon={
            theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />
          }
        />
        <MetricCard
          label="Lembretes"
          value={agendaReminders ? "Ativos" : "Pausados"}
          hint={
            notificationsEnabled
              ? `${reminderDays.join(", ")} dia(s) antes do vencimento.`
              : "Dependem das notificacoes gerais."
          }
          tone={agendaReminders ? "info" : "default"}
        />
        <MetricCard
          label="Horario de silencio"
          value={quietHoursEnabled ? `${quietHoursStart} - ${quietHoursEnd}` : "Desligado"}
          hint="Usado para reduzir ruido fora da rotina operacional."
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="app-surface p-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Preferencias
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="space-y-6">
          <FormSection
            title="Identidade"
            description="Atualize foto, nome e telefone. O e-mail continua apenas para consulta."
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="flex items-center gap-4 lg:min-w-[240px] lg:flex-col lg:items-start">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-24 w-24 rounded-full border border-border/70 object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-border/70 bg-muted/20">
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}

                <div className="space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {avatarUrl ? "Alterar foto" : "Adicionar foto"}
                  </Button>
                  {avatarUrl ? (
                    <Button variant="ghost" size="sm" onClick={handleRemoveAvatar}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid flex-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email} disabled className="bg-muted/30" />
                  <p className="text-xs text-muted-foreground">
                    O e-mail nao pode ser alterado neste fluxo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Nome de exibicao</Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Seu nome"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full sm:w-auto">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar perfil"
                )}
              </Button>
            </div>
          </FormSection>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <FormSection
            title="Aparencia"
            description="Escolha como a interface deve se comportar neste dispositivo."
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <Label>Tema</Label>
                <p className="text-sm leading-6 text-muted-foreground">
                  Sistema, claro ou escuro. A aplicacao usa esta preferencia imediatamente.
                </p>
              </div>
              <Select
                value={theme}
                onValueChange={(value: "system" | "light" | "dark") => setTheme(value)}
              >
                <SelectTrigger className="w-full lg:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Sistema</SelectItem>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormSection>

          <FormSection
            title="Notificacoes"
            description="Mantenha somente os lembretes realmente uteis na rotina e esconda o resto fora de horario."
          >
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label>Notificacoes gerais</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativa ou pausa os avisos do aplicativo neste dispositivo.
                  </p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>

              {notificationsEnabled ? (
                <>
                  <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <Label>Lembretes de agenda</Label>
                      <p className="text-sm text-muted-foreground">
                        Mantem avisos de tarefas e vencimentos proximos.
                      </p>
                    </div>
                    <Switch checked={agendaReminders} onCheckedChange={setAgendaReminders} />
                  </div>

                  <div className="space-y-4 rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <Label>Horario de silencio</Label>
                        <p className="text-sm text-muted-foreground">
                          Suspende notificacoes entre os horarios configurados.
                        </p>
                      </div>
                      <Switch
                        checked={quietHoursEnabled}
                        onCheckedChange={setQuietHoursEnabled}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="quietHoursStart">Inicio</Label>
                        <Input
                          id="quietHoursStart"
                          type="time"
                          value={quietHoursStart}
                          onChange={(event) => setQuietHoursStart(event.target.value)}
                          disabled={!quietHoursEnabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quietHoursEnd">Fim</Label>
                        <Input
                          id="quietHoursEnd"
                          type="time"
                          value={quietHoursEnd}
                          onChange={(event) => setQuietHoursEnd(event.target.value)}
                          disabled={!quietHoursEnabled}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="pt-2">
              <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full sm:w-auto">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar preferencias"
                )}
              </Button>
            </div>
          </FormSection>
        </TabsContent>
      </Tabs>

      <FormSection
        title="Conta e acesso"
        description="Acoes sensiveis ficam fora do conteudo principal para reduzir risco e ruido."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={handleSwitchFarm} className="sm:w-auto">
            <Building2 className="mr-2 h-4 w-4" />
            Trocar de fazenda
          </Button>

          <Button variant="destructive" onClick={handleLogout} className="sm:w-auto">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </FormSection>
    </div>
  );
};

export default Perfil;
