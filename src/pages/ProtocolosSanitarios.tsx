import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import { useAuth } from "@/hooks/useAuth";
import type { ProtocoloSanitarioItem, SanitarioTipoEnum } from "@/lib/offline/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from "@/utils/toast";
import { ShieldPlus, Syringe } from "lucide-react";

const sanitizeInteger = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const readString = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
};

const ProtocolosSanitarios = () => {
  const { activeFarmId } = useAuth();
  const [nomeProtocolo, setNomeProtocolo] = useState("");
  const [descricaoProtocolo, setDescricaoProtocolo] = useState("");
  const [protocoloAtivo, setProtocoloAtivo] = useState(true);

  const [itemProtocoloId, setItemProtocoloId] = useState("");
  const [itemTipo, setItemTipo] = useState<SanitarioTipoEnum>("vacinacao");
  const [itemProduto, setItemProduto] = useState("");
  const [itemIntervaloDias, setItemIntervaloDias] = useState("30");
  const [itemDoseNum, setItemDoseNum] = useState("1");
  const [itemGeraAgenda, setItemGeraAgenda] = useState(true);
  const [itemDedupTemplate, setItemDedupTemplate] = useState("");
  const [itemSexoAlvo, setItemSexoAlvo] = useState<"todos" | "M" | "F">("todos");
  const [itemIdadeMinDias, setItemIdadeMinDias] = useState("");
  const [itemIdadeMaxDias, setItemIdadeMaxDias] = useState("");
  const [itemIndicacao, setItemIndicacao] = useState("");

  useEffect(() => {
    if (!activeFarmId) return;
    pullDataForFarm(activeFarmId, ["protocolos_sanitarios", "protocolos_sanitarios_itens"], { mode: "merge" }).catch(
      (error) => {
        console.warn("[protocolos-sanitarios] failed to refresh protocols", error);
      },
    );
  }, [activeFarmId]);

  const protocolos = useLiveQuery(() => {
    if (!activeFarmId) return [];
    return db.state_protocolos_sanitarios
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((p) => !p.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const itens = useLiveQuery(() => {
    if (!activeFarmId) return [];
    return db.state_protocolos_sanitarios_itens
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((item) => !item.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const itensByProtocolo = useMemo(() => {
    const grouped = new Map<string, ProtocoloSanitarioItem[]>();
    for (const item of itens ?? []) {
      const current = grouped.get(item.protocolo_id);
      if (current) {
        current.push(item);
      } else {
        grouped.set(item.protocolo_id, [item]);
      }
    }
    for (const values of grouped.values()) {
      values.sort((a, b) => (a.dose_num ?? 1) - (b.dose_num ?? 1));
    }
    return grouped;
  }, [itens]);

  const handleCriarProtocolo = async () => {
    if (!activeFarmId) {
      showError("Fazenda ativa nao identificada.");
      return;
    }
    if (!nomeProtocolo.trim()) {
      showError("Informe o nome do protocolo.");
      return;
    }

    try {
      await createGesture(activeFarmId, [
        {
          table: "protocolos_sanitarios",
          action: "INSERT",
          record: {
            id: crypto.randomUUID(),
            nome: nomeProtocolo.trim(),
            descricao: descricaoProtocolo.trim() || null,
            ativo: protocoloAtivo,
            payload: {
              origem: "config_protocolos_sanitarios",
            },
          },
        },
      ]);
      setNomeProtocolo("");
      setDescricaoProtocolo("");
      setProtocoloAtivo(true);
      showSuccess("Protocolo cadastrado localmente.");
    } catch (error) {
      console.error(error);
      showError("Erro ao cadastrar protocolo.");
    }
  };

  const handleCriarItem = async () => {
    if (!activeFarmId) {
      showError("Fazenda ativa nao identificada.");
      return;
    }
    if (!itemProtocoloId) {
      showError("Selecione um protocolo.");
      return;
    }
    if (!itemProduto.trim()) {
      showError("Informe o nome da vacina/produto.");
      return;
    }

    const intervaloDias = sanitizeInteger(itemIntervaloDias);
    if (!intervaloDias || intervaloDias <= 0) {
      showError("Intervalo em dias deve ser maior que zero.");
      return;
    }

    const doseNum = sanitizeInteger(itemDoseNum);
    if (!doseNum || doseNum <= 0) {
      showError("Dose deve ser maior que zero.");
      return;
    }

    const idadeMin = itemIdadeMinDias ? sanitizeInteger(itemIdadeMinDias) : null;
    const idadeMax = itemIdadeMaxDias ? sanitizeInteger(itemIdadeMaxDias) : null;

    if ((idadeMin !== null && idadeMin < 0) || (idadeMax !== null && idadeMax < 0)) {
      showError("Idades de restricao devem ser positivas.");
      return;
    }
    if (idadeMin !== null && idadeMax !== null && idadeMax < idadeMin) {
      showError("Idade maxima deve ser maior ou igual a idade minima.");
      return;
    }

    const payload: Record<string, unknown> = {
      origem: "config_protocolos_sanitarios",
      indicacao: itemIndicacao.trim() || null,
    };
    if (itemSexoAlvo !== "todos") payload.sexo_alvo = itemSexoAlvo;
    if (idadeMin !== null) payload.idade_minima_dias = idadeMin;
    if (idadeMax !== null) payload.idade_maxima_dias = idadeMax;

    try {
      await createGesture(activeFarmId, [
        {
          table: "protocolos_sanitarios_itens",
          action: "INSERT",
          record: {
            id: crypto.randomUUID(),
            protocolo_id: itemProtocoloId,
            protocol_item_id: crypto.randomUUID(),
            version: 1,
            tipo: itemTipo,
            produto: itemProduto.trim(),
            intervalo_dias: intervaloDias,
            dose_num: doseNum,
            gera_agenda: itemGeraAgenda,
            dedup_template: itemDedupTemplate.trim() || null,
            payload,
          },
        },
      ]);

      setItemProduto("");
      setItemIntervaloDias("30");
      setItemDoseNum("1");
      setItemGeraAgenda(true);
      setItemDedupTemplate("");
      setItemSexoAlvo("todos");
      setItemIdadeMinDias("");
      setItemIdadeMaxDias("");
      setItemIndicacao("");
      showSuccess("Item sanitario cadastrado localmente.");
    } catch (error) {
      console.error(error);
      showError("Erro ao cadastrar item sanitario.");
    }
  };

  const toggleProtocoloAtivo = async (id: string, ativoAtual: boolean) => {
    if (!activeFarmId) return;
    try {
      await createGesture(activeFarmId, [
        {
          table: "protocolos_sanitarios",
          action: "UPDATE",
          record: {
            id,
            ativo: !ativoAtual,
          },
        },
      ]);
      showSuccess(!ativoAtual ? "Protocolo ativado." : "Protocolo inativado.");
    } catch (error) {
      console.error(error);
      showError("Erro ao atualizar status do protocolo.");
    }
  };

  const toggleItemAgenda = async (item: ProtocoloSanitarioItem) => {
    if (!activeFarmId) return;
    try {
      await createGesture(activeFarmId, [
        {
          table: "protocolos_sanitarios_itens",
          action: "UPDATE",
          record: {
            id: item.id,
            gera_agenda: !item.gera_agenda,
          },
        },
      ]);
      showSuccess(!item.gera_agenda ? "Item marcado para gerar agenda." : "Item removido da agenda automatica.");
    } catch (error) {
      console.error(error);
      showError("Erro ao atualizar item do protocolo.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Syringe className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Protocolos Sanitarios</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Novo Protocolo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Nome</Label>
            <Input
              value={nomeProtocolo}
              onChange={(e) => setNomeProtocolo(e.target.value)}
              placeholder="Ex.: Vacinacao de bezerras"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descricao</Label>
            <Textarea
              value={descricaoProtocolo}
              onChange={(e) => setDescricaoProtocolo(e.target.value)}
              placeholder="Descricao do protocolo"
            />
          </div>
          <div className="space-y-2">
            <Label>Status inicial</Label>
            <Select
              value={protocoloAtivo ? "ativo" : "inativo"}
              onValueChange={(v) => setProtocoloAtivo(v === "ativo")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={handleCriarProtocolo}>
              <ShieldPlus className="h-4 w-4 mr-2" /> Criar Protocolo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Novo Item Sanitario</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label>Protocolo</Label>
            <Select value={itemProtocoloId} onValueChange={setItemProtocoloId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o protocolo" />
              </SelectTrigger>
              <SelectContent>
                {(protocolos ?? []).map((protocolo) => (
                  <SelectItem key={protocolo.id} value={protocolo.id}>
                    {protocolo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={itemTipo} onValueChange={(v) => setItemTipo(v as SanitarioTipoEnum)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacinacao">Vacinacao</SelectItem>
                <SelectItem value="vermifugacao">Vermifugacao</SelectItem>
                <SelectItem value="medicamento">Medicamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Produto / Vacina</Label>
            <Input
              value={itemProduto}
              onChange={(e) => setItemProduto(e.target.value)}
              placeholder="Nome do produto"
            />
          </div>
          <div className="space-y-2">
            <Label>Periodicidade (dias)</Label>
            <Input
              type="number"
              min={1}
              value={itemIntervaloDias}
              onChange={(e) => setItemIntervaloDias(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Dose</Label>
            <Input
              type="number"
              min={1}
              value={itemDoseNum}
              onChange={(e) => setItemDoseNum(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Sexo alvo</Label>
            <Select value={itemSexoAlvo} onValueChange={(v) => setItemSexoAlvo(v as "todos" | "M" | "F")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="F">Femeas</SelectItem>
                <SelectItem value="M">Machos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Idade minima (dias)</Label>
            <Input
              type="number"
              min={0}
              value={itemIdadeMinDias}
              onChange={(e) => setItemIdadeMinDias(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Idade maxima (dias)</Label>
            <Input
              type="number"
              min={0}
              value={itemIdadeMaxDias}
              onChange={(e) => setItemIdadeMaxDias(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Dedup template</Label>
            <Input
              value={itemDedupTemplate}
              onChange={(e) => setItemDedupTemplate(e.target.value)}
              placeholder="Ex.: vacina:{animal_id}:dose:{dose_num}"
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Indicacao</Label>
            <Textarea
              value={itemIndicacao}
              onChange={(e) => setItemIndicacao(e.target.value)}
              placeholder="Ex.: bezerras de 3 a 8 meses"
            />
          </div>
          <div className="space-y-2">
            <Label>Geracao automatica na agenda</Label>
            <Select
              value={itemGeraAgenda ? "sim" : "nao"}
              onValueChange={(v) => setItemGeraAgenda(v === "sim")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Nao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end md:col-span-2">
            <Button className="w-full" onClick={handleCriarItem}>
              <ShieldPlus className="h-4 w-4 mr-2" /> Criar Item
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {(protocolos ?? []).map((protocolo) => {
          const items = itensByProtocolo.get(protocolo.id) ?? [];

          return (
            <Card key={protocolo.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{protocolo.nome}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {protocolo.descricao || "Sem descricao"} | {items.length} item(ns)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={protocolo.ativo ? "default" : "secondary"}>
                      {protocolo.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleProtocoloAtivo(protocolo.id, protocolo.ativo)}
                    >
                      {protocolo.ativo ? "Inativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem itens neste protocolo.</p>
                ) : (
                  items.map((item) => {
                    const indicacao = readString(item.payload, "indicacao") || "Sem indicacao";
                    const idadeMin = sanitizeInteger(String(item.payload?.idade_minima_dias ?? ""));
                    const idadeMax = sanitizeInteger(String(item.payload?.idade_maxima_dias ?? ""));
                    const sexoAlvo = readString(item.payload, "sexo_alvo");

                    return (
                      <div key={item.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            Dose {item.dose_num ?? 1}: {item.produto}
                          </p>
                          <div className="flex gap-2">
                            <Badge variant="outline">{item.tipo}</Badge>
                            <Badge variant={item.gera_agenda ? "default" : "secondary"}>
                              {item.gera_agenda ? "Gera agenda" : "Manual"}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => toggleItemAgenda(item)}>
                              {item.gera_agenda ? "Desativar agenda" : "Ativar agenda"}
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Periodicidade: {item.intervalo_dias} dia(s) | Sexo: {sexoAlvo || "Todos"} | Idade:{" "}
                          {idadeMin ?? 0} a {idadeMax ?? "sem limite"} dias
                        </p>
                        <p className="text-sm text-muted-foreground">Indicacao: {indicacao}</p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
        {(protocolos ?? []).length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nenhum protocolo encontrado para a fazenda ativa.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProtocolosSanitarios;
