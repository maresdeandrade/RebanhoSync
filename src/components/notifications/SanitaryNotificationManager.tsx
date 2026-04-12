import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import {
  buildSanitaryReminderPlan,
  isWithinQuietHours,
} from "@/lib/notifications/sanitaryReminders";
import { db } from "@/lib/offline/db";
import {
  EMPTY_SANITARY_ATTENTION_SUMMARY,
  summarizeSanitaryAgendaAttention,
} from "@/lib/sanitario/attention";
import { showInfo } from "@/utils/toast";

const STORAGE_PREFIX = "rebanhosync:sanitary-reminder";

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function SanitaryNotificationManager() {
  const location = useLocation();
  const {
    activeFarmId,
    farmExperienceMode,
    notificationPreferences,
  } = useAuth();

  const sanitaryAttention =
    useLiveQuery(async () => {
      if (!activeFarmId) return EMPTY_SANITARY_ATTENTION_SUMMARY;

      const [agenda, animals, lotes, protocols, protocolItems] = await Promise.all([
        db.state_agenda_itens.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_protocolos_sanitarios.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_protocolos_sanitarios_itens
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
      ]);

      return summarizeSanitaryAgendaAttention({
        agenda,
        animals: animals.filter((item) => !item.deleted_at),
        lotes: lotes.filter((item) => !item.deleted_at),
        protocols: protocols.filter((item) => !item.deleted_at),
        protocolItems: protocolItems.filter((item) => !item.deleted_at),
        limit: 12,
      });
    }, [activeFarmId]) || EMPTY_SANITARY_ATTENTION_SUMMARY;

  const reminderPlan = useMemo(
    () =>
      buildSanitaryReminderPlan({
        summary: sanitaryAttention,
        preferences: notificationPreferences,
        experienceMode: farmExperienceMode,
      }),
    [farmExperienceMode, notificationPreferences, sanitaryAttention],
  );

  useEffect(() => {
    if (!activeFarmId || !reminderPlan) return;
    if (location.pathname === "/perfil") return;
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;

    const now = new Date();
    if (isWithinQuietHours(now, notificationPreferences.quietHours)) return;

    const storageKey = [
      STORAGE_PREFIX,
      activeFarmId,
      toDateKey(now),
      reminderPlan.dedupKey,
    ].join(":");

    if (localStorage.getItem(storageKey)) {
      return;
    }

    showInfo(`${reminderPlan.message} Abra a agenda para executar.`);
    localStorage.setItem(storageKey, now.toISOString());
  }, [activeFarmId, location.pathname, notificationPreferences.quietHours, reminderPlan]);

  return null;
}
