import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";
import type { OperationInput } from "@/lib/offline/types";
import { 
  Check, 
  Plus, 
  ShieldAlert, 
  X, 
  ArrowDownLeft, 
  Link, 
  ArrowUpRight, 
  Archive,
  Info,
  Users,
  Scale
} from "lucide-react";
import { createGesture } from "@/lib/offline/ops";
import { ANIMAL_BREED_OPTIONS, type AnimalBreedEnum } from "@/lib/animals/catalogs";

type ActionType = "entrada" | "vincular" | "retirar" | "encerrar";

interface AnimalDraft {
  localId: string;
  identificacao: string;
  sexo: "F" | "M";
  raca: string;
  dataNascimento: string;
  pesoKg: string;
}

export function RegistrarSociedadeSection(props: {
  selectedAnimalIds: string[];
  contrapartes: { id: string; nome: string }[] | undefined;
  fazendaId: string;
}) {
  const { user } = useAuth();
  const [actionType, setActionType] = useState<ActionType>("entrada");

  // Sociedade selecionada (geral)
  const [selectedSocId, setSelectedSocId] = useState("");

  // Formulário de Nova Sociedade
  const [nome, setNome] = useState("");
  const [contraparteId, setContraparteId] = useState("");
  const [percFazenda, setPercFazenda] = useState("50");
  const [percParceiro, setPercParceiro] = useState("50");

  // Formulário de Entrada (Animais da Sociedade)
  const [regMode, setRegMode] = useState<"individual" | "lote">("individual");
  const [loteQtd, setLoteQtd] = useState("2");
  const [lotePrefixo, setLotePrefixo] = useState("SOC-");
  const [selectedLoteId, setSelectedLoteId] = useState("");
  const [dataEntrada, setDataEntrada] = useState(() => new Date().toISOString().slice(0, 10));

  // Lista de animais a serem cadastrados
  const [drafts, setDrafts] = useState<AnimalDraft[]>([
    { localId: crypto.randomUUID(), identificacao: "", sexo: "F", raca: "null", dataNascimento: "", pesoKg: "" }
  ]);

  // Formulário de Retirada
  const [physicalRemoval, setPhysicalRemoval] = useState(false);
  const [dataSaida, setDataSaida] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivoSaida, setMotivoSaida] = useState("");

  // Formulário de Encerramento
  const [animalsRemain, setAnimalsRemain] = useState(true);
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));

  // Live Queries
  const activeSocieties = useLiveQuery(
    () => {
      if (!props.fazendaId || typeof props.fazendaId !== "string" || props.fazendaId.trim() === "") return [];
      return db.state_sociedades_pecuarias
        .where("[fazenda_id+status]")
        .equals([props.fazendaId, "ativa"])
        .toArray();
    },
    [props.fazendaId],
    []
  );

  const activeLinks = useLiveQuery(
    () => {
      if (!props.fazendaId || typeof props.fazendaId !== "string" || props.fazendaId.trim() === "") return [];
      return db.state_sociedade_animais
        .where("[fazenda_id+status]")
        .equals([props.fazendaId, "ativo"])
        .toArray();
    },
    [props.fazendaId],
    []
  );

  const activeLotes = useLiveQuery(
    () => {
      if (!props.fazendaId || typeof props.fazendaId !== "string" || props.fazendaId.trim() === "") return [];
      return db.state_lotes
        .where("fazenda_id")
        .equals(props.fazendaId)
        .filter(l => l.status === "ativo" && !l.deleted_at)
        .toArray();
    },
    [props.fazendaId],
    []
  );

  const selectedAnimalsWithActiveLink = props.selectedAnimalIds.filter(id => activeLinks.some(link => link.animal_id === id));
  const selectedAnimalsWithoutLink = props.selectedAnimalIds.filter(id => !activeLinks.some(link => link.animal_id === id));

  // Manejo de alternância de modo (Individual vs Lote)
  const handleModeChange = (mode: "individual" | "lote") => {
    setRegMode(mode);
    if (mode === "individual") {
      setDrafts([{ localId: crypto.randomUUID(), identificacao: "", sexo: "F", raca: "null", dataNascimento: "", pesoKg: "" }]);
      setLoteQtd("1");
    } else {
      const qty = parseInt(loteQtd, 10) || 2;
      const newDrafts: AnimalDraft[] = Array.from({ length: qty }, (_, idx) => ({
        localId: crypto.randomUUID(),
        identificacao: lotePrefixo ? `${lotePrefixo.trim()}${idx + 1}` : `SOC-${idx + 1}`,
        sexo: "F",
        raca: "null",
        dataNascimento: "",
        pesoKg: ""
      }));
      setDrafts(newDrafts);
    }
  };

  // Modificação de quantidade de animais
  const handleQtyChange = (qtyStr: string) => {
    setLoteQtd(qtyStr);
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return;
    
    setDrafts(prev => {
      if (prev.length === qty) return prev;
      if (prev.length < qty) {
        const next = [...prev];
        for (let i = prev.length; i < qty; i++) {
          next.push({
            localId: crypto.randomUUID(),
            identificacao: lotePrefixo ? `${lotePrefixo.trim()}${i + 1}` : `SOC-${i + 1}`,
            sexo: "F",
            raca: "null",
            dataNascimento: "",
            pesoKg: ""
          });
        }
        return next;
      } else {
        return prev.slice(0, qty);
      }
    });
  };

  // Modificação de prefixo de identificação em lote
  const handlePrefixoChange = (prefix: string) => {
    setLotePrefixo(prefix);
    setDrafts(prev => prev.map((d, i) => {
      // Sobrescrever se estiver vazio ou se começar com o prefixo antigo
      if (!d.identificacao || d.identificacao.startsWith(lotePrefixo) || d.identificacao.startsWith("SOC-")) {
        return { ...d, identificacao: `${prefix.trim()}${i + 1}` };
      }
      return d;
    }));
  };

  // Atualização de campos individuais do rascunho
  const updateDraftField = <K extends keyof AnimalDraft>(localId: string, field: K, value: AnimalDraft[K]) => {
    setDrafts(prev => prev.map(d => d.localId === localId ? { ...d, [field]: value } : d));
  };

  // Confirmar Entrada de Animais
  const handleEntradaSociedade = async () => {
    let finalSocId = selectedSocId;
    const ops: OperationInput[] = [];

    // 1. Validar e criar sociedade se for nova
    if (selectedSocId === "new") {
      if (!nome || !contraparteId || !percFazenda || !percParceiro) {
        alert("Preencha todos os campos da nova sociedade.");
        return;
      }
      const fz = parseFloat(percFazenda);
      const pa = parseFloat(percParceiro);
      if (Math.abs((fz + pa) - 100) > 0.0001) {
        alert("A soma dos percentuais da sociedade deve ser 100%.");
        return;
      }

      finalSocId = crypto.randomUUID();
      ops.push({
        table: "sociedades_pecuarias",
        action: "INSERT",
        record: {
          id: finalSocId,
          fazenda_id: props.fazendaId,
          contraparte_id: contraparteId,
          nome,
          status: "ativa",
          data_inicio: dataEntrada,
          data_fim: null,
          percentual_fazenda: fz,
          percentual_parceiro: pa,
          regra_custos: "proporcional",
          regra_perdas: "proporcional",
          regra_receita: "proporcional",
          observacoes: null,
          payload: {}
        }
      });
    }

    if (!finalSocId || finalSocId === "new") {
      alert("Selecione ou crie uma sociedade válida.");
      return;
    }

    const normalizedLoteId = selectedLoteId === "null" || selectedLoteId === "" ? null : selectedLoteId;

    // 2. Validar rascunhos de animais
    for (const d of drafts) {
      if (!d.identificacao.trim()) {
        alert("A identificação é obrigatória para todos os animais.");
        return;
      }
    }

    // 3. Gerar operações de inserção
    for (const d of drafts) {
      const animalId = crypto.randomUUID();
      const weight = d.pesoKg.trim() ? parseFloat(d.pesoKg) : null;

      ops.push({
        table: "animais",
        action: "INSERT",
        record: {
          id: animalId,
          fazenda_id: props.fazendaId,
          identificacao: d.identificacao.trim(),
          sexo: d.sexo,
          status: "ativo",
          lote_id: normalizedLoteId,
          data_entrada: dataEntrada,
          data_nascimento: d.dataNascimento || null,
          origem: "sociedade",
          raca: d.raca === "null" ? null : (d.raca as AnimalBreedEnum),
          payload: {
            tipo_entrada: "entrada_sociedade",
            sociedadeId: finalSocId,
            sociedade_id: finalSocId,
            physicalEntry: true
          }
        }
      });

      ops.push({
        table: "sociedade_animais",
        action: "INSERT",
        record: {
          id: crypto.randomUUID(),
          fazenda_id: props.fazendaId,
          sociedade_id: finalSocId,
          animal_id: animalId,
          data_entrada: dataEntrada,
          data_saida: null,
          status: "ativo",
          motivo_saida: null,
          payload: {
            tipo_acao: "entrada_sociedade"
          }
        }
      });

      if (weight !== null) {
        const pesoEventoId = crypto.randomUUID();
        ops.push({
          table: "eventos",
          action: "INSERT",
          record: {
            id: pesoEventoId,
            dominio: "pesagem",
            occurred_at: dataEntrada,
            animal_id: animalId,
            lote_id: normalizedLoteId,
            source_task_id: null,
            corrige_evento_id: null,
            sanitario_caso_id: null,
            observacoes: "Peso inicial registrado na entrada em sociedade",
            payload: {
              tipo_acao: "entrada_sociedade"
            }
          }
        });

        ops.push({
          table: "eventos_pesagem",
          action: "INSERT",
          record: {
            evento_id: pesoEventoId,
            peso_kg: weight,
            payload: {}
          }
        });
      }
    }

    await createGesture(props.fazendaId, ops);
    alert("Entrada em sociedade registrada com sucesso!");
    
    // Reset forms
    setNome("");
    setPercFazenda("50");
    setPercParceiro("50");
    setSelectedSocId("");
    setDrafts([{ localId: crypto.randomUUID(), identificacao: "", sexo: "F", raca: "null", dataNascimento: "", pesoKg: "" }]);
    setRegMode("individual");
  };

  const handleLinkAnimals = async () => {
    if (!selectedSocId || selectedSocId === "new") {
      alert("Selecione uma sociedade ativa.");
      return;
    }
    if (selectedAnimalsWithoutLink.length === 0) {
      alert("Selecione um ou mais animais sem vínculo societário.");
      return;
    }

    const selectedAnimals = await db.state_animais.bulkGet(selectedAnimalsWithoutLink);
    const invalidAnimals = selectedAnimals.filter(
      (animal) => !animal || animal.deleted_at || animal.status !== "ativo",
    );
    if (invalidAnimals.length > 0) {
      alert("Somente animais ativos podem receber sociedade ativa.");
      return;
    }

    const linkOps: OperationInput[] = selectedAnimalsWithoutLink.map(animalId => ({
      table: "sociedade_animais",
      action: "INSERT",
      record: {
        id: crypto.randomUUID(),
        fazenda_id: props.fazendaId,
        sociedade_id: selectedSocId,
        animal_id: animalId,
        data_entrada: new Date().toISOString().slice(0, 10),
        data_saida: null,
        status: "ativo",
        motivo_saida: null,
        payload: {
          tipo_acao: "vinculo_existente",
          physicalEntry: false
        }
      }
    }));

    await createGesture(props.fazendaId, linkOps);
    alert(`${linkOps.length} animais vinculados com sucesso!`);
  };

  const handleRetiradaSociedade = async () => {
    if (selectedAnimalsWithActiveLink.length === 0) {
      alert("Selecione animais que possuam vínculo societário ativo.");
      return;
    }
    if (!dataSaida) {
      alert("A data de saída é obrigatória.");
      return;
    }
    if (!confirm("Deseja realmente retirar estes animais da sociedade?")) return;

    const ops: OperationInput[] = [];
    const activeLinksToClose = activeLinks.filter(l => selectedAnimalsWithActiveLink.includes(l.animal_id));

    for (const link of activeLinksToClose) {
      ops.push({
        table: "sociedade_animais",
        action: "UPDATE",
        record: {
          id: link.id,
          status: "encerrado",
          data_saida: dataSaida,
          motivo_saida: "retirada_sociedade",
          payload: {
            tipo_acao: "retirada_sociedade"
          }
        }
      });

      if (physicalRemoval) {
        const animal = await db.state_animais.get(link.animal_id);
        ops.push({
          table: "animais",
          action: "UPDATE",
          record: {
            id: link.animal_id,
            status: "retirado",
            data_saida: dataSaida,
            lote_id: null,
            payload: {
              ...(animal?.payload || {}),
              tipo_saida: "retirada_sociedade",
              sociedadeId: link.sociedade_id,
              sociedadeAnimalId: link.id,
              motivo_saida: motivoSaida,
              physicalRemoval: true
            }
          }
        });
      }
    }

    await createGesture(props.fazendaId, ops);
    alert(`Retirada de sociedade concluída para ${activeLinksToClose.length} animais!`);
    setMotivoSaida("");
  };

  const handleEndSociety = async () => {
    if (!selectedSocId || selectedSocId === "new") {
      alert("Selecione a sociedade a ser encerrada.");
      return;
    }
    if (!dataFim) {
      alert("A data de encerramento é obrigatória.");
      return;
    }
    if (!confirm("Deseja realmente encerrar essa sociedade?")) return;

    const ops: OperationInput[] = [];
    const linksToClose = activeLinks.filter(l => l.sociedade_id === selectedSocId);

    ops.push({
      table: "sociedades_pecuarias",
      action: "UPDATE",
      record: {
        id: selectedSocId,
        status: "encerrada",
        data_fim: dataFim,
      }
    });

    for (const link of linksToClose) {
      ops.push({
        table: "sociedade_animais",
        action: "UPDATE",
        record: {
          id: link.id,
          status: "encerrado",
          data_saida: dataFim,
          motivo_saida: "encerramento_sociedade",
          payload: {
            tipo_acao: "encerramento_sociedade"
          }
        }
      });

      if (!animalsRemain) {
        const animal = await db.state_animais.get(link.animal_id);
        if (animal && animal.status === "ativo") {
          ops.push({
            table: "animais",
            action: "UPDATE",
            record: {
              id: animal.id,
              status: "retirado",
              data_saida: dataFim,
              lote_id: null,
              payload: {
                ...(animal.payload || {}),
                tipo_saida: "encerramento_sociedade",
                sociedadeId: selectedSocId,
                sociedadeAnimalId: link.id,
                physicalRemoval: true
              }
            }
          });
        }
      }
    }

    await createGesture(props.fazendaId, ops);
    alert("Sociedade encerrada com sucesso!");
    setSelectedSocId("");
  };

  return (
    <div className="space-y-6 mt-4 p-5 border rounded-xl bg-card shadow-sm transition-all duration-300">
      
      {/* 1. Header do Painel */}
      <div className="flex flex-col gap-1 border-b pb-4">
        <div className="flex items-center gap-2 text-primary">
          <Users className="h-5 w-5" />
          <h3 className="text-lg font-semibold tracking-tight text-foreground">Gestão de Negócios Patrimoniais</h3>
        </div>
        <p className="text-xs text-muted-foreground">Sociedade Pecuária e Parcerias Compartilhadas</p>
      </div>

      {/* 2. Seletor Visual de Ação E2E */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">O que deseja registrar?</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              { id: "entrada", label: "Entrada em Sociedade", icon: ArrowDownLeft, desc: "Novos animais compartidos" },
              { id: "vincular", label: "Vincular Existente", icon: Link, desc: "Formalizar sociedade no rebanho" },
              { id: "retirar", label: "Retirar de Sociedade", icon: ArrowUpRight, desc: "Saída/acerto de animais" },
              { id: "encerrar", label: "Encerrar Sociedade", icon: Archive, desc: "Finalizar contrato/parceria" },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = actionType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActionType(item.id)}
                className={`flex flex-col items-start gap-2 p-3.5 text-left border rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 ${
                  active 
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30" 
                    : "border-border hover:border-foreground/20 hover:bg-muted/30"
                }`}
              >
                <div className={`p-2 rounded-lg ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold leading-none">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-1">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Microcopy Informativo/Assistivo */}
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/5 p-3 text-[11px] text-primary/95 leading-relaxed shadow-sm">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <div className="space-y-1">
          {actionType === "entrada" && (
            <p><strong>Entrada em sociedade:</strong> registra animais que passam a compor o rebanho da fazenda com vínculo patrimonial compartilhado. <em>Este fluxo não gera rateio ou lançamento financeiro automático.</em></p>
          )}
          {actionType === "vincular" && (
            <p><strong>Vincular animal existente:</strong> formaliza a entrada de animal ativo da propriedade em uma sociedade específica, sem alterar a presença física ou lote. <em>Este fluxo não gera rateio ou lançamento financeiro automático.</em></p>
          )}
          {actionType === "retirar" && (
            <p><strong>Retirada de sociedade:</strong> encerra a copropriedade de animais. Pode ou não representar a saída física da propriedade. Informe explicitamente. <em>Este fluxo não gera rateio ou lançamento financeiro automático.</em></p>
          )}
          {actionType === "encerrar" && (
            <p><strong>Encerrar sociedade:</strong> finaliza a parceria/sociedade. É necessário escolher se os animais permanecem ativos na fazenda ou se saem fisicamente. <em>Este fluxo não gera rateio ou lançamento financeiro automático.</em></p>
          )}
        </div>
      </div>

      {/* 4. Fluxo Específico */}
      <div className="border-t pt-5">
        
        {/* FLUXO 1: ENTRADA EM SOCIEDADE */}
        {actionType === "entrada" && (
          <div className="space-y-5">
            <h4 className="text-sm font-semibold text-foreground/80">Registrar Entrada Física/Patrimonial</h4>
            
            {/* Seletor de Sociedade + Lote + Data */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Sociedade Parceira</Label>
                <Select value={selectedSocId} onValueChange={setSelectedSocId}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Criar nova sociedade...</SelectItem>
                    {activeSocieties.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome} ({s.percentual_fazenda}%/{s.percentual_parceiro}%)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Lote Inicial</Label>
                <Select value={selectedLoteId} onValueChange={setSelectedLoteId}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Sem Lote" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Sem Lote</SelectItem>
                    {activeLotes.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Entrada</Label>
                <Input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} className="bg-background" />
              </div>
            </div>

            {/* Criação de Nova Sociedade on the fly */}
            {selectedSocId === "new" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-xl bg-muted/20">
                <div className="space-y-2">
                  <Label>Nome da Sociedade</Label>
                  <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Sociedade Nelore G1" className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Contraparte (Parceiro)</Label>
                  <Select value={contraparteId} onValueChange={setContraparteId}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {props.contrapartes?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>% Participação Fazenda</Label>
                  <Input type="number" step="0.0001" value={percFazenda} onChange={e => setPercFazenda(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>% Participação Parceiro</Label>
                  <Input type="number" step="0.0001" value={percParceiro} onChange={e => setPercParceiro(e.target.value)} className="bg-background" />
                </div>
              </div>
            )}

            {/* Seletor de Modo de Cadastro */}
            <div className="space-y-2">
              <Label>Modo de Cadastro</Label>
              <div className="flex gap-2">
                {[
                  { id: "individual", label: "Animal Individual" },
                  { id: "lote", label: "Múltiplos / Lote de Animais" },
                ].map((opt) => (
                  <Button
                    key={opt.id}
                    type="button"
                    variant={regMode === opt.id ? "default" : "outline"}
                    onClick={() => handleModeChange(opt.id as "individual" | "lote")}
                    className="rounded-full shadow-none flex-1 bg-background aria-selected:bg-primary"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Lote Config Panel se for modo Múltiplos */}
            {regMode === "lote" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-xl bg-muted/20">
                <div className="space-y-2">
                  <Label>Quantidade de Animais na Sociedade</Label>
                  <Input type="number" min="1" value={loteQtd} onChange={e => handleQtyChange(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Prefixo de Identificação Automática</Label>
                  <Input value={lotePrefixo} onChange={e => handlePrefixoChange(e.target.value)} placeholder="Ex: SOC-" className="bg-background" />
                </div>
              </div>
            )}

            {/* Dados do(s) Animal(is) - Editor Individual ou Grade para Múltiplos */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Dados dos Animais</Label>
              
              {drafts.map((draft, idx) => (
                <div key={draft.localId} className="p-4 border rounded-xl space-y-4 bg-muted/10">
                  <div className="flex items-center gap-2 border-b pb-2 mb-2 text-foreground/80 font-medium text-xs">
                    <Users className="h-4.5 w-4.5 text-primary" />
                    <span>Animal #{idx + 1}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    
                    <div className="space-y-2">
                      <Label>Identificação</Label>
                      <Input 
                        value={draft.identificacao} 
                        onChange={e => updateDraftField(draft.localId, "identificacao", e.target.value)} 
                        placeholder={`BR-${idx + 1}`}
                        className="bg-background" 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Sexo</Label>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          variant={draft.sexo === "F" ? "default" : "outline"}
                          className="flex-1 bg-background h-10 px-2 text-xs"
                          onClick={() => updateDraftField(draft.localId, "sexo", "F")}
                        >
                          Fêmea
                        </Button>
                        <Button
                          type="button"
                          variant={draft.sexo === "M" ? "default" : "outline"}
                          className="flex-1 bg-background h-10 px-2 text-xs"
                          onClick={() => updateDraftField(draft.localId, "sexo", "M")}
                        >
                          Macho
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Raça</Label>
                      <Select value={draft.raca} onValueChange={v => updateDraftField(draft.localId, "raca", v)}>
                        <SelectTrigger className="bg-background"><SelectValue placeholder="Raça" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">Não informada</SelectItem>
                          {ANIMAL_BREED_OPTIONS.map((b) => (
                            <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Nascimento (Opcional)</Label>
                      <Input 
                        type="date" 
                        value={draft.dataNascimento} 
                        onChange={e => updateDraftField(draft.localId, "dataNascimento", e.target.value)} 
                        className="bg-background" 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Scale className="h-3.5 w-3.5 text-primary" />
                        <span>Peso Inicial (kg)</span>
                      </Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={draft.pesoKg} 
                        onChange={e => updateDraftField(draft.localId, "pesoKg", e.target.value)} 
                        placeholder="Ex: 180"
                        className="bg-background" 
                      />
                    </div>

                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleEntradaSociedade} className="w-full">
              Confirmar Registro de Entrada
            </Button>
          </div>
        )}

        {/* FLUXO 2: VINCULAR ANIMAIS JÁ EXISTENTES */}
        {actionType === "vincular" && (
          <div className="space-y-5">
            <h4 className="text-sm font-semibold text-foreground/80">Vincular Rebanho Ativo</h4>

            {selectedAnimalsWithoutLink.length === 0 ? (
              <div className="p-4 border border-dashed rounded-xl bg-muted/10 text-center">
                <p className="text-sm text-muted-foreground">Nenhum animal sem sociedade selecionado na lista do Registrar.</p>
                <p className="text-xs text-muted-foreground/80 mt-1">Por favor, volte e selecione animais ativos na propriedade antes de vincular.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-muted/20 p-3 rounded-lg border">
                  <span className="text-xs font-semibold text-foreground">{selectedAnimalsWithoutLink.length} animal(is) prontos para receber sociedade.</span>
                </div>

                <div className="space-y-2">
                  <Label>Escolha a Sociedade Receptora</Label>
                  <Select value={selectedSocId} onValueChange={setSelectedSocId}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {activeSocieties.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome} ({s.percentual_fazenda}%/{s.percentual_parceiro}%)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleLinkAnimals} className="w-full" disabled={!selectedSocId}>
                  Vincular {selectedAnimalsWithoutLink.length} Animais à Sociedade
                </Button>
              </div>
            )}
          </div>
        )}

        {/* FLUXO 3: RETIRADA DA SOCIEDADE */}
        {actionType === "retirar" && (
          <div className="space-y-5">
            <h4 className="text-sm font-semibold text-foreground/80">Confirmar Retirada de Sociedade</h4>

            {selectedAnimalsWithActiveLink.length === 0 ? (
              <div className="p-4 border border-dashed rounded-xl bg-muted/10 text-center">
                <p className="text-sm text-muted-foreground">Nenhum animal vinculado a sociedade ativo selecionado na lista.</p>
              </div>
            ) : (
              <div className="space-y-4 p-4 border rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/60">
                <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300 font-semibold text-sm">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Retirada operacional para {selectedAnimalsWithActiveLink.length} animal(is)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Saída / Acerto</Label>
                    <Input type="date" value={dataSaida} onChange={e => setDataSaida(e.target.value)} className="bg-background text-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Label>Motivo / Observações</Label>
                    <Input value={motivoSaida} onChange={e => setMotivoSaida(e.target.value)} placeholder="Ex: Substituição ou acerto de partes" className="bg-background text-foreground" />
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3 mt-2">
                  <Label className="text-orange-900 dark:text-orange-100 font-semibold">Os animais também saem fisicamente da fazenda?</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Button
                      type="button"
                      variant={!physicalRemoval ? "default" : "outline"}
                      className="flex-1 bg-background"
                      onClick={() => setPhysicalRemoval(false)}
                    >
                      Não, apenas patrimonial (permanece ativo)
                    </Button>
                    <Button
                      type="button"
                      variant={physicalRemoval ? "destructive" : "outline"}
                      className="flex-1 bg-background"
                      onClick={() => setPhysicalRemoval(true)}
                    >
                      Sim, saída física (status mudará para 'retirado')
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handleRetiradaSociedade} 
                  variant={physicalRemoval ? "destructive" : "default"}
                  className="w-full mt-2"
                >
                  Confirmar e Executar Retiradas
                </Button>
              </div>
            )}
          </div>
        )}

        {/* FLUXO 4: ENCERRAMENTO DA SOCIEDADE */}
        {actionType === "encerrar" && (
          <div className="space-y-5">
            <h4 className="text-sm font-semibold text-foreground/80">Encerrar Parceria e Contratos</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Selecione a Sociedade Ativa</Label>
                <Select value={selectedSocId} onValueChange={setSelectedSocId}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeSocieties.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Fim / Encerramento</Label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-background" />
              </div>
            </div>

            {selectedSocId && selectedSocId !== "new" && (
              <div className="p-4 border rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/60 space-y-4">
                
                <div className="space-y-2">
                  <Label className="font-semibold text-orange-900 dark:text-orange-100">Ao encerrar a sociedade, os animais permanecem na fazenda?</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button"
                      variant={animalsRemain ? "default" : "outline"}
                      className="flex-1 bg-background"
                      onClick={() => setAnimalsRemain(true)}
                    >
                      Sim, permanecem na fazenda (ativos)
                    </Button>
                    <Button
                      type="button"
                      variant={!animalsRemain ? "destructive" : "outline"}
                      className="flex-1 bg-background"
                      onClick={() => setAnimalsRemain(false)}
                    >
                      Não, saem da fazenda (retirados)
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handleEndSociety} 
                  variant={!animalsRemain ? "destructive" : "default"}
                  className="w-full"
                >
                  Finalizar Sociedade e Vínculos
                </Button>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
