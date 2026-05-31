import type { SanitarioTipoEnum } from "@/lib/offline/types";
import { useEffect, useMemo, useState } from "react";
import type {
  BiosecurityOccurrenceCategory,
  BiosecurityOccurrenceDraft,
  BiosecurityOccurrenceKind,
  BiosecurityOccurrenceScope,
  BiosecurityOccurrenceSeverity,
} from "@/lib/sanitario/compliance/biosecurityOccurrence";
import {
  getAvailableBiosecurityLinkScopes,
  requiresClinicalBiosecurityLink,
  validateBiosecurityOccurrenceDraft,
} from "@/lib/sanitario/compliance/biosecurityOccurrence";
import { describeRegistrarSanitaryCalendarSchedule } from "@/lib/sanitario/models/calendarDisplay";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RegistrarSanitarioSectionProps = {
  sanitarioTipo: SanitarioTipoEnum;
  onSanitarioTipoChange: (tipo: SanitarioTipoEnum) => void;
  produto: string;
  onProdutoChange: (value: string) => void;
  sanitatioProductMissing: boolean;
  selectedVeterinaryProduct: { nome: string; categoria: string | null } | null;
  hasVeterinaryProducts: boolean;
  isVeterinaryProductsEmpty: boolean;
  veterinaryProductSuggestions: Array<{ id: string; nome: string; categoria: string | null }>;
  selectedVeterinaryProductId: string;
  onSelectVeterinaryProduct: (product: {
    id: string;
    nome: string;
    categoria: string | null;
  }) => void;
  protocoloId: string;
  onProtocoloChange: (id: string) => void;
  protocolos: Array<{ id: string; nome: string }>;
  protocoloItemId: string;
  onProtocoloItemChange: (value: string) => void;
  protocoloItensEvaluated: Array<{
    item: {
      id: string;
      dose_num: number;
      intervalo_dias: number | null;
      gera_agenda: boolean;
      payload: unknown;
    };
    eligibility: {
      compatibleWithAll: boolean;
      eligibleCount: number;
    };
  }>;
  selectedAnimaisDetalhesCount: number;
  selectedProtocolRestrictionsText: string | null;
  selectedProtocolPrimaryReason: string | null;
  selectedProtocolCompatibleWithAll: boolean | null;
  allProtocolItemsIneligible: boolean;
  clinicalCases: Array<{ id: string; label: string }>;
  selectedClinicalCaseId: string;
  onClinicalCaseChange: (value: string) => void;
  createClinicalCase: boolean;
  onCreateClinicalCaseChange: (value: boolean) => void;
  biosecurityContext: {
    animals: Array<{ id: string; label: string }>;
    lote: { id: string; label: string } | null;
    localId?: string | null;
    agendaItemId?: string | null;
  };
  onRegisterBiosecurityOccurrence: (
    occurrence: BiosecurityOccurrenceDraft,
  ) => Promise<void>;
  isRegisteringBiosecurityOccurrence: boolean;
};

export function RegistrarSanitarioSection(props: RegistrarSanitarioSectionProps) {
  const [biosecurityDialogOpen, setBiosecurityDialogOpen] = useState(false);
  const [biosecurityDraft, setBiosecurityDraft] =
    useState<BiosecurityOccurrenceDraft>(() =>
      createBiosecurityDraft(props.biosecurityContext),
    );
  const [biosecurityIssue, setBiosecurityIssue] = useState<string | null>(null);
  const contextAvailability = useMemo(
    () => buildBiosecurityContextAvailability(props.biosecurityContext),
    [props.biosecurityContext],
  );
  const scopeOptions = useMemo(
    () =>
      getAvailableBiosecurityLinkScopes({
        selectedOccurrenceTypes: biosecurityDraft.tipos_ocorrencia ?? [],
        category: biosecurityDraft.categoria_ocorrencia,
        contextAvailability,
      }),
    [
      biosecurityDraft.categoria_ocorrencia,
      biosecurityDraft.tipos_ocorrencia,
      contextAvailability,
    ],
  );
  const clinicalLinkRequired = requiresClinicalBiosecurityLink(
    biosecurityDraft,
  );

  useEffect(() => {
    if (!biosecurityDialogOpen) return;
    if (scopeOptions.length === 0) return;
    const currentScopes = biosecurityDraft.escopos_tipo ?? [
      biosecurityDraft.escopo_tipo,
    ];
    const availableScopes = new Set(scopeOptions.map((option) => option.scope));
    const nextScopes = currentScopes.filter((scope) =>
      availableScopes.has(scope),
    );

    if (nextScopes.length === currentScopes.length && nextScopes.length > 0) {
      return;
    }

    setBiosecurityDraft((current) => ({
      ...current,
      ...buildBiosecurityScopesPatch(
        nextScopes.length > 0 ? nextScopes : [scopeOptions[0]!.scope],
        props.biosecurityContext,
      ),
    }));
    setBiosecurityIssue(null);
  }, [
    biosecurityDialogOpen,
    biosecurityDraft.escopo_tipo,
    biosecurityDraft.escopos_tipo,
    props.biosecurityContext,
    scopeOptions,
  ]);

  const openBiosecurityDialog = () => {
    setBiosecurityDraft(createBiosecurityDraft(props.biosecurityContext));
    setBiosecurityIssue(null);
    setBiosecurityDialogOpen(true);
  };

  const updateBiosecurityDraft = (
    patch: Partial<BiosecurityOccurrenceDraft>,
  ) => {
    setBiosecurityDraft((prev) => ({ ...prev, ...patch }));
    setBiosecurityIssue(null);
  };

  const handleBiosecurityCategoryChange = (
    category: BiosecurityOccurrenceCategory,
  ) => {
    const next: Partial<BiosecurityOccurrenceDraft> = {
      categoria_ocorrencia: category,
    };

    if (category === "suspeita_doenca_notificavel") {
      if (props.biosecurityContext.animals.length > 1) {
        Object.assign(
          next,
          buildBiosecurityScopesPatch(
            addScopeToDraft(biosecurityDraft, "animais"),
            props.biosecurityContext,
          ),
        );
      } else if (props.biosecurityContext.animals[0]) {
        Object.assign(
          next,
          buildBiosecurityScopesPatch(
            addScopeToDraft(biosecurityDraft, "animal"),
            props.biosecurityContext,
          ),
        );
      } else if (props.biosecurityContext.lote) {
        Object.assign(
          next,
          buildBiosecurityScopesPatch(
            addScopeToDraft(biosecurityDraft, "lote"),
            props.biosecurityContext,
          ),
        );
      }
    }

    updateBiosecurityDraft(next);
  };

  const handleBiosecurityKindToggle = (kind: BiosecurityOccurrenceKind) => {
    const current = biosecurityDraft.tipos_ocorrencia ?? [];
    const nextKinds = current.includes(kind)
      ? current.filter((value) => value !== kind)
      : [...current, kind];

    updateBiosecurityDraft({
      tipos_ocorrencia: nextKinds,
      tipo_ocorrencia: nextKinds[0] ?? kind,
    });
  };

  const handleBiosecurityScopeToggle = (scope: BiosecurityOccurrenceScope) => {
    const currentScopes = biosecurityDraft.escopos_tipo ?? [
      biosecurityDraft.escopo_tipo,
    ];
    const nextScopes = currentScopes.includes(scope)
      ? currentScopes.filter((value) => value !== scope)
      : [...currentScopes, scope];

    updateBiosecurityDraft(
      buildBiosecurityScopesPatch(nextScopes, props.biosecurityContext),
    );
  };

  const handleSubmitBiosecurityOccurrence = async () => {
    const issue = validateBiosecurityOccurrenceDraft(biosecurityDraft);
    if (issue) {
      setBiosecurityIssue(issue);
      return;
    }

    await props.onRegisterBiosecurityOccurrence(biosecurityDraft);
    setBiosecurityDialogOpen(false);
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-4">
      <div className="rounded-lg border bg-background/70 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium">
              Biossegurança: Sem ocorrência informada
            </div>
            <div className="text-xs text-muted-foreground">
              Checklist regulatório disponível não cria pendência.
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full shadow-none"
            onClick={openBiosecurityDialog}
          >
            Registrar ocorrência
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Tipo</Label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "vacinacao", label: "Vacinação" },
            { value: "vermifugacao", label: "Vermifugação" },
            { value: "medicamento", label: "Medicamento" },
          ].map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={props.sanitarioTipo === opt.value ? "default" : "outline"}
              onClick={() => props.onSanitarioTipoChange(opt.value as SanitarioTipoEnum)}
              className="flex-1 rounded-full shadow-none sm:flex-none bg-background aria-selected:bg-primary"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Protocolo (opcional)</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={!props.protocoloId || props.protocoloId === "none" ? "default" : "outline"}
            onClick={() => props.onProtocoloChange("none")}
            className="rounded-full shadow-none sm:flex-none bg-background aria-selected:bg-primary"
          >
            Sem protocolo
          </Button>
          {props.protocolos.map((protocol) => (
            <Button
              key={protocol.id}
              type="button"
              variant={props.protocoloId === protocol.id ? "default" : "outline"}
              onClick={() => props.onProtocoloChange(protocol.id)}
              className="rounded-full shadow-none sm:flex-none bg-background aria-selected:bg-primary"
            >
              {protocol.nome}
            </Button>
          ))}
        </div>
      </div>

      {props.protocoloId && props.protocoloId !== "none" && props.protocoloItensEvaluated.length > 0 ? (
        <div className="space-y-3 rounded-lg border bg-background/50 p-3">
          <Label>Item do Protocolo</Label>
          <select
            className="flex h-12 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => props.onProtocoloItemChange(event.target.value)}
            value={props.protocoloItemId}
          >
            <option value="" disabled>
              Selecione o item
            </option>
            {props.protocoloItensEvaluated.map(({ item, eligibility }) => (
              <option
                key={item.id}
                value={item.id}
                disabled={!eligibility.compatibleWithAll && item.id !== props.protocoloItemId}
              >
                  Dose {item.dose_num} |{" "}
                  {describeRegistrarSanitaryCalendarSchedule({
                    intervalDays: item.intervalo_dias,
                    geraAgenda: item.gera_agenda,
                    payload: item.payload,
                  })}
                  {props.selectedAnimaisDetalhesCount > 0
                    ? ` | ${eligibility.eligibleCount}/${props.selectedAnimaisDetalhesCount} aptos`
                    : ""}
              </option>
            ))}
          </select>

          {props.selectedProtocolRestrictionsText || !props.selectedProtocolCompatibleWithAll ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {props.selectedProtocolRestrictionsText ? (
                <Badge variant="outline">Regras aplicadas</Badge>
              ) : null}
              {props.selectedProtocolCompatibleWithAll === false && props.selectedProtocolPrimaryReason ? (
                <Badge variant="destructive">
                  {props.selectedProtocolPrimaryReason}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {props.allProtocolItemsIneligible ? (
            <p className="text-xs text-muted-foreground">
              Nenhum item atende todos os animais.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 pt-1">
        <Label>Produto</Label>
        <Input
          className={cn(
            "h-12 rounded-xl bg-background",
            props.sanitatioProductMissing && "border-destructive focus-visible:ring-destructive/30",
          )}
          placeholder="Produto"
          value={props.produto}
          onChange={(event) => props.onProdutoChange(event.target.value)}
        />
        {props.sanitatioProductMissing ? (
          <p className="text-xs text-destructive">
            Informe o produto ou selecione um protocolo.
          </p>
        ) : props.selectedVeterinaryProduct ? (
          <Badge variant="outline">
            Catálogo: {props.selectedVeterinaryProduct.nome}
          </Badge>
        ) : props.produto.trim() ? (
          <Badge variant="secondary">Texto livre</Badge>
        ) : props.hasVeterinaryProducts ? (
          null
        ) : null}

        {props.veterinaryProductSuggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {props.veterinaryProductSuggestions.map((product) => {
              const isSelected = product.id === props.selectedVeterinaryProductId;
              return (
                <Button
                  key={product.id}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className="h-auto min-h-9 px-3 py-2 text-left rounded-full"
                  onClick={() => props.onSelectVeterinaryProduct(product)}
                >
                  <span>{product.nome}</span>
                  {product.categoria ? (
                    <Badge variant="secondary" className="ml-2 whitespace-nowrap bg-muted">
                      {product.categoria}
                    </Badge>
                  ) : null}
                </Button>
              );
            })}
          </div>
        ) : props.isVeterinaryProductsEmpty ? (
          <p className="text-xs text-muted-foreground">
            Catálogo indisponível offline.
          </p>
        ) : null}
      </div>

      <div className="space-y-3 pt-1">
        <Label>Caso clínico (opcional)</Label>
        {props.clinicalCases.length > 0 ? (
          <select
            className="flex h-12 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            value={props.selectedClinicalCaseId}
            disabled={props.createClinicalCase}
            onChange={(event) => props.onClinicalCaseChange(event.target.value)}
          >
            <option value="">Sem vínculo</option>
            {props.clinicalCases.map((clinicalCase) => (
              <option key={clinicalCase.id} value={clinicalCase.id}>
                {clinicalCase.label}
              </option>
            ))}
          </select>
        ) : null}
        <Button
          type="button"
          variant={props.createClinicalCase ? "default" : "outline"}
          className="rounded-full shadow-none"
          onClick={() =>
            props.onCreateClinicalCaseChange(!props.createClinicalCase)
          }
        >
          Abrir novo caso clínico
        </Button>
      </div>

      <Dialog
        open={biosecurityDialogOpen}
        onOpenChange={setBiosecurityDialogOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar ocorrência</DialogTitle>
            <DialogDescription>
              Registre apenas fato real observado no manejo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Classificação</Label>
              <div className="flex flex-wrap gap-2">
                {BIOSECURITY_CATEGORY_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      biosecurityDraft.categoria_ocorrencia === option.value
                        ? "default"
                        : "outline"
                    }
                    className="rounded-full shadow-none"
                    onClick={() => handleBiosecurityCategoryChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>O que aconteceu?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {BIOSECURITY_KIND_OPTIONS.map((option) => {
                  const selected =
                    biosecurityDraft.tipos_ocorrencia?.includes(
                      option.value,
                    ) ?? false;

                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className="h-auto justify-start rounded-xl px-3 py-2 text-left shadow-none"
                      onClick={() => handleBiosecurityKindToggle(option.value)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {biosecurityDraft.tipos_ocorrencia?.includes("outro") ? (
              <div className="space-y-2">
                <Label>Relato</Label>
                <Textarea
                  value={biosecurityDraft.outro_relato ?? ""}
                  onChange={(event) =>
                    updateBiosecurityDraft({
                      outro_relato: event.target.value,
                    })
                  }
                  placeholder="Relate o que aconteceu"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Vínculo</Label>
              {scopeOptions.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {scopeOptions.map((option) => (
                    <Button
                      key={option.scope}
                      type="button"
                      variant={
                        (biosecurityDraft.escopos_tipo ?? [
                          biosecurityDraft.escopo_tipo,
                        ]).includes(option.scope)
                          ? "default"
                          : "outline"
                      }
                      className="h-auto justify-start rounded-xl px-3 py-2 text-left shadow-none"
                      onClick={() => handleBiosecurityScopeToggle(option.scope)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                  {clinicalLinkRequired
                    ? "Esta ocorrência exige vínculo com animal ou lote, mas nenhum vínculo disponível foi carregado neste contexto."
                    : "Nenhum vínculo disponível para este contexto. Ajuste o tipo de ocorrência ou registre a ocorrência pela tela adequada."}
                </p>
              )}
            </div>

            {(biosecurityDraft.escopos_tipo ?? [
              biosecurityDraft.escopo_tipo,
            ]).includes("animal") &&
            !(biosecurityDraft.escopos_tipo ?? []).includes("animais") &&
            props.biosecurityContext.animals.length > 0 ? (
              <div className="space-y-2">
                <Label>Animal</Label>
                <select
                  className="flex h-12 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  value={biosecurityDraft.animal_id ?? ""}
                  onChange={(event) =>
                    updateBiosecurityDraft({ animal_id: event.target.value })
                  }
                >
                  {props.biosecurityContext.animals.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {(biosecurityDraft.escopos_tipo ?? [
              biosecurityDraft.escopo_tipo,
            ]).includes("animais") ? (
              <div className="space-y-2">
                <Label>Animais</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {props.biosecurityContext.animals.map((animal) => {
                    const selected =
                      biosecurityDraft.animal_ids?.includes(animal.id) ??
                      false;

                    return (
                      <label
                        key={animal.id}
                        className="flex items-center gap-2 rounded-lg border bg-background/60 p-3 text-sm"
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) => {
                            const current =
                              biosecurityDraft.animal_ids ?? [];
                            const nextAnimalIds =
                              checked === true
                                ? Array.from(new Set([...current, animal.id]))
                                : current.filter((id) => id !== animal.id);

                            updateBiosecurityDraft({
                              animal_ids: nextAnimalIds,
                              animal_id: nextAnimalIds[0] ?? null,
                            });
                          }}
                        />
                        {animal.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Gravidade</Label>
              <div className="flex flex-wrap gap-2">
                {BIOSECURITY_SEVERITY_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      biosecurityDraft.gravidade === option.value
                        ? "default"
                        : "outline"
                    }
                    className="rounded-full shadow-none"
                    onClick={() =>
                      updateBiosecurityDraft({ gravidade: option.value })
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={biosecurityDraft.descricao ?? ""}
                onChange={(event) =>
                  updateBiosecurityDraft({ descricao: event.target.value })
                }
                placeholder="Descreva o fato observado"
              />
            </div>

            <div className="space-y-2">
              <Label>Ação imediata</Label>
              <Textarea
                value={biosecurityDraft.acao_imediata}
                onChange={(event) =>
                  updateBiosecurityDraft({ acao_imediata: event.target.value })
                }
                placeholder="Informe o que foi feito no momento"
              />
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-3">
              <Checkbox
                id="biosecurity-gera-pendencia"
                checked={biosecurityDraft.gera_pendencia}
                onCheckedChange={(checked) =>
                  updateBiosecurityDraft({
                    gera_pendencia: checked === true,
                    prazo_correcao:
                      checked === true
                        ? biosecurityDraft.prazo_correcao
                        : null,
                  })
                }
              />
              <Label
                htmlFor="biosecurity-gera-pendencia"
                className="text-sm font-normal"
              >
                Gera pendência corretiva
              </Label>
            </div>

            {biosecurityDraft.gera_pendencia ? (
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={biosecurityDraft.prazo_correcao ?? ""}
                  onChange={(event) =>
                    updateBiosecurityDraft({
                      prazo_correcao: event.target.value,
                    })
                  }
                />
              </div>
            ) : null}

            {biosecurityIssue ? (
              <p className="text-sm text-destructive">{biosecurityIssue}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBiosecurityDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmitBiosecurityOccurrence}
              disabled={props.isRegisteringBiosecurityOccurrence}
            >
              Salvar ocorrência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const BIOSECURITY_CATEGORY_OPTIONS: Array<{
  value: BiosecurityOccurrenceCategory;
  label: string;
}> = [
  { value: "biosseguranca", label: "Biossegurança" },
  {
    value: "suspeita_doenca_notificavel",
    label: "Suspeita de doença notificável",
  },
];

const BIOSECURITY_KIND_OPTIONS: Array<{
  value: BiosecurityOccurrenceKind;
  label: string;
}> = [
  { value: "acidente_perfurocortante", label: "Acidente perfurocortante" },
  {
    value: "contato_sangue_secrecao_aborto_carcaca",
    label: "Contato com sangue, secreção, aborto ou carcaça",
  },
  {
    value: "animal_suspeito_sem_isolamento",
    label: "Animal suspeito sem isolamento",
  },
  { value: "falha_epi", label: "Falha de EPI" },
  { value: "descarte_inadequado", label: "Descarte inadequado" },
  {
    value: "falha_limpeza_desinfeccao",
    label: "Falha de limpeza/desinfecção",
  },
  {
    value: "visitante_sem_orientacao",
    label: "Visitante sem orientação",
  },
  {
    value: "transporte_com_risco_sanitario",
    label: "Transporte com risco sanitário",
  },
  { value: "outro", label: "Outro" },
];

const BIOSECURITY_SEVERITY_OPTIONS: Array<{
  value: BiosecurityOccurrenceSeverity;
  label: string;
}> = [
  { value: "leve", label: "Leve" },
  { value: "moderada", label: "Moderada" },
  { value: "alta", label: "Alta" },
];

function createBiosecurityDraft(context: RegistrarSanitarioSectionProps["biosecurityContext"]): BiosecurityOccurrenceDraft {
  const initialScope = getAvailableBiosecurityLinkScopes({
    selectedOccurrenceTypes: ["visitante_sem_orientacao"],
    category: "biosseguranca",
    contextAvailability: buildBiosecurityContextAvailability(context),
  })[0]?.scope ?? "fazenda";

  return {
    tipo_ocorrencia: "visitante_sem_orientacao",
    tipos_ocorrencia: ["visitante_sem_orientacao"],
    categoria_ocorrencia: "biosseguranca",
    ...buildBiosecurityScopesPatch([initialScope], context),
    gravidade: "leve",
    descricao: "",
    outro_relato: "",
    acao_imediata: "",
    gera_pendencia: false,
    prazo_correcao: null,
    status: "aberta",
  };
}

function buildBiosecurityContextAvailability(
  context: RegistrarSanitarioSectionProps["biosecurityContext"],
): Parameters<typeof getAvailableBiosecurityLinkScopes>[0]["contextAvailability"] {
  return {
    hasAnimal: context.animals.length > 0,
    hasMultipleAnimals: context.animals.length > 1,
    hasLote: Boolean(context.lote),
    hasLocal: Boolean(context.localId),
    hasManejo: Boolean(context.agendaItemId),
    hasFazenda: true,
  };
}

function buildBiosecurityScopesPatch(
  scopes: BiosecurityOccurrenceScope[],
  context: RegistrarSanitarioSectionProps["biosecurityContext"],
): Pick<
  BiosecurityOccurrenceDraft,
  | "escopo_tipo"
  | "escopos_tipo"
  | "animal_id"
  | "animal_ids"
  | "lote_id"
  | "local_id"
  | "evento_id"
  | "agenda_item_id"
> {
  const animalIds = context.animals.map((animal) => animal.id).filter(Boolean);
  const uniqueScopes = Array.from(new Set(scopes));
  const primaryScope = uniqueScopes[0] ?? "fazenda";
  const includesAnimal = uniqueScopes.includes("animal");
  const includesAnimais = uniqueScopes.includes("animais");

  return {
    escopo_tipo: primaryScope,
    escopos_tipo: uniqueScopes,
    animal_id:
      includesAnimal || includesAnimais ? animalIds[0] ?? null : null,
    animal_ids:
      includesAnimal && !includesAnimais
        ? animalIds[0]
          ? [animalIds[0]]
          : []
        : includesAnimais
          ? animalIds
          : [],
    lote_id: uniqueScopes.includes("lote") ? context.lote?.id ?? null : null,
    local_id: uniqueScopes.includes("local") ? context.localId ?? null : null,
    evento_id: null,
    agenda_item_id: uniqueScopes.includes("evento")
      ? context.agendaItemId ?? null
      : null,
  };
}

function addScopeToDraft(
  draft: BiosecurityOccurrenceDraft,
  scope: BiosecurityOccurrenceScope,
) {
  return Array.from(
    new Set([...(draft.escopos_tipo ?? [draft.escopo_tipo]), scope]),
  );
}
