import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import { concluirPendenciaSanitaria } from "@/lib/sanitario/service";
import type {
  FinanceiroTipoEnum,
  OperationInput,
  SanitarioTipoEnum,
  ReproTipoEnum,
} from "@/lib/offline/types";
import {
  ReproductionForm,
  ReproductionEventData,
} from "@/components/events/ReproductionForm";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type { EventDomain, EventInput } from "@/lib/events/types";
import { EventValidationError } from "@/lib/events/validators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Scale,
  Move,
  Syringe,
  ChevronRight,
  ChevronLeft,
  Check,
  PlusCircle,
  Handshake,
} from "lucide-react";
import { useLotes } from "@/hooks/useLotes";
import { useAuth } from "@/hooks/useAuth";
import { findLinkedServiceForDiagnostic, findLinkedServiceForParto } from "@/lib/reproduction/linking";
import { getAnimalReproHistory } from "@/lib/reproduction/selectors";
import type { ReproductionEventPayloadV1 } from "@/lib/reproduction/types";

// P2.2 FIX: Magic numbers to enum for better readability
enum RegistrationStep {
  SELECT_ANIMALS = 1,
  CHOOSE_ACTION = 2,
  CONFIRM = 3,
}

const SEM_LOTE_OPTION = "__sem_lote__";

const readString = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

interface CompraNovoAnimalDraft {
  localId: string;
  identificacao: string;
  sexo: "M" | "F";
  dataNascimento: string;
}

type FinanceiroNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida";

interface NovaContraparteDraft {
  tipo: "pessoa" | "empresa";
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
}

const BullNameDisplay = ({ machoId }: { machoId: string }) => {
  const bull = useLiveQuery(() => db.state_animais.get(machoId), [machoId]);
  if (!bull) return <span className="font-bold truncate max-w-[150px]">{machoId}</span>;
  return <span className="font-bold truncate max-w-[150px]">{bull.identificacao}</span>;
};

const Registrar = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeFarmId, role } = useAuth();
  const [step, setStep] = useState<RegistrationStep>(
    RegistrationStep.SELECT_ANIMALS,
  );
  const [tipoManejo, setTipoManejo] = useState<EventDomain | null>(null);
  const [selectedLoteId, setSelectedLoteId] = useState<string>("");
  const [selectedAnimais, setSelectedAnimais] = useState<string[]>([]);
  const [sourceTaskId, setSourceTaskId] = useState<string>("");

  // Form states
  const [sanitarioData, setSanitarioData] = useState({
    tipo: "vacinacao" as SanitarioTipoEnum,
    produto: "",
  });
  const [protocoloId, setProtocoloId] = useState<string>("");
  const [protocoloItemId, setProtocoloItemId] = useState<string>("");
  const [pesagemData, setPesagemData] = useState<Record<string, string>>({});
  const [movimentacaoData, setMovimentacaoData] = useState({ toLoteId: "" });
  const [nutricaoData, setNutricaoData] = useState({
    alimentoNome: "",
    quantidadeKg: "",
  });
  const [financeiroData, setFinanceiroData] = useState({
    natureza: "compra" as FinanceiroNatureza,
    valorTotal: "",
    contraparteId: "none",
  });
  const [showNovaContraparte, setShowNovaContraparte] = useState(false);
  const [isSavingContraparte, setIsSavingContraparte] = useState(false);
  const [novaContraparte, setNovaContraparte] = useState<NovaContraparteDraft>({
    tipo: "pessoa",
    nome: "",
    documento: "",
    telefone: "",
    email: "",
    endereco: "",
  });
  const [compraNovosAnimais, setCompraNovosAnimais] = useState<
    CompraNovoAnimalDraft[]
  >([]);
  const [reproducaoData, setReproducaoData] = useState<ReproductionEventData>({
    tipo: "cobertura",
    machoId: null,
    observacoes: "",
  });

  const canManageContraparte = role === "owner" || role === "manager";
  const financeiroTipo: FinanceiroTipoEnum =
    financeiroData.natureza === "venda" ||
    financeiroData.natureza === "sociedade_saida"
      ? "venda"
      : "compra";
  const isFinanceiroSociedade =
    financeiroData.natureza === "sociedade_entrada" ||
    financeiroData.natureza === "sociedade_saida";

  // P2.4 FIX: Use centralized useLotes hook
  const lotes = useLotes();
  const selectedLoteIdNormalized =
    selectedLoteId === SEM_LOTE_OPTION
      ? null
      : selectedLoteId || null;
  const selectedLoteLabel =
    selectedLoteId === SEM_LOTE_OPTION
      ? "Sem lote"
      : lotes?.find((l) => l.id === selectedLoteId)?.nome ?? "-";
  const animaisNoLote = useLiveQuery(
    async () => {
      if (!selectedLoteId) return [];
      if (selectedLoteId === SEM_LOTE_OPTION) {
        return db.state_animais
          .filter((a) => a.lote_id === null && (!a.deleted_at || a.deleted_at === null))
          .toArray();
      }
      return db.state_animais
        .where("lote_id")
        .equals(selectedLoteId)
        .filter((a) => !a.deleted_at || a.deleted_at === null)
        .toArray();
    },
    [selectedLoteId],
  );

  const protocolos = useLiveQuery(() => {
    return activeFarmId
      ? db.state_protocolos_sanitarios
          .where("fazenda_id")
          .equals(activeFarmId)
          .filter((p) => p.ativo && (!p.deleted_at || p.deleted_at === null))
          .toArray()
      : [];
  }, [activeFarmId]);

  const contrapartes = useLiveQuery(() => {
    return activeFarmId
      ? db.state_contrapartes
          .where("fazenda_id")
          .equals(activeFarmId)
          .filter((c) => !c.deleted_at || c.deleted_at === null)
          .toArray()
      : [];
  }, [activeFarmId]);

  const protocoloItens = useLiveQuery(() => {
    return protocoloId && activeFarmId
      ? db.state_protocolos_sanitarios_itens
          .where("protocolo_id")
          .equals(protocoloId)
          .filter(
            (i) =>
              i.fazenda_id === activeFarmId &&
              i.tipo === sanitarioData.tipo &&
              (!i.deleted_at || i.deleted_at === null),
          )
          .toArray()
      : [];
  }, [protocoloId, sanitarioData.tipo, activeFarmId]);
  const contraparteSelecionadaNome =
    financeiroData.contraparteId !== "none"
      ? contrapartes?.find((item) => item.id === financeiroData.contraparteId)
          ?.nome ?? "Contraparte selecionada"
      : "Sem contraparte";

  useEffect(() => {
    if (!activeFarmId) return;

    pullDataForFarm(activeFarmId, [
      "protocolos_sanitarios",
      "protocolos_sanitarios_itens",
    ]).catch((error) => {
      console.warn("[registrar] failed to refresh sanitary protocols", error);
    });
  }, [activeFarmId]);

  useEffect(() => {
    if (!protocoloId) return;
    const stillExists = (protocolos ?? []).some((p) => p.id === protocoloId);
    if (!stillExists) {
      setProtocoloId("");
      setProtocoloItemId("");
    }
  }, [protocolos, protocoloId]);

  useEffect(() => {
    if (!protocoloItemId) return;
    const stillExists = (protocoloItens ?? []).some((item) => item.id === protocoloItemId);
    if (!stillExists) {
      setProtocoloItemId("");
    }
  }, [protocoloItens, protocoloItemId]);

  useEffect(() => {
    if (!protocoloItemId) return;
    const selectedItem = (protocoloItens ?? []).find(
      (item) => item.id === protocoloItemId,
    );
    if (!selectedItem) return;

    setSanitarioData((prev) => {
      if (prev.produto.trim()) return prev;
      return { ...prev, produto: selectedItem.produto };
    });
  }, [protocoloItemId, protocoloItens]);

  useEffect(() => {
    const querySourceTaskId = searchParams.get("sourceTaskId");
    const queryDomain = searchParams.get("dominio");
    const queryNatureza = searchParams.get("natureza");
    const queryAnimalId = searchParams.get("animalId");
    const queryLoteId = searchParams.get("loteId");
    const queryProtocoloId = searchParams.get("protocoloId");
    const queryProtocoloItemId = searchParams.get("protocoloItemId");
    const queryProduto = searchParams.get("produto");
    const querySanitarioTipo = searchParams.get("sanitarioTipo");

    if (querySourceTaskId) {
      setSourceTaskId(querySourceTaskId);
    }
    if (queryLoteId) {
      setSelectedLoteId(queryLoteId);
    }
    if (queryAnimalId) {
      setSelectedAnimais([queryAnimalId]);
    }
    if (
      queryDomain &&
      ["sanitario", "pesagem", "movimentacao", "nutricao", "financeiro"].includes(
        queryDomain,
      )
    ) {
      setTipoManejo(queryDomain as EventDomain);
    }
    if (queryProtocoloId) {
      setProtocoloId(queryProtocoloId);
    }
    if (queryProtocoloItemId) {
      setProtocoloItemId(queryProtocoloItemId);
    }
    if (queryProduto) {
      setSanitarioData((prev) => ({ ...prev, produto: queryProduto }));
    }
    if (
      querySanitarioTipo &&
      ["vacinacao", "vermifugacao", "medicamento"].includes(querySanitarioTipo)
    ) {
      setSanitarioData((prev) => ({
        ...prev,
        tipo: querySanitarioTipo as SanitarioTipoEnum,
      }));
    }
    if (
      queryNatureza &&
      ["compra", "venda", "sociedade_entrada", "sociedade_saida"].includes(
        queryNatureza,
      )
    ) {
      setFinanceiroData((prev) => ({
        ...prev,
        natureza: queryNatureza as FinanceiroNatureza,
      }));
    }
    if (queryDomain === "reproducao") {
       setTipoManejo("reproducao");
    }
    if (queryDomain && queryAnimalId) {
      setStep(RegistrationStep.CHOOSE_ACTION);
    }
  }, [searchParams]);

  useEffect(() => {
    const applySourceTaskPrefill = async () => {
      if (!sourceTaskId) return;
      if (tipoManejo && tipoManejo !== "sanitario") return;

      const sourceTask = await db.state_agenda_itens.get(sourceTaskId);
      if (!sourceTask || sourceTask.dominio !== "sanitario") return;

      const sourceRef = sourceTask.source_ref;
      const protocoloIdFromTask = readString(sourceRef, "protocolo_id");
      const protocoloItemIdFromTask =
        readString(sourceRef, "protocolo_item_id") ?? sourceTask.protocol_item_version_id;
      const produtoFromTask =
        readString(sourceRef, "produto") ?? readString(sourceTask.payload, "produto");
      const tipoFromTask = readString(sourceRef, "tipo");

      if (protocoloIdFromTask) setProtocoloId((prev) => prev || protocoloIdFromTask);
      if (protocoloItemIdFromTask) {
        setProtocoloItemId((prev) => prev || protocoloItemIdFromTask);
      }

      if (
        tipoFromTask &&
        ["vacinacao", "vermifugacao", "medicamento"].includes(tipoFromTask)
      ) {
        setSanitarioData((prev) => ({
          ...prev,
          tipo: tipoFromTask as SanitarioTipoEnum,
          produto: prev.produto || produtoFromTask || "",
        }));
      } else if (produtoFromTask) {
        setSanitarioData((prev) => ({
          ...prev,
          produto: prev.produto || produtoFromTask,
        }));
      }
    };

    applySourceTaskPrefill().catch((error) => {
      console.warn("[registrar] failed to prefill from source task", error);
    });
  }, [sourceTaskId, tipoManejo]);

  useEffect(() => {
    if (selectedAnimais.length === 0 && financeiroData.natureza === "venda") {
      setFinanceiroData((prev) => ({ ...prev, natureza: "compra" }));
    }
  }, [selectedAnimais.length, financeiroData.natureza]);

  useEffect(() => {
    if (
      tipoManejo !== "financeiro" ||
      financeiroData.natureza !== "compra" ||
      selectedAnimais.length > 0
    ) {
      setCompraNovosAnimais([]);
    }
  }, [tipoManejo, financeiroData.natureza, selectedAnimais.length]);

  // UX Improvement: Auto-select bull if present in the selected lote
  useEffect(() => {
     const autoSelectBull = async () => {
        if (tipoManejo !== "reproducao") return;
        if (!selectedLoteId || selectedLoteId === SEM_LOTE_OPTION) return;

        // If we already have a bull selected manually, don't override
        if (reproducaoData.machoId) return;

        // Find active bulls in this lote
        const bullsInLote = await db.state_animais
           .where("lote_id")
           .equals(selectedLoteId)
           .filter(a => a.sexo === "M" && a.status === "ativo" && !a.deleted_at)
           .toArray();

        if (bullsInLote.length === 1) {
           setReproducaoData(prev => ({ ...prev, machoId: bullsInLote[0].id }));
           showSuccess(`Reprodutor ${bullsInLote[0].identificacao} selecionado automaticamente.`);
        }
     };

     autoSelectBull();
  }, [tipoManejo, selectedLoteId, reproducaoData.machoId]);

  const handleCreateContraparte = async () => {
    const fazenda_id = activeFarmId ?? lotes?.[0]?.fazenda_id;
    if (!fazenda_id) {
      showError("Selecione uma fazenda ativa.");
      return;
    }
    if (!canManageContraparte) {
      showError("Apenas owner/manager pode cadastrar contraparte.");
      return;
    }
    if (!novaContraparte.nome.trim()) {
      showError("Nome da contraparte e obrigatorio.");
      return;
    }

    setIsSavingContraparte(true);
    try {
      const contraparteId = crypto.randomUUID();
      const txId = await createGesture(fazenda_id, [
        {
          table: "contrapartes",
          action: "INSERT",
          record: {
            id: contraparteId,
            tipo: novaContraparte.tipo,
            nome: novaContraparte.nome.trim(),
            documento: novaContraparte.documento.trim() || null,
            telefone: novaContraparte.telefone.trim() || null,
            email: novaContraparte.email.trim() || null,
            endereco: novaContraparte.endereco.trim() || null,
            payload: {
              origem: "registrar_financeiro",
            },
          },
        },
      ]);

      setFinanceiroData((prev) => ({ ...prev, contraparteId }));
      setNovaContraparte({
        tipo: "pessoa",
        nome: "",
        documento: "",
        telefone: "",
        email: "",
        endereco: "",
      });
      setShowNovaContraparte(false);
      showSuccess(`Contraparte cadastrada. TX: ${txId.slice(0, 8)}`);
    } catch {
      showError("Falha ao cadastrar contraparte.");
    } finally {
      setIsSavingContraparte(false);
    }
  };

  const handleFinalize = async () => {
    if (!tipoManejo) return;

    const fazenda_id = activeFarmId ?? lotes?.[0]?.fazenda_id;
    if (!fazenda_id) return;

    const hasSelectedAnimals = selectedAnimais.length > 0;
    const financeRequiresAnimal =
      tipoManejo === "financeiro" && financeiroData.natureza === "venda";
    const financeByLoteOnly =
      tipoManejo === "financeiro" &&
      !financeRequiresAnimal &&
      !hasSelectedAnimals;
    const compraComCadastroAnimais =
      financeByLoteOnly &&
      financeiroData.natureza === "compra" &&
      compraNovosAnimais.length > 0;

    if (
      tipoManejo === "financeiro" &&
      isFinanceiroSociedade &&
      financeiroData.contraparteId === "none"
    ) {
      showError("Selecione ou cadastre uma contraparte para evento de sociedade.");
      return;
    }

    if (!hasSelectedAnimals && !financeByLoteOnly) {
      showError("Selecione ao menos um animal para este tipo de registro.");
      return;
    }

    if (financeByLoteOnly && !selectedLoteId) {
      showError("Selecione um lote para registrar compra sem animais.");
      return;
    }

    if (
      financeByLoteOnly &&
      selectedLoteId === SEM_LOTE_OPTION &&
      financeiroData.natureza === "compra" &&
      compraNovosAnimais.length === 0
    ) {
      showError(
        "Para compra com alvo sem lote, informe ao menos um novo animal.",
      );
      return;
    }

    if (compraComCadastroAnimais) {
      const temIdentificacaoVazia = compraNovosAnimais.some(
        (item) => !item.identificacao.trim(),
      );
      if (temIdentificacaoVazia) {
        showError("Preencha a identificacao de todos os novos animais.");
        return;
      }

      const hoje = new Date();
      const dataNascimentoInvalida = compraNovosAnimais.some((item) => {
        if (!item.dataNascimento) return false;
        const parsed = new Date(item.dataNascimento);
        return Number.isNaN(parsed.getTime()) || parsed > hoje;
      });
      if (dataNascimentoInvalida) {
        showError("Data de nascimento invalida ou no futuro.");
        return;
      }

      const identificacoes = compraNovosAnimais.map((item) =>
        item.identificacao.trim().toLowerCase(),
      );
      if (new Set(identificacoes).size !== identificacoes.length) {
        showError("Nao repita identificacoes nos novos animais.");
        return;
      }
    }

    try {
      const now = new Date().toISOString();
      const today = now.split("T")[0];
      const protocoloItem =
        tipoManejo === "sanitario" && protocoloItemId
          ? await db.state_protocolos_sanitarios_itens.get(protocoloItemId)
          : null;

      if (tipoManejo === "sanitario" && sourceTaskId) {
        try {
          const eventoId = await concluirPendenciaSanitaria({
            agendaItemId: sourceTaskId,
            occurredAt: now,
            tipo: sanitarioData.tipo,
            produto: sanitarioData.produto.trim() || protocoloItem?.produto || "",
            payload: {
              origem: "registrar_manejo",
              protocolo_item_id: protocoloItem?.id ?? null,
              protocolo_id: protocoloItem?.protocolo_id ?? null,
            },
          });

          await pullDataForFarm(fazenda_id, [
            "agenda_itens",
            "eventos",
            "eventos_sanitario",
          ]);

          showSuccess(
            `Aplicacao sanitaria registrada! Evento ${eventoId.slice(0, 8)}`,
          );
          navigate("/home", { state: { syncPending: false } });
          return;
        } catch (rpcError) {
          console.warn(
            "[registrar] rpc sanitario falhou, fallback para fluxo offline",
            rpcError,
          );
        }
      }

      const parseNumeric = (value: string): number =>
        Number.parseFloat(value.replace(",", "."));

      const ops: OperationInput[] = [];
      const createdAnimalIds: string[] = [];

      if (compraComCadastroAnimais) {
        for (const draft of compraNovosAnimais) {
          const animalId = crypto.randomUUID();
          createdAnimalIds.push(animalId);
          ops.push({
            table: "animais",
            action: "INSERT",
            record: {
              id: animalId,
              identificacao: draft.identificacao.trim(),
              sexo: draft.sexo,
              status: "ativo",
              lote_id: selectedLoteIdNormalized,
              data_nascimento: draft.dataNascimento || null,
              data_entrada: today,
              data_saida: null,
              pai_id: null,
              mae_id: null,
              nome: null,
              rfid: null,
              origem: "compra",
              raca: null,
              papel_macho: null,
              habilitado_monta: false,
              observacoes: null,
              payload: {
                source: "registrar_manejo_compra",
              },
              created_at: now,
              updated_at: now,
            },
          });
        }
      }

      let linkedEventId: string | null = null;

      const targetAnimalIds: Array<string | null> = hasSelectedAnimals
        ? selectedAnimais
        : [null];

      for (const animalId of targetAnimalIds) {
        const animal = animalId ? await db.state_animais.get(animalId) : null;
        if (animalId && !animal) continue;
        const targetLoteId = animal?.lote_id ?? selectedLoteIdNormalized;

        let eventInput: EventInput;

        if (tipoManejo === "sanitario") {
          eventInput = {
            dominio: "sanitario",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: animalId ?? null,
            loteId: targetLoteId,
            tipo: sanitarioData.tipo,
            produto: sanitarioData.produto.trim() || protocoloItem?.produto || "",
            protocoloItem: protocoloItem
              ? {
                  id: protocoloItem.id,
                  intervalDays: protocoloItem.intervalo_dias,
                  doseNum: protocoloItem.dose_num,
                  geraAgenda: protocoloItem.gera_agenda,
                }
              : undefined,
          };
        } else if (tipoManejo === "pesagem") {
          eventInput = {
            dominio: "pesagem",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: animalId ?? null,
            loteId: targetLoteId,
            pesoKg: parseNumeric(animalId ? pesagemData[animalId] || "" : ""),
          };
        } else if (tipoManejo === "movimentacao") {
          eventInput = {
            dominio: "movimentacao",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: animalId ?? null,
            loteId: targetLoteId,
            fromLoteId: targetLoteId,
            toLoteId: movimentacaoData.toLoteId || null,
          };
        } else if (tipoManejo === "nutricao") {
          eventInput = {
            dominio: "nutricao",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: animalId ?? null,
            loteId: targetLoteId,
            alimentoNome: nutricaoData.alimentoNome,
            quantidadeKg: parseNumeric(nutricaoData.quantidadeKg),
          };
        } else if (tipoManejo === "financeiro") {
          const natureza = financeiroData.natureza;
          const financialAnimalId =
            animalId ??
            (natureza === "compra" && selectedLoteId === SEM_LOTE_OPTION
              ? createdAnimalIds[0] ?? null
              : null);
          const payloadFinanceiro =
            natureza === "sociedade_entrada"
              ? { kind: "sociedade_entrada", origem: "registrar_manejo" }
              : natureza === "sociedade_saida"
                ? { kind: "sociedade_saida", origem: "registrar_manejo" }
                : natureza === "venda"
                  ? { kind: "venda_animal", origem: "registrar_manejo" }
                  : animalId
                    ? { kind: "compra_animal", origem: "registrar_manejo" }
                    : createdAnimalIds.length > 0
                      ? {
                          kind: "compra_lote_com_animais",
                          origem: "registrar_manejo",
                          animal_ids: createdAnimalIds,
                          animais_cadastrados: createdAnimalIds.length,
                        }
                      : { kind: "compra_lote", origem: "registrar_manejo" };

          eventInput = {
            dominio: "financeiro",
            fazendaId: fazenda_id,
            occurredAt: now,
            sourceTaskId: sourceTaskId || null,
            animalId: financialAnimalId,
            loteId: targetLoteId,
            tipo: financeiroTipo,
            valorTotal: parseNumeric(financeiroData.valorTotal),
            contraparteId:
              financeiroData.contraparteId !== "none"
                ? financeiroData.contraparteId
                : null,
            applyAnimalStateUpdate:
              natureza === "venda" && Boolean(animalId),
            clearAnimalLoteOnSale:
              natureza === "venda" && Boolean(animalId),
            payload: payloadFinanceiro,
          };
        } else if (tipoManejo === "reproducao") {
          // Block orphan parto if validation failed or user selected 'unlinked'
          // Actually, we should check if we found a candidate if mode is auto.
          // But strict server rules say: REJECT if parto is unlinked.
            if (reproducaoData.tipo === "parto") {
               // Strict V1: Block orphan/unlinked
               // We will validate this after trying auto-link below
            }
 
            if (
               (reproducaoData.tipo === "cobertura" || reproducaoData.tipo === "IA") &&
               !reproducaoData.machoId
            ) {
               showError("Macho e obrigatorio para Cobertura/IA.");
               return;
            }

            // AUTO-LINKING LOGIC
            let episodeEventoId = reproducaoData.episodeEventoId || undefined;
            // Map UI method to Domain method
            let episodeLinkMethod: any = reproducaoData.episodeLinkMethod;

            if (reproducaoData.episodeLinkMethod === 'auto_last_open_service') {
               // Default if not found
               episodeLinkMethod = undefined; 
               if (animalId) {
                  try {
                     const history = await getAnimalReproHistory(animalId);
                     
                     if (reproducaoData.tipo === 'diagnostico') {
                        const linked = findLinkedServiceForDiagnostic(history, now);
                        if (linked) {
                           episodeEventoId = linked.id;
                           episodeLinkMethod = 'auto_A';
                        }
                     } else if (reproducaoData.tipo === 'parto') {
                        const res = findLinkedServiceForParto(history, now);
                        if (res.event) {
                           episodeEventoId = res.event.id;
                           episodeLinkMethod = res.method;
                        }
                     }
                  } catch (err) {
                     console.error("Failed to auto-link reproduction event", err);
                  }
               }
            } else if (reproducaoData.episodeLinkMethod === 'unlinked') {
               episodeLinkMethod = 'orphan';
            }

            // STRICT VALIDATION FOR PARTO
            if (reproducaoData.tipo === 'parto') {
               if (!episodeEventoId) {
                  // V1 STRICT: Parto MUST be linked. No orphan allowed.
                  if (reproducaoData.episodeLinkMethod === 'auto_last_open_service') {
                     showError(`Não foi possível encontrar serviço para vincular o parto. Selecione manualmente.`);
                  } else {
                     showError("Parto exige vínculo com evento anterior (Cobertura/IA). Selecione um episódio.");
                  }
                  return;
               }
            }

            const payloadV1: ReproductionEventPayloadV1 = {
               schema_version: 1,
               episode_evento_id: episodeEventoId,
               episode_link_method: episodeLinkMethod,
               
               // Cobertura/IA
               tecnica_livre: reproducaoData.tecnicaLivre,
               reprodutor_tag: reproducaoData.reprodutorTag,
               lote_semen: reproducaoData.loteSemen,
               dose_semen_ref: reproducaoData.doseSemenRef,
               
               // Diagnostico
               resultado: reproducaoData.resultadoDiagnostico as any,
               data_prevista_parto: reproducaoData.dataPrevistaParto,
               
               // Parto
               data_parto_real: reproducaoData.dataParto,
               numero_crias: reproducaoData.numeroCrias,
               
               observacoes_estruturadas: reproducaoData.observacoes ? { texto: reproducaoData.observacoes } : undefined
            };
 
            eventInput = {
              dominio: "reproducao",
              fazendaId: fazenda_id,
              occurredAt: now,
              sourceTaskId: sourceTaskId || null,
              animalId: animalId ?? null,
              tipo: reproducaoData.tipo,
              machoId: reproducaoData.machoId,
              observacoes: reproducaoData.observacoes,
              payloadData: payloadV1,
            };
        } else {
           continue; 
        }

        const built = buildEventGesture(eventInput);
        if (!linkedEventId) {
          linkedEventId = built.eventId;
        }
        ops.push(...built.ops);
      }

      if (sourceTaskId && linkedEventId) {
        ops.push({
          table: "agenda_itens",
          action: "UPDATE",
          record: {
            id: sourceTaskId,
            status: "concluido",
            source_evento_id: linkedEventId,
          },
        });
      }

      if (ops.length === 0) {
        showError("Nenhuma operacao valida para envio.");
        return;
      }

      const txId = await createGesture(fazenda_id, ops);
      if (compraComCadastroAnimais) {
        showSuccess(
          `Compra registrada com ${createdAnimalIds.length} novo(s) animal(is). TX: ${txId.slice(0, 8)}`,
        );
      } else {
        showSuccess(`Manejo registrado! TX: ${txId.slice(0, 8)}`);
      }
      navigate("/home", { state: { syncPending: true } });
    } catch (e: unknown) {
      if (e instanceof EventValidationError) {
        showError(e.issues[0]?.message ?? "Dados invalidos para o evento.");
        return;
      }
      showError("Erro ao registrar manejo.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Registrar Manejo</h1>
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-8 rounded-full ${step >= s ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>

      {sourceTaskId && (
        <div className="flex items-center gap-2">
          <Badge variant="outline">Origem: Agenda</Badge>
          <span className="text-sm text-muted-foreground">
            Tarefa <span className="font-mono">{sourceTaskId.slice(0, 8)}</span>
          </span>
        </div>
      )}

      {step === RegistrationStep.SELECT_ANIMALS && (
        <Card>
          <CardHeader>
            <CardTitle>1. Selecionar Alvo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Lote</Label>
              <Select
                onValueChange={(value) => {
                  setSelectedLoteId(value);
                  setSelectedAnimais([]);
                }}
                value={selectedLoteId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o lote" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_LOTE_OPTION}>Sem lote</SelectItem>
                  {lotes?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLoteId && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {animaisNoLote?.map((a) => (
                  <div key={a.id} className="flex items-center p-3 gap-3">
                    <Checkbox
                      checked={selectedAnimais.includes(a.id)}
                      onCheckedChange={(checked) => {
                        setSelectedAnimais((prev) =>
                          checked
                            ? [...prev, a.id]
                            : prev.filter((id) => id !== a.id),
                        );
                      }}
                    />
                    <span className="font-medium">{a.identificacao}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.sexo === "M" ? "Macho" : "Fêmea"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selectedLoteId && (animaisNoLote?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedLoteId === SEM_LOTE_OPTION
                  ? "Nao ha animais sem lote cadastrados."
                  : "Este lote ainda nao possui animais. Voce pode registrar compra ou sociedade por lote."}
              </p>
            )}

            <Button
              className="w-full"
              disabled={!selectedLoteId}
              onClick={() => setStep(RegistrationStep.CHOOSE_ACTION)}
            >
              Próximo <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === RegistrationStep.CHOOSE_ACTION && (
        <Card>
          <CardHeader>
            <CardTitle>2. Escolher Ação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Button
                variant={tipoManejo === "sanitario" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                disabled={selectedAnimais.length === 0}
                onClick={() => setTipoManejo("sanitario")}
              >
                <Syringe className="h-6 w-6" /> Sanitário
              </Button>
              <Button
                variant={tipoManejo === "pesagem" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                disabled={selectedAnimais.length === 0}
                onClick={() => setTipoManejo("pesagem")}
              >
                <Scale className="h-6 w-6" /> Pesagem
              </Button>
              <Button
                variant={tipoManejo === "movimentacao" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                disabled={selectedAnimais.length === 0}
                onClick={() => setTipoManejo("movimentacao")}
              >
                <Move className="h-6 w-6" /> Mover
              </Button>
              <Button
                variant={tipoManejo === "nutricao" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                disabled={selectedAnimais.length === 0}
                onClick={() => setTipoManejo("nutricao")}
              >
                <Scale className="h-6 w-6" /> Nutricao
              </Button>
              <Button
                variant={tipoManejo === "financeiro" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                onClick={() => setTipoManejo("financeiro")}
              >
                <Move className="h-6 w-6" /> Financeiro
              </Button>
              <Button
                variant={tipoManejo === "reproducao" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                onClick={() => setTipoManejo("reproducao")}
                disabled={selectedAnimais.length === 0}
              >
                <div className="h-6 w-6 rounded-full border-2 border-current" /> Reprodução
              </Button>
            </div>

            {selectedAnimais.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem animais selecionados: use Financeiro para compra/sociedade
                por lote. Venda exige selecao de animal.
              </p>
            )}

            {tipoManejo === "sanitario" && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    onValueChange={(v) =>
                      setSanitarioData((d) => ({
                        ...d,
                        tipo: v as SanitarioTipoEnum,
                      }))
                    }
                    value={sanitarioData.tipo}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacinacao">Vacinação</SelectItem>
                      <SelectItem value="vermifugacao">Vermifugação</SelectItem>
                      <SelectItem value="medicamento">Medicamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Input
                    value={sanitarioData.produto}
                    onChange={(e) =>
                      setSanitarioData((d) => ({
                        ...d,
                        produto: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Protocolo (opcional)</Label>
                  <Select
                    onValueChange={(value) =>
                      setProtocoloId(value === "none" ? "" : value)
                    }
                    value={protocoloId || "none"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem protocolo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem protocolo</SelectItem>
                      {protocolos?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {protocoloId && protocoloItens && protocoloItens.length > 0 && (
                  <div className="space-y-2">
                    <Label>Item do Protocolo</Label>
                    <Select
                      onValueChange={setProtocoloItemId}
                      value={protocoloItemId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o item" />
                      </SelectTrigger>
                      <SelectContent>
                        {protocoloItens.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            Dose {item.dose_num}{" "}
                            {item.gera_agenda && `(+${item.intervalo_dias}d)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {tipoManejo === "pesagem" && (
              <div className="space-y-4 border-t pt-4 max-h-64 overflow-y-auto">
                {selectedAnimais.map((id) => {
                  const animal = animaisNoLote?.find((a) => a.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-4"
                    >
                      <Label className="w-24">{animal?.identificacao}</Label>
                      <Input
                        type="number"
                        placeholder="Peso (kg)"
                        value={pesagemData[id] || ""}
                        onChange={(e) =>
                          setPesagemData((prev) => ({
                            ...prev,
                            [id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {tipoManejo === "movimentacao" && (
              <div className="space-y-4 border-t pt-4">
                <Label>Lote Destino</Label>
                <Select
                  onValueChange={(v) => setMovimentacaoData({ toLoteId: v })}
                  value={movimentacaoData.toLoteId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes
                      ?.filter((l) => l.id !== selectedLoteIdNormalized)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipoManejo === "nutricao" && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Alimento</Label>
                  <Input
                    value={nutricaoData.alimentoNome}
                    onChange={(e) =>
                      setNutricaoData((prev) => ({
                        ...prev,
                        alimentoNome: e.target.value,
                      }))
                    }
                    placeholder="Ex.: racao proteica"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade (kg)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={nutricaoData.quantidadeKg}
                    onChange={(e) =>
                      setNutricaoData((prev) => ({
                        ...prev,
                        quantidadeKg: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {tipoManejo === "financeiro" && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Natureza</Label>
                  <Select
                    onValueChange={(value) =>
                      setFinanceiroData((prev) => ({
                        ...prev,
                        natureza: value as FinanceiroNatureza,
                      }))
                    }
                    value={financeiroData.natureza}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem
                        value="venda"
                        disabled={selectedAnimais.length === 0}
                      >
                        Venda
                      </SelectItem>
                      <SelectItem value="sociedade_entrada">
                        Sociedade (Entrada)
                      </SelectItem>
                      <SelectItem value="sociedade_saida">
                        Sociedade (Saida)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor total</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={financeiroData.valorTotal}
                    onChange={(e) =>
                      setFinanceiroData((prev) => ({
                        ...prev,
                        valorTotal: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Contraparte{" "}
                    {isFinanceiroSociedade ? "(obrigatoria em sociedade)" : "(opcional)"}
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setFinanceiroData((prev) => ({
                        ...prev,
                        contraparteId: value,
                      }))
                    }
                    value={financeiroData.contraparteId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem contraparte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem contraparte</SelectItem>
                      {contrapartes?.map((contraparte) => (
                        <SelectItem key={contraparte.id} value={contraparte.id}>
                          {contraparte.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNovaContraparte((prev) => !prev)}
                    disabled={!canManageContraparte}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {showNovaContraparte ? "Fechar cadastro" : "Nova contraparte"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate("/contrapartes")}
                  >
                    <Handshake className="mr-2 h-4 w-4" />
                    Gerenciar parceiros
                  </Button>
                </div>
                {!canManageContraparte && (
                  <p className="text-xs text-muted-foreground">
                    Apenas owner/manager pode criar contraparte.
                  </p>
                )}

                {showNovaContraparte && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Tipo da contraparte</Label>
                        <Select
                          value={novaContraparte.tipo}
                          onValueChange={(value) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              tipo: value as "pessoa" | "empresa",
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pessoa">Pessoa</SelectItem>
                            <SelectItem value="empresa">Empresa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={novaContraparte.nome}
                          onChange={(e) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              nome: e.target.value,
                            }))
                          }
                          placeholder="Nome da contraparte"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Documento</Label>
                        <Input
                          value={novaContraparte.documento}
                          onChange={(e) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              documento: e.target.value,
                            }))
                          }
                          placeholder="CPF/CNPJ"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                          value={novaContraparte.telefone}
                          onChange={(e) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              telefone: e.target.value,
                            }))
                          }
                          placeholder="Telefone"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          value={novaContraparte.email}
                          onChange={(e) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="Email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Endereco</Label>
                        <Input
                          value={novaContraparte.endereco}
                          onChange={(e) =>
                            setNovaContraparte((prev) => ({
                              ...prev,
                              endereco: e.target.value,
                            }))
                          }
                          placeholder="Cidade/UF"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={handleCreateContraparte}
                      disabled={isSavingContraparte || !canManageContraparte}
                    >
                      {isSavingContraparte ? "Salvando..." : "Salvar contraparte"}
                    </Button>
                  </div>
                )}

                {selectedAnimais.length === 0 &&
                  financeiroData.natureza === "compra" && (
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Label>Novos Animais da Compra (opcional)</Label>
                          <p className="text-xs text-muted-foreground">
                            Cadastre os animais no mesmo gesto da compra.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setCompraNovosAnimais((prev) => [
                              ...prev,
                              {
                                localId: crypto.randomUUID(),
                                identificacao: "",
                                sexo: "F",
                                dataNascimento: "",
                              },
                            ])
                          }
                        >
                          Adicionar
                        </Button>
                      </div>

                      {compraNovosAnimais.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Sem novos animais informados.
                        </p>
                      )}

                      {compraNovosAnimais.map((draft, index) => (
                        <div
                          key={draft.localId}
                          className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-[1fr_150px_170px_96px]"
                        >
                          <Input
                            value={draft.identificacao}
                            onChange={(e) =>
                              setCompraNovosAnimais((prev) =>
                                prev.map((item) =>
                                  item.localId === draft.localId
                                    ? {
                                        ...item,
                                        identificacao: e.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                            placeholder={`Identificacao do animal ${index + 1}`}
                          />
                          <Select
                            value={draft.sexo}
                            onValueChange={(value) =>
                              setCompraNovosAnimais((prev) =>
                                prev.map((item) =>
                                  item.localId === draft.localId
                                    ? {
                                        ...item,
                                        sexo: value as "M" | "F",
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="F">Femea</SelectItem>
                              <SelectItem value="M">Macho</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={draft.dataNascimento}
                            onChange={(e) =>
                              setCompraNovosAnimais((prev) =>
                                prev.map((item) =>
                                  item.localId === draft.localId
                                    ? {
                                        ...item,
                                        dataNascimento: e.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              setCompraNovosAnimais((prev) =>
                                prev.filter((item) => item.localId !== draft.localId),
                              )
                            }
                          >
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

            )}

            {tipoManejo === "reproducao" && (
                <div className="space-y-4 border-t pt-4">
                  <ReproductionForm
                    fazendaId={activeFarmId ?? ""}
                    animalId={selectedAnimais[0]}
                    data={reproducaoData}
                    onChange={setReproducaoData}
                  />
                </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(RegistrationStep.SELECT_ANIMALS)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                className="flex-1"
                disabled={!tipoManejo}
                onClick={() => setStep(RegistrationStep.CONFIRM)}
              >
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === RegistrationStep.CONFIRM && (
        <Card>
          <CardHeader>
            <CardTitle>3. Confirmar Registro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manejo:</span>
                <span className="font-bold capitalize">{tipoManejo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Animais:</span>
                <span className="font-bold">{selectedAnimais.length}</span>
              </div>
              {selectedAnimais.length === 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alvo (lote):</span>
                  <span className="font-bold">{selectedLoteLabel}</span>
                </div>
              )}
              {tipoManejo === "movimentacao" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destino:</span>
                  <span className="font-bold">
                    {
                      lotes?.find((l) => l.id === movimentacaoData.toLoteId)
                        ?.nome
                    }
                  </span>
                </div>
              )}
              {tipoManejo === "nutricao" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alimento:</span>
                  <span className="font-bold">{nutricaoData.alimentoNome}</span>
                </div>
              )}
              {tipoManejo === "financeiro" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Natureza:</span>
                    <span className="font-bold capitalize">
                      {financeiroData.natureza.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contraparte:</span>
                    <span className="font-bold">{contraparteSelecionadaNome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-bold">{financeiroData.valorTotal}</span>
                  </div>
                </>
              )}
              {tipoManejo === "financeiro" &&
                selectedAnimais.length === 0 &&
                financeiroData.natureza === "compra" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Novos animais:</span>
                    <span className="font-bold">{compraNovosAnimais.length}</span>
                  </div>

                )}
              {tipoManejo === "reproducao" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-bold capitalize">{reproducaoData.tipo}</span>
                  </div>
                  {reproducaoData.machoId && (
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Reprodutor:</span>
                        <BullNameDisplay machoId={reproducaoData.machoId} />
                     </div>
                  )}
                  {reproducaoData.observacoes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Obs:</span>
                      <span className="font-bold truncate max-w-[150px]">{reproducaoData.observacoes}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(RegistrationStep.CHOOSE_ACTION)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleFinalize}
              >
                <Check className="mr-2 h-4 w-4" /> Confirmar e Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Registrar;
