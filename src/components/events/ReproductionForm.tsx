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
  
  // Cobertura (New)
  tecnicaLivre?: string;
  reprodutorTag?: string; // Para IATF ou reprodutor externo
  // IA (New)
  loteSemen?: string;
  doseSemenRef?: string;
  // Episode Linking (New)
  episodeEventoId?: string | null;
  episodeLinkMethod?: 'manual' | 'auto_last_open_service' | 'unlinked';
}

interface ReproductionFormProps {
  fazendaId: string;
  animalId?: string | null;
  data: ReproductionEventData;
  onChange: (data: ReproductionEventData) => void;
}

export function ReproductionForm({
  fazendaId,
  animalId,
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

  // Fetch candidate service events for linking (Episode)
  const candidateEpisodes = useLiveQuery(async () => {
    if (!animalId || (data.tipo !== 'diagnostico' && data.tipo !== 'parto')) return [];
    
    // Find recent services (Cobertura/IA)
    const services = await db.event_eventos
      .where("animal_id")
      .equals(animalId)
      .filter(e => e.dominio === 'reproducao' && (!e.deleted_at))
      .reverse()
      .sortBy("occurred_at");

    // Filter and enrich
    const enriched = await Promise.all(services.map(async (evt) => {
        const details = await db.event_eventos_reproducao.get(evt.id);
        if (details && (details.tipo === 'cobertura' || details.tipo === 'IA')) {
           return { ...evt, details };
        }
        return null;
    }));
    
    return enriched.filter(e => e !== null);
  }, [animalId, data.tipo]);

  const updateField = (field: keyof ReproductionEventData, value: string | number | null | undefined) => {
    onChange({ ...data, [field]: value });
  };

  const isMachoRequired =
    data.tipo === "cobertura" || (data.tipo === "IA" && !data.loteSemen);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Evento</Label>
        <Select
          value={data.tipo}
          onValueChange={(val) => {
             // Reset specific fields on type change
             onChange({ 
                ...data, 
                tipo: val as ReproTipoEnum,
                episodeEventoId: null, // Reset linking on type change
                episodeLinkMethod: undefined 
             });
          }}
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

      {/* EPISODE LINKING for Diagnostico/Parto */}
      {(data.tipo === "diagnostico" || data.tipo === "parto") && (
         <div className="p-3 bg-muted/30 rounded-md border border-muted">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Vínculo com Serviço (Episódio)</Label>
            <div className="mt-2">
               <Select
                  value={data.episodeEventoId || "auto"}
                  onValueChange={(val) => {
                     if (val === "auto") {
                        updateField("episodeEventoId", null);
                        updateField("episodeLinkMethod", "auto_last_open_service");
                     } else if (val === "unlinked") {
                        updateField("episodeEventoId", null);
                        updateField("episodeLinkMethod", "unlinked");
                     } else {
                        updateField("episodeEventoId", val);
                        updateField("episodeLinkMethod", "manual");
                     }
                  }}
               >
                  <SelectTrigger className="w-full">
                     <SelectValue placeholder="Automático (Último serviço aberto)" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="auto">✨ Automático (Último serviço aberto)</SelectItem>
                     {candidateEpisodes?.map((evt: { id: string; occurred_at: string; details: { tipo: string } }) => (
                        <SelectItem key={evt.id} value={evt.id}>
                           {new Date(evt.occurred_at).toLocaleDateString()} - {evt.details.tipo.toUpperCase()}
                        </SelectItem>
                     ))}
                     <SelectItem value="unlinked">⚠️ Sem vínculo (Órfão)</SelectItem>
                  </SelectContent>
               </Select>
               <p className="text-[10px] text-muted-foreground mt-1">
                  Selecione "Automático" para que o sistema vincule ao serviço mais recente.
               </p>
            </div>
         </div>
      )}

      {/* COBERTURA / IA FIELDS */}
      {(data.tipo === "cobertura" || data.tipo === "IA") && (
        <div className="space-y-4 border-l-2 border-primary/20 pl-3">
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
                <SelectItem value="none">-- Não informado / Outro --</SelectItem>
                {machos?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.identificacao} {m.nome ? `(${m.nome})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Técnica / Tag Reprodutor (Opcional)</Label>
            <Input 
               placeholder={data.tipo === "IA" ? "Lote do Sêmen / Dose" : "Monta Natural / IATF"}
               value={data.tecnicaLivre || ""}
               onChange={(e) => updateField("tecnicaLivre", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* DIAGNOSTICO FIELDS */}
      {data.tipo === "diagnostico" && (
        <div className="space-y-4 border-l-2 border-primary/20 pl-3">
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
          {data.resultadoDiagnostico === 'positivo' && (
             <div className="space-y-2">
               <Label>Data Prevista Parto (Estimada)</Label>
               <Input 
                  type="date" 
                  value={data.dataPrevistaParto || ""}
                  onChange={(e) => updateField("dataPrevistaParto", e.target.value)}
               />
             </div>
          )}
        </div>
      )}

      {/* PARTO FIELDS */}
      {data.tipo === "parto" && (
        <div className="border-l-2 border-primary/20 pl-3 grid grid-cols-2 gap-4">
           <div className="space-y-2">
            <Label>Data Real Parto</Label>
            <Input 
               type="date"
               value={data.dataParto || new Date().toISOString().split('T')[0]}
               onChange={(e) => updateField("dataParto", e.target.value)}
            />
           </div>
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

      <div className="space-y-2 pt-2 border-t">
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
