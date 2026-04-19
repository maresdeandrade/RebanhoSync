import { useCallback, useMemo, useState } from "react";
import { Handshake, Move, Scale, Syringe } from "lucide-react";

import type { EventDomain } from "@/lib/events/types";

export type QuickActionKey =
  | "vacinacao"
  | "vermifugacao"
  | "pesagem"
  | "movimentacao"
  | "compra"
  | "venda";

export type QuickActionConfig = {
  key: QuickActionKey;
  label: string;
  helper: string;
  requiresAnimals?: boolean;
  icon: typeof Syringe;
};

export const REGISTRAR_QUICK_ACTIONS: QuickActionConfig[] = [
  {
    key: "vacinacao",
    label: "Vacinacao",
    helper: "Aplicacao sanitaria rapida para rotina de vacina.",
    requiresAnimals: true,
    icon: Syringe,
  },
  {
    key: "vermifugacao",
    label: "Vermifugacao",
    helper: "Registro sanitario rapido por lote ou animal.",
    requiresAnimals: true,
    icon: Syringe,
  },
  {
    key: "pesagem",
    label: "Pesagem",
    helper: "Lancar peso sem navegar pelo fluxo generico.",
    requiresAnimals: true,
    icon: Scale,
  },
  {
    key: "movimentacao",
    label: "Movimentacao",
    helper: "Mover animais entre lotes com menos cliques.",
    requiresAnimals: true,
    icon: Move,
  },
  {
    key: "compra",
    label: "Compra",
    helper: "Compra simples por lote, com ou sem novos animais.",
    icon: Handshake,
  },
  {
    key: "venda",
    label: "Venda",
    helper: "Venda simples com atualizacao do status do animal.",
    requiresAnimals: true,
    icon: Handshake,
  },
];

export function isQuickActionKey(value: string | null): value is QuickActionKey {
  return REGISTRAR_QUICK_ACTIONS.some((action) => action.key === value);
}

export function getQuickActionConfig(key: QuickActionKey | null) {
  return REGISTRAR_QUICK_ACTIONS.find((action) => action.key === key) ?? null;
}

export function resolveQuickActionDecision(actionKey: QuickActionKey): {
  tipoManejo: EventDomain;
  sanitaryQuickAction: "vacinacao" | "vermifugacao" | null;
  financeiroNatureza: "compra" | "venda" | null;
} {
  if (actionKey === "vacinacao" || actionKey === "vermifugacao") {
    return {
      tipoManejo: "sanitario",
      sanitaryQuickAction: actionKey,
      financeiroNatureza: null,
    };
  }

  if (actionKey === "pesagem") {
    return {
      tipoManejo: "pesagem",
      sanitaryQuickAction: null,
      financeiroNatureza: null,
    };
  }

  if (actionKey === "movimentacao") {
    return {
      tipoManejo: "movimentacao",
      sanitaryQuickAction: null,
      financeiroNatureza: null,
    };
  }

  return {
    tipoManejo: "financeiro",
    sanitaryQuickAction: null,
    financeiroNatureza: actionKey === "compra" ? "compra" : "venda",
  };
}

export function requiresAnimalsForQuickAction(input: {
  quickAction: QuickActionKey | null;
  selectedAnimalCount: number;
}) {
  const config = getQuickActionConfig(input.quickAction);
  return config?.requiresAnimals === true && input.selectedAnimalCount === 0;
}

export function useRegistrarQuickActionPolicy(input: {
  applySanitaryQuickAction: (actionKey: "vacinacao" | "vermifugacao") => void;
  setTipoManejo: (domain: EventDomain) => void;
  updateFinanceiroNatureza: (natureza: "compra" | "venda") => void;
}) {
  const {
    applySanitaryQuickAction,
    setTipoManejo,
    updateFinanceiroNatureza,
  } = input;
  const [quickAction, setQuickAction] = useState<QuickActionKey | null>(null);

  const applyQuickAction = useCallback(
    (actionKey: QuickActionKey) => {
      setQuickAction(actionKey);
      const decision = resolveQuickActionDecision(actionKey);
      setTipoManejo(decision.tipoManejo);

      if (decision.sanitaryQuickAction) {
        applySanitaryQuickAction(decision.sanitaryQuickAction);
      }

      if (decision.financeiroNatureza) {
        updateFinanceiroNatureza(decision.financeiroNatureza);
      }
    },
    [applySanitaryQuickAction, setTipoManejo, updateFinanceiroNatureza],
  );

  const clearQuickAction = useCallback(() => {
    setQuickAction(null);
  }, []);

  const selectRegularAction = useCallback(
    (domain: EventDomain) => {
      setQuickAction(null);
      setTipoManejo(domain);
    },
    [setTipoManejo],
  );

  const quickActionConfig = useMemo(
    () => getQuickActionConfig(quickAction),
    [quickAction],
  );

  return {
    quickAction,
    quickActionConfig,
    quickActions: REGISTRAR_QUICK_ACTIONS,
    applyQuickAction,
    clearQuickAction,
    selectRegularAction,
  };
}
