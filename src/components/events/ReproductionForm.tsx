import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import type { ReproTipoEnum } from "@/lib/offline/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ReproductionEventData {
  tipo: ReproTipoEnum;
  machoId: string | null;
  observacoes: string;
  // Diagnostico
  resultadoDiagnostico?: string;
  dataPrevistaParto?: string;
  // Parto
  dataParto?: string;
  numeroCrias?: number;
}

interface ReproductionFormProps {
  fazendaId: string;
  data: ReproductionEventData;
  onChange: (data: ReproductionEventData) => void;
}

export function ReproductionForm({
  fazendaId,
  data,
  onChange,
}: ReproductionFormProps) {
  // Fetch bulls (machos ativos)
  const machos = useLiveQuery(() => {
    return db.state_animais
      .where("fazenda_id")
      .equals(fazendaId)
      .filter(
        (a) =>
          a.sexo === "M" &&
          a.status === "ativo" &&
          (!a.deleted_at || a.deleted_at === null),
      )
      .toArray();
  }, [fazendaId]);

  const updateField = (field: keyof ReproductionEventData, value: string | number | null | undefined) => {
    onChange({ ...data, [field]: value });
  };

  const isMachoRequired =
    data.tipo === "cobertura" || data.tipo === "IA";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Evento</Label>
        <Select
          value={data.tipo}
          onValueChange={(val) => updateField("tipo", val as ReproTipoEnum)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cobertura">Cobertura (Monta)</SelectItem>
            <SelectItem value="IA">Inseminação Artificial (IA)</SelectItem>
            <SelectItem value="diagnostico">Diagnóstico de Gestação</SelectItem>
            <SelectItem value="parto">Parto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(data.tipo === "cobertura" || data.tipo === "IA") && (
        <div className="space-y-2">
          <Label className={isMachoRequired ? "text-primary" : ""}>
            Reprodutor (Macho) {isMachoRequired && "*"}
          </Label>
          <Select
            value={data.machoId || "none"}
            onValueChange={(val) =>
              updateField("machoId", val === "none" ? null : val)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o reprodutor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- Não informado --</SelectItem>
              {machos?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.identificacao} {m.nome ? `(${m.nome})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isMachoRequired && !data.machoId && (
            <p className="text-xs text-destructive">
              Obrigatório para Cobertura/IA
            </p>
          )}
        </div>
      )}

      {data.tipo === "diagnostico" && (
        <>
           <div className="space-y-2">
            <Label>Resultado</Label>
            <Select
              value={data.resultadoDiagnostico || "inconclusivo"}
              onValueChange={(val) => updateField("resultadoDiagnostico", val)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="positivo">Positivo (Prenha)</SelectItem>
                  <SelectItem value="negativo">Negativo (Vazia)</SelectItem>
                  <SelectItem value="inconclusivo">Inconclusivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {data.tipo === "parto" && (
        <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
            <Label>Número de Crias</Label>
            <Input
              type="number"
              min="1"
              value={data.numeroCrias || 1}
              onChange={(e) => updateField("numeroCrias", parseInt(e.target.value))}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={data.observacoes}
          onChange={(e) => updateField("observacoes", e.target.value)}
          placeholder="Detalhes adicionais..."
        />
      </div>
    </div>
  );
}
