/**
 * Sub-componente — Editor de Draft com Campos Dinâmicos
 *
 * Renderiza campos obrigatórios, condicionais por mode, e preview de dedup.
 * Separado do componente principal para modularidade.
 */

import type { ProtocolItemDraft } from "@/lib/sanitario/draft";
import { getVisibleFieldsByMode } from "@/lib/sanitario/draft";
import { buildSanitaryDedupKey } from "@/lib/sanitario/dedup";
import type { SanitaryCalendarAnchor, SanitaryCalendarMode } from "@/lib/sanitario/domain";
import {
  FormSection,
} from "@/components/ui/form-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ProtocolItemDraftEditorProps {
  draft: ProtocolItemDraft;
  onUpdateDraft: <K extends keyof ProtocolItemDraft>(
    key: K,
    value: ProtocolItemDraft[K]
  ) => void;
  errors: string[];
}

const MODE_OPTIONS: Array<{
  value: SanitaryCalendarMode;
  label: string;
}> = [
  { value: "campanha", label: "Campanha sazonal" },
  { value: "janela_etaria", label: "Janela etária" },
  { value: "rotina_recorrente", label: "Rotina recorrente" },
  { value: "procedimento_imediato", label: "Procedimento imediato" },
  { value: "nao_estruturado", label: "Não estruturado" },
];

const ANCHOR_OPTIONS: Array<{
  value: SanitaryCalendarAnchor;
  label: string;
}> = [
  { value: "nascimento", label: "Nascimento" },
  { value: "entrada_fazenda", label: "Entrada na fazenda" },
  { value: "conclusao_etapa_dependente", label: "Conclusão de etapa dependente" },
  { value: "ultima_conclusao_mesma_familia", label: "Última conclusão da família" },
  { value: "desmama", label: "Desmama" },
  { value: "parto_previsto", label: "Parto previsto" },
  { value: "movimentacao", label: "Movimentação" },
  { value: "diagnostico_evento", label: "Diagnóstico de evento" },
];

const LAYER_OPTIONS = [
  { value: "sanitario", label: "Sanitário" },
  { value: "nutricao", label: "Nutrição" },
  { value: "reproducao", label: "Reprodução" },
  { value: "financeiro", label: "Financeiro" },
  { value: "movimentacao", label: "Movimentação" },
];

const SCOPE_OPTIONS = [
  { value: "animal", label: "Animal" },
  { value: "lote", label: "Lote" },
  { value: "fazenda", label: "Fazenda" },
];

export function ProtocolItemDraftEditor({
  draft,
  onUpdateDraft,
  errors,
}: ProtocolItemDraftEditorProps) {
  const visibleFields = getVisibleFieldsByMode(draft.mode);
  const dedupPreview = draft.mode
    ? buildSanitaryDedupKey({
        layer: draft.layer,
        scopeType: draft.scopeType,
        mode: draft.mode,
        familyCode: draft.familyCode || `family-${draft.itemId}`,
        itemCode: draft.itemCode || `item-${draft.itemId}`,
        animalId: "PREVIEW",
        loteId: "PREVIEW",
        fazendaId: "PREVIEW",
        campaignMonths: draft.campaignMonths,
        ageStartDays: draft.ageStartDays,
        now: new Date(),
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Erros */}
      {errors.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              {errors.map((error) => (
                <li key={error} className="text-sm">
                  {error}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Identity Fields */}
      <FormSection
        title="Identificação"
        description="Código de família, item e versão do regime"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="familyCode">Código da família</Label>
            <Input
              id="familyCode"
              value={draft.familyCode || ""}
              onChange={(e) => onUpdateDraft("familyCode", e.target.value)}
              placeholder="ex: brucelose, raiva"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="itemCode">Código do item</Label>
            <Input
              id="itemCode"
              value={draft.itemCode || ""}
              onChange={(e) => onUpdateDraft("itemCode", e.target.value)}
              placeholder="ex: dose_1, dose_2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regimenVersion">Versão do regime</Label>
            <Input
              id="regimenVersion"
              type="number"
              max="99"
              min="1"
              value={draft.regimenVersion || 1}
              onChange={(e) => onUpdateDraft("regimenVersion", parseInt(e.target.value))}
            />
          </div>
        </div>
      </FormSection>

      {/* Layer & Scope */}
      <FormSection
        title="Localização"
        description="Camada de domínio e escopo de aplicação"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="layer">Camada de domínio</Label>
            <Select
              value={draft.layer || ""}
              onValueChange={(value) => onUpdateDraft("layer", value)}
            >
              <SelectTrigger id="layer">
                <SelectValue placeholder="Selecione uma camada" />
              </SelectTrigger>
              <SelectContent>
                {LAYER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scopeType">Escopo</Label>
            <Select
              value={draft.scopeType || ""}
              onValueChange={(value) => onUpdateDraft("scopeType", value)}
            >
              <SelectTrigger id="scopeType">
                <SelectValue placeholder="Selecione um escopo" />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      {/* Schedule Mode & Anchor */}
      <FormSection
        title="Agendamento"
        description="Modo e âncora de agendamento"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mode">Modo de agendamento</Label>
            <Select
              value={draft.mode || ""}
              onValueChange={(value) => onUpdateDraft("mode", value)}
            >
              <SelectTrigger id="mode">
                <SelectValue placeholder="Selecione um modo" />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="anchor">Âncora de agendamento</Label>
            <Select
              value={draft.anchor || ""}
              disabled={draft.mode === "procedimento_imediato"}
              onValueChange={(value) => onUpdateDraft("anchor", value)}
            >
              <SelectTrigger id="anchor">
                <SelectValue placeholder="Selecione uma âncora" />
              </SelectTrigger>
              <SelectContent>
                {ANCHOR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      {/* Campos Dinâmicos por Mode */}

      {/* Campanha */}
      {visibleFields.campaignFields && (
        <FormSection
          title="Campanha Sazonal"
          description="Meses de ocorrência da campanha"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Meses da campanha (1-12)</Label>
              <Input
                type="text"
                placeholder="ex: 5,6,7 para maio-julho"
                value={
                  draft.campaignMonths
                    ? draft.campaignMonths.join(", ")
                    : ""
                }
                onChange={(e) => {
                  const months = e.target.value
                    .split(",")
                    .map((s) => {
                      const n = parseInt(s.trim());
                      return !isNaN(n) && n >= 1 && n <= 12 ? n : null;
                    })
                    .filter((n): n is number => n !== null);
                  onUpdateDraft("campaignMonths", months);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignLabel">Rótulo da campanha</Label>
              <Input
                id="campaignLabel"
                value={draft.campaignLabel || ""}
                onChange={(e) => onUpdateDraft("campaignLabel", e.target.value)}
                placeholder="ex: Campanha de vacinação maio-julho"
              />
            </div>
          </div>
        </FormSection>
      )}

      {/* Janela Etária */}
      {visibleFields.ageWindowFields && (
        <FormSection
          title="Janela Etária"
          description="Intervalo de idade em dias"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ageStartDays">Idade inicial (dias)</Label>
              <Input
                id="ageStartDays"
                type="number"
                min="0"
                value={draft.ageStartDays || ""}
                onChange={(e) =>
                  onUpdateDraft("ageStartDays", parseInt(e.target.value) || undefined)
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ageEndDays">Idade final (dias)</Label>
              <Input
                id="ageEndDays"
                type="number"
                min="0"
                value={draft.ageEndDays || ""}
                onChange={(e) =>
                  onUpdateDraft("ageEndDays", parseInt(e.target.value) || undefined)
                }
                placeholder="999"
              />
            </div>
          </div>
        </FormSection>
      )}

      {/* Rotina Recorrente */}
      {visibleFields.intervalFields && (
        <FormSection
          title="Rotina Recorrente"
          description="Intervalo em dias entre execuções"
        >
          <div className="space-y-2">
            <Label htmlFor="intervalDays">Intervalo (dias)</Label>
            <Input
              id="intervalDays"
              type="number"
              min="1"
              value={draft.intervalDays || ""}
              onChange={(e) =>
                onUpdateDraft("intervalDays", parseInt(e.target.value) || undefined)
              }
              placeholder="90"
            />
          </div>
        </FormSection>
      )}

      {/* Procedimento Imediato */}
      {visibleFields.triggerEventField && (
        <FormSection
          title="Procedimento Imediato"
          description="Evento disparador"
        >
          <div className="space-y-2">
            <Label htmlFor="triggerEvent">Tipo de evento</Label>
            <Input
              id="triggerEvent"
              value={draft.triggerEvent || ""}
              onChange={(e) => onUpdateDraft("triggerEvent", e.target.value)}
              placeholder="ex: notificacao_svo"
            />
          </div>
        </FormSection>
      )}

      {/* Dedup Preview */}
      {dedupPreview && (
        <FormSection
          title="Preview de Dedup (Somente Leitura)"
          description="Chave determinística para deduplicação"
        >
          <div className="bg-gray-50 p-4 rounded border border-gray-200">
            <code className="text-xs leading-relaxed break-all text-gray-700">
              {dedupPreview}
            </code>
          </div>
        </FormSection>
      )}

      {/* Outros Campos */}
      <FormSection
        title="Metadados"
        description="Produto, dose e informações adicionais"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productCode">Código do produto</Label>
              <Input
                id="productCode"
                value={draft.productCode || ""}
                onChange={(e) => onUpdateDraft("productCode", e.target.value)}
                placeholder="ex: brucelose-viva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productName">Nome do produto</Label>
              <Input
                id="productName"
                value={draft.productName || ""}
                onChange={(e) => onUpdateDraft("productName", e.target.value)}
                placeholder="ex: Brucevac"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doseNumber">Número da dose</Label>
            <Input
              id="doseNumber"
              type="number"
              min="1"
              value={draft.doseNumber || 1}
              onChange={(e) =>
                onUpdateDraft("doseNumber", parseInt(e.target.value) || 1)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={draft.description || ""}
              onChange={(e) => onUpdateDraft("description", e.target.value)}
              placeholder="Breve descrição do protocolo"
            />
          </div>
        </div>
      </FormSection>
    </div>
  );
}
