import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  Loader2,
  LogOut,
  Trash2,
  Upload,
  User,
} from "lucide-react";

import { FormSection } from "@/components/ui/form-section";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { resolveNotificationPreferences } from "@/lib/notifications/sanitaryReminders";
import { applyTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";

const REMINDER_DAY_OPTIONS = [7, 3, 1] as const;

export const Perfil = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { refreshSettings, farmExperienceMode } = useAuth();

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
  const [sanitaryCriticalAlerts, setSanitaryCriticalAlerts] = useState(true);
  const [sanitaryMandatoryAlerts, setSanitaryMandatoryAlerts] = useState(true);
  const [sanitaryUpcomingAlerts, setSanitaryUpcomingAlerts] = useState(true);
  const [sanitaryFollowupAlerts, setSanitaryFollowupAlerts] = useState(true);

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

        const notifications = resolveNotificationPreferences(
          settings.notifications || {},
        );
        setNotificationsEnabled(notifications.enabled);
        setAgendaReminders(notifications.agendaReminders);
        setQuietHoursEnabled(Boolean(notifications.quietHours?.start));
        setQuietHoursStart(notifications.quietHours?.start || "22:00");
        setQuietHoursEnd(notifications.quietHours?.end || "06:00");
        setReminderDays(notifications.daysBefore);
        setSanitaryCriticalAlerts(notifications.sanitaryCritical);
        setSanitaryMandatoryAlerts(notifications.sanitaryMandatory);
        setSanitaryUpcomingAlerts(notifications.sanitaryUpcoming);
        setSanitaryFollowupAlerts(notifications.sanitaryFollowups);
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
        sanitary_critical: sanitaryCriticalAlerts,
        sanitary_mandatory: sanitaryMandatoryAlerts,
        sanitary_upcoming: sanitaryUpcomingAlerts,
        sanitary_followups: sanitaryFollowupAlerts,
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
      await refreshSettings();

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

  const handleReminderDayToggle = (day: number, checked: boolean) => {
    setReminderDays((current) => {
      if (checked) {
        return Array.from(new Set([...current, day])).sort(
          (left, right) => right - left,
        );
      }

      const next = current.filter((entry) => entry !== day);
      return next.length > 0 ? next : current;
    });
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
    <div className="space-y-5 pb-16">
      <PageIntro
        variant="plain"
        eyebrow="Conta"
        title="Meu perfil"
        meta={
          <>
            <StatusBadge tone={notificationsEnabled ? "info" : "neutral"}>
              {notificationsEnabled
                ? "Notificacoes ativas"
                : "Notificacoes desativadas"}
            </StatusBadge>
            <StatusBadge tone="neutral">
              Tema{" "}
              {theme === "system"
                ? "Sistema"
                : theme === "light"
                  ? "Claro"
                  : "Escuro"}
            </StatusBadge>
            <StatusBadge tone={agendaReminders ? "info" : "neutral"}>
              Lembretes {agendaReminders ? "ativos" : "pausados"}
            </StatusBadge>
            <StatusBadge tone="neutral">
              {farmExperienceMode === "completo" ? "Completo" : "Essencial"}
            </StatusBadge>
          </>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-5"
      >
        <div className="rounded-xl border border-border/70 bg-card p-2 shadow-none">
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

        <TabsContent value="profile" className="space-y-5">
          <FormSection title="Identidade">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAvatar}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid flex-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted/30"
                  />
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
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
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

        <TabsContent value="settings" className="space-y-5">
          <FormSection title="Aparencia">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <Label>Tema</Label>
              </div>
              <Select
                value={theme}
                onValueChange={(value: "system" | "light" | "dark") =>
                  setTheme(value)
                }
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

          <FormSection title="Notificacoes">
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label>Notificacoes gerais</Label>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>

              {notificationsEnabled ? (
                <>
                  <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <Label>Lembretes de agenda</Label>
                    </div>
                    <Switch
                      checked={agendaReminders}
                      onCheckedChange={setAgendaReminders}
                    />
                  </div>

                  <div className="space-y-4 rounded-xl border border-border/70 bg-background/80 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <Label>Horario de silencio</Label>
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
                          onChange={(event) =>
                            setQuietHoursStart(event.target.value)
                          }
                          disabled={!quietHoursEnabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quietHoursEnd">Fim</Label>
                        <Input
                          id="quietHoursEnd"
                          type="time"
                          value={quietHoursEnd}
                          onChange={(event) =>
                            setQuietHoursEnd(event.target.value)
                          }
                          disabled={!quietHoursEnabled}
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-4">
                      <div className="space-y-1">
                        <Label>Notificacoes sanitarias inteligentes</Label>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
                          <Switch
                            checked={sanitaryCriticalAlerts}
                            onCheckedChange={setSanitaryCriticalAlerts}
                          />
                          <div className="space-y-1">
                            <span className="text-sm font-medium text-foreground">
                              Criticos e atrasados
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
                          <Switch
                            checked={sanitaryMandatoryAlerts}
                            onCheckedChange={setSanitaryMandatoryAlerts}
                          />
                          <div className="space-y-1">
                            <span className="text-sm font-medium text-foreground">
                              Obrigatorios do dia
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
                          <Switch
                            checked={sanitaryFollowupAlerts}
                            onCheckedChange={setSanitaryFollowupAlerts}
                            disabled={farmExperienceMode !== "completo"}
                          />
                          <div className="space-y-1">
                            <span className="text-sm font-medium text-foreground">
                              Proximo procedimento
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
                          <Switch
                            checked={sanitaryUpcomingAlerts}
                            onCheckedChange={setSanitaryUpcomingAlerts}
                            disabled={farmExperienceMode !== "completo"}
                          />
                          <div className="space-y-1">
                            <span className="text-sm font-medium text-foreground">
                              Janela antecipada
                            </span>
                          </div>
                        </label>
                      </div>

                      <div className="space-y-2">
                        <Label>Antecedencia dos lembretes</Label>
                        <div className="flex flex-wrap gap-3">
                          {REMINDER_DAY_OPTIONS.map((day) => (
                            <label
                              key={day}
                              className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-sm"
                            >
                              <Checkbox
                                checked={reminderDays.includes(day)}
                                onCheckedChange={(checked) =>
                                  handleReminderDayToggle(day, checked === true)
                                }
                              />
                              <span>{day} dia(s) antes</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Pelo menos uma janela permanece ativa para evitar
                          silencio total por engano.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="pt-2">
              <Button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
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

      <FormSection title="Conta e acesso">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleSwitchFarm}
            className="sm:w-auto"
          >
            <Building2 className="mr-2 h-4 w-4" />
            Trocar de fazenda
          </Button>

          <Button
            variant="destructive"
            onClick={handleLogout}
            className="sm:w-auto"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </FormSection>
    </div>
  );
};

export default Perfil;

