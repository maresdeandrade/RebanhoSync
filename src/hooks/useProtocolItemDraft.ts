/**
 * Hook — Gerenciamento de Draft de Item Sanitário
 *
 * Encapsula estado, validação e conversão draft ↔ domínio.
 */

import { useCallback, useState } from "react";
import type { ProtocolItemDraft } from "@/lib/sanitario/draft";
import {
  createEmptyProtocolItemDraft,
  mapDraftToDomain,
  mapDomainToDraft,
  validateProtocolItemDraft,
  getVisibleFieldsByMode,
} from "@/lib/sanitario/draft";
import type { SanitaryProtocolItemDomain } from "@/lib/sanitario/domain";

export interface UseProtocolItemDraftState {
  draft: ProtocolItemDraft;
  errors: string[];
  isDirty: boolean;
  isValid: boolean;
}

export interface UseProtocolItemDraftHandlers {
  updateDraft: <K extends keyof ProtocolItemDraft>(
    key: K,
    value: ProtocolItemDraft[K]
  ) => void;
  resetToDraft: (initialDraft: ProtocolItemDraft) => void;
  resetToEmpty: () => void;
  toDomain: () => SanitaryProtocolItemDomain | null;
  fromDomain: (domain: SanitaryProtocolItemDomain) => void;
}

export function useProtocolItemDraft(
  initialDraft?: ProtocolItemDraft
): UseProtocolItemDraftState & UseProtocolItemDraftHandlers {
  const [draft, setDraft] = useState<ProtocolItemDraft>(
    initialDraft || createEmptyProtocolItemDraft()
  );
  const [originalDraft] = useState<ProtocolItemDraft>(
    initialDraft || createEmptyProtocolItemDraft()
  );

  // Validar em tempo real
  const errors = validateProtocolItemDraft(draft);
  const isValid = errors.length === 0;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(originalDraft);

  const updateDraft = useCallback(
    <K extends keyof ProtocolItemDraft>(
      key: K,
      value: ProtocolItemDraft[K]
    ) => {
      setDraft((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const resetToDraft = useCallback((initial: ProtocolItemDraft) => {
    setDraft(initial);
  }, []);

  const resetToEmpty = useCallback(() => {
    setDraft(createEmptyProtocolItemDraft());
  }, []);

  const toDomain = useCallback((): SanitaryProtocolItemDomain | null => {
    if (!isValid) return null;
    try {
      return mapDraftToDomain(draft);
    } catch (e) {
      console.error("Failed to convert draft to domain:", e);
      return null;
    }
  }, [draft, isValid]);

  const fromDomain = useCallback((domain: SanitaryProtocolItemDomain) => {
    const newDraft = mapDomainToDraft(domain);
    setDraft(newDraft);
  }, []);

  return {
    // State
    draft,
    errors,
    isDirty,
    isValid,
    // Handlers
    updateDraft,
    resetToDraft,
    resetToEmpty,
    toDomain,
    fromDomain,
  };
}

/**
 * Hook para obter campos visíveis por mode
 */
export function useVisibleFields(mode?: string) {
  const visible = getVisibleFieldsByMode(mode);
  return visible;
}
