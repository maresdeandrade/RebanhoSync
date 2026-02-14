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
  // Episode Linking
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
    // Only fetching if we have an animal and it's a type that needs linking
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
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
               {data.tipo === "parto" ? "Vínculo Obrigatório (Serviço)" : "Vínculo com Serviço (Episódio)"}
            </Label>
            <div className="mt-2">
               <Select
                  value={
                     data.episodeLinkMethod === "unlinked" ? "unlinked" :
                     data.episodeLinkMethod === "manual" && data.episodeEventoId ? data.episodeEventoId : 
                     "auto"
                  }
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
                     <SelectValue placeholder="Automático" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="auto">✨ Automático (Inteligente)</SelectItem>
                     {candidateEpisodes?.map((evt) => (
                        <SelectItem key={evt.id} value={evt.id}>
                           {new Date(evt.occurred_at).toLocaleDateString()} - {evt.details.tipo.toUpperCase()}
                        </SelectItem>
                     ))}
                     {/* Strict V1: Orphan Parto is blocked by Registrar logic, but we might hide it here or show with warning */}
                     {/* Only allow 'unlinked' for Diagnostico/Legacy/Recovery. STRICT V1: Parto must link. */}
                     {data.tipo !== 'parto' && (
                        <SelectItem value="unlinked">⚠️ Sem Vínculo (Novo Episódio/Legacy)</SelectItem>
                      )
                     }
                  </SelectContent>
               </Select>
               <p className="text-[10px] text-muted-foreground mt-1">
                  {data.tipo === "parto" 
                     ? "O parto deve ser vinculado a um serviço anterior (Cobertura/IA)."
                     : "Vincular o diagnóstico ao serviço ajuda a calcular a data provável de parto."}
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

          <div className="grid grid-cols-2 gap-4">
             {data.tipo === "IA" && (
               <>
                 <div className="space-y-2">
                   <Label>Lote do Sêmen</Label>
                   <Input 
                      value={data.loteSemen || ""}
                      onChange={(e) => updateField("loteSemen", e.target.value)}
                      placeholder="Ex: ABC-123"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Ref. Dose</Label>
                   <Input 
                      value={data.doseSemenRef || ""}
                      onChange={(e) => updateField("doseSemenRef", e.target.value)}
                      placeholder="Ex: Palheta 1"
                   />
                 </div>
               </>
             )}
             
             <div className="space-y-2 col-span-2">
               <Label>Técnica / Tag Visual</Label>
               <div className="flex gap-2">
                  <Input 
                     className="flex-1"
                     placeholder={data.tipo === "IA" ? "IATF / Convencional" : "Monta Natural / Controlada"}
                     value={data.tecnicaLivre || ""}
                     onChange={(e) => updateField("tecnicaLivre", e.target.value)}
                  />
                  <Input 
                     className="w-1/3"
                     placeholder="Tag Reprodutor"
                     value={data.reprodutorTag || ""}
                     onChange={(e) => updateField("reprodutorTag", e.target.value)}
                  />
               </div>
             </div>
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
