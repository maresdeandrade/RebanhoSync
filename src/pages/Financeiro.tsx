import { useMemo, useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import {
  BadgeDollarSign,
  AlertTriangle,
  Handshake,
  PlusCircle,
  Receipt,
  Search,
  TrendingDown,
  TrendingUp,
  FolderOpen,
} from "lucide-react";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";
import { createGesture } from "@/lib/offline/ops";
import {
  validateFinanceTransaction,
  calculateGerencialSummary,
} from "@/lib/finance/gerencial";
import type {
  FinanceCategoryTipoEnum,
  FinanceCategoryGrupoEnum,
  FinanceTransactionDirectionEnum,
  FinanceTransactionStatusEnum,
  FinanceTransactionCentroCustoTipoEnum,
  FinanceTransactionRateioMetodoEnum,
  FinanceTransaction,
  FinanceCategory,
} from "@/lib/offline/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function toDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FinancialRow {
  id: string;
  tipoOrigem: "gerencial" | "legacy";
  direction: "entrada" | "saida";
  valorTotal: number;
  contraparteNome: string;
  naturezaLabel: string;
  categoriaNome: string;
  centroCustoLabel: string;
  status: string;
  occurredAt: string;
  competenceDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  observacoes: string;
}

const Financeiro = () => {
  const navigate = useNavigate();
  const { activeFarmId } = useAuth();

  // Search & Filtering
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<"all" | "entrada" | "saida">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "previsto" | "realizado" | "cancelado">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [costCenterFilter, setCostCenterFilter] = useState<"all" | "fazenda" | "lote" | "pasto" | "animal">("all");
  const [contraparteFilter, setContraparteFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [txErrors, setTxErrors] = useState<string[]>([]);
  const [catErrors, setCatErrors] = useState<string[]>([]);

  // Form inputs for Transaction
  const [formTxDirection, setFormTxDirection] = useState<FinanceTransactionDirectionEnum>("saida");
  const [formTxCategoryId, setFormTxCategoryId] = useState("");
  const [formTxValorTotal, setFormTxValorTotal] = useState("");
  const [formTxStatus, setFormTxStatus] = useState<FinanceTransactionStatusEnum>("realizado");
  const [formTxOccurredAt, setFormTxOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [formTxCompetenceDate, setFormTxCompetenceDate] = useState("");
  const [formTxDueDate, setFormTxDueDate] = useState("");
  const [formTxContraparteId, setFormTxContraparteId] = useState("");
  const [formTxCentroCustoTipo, setFormTxCentroCustoTipo] = useState<FinanceTransactionCentroCustoTipoEnum>("fazenda");
  const [formTxCentroCustoId, setFormTxCentroCustoId] = useState("");
  const [formTxRateioMetodo, setFormTxRateioMetodo] = useState<FinanceTransactionRateioMetodoEnum>("direto");
  const [formTxQuantidade, setFormTxQuantidade] = useState("");
  const [formTxUnidade, setFormTxUnidade] = useState("");
  const [formTxValorUnitario, setFormTxValorUnitario] = useState("");
  const [formTxObservacoes, setFormTxObservacoes] = useState("");

  // Form inputs for Category
  const [formCatNome, setFormCatNome] = useState("");
  const [formCatTipo, setFormCatTipo] = useState<FinanceCategoryTipoEnum>("custo_variavel");
  const [formCatGrupo, setFormCatGrupo] = useState<FinanceCategoryGrupoEnum>("outros");
  const [formCatObservacoes, setFormCatObservacoes] = useState("");

  // Load Offline Data
  const data = useLiveQuery(async () => {
    if (!activeFarmId) {
      return {
        eventosBase: [],
        detalhes: [],
        contrapartes: [],
        animais: [],
        lotes: [],
        pastos: [],
        categories: [],
        transactions: [],
      };
    }

    const [
      eventosBase,
      detalhes,
      contrapartes,
      animais,
      lotes,
      pastos,
      categories,
      transactions,
    ] = await Promise.all([
      db.event_eventos.where("fazenda_id").equals(activeFarmId).toArray(),
      db.event_eventos_financeiro
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_contrapartes.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_pastos.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_finance_categories
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_finance_transactions
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
    ]);

    return {
      eventosBase: eventosBase.filter(
        (e) => e.dominio === "financeiro" && !e.deleted_at
      ),
      detalhes: detalhes.filter((d) => !d.deleted_at),
      contrapartes: contrapartes.filter((c) => !c.deleted_at),
      animais: animais.filter((a) => !a.deleted_at),
      lotes: lotes.filter((l) => !l.deleted_at),
      pastos: pastos.filter((p) => !p.deleted_at),
      categories: categories.filter((c) => !c.deleted_at),
      transactions: transactions.filter((t) => !t.deleted_at),
    };
  }, [activeFarmId]);

  // Seeding default categories offline if none exist
  useEffect(() => {
    if (!activeFarmId || !data) return;
    const seedCategories = async () => {
      const count = await db.state_finance_categories
        .where("fazenda_id")
        .equals(activeFarmId)
        .count();
      if (count === 0) {
        console.log("[Financeiro] Semeando categorias gerenciais padrão...");
        const defaults = [
          { nome: "Venda de Animais", tipo: "receita", grupo: "venda_animais", slug: "venda-animais" },
          { nome: "Compra de Animais", tipo: "custo_variavel", grupo: "compra_animais", slug: "compra-animais" },
          { nome: "Sanidade/Medicamentos", tipo: "custo_variavel", grupo: "sanidade", slug: "sanidade-medicamentos" },
          { nome: "Nutrição/Alimentos", tipo: "custo_variavel", grupo: "nutricao", slug: "nutricao-alimentos" },
          { nome: "Mão de Obra/Salários", tipo: "custo_fixo", grupo: "mao_obra", slug: "mao-de-obra-salarios" },
          { nome: "Combustível", tipo: "custo_variavel", grupo: "combustivel", slug: "combustivel" },
          { nome: "Manutenção", tipo: "custo_fixo", grupo: "manutencao", slug: "manutencao" },
          { nome: "Arrendamento", tipo: "custo_fixo", grupo: "arrendamento", slug: "arrendamento" },
          { nome: "Infraestrutura", tipo: "investimento", grupo: "infraestrutura", slug: "infraestrutura" },
          { nome: "Reprodução/Sêmen", tipo: "custo_variavel", grupo: "reproducao", slug: "reproducao-semen" },
          { nome: "Administrativo", tipo: "custo_fixo", grupo: "administrativo", slug: "administrativo" },
          { nome: "Outros", tipo: "custo_variavel", grupo: "outros", slug: "outros" },
        ];

        const ops = defaults.map((c) => ({
          table: "finance_categories",
          action: "INSERT" as const,
          record: {
            id: crypto.randomUUID(),
            fazenda_id: activeFarmId,
            nome: c.nome,
            tipo: c.tipo as FinanceCategoryTipoEnum,
            grupo: c.grupo as FinanceCategoryGrupoEnum,
            slug: c.slug,
            is_default: true,
            ativo: true,
            observacoes: "Categoria gerencial padrão semeada localmente.",
          },
        }));

        await createGesture(activeFarmId, ops);
      }
    };
    seedCategories();
  }, [activeFarmId, data]);

  // Combined Rows Mapper
  const rows = useMemo(() => {
    if (!data) return [];

    const categoryMap = new Map(data.categories.map((c) => [c.id, c.nome]));
    const counterpartMap = new Map(data.contrapartes.map((c) => [c.id, c.nome]));
    const animalMap = new Map(data.animais.map((a) => [a.id, a.identificacao]));
    const loteMap = new Map(data.lotes.map((l) => [l.id, l.nome]));
    const pastoMap = new Map(data.pastos.map((p) => [p.id, p.nome]));

    // 1. Map Ledger Gerencial lançamentos
    const gerencialRows: FinancialRow[] = data.transactions.map((tx) => {
      const catNome = categoryMap.get(tx.category_id) || "Sem Categoria";
      const cpNome = tx.contraparte_id
        ? counterpartMap.get(tx.contraparte_id) || "Sem parceiro"
        : "Sem parceiro";
      let ccNome = "Geral Fazenda";
      if (tx.centro_custo_tipo === "animal" && tx.centro_custo_id) {
        ccNome = `Animal: ${animalMap.get(tx.centro_custo_id) || tx.centro_custo_id}`;
      } else if (tx.centro_custo_tipo === "lote" && tx.centro_custo_id) {
        ccNome = `Lote: ${loteMap.get(tx.centro_custo_id) || tx.centro_custo_id}`;
      } else if (tx.centro_custo_tipo === "pasto" && tx.centro_custo_id) {
        ccNome = `Pasto: ${pastoMap.get(tx.centro_custo_id) || tx.centro_custo_id}`;
      }

      return {
        id: tx.id,
        tipoOrigem: "gerencial" as const,
        direction: tx.direction,
        valorTotal: Number(tx.valor_total),
        contraparteNome: cpNome,
        naturezaLabel:
          tx.direction === "entrada"
            ? "Receita Gerencial"
            : "Despesa Gerencial",
        categoriaNome: catNome,
        centroCustoLabel: ccNome,
        status: tx.status,
        occurredAt: tx.occurred_at,
        competenceDate: tx.competence_date,
        dueDate: tx.due_date,
        paidAt: tx.paid_at,
        observacoes: tx.observacoes || "",
      };
    });

    // 2. Map Legacy zootecnico purchases and sales
    const legacyRows = data.detalhes
      .map((detalhe) => {
        const evento = data.eventosBase.find((e) => e.id === detalhe.evento_id);
        if (!evento) return null;

        const cpNome = detalhe.contraparte_id
          ? counterpartMap.get(detalhe.contraparte_id) || "Sem parceiro"
          : "Sem parceiro";
        const animalNome = evento.animal_id
          ? animalMap.get(evento.animal_id) || "Sem animal"
          : "Sem animal";
        const loteNome = evento.lote_id
          ? loteMap.get(evento.lote_id) || "Sem lote"
          : "Sem lote";

        const payloadKind =
          evento.payload && typeof evento.payload.kind === "string"
            ? evento.payload.kind
            : "";
        let naturezaLabel =
          detalhe.tipo === "compra" ? "Compra Zootécnica" : "Venda Zootécnica";
        if (payloadKind.startsWith("sociedade_")) {
          naturezaLabel =
            payloadKind === "sociedade_entrada"
              ? "Sociedade (Entrada)"
              : "Sociedade (Saída)";
        }

        return {
          id: detalhe.evento_id,
          tipoOrigem: "legacy" as const,
          direction:
            detalhe.tipo === "compra"
              ? ("saida" as const)
              : ("entrada" as const),
          valorTotal: Number(detalhe.valor_total),
          contraparteNome: cpNome,
          naturezaLabel,
          categoriaNome:
            detalhe.tipo === "compra" ? "Compra de Animais" : "Venda de Animais",
          centroCustoLabel:
            animalNome !== "Sem animal"
              ? `Animal: ${animalNome}`
              : `Lote: ${loteNome}`,
          status: "realizado" as const,
          occurredAt: evento.occurred_at,
          competenceDate: null,
          dueDate: null,
          paidAt: evento.occurred_at,
          observacoes: evento.observacoes || "",
        };
      })
      .filter(Boolean) as FinancialRow[];

    const allRows = [...gerencialRows, ...legacyRows];

    // Apply Filter Criteria
    const searchLower = search.trim().toLowerCase();
    return allRows
      .filter((row) => {
        const matchesSearch =
          !searchLower ||
          row.contraparteNome.toLowerCase().includes(searchLower) ||
          row.categoriaNome.toLowerCase().includes(searchLower) ||
          row.centroCustoLabel.toLowerCase().includes(searchLower) ||
          row.observacoes.toLowerCase().includes(searchLower);

        const matchesDirection =
          tipoFilter === "all" ||
          (tipoFilter === "entrada" && row.direction === "entrada") ||
          (tipoFilter === "saida" && row.direction === "saida");

        const matchesStatus =
          statusFilter === "all" || row.status === statusFilter;

        const matchesCategory =
          categoryFilter === "all" || row.categoriaNome === categoryFilter;

        const matchesCostCenter =
          costCenterFilter === "all" ||
          (costCenterFilter === "fazenda" &&
            row.centroCustoLabel === "Geral Fazenda") ||
          (costCenterFilter === "lote" &&
            row.centroCustoLabel.startsWith("Lote:")) ||
          (costCenterFilter === "pasto" &&
            row.centroCustoLabel.startsWith("Pasto:")) ||
          (costCenterFilter === "animal" &&
            row.centroCustoLabel.startsWith("Animal:"));

        const matchesCounterpart =
          contraparteFilter === "all" ||
          row.contraparteNome === contraparteFilter;

        const rowDate = row.occurredAt.slice(0, 10);
        const matchesDate =
          (!dateFrom || rowDate >= dateFrom) && (!dateTo || rowDate <= dateTo);

        return (
          matchesSearch &&
          matchesDirection &&
          matchesStatus &&
          matchesCategory &&
          matchesCostCenter &&
          matchesCounterpart &&
          matchesDate
        );
      })
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [
    data,
    search,
    tipoFilter,
    statusFilter,
    categoryFilter,
    costCenterFilter,
    contraparteFilter,
    dateFrom,
    dateTo,
  ]);

  // Aggregate ledger gerencial summaries (Excludes legacy zootecnico values to prevent duplication)
  const summary = useMemo(() => {
    if (!data) {
      return {
        entradasRealizadas: 0,
        saidasRealizadas: 0,
        saldoRealizado: 0,
        previstosAPagar: 0,
        previstosAReceber: 0,
      };
    }
    return calculateGerencialSummary(data.transactions);
  }, [data]);

  // Selections mapping
  const activeFarmCategories = useMemo(() => {
    return data?.categories.filter((c) => c.ativo) ?? [];
  }, [data?.categories]);

  const allCategoryNames = useMemo(() => {
    const names = new Set(rows.map((r) => r.categoriaNome));
    return Array.from(names);
  }, [rows]);

  const allCounterpartNames = useMemo(() => {
    const names = new Set(rows.map((r) => r.contraparteNome));
    return Array.from(names);
  }, [rows]);

  // Save Transaction
  const handleSaveTx = async () => {
    if (!activeFarmId) return;
    setTxErrors([]);

    const valorNum = parseFloat(formTxValorTotal);
    const qtyNum = formTxQuantidade ? parseFloat(formTxQuantidade) : null;
    const unitPriceNum = formTxValorUnitario ? parseFloat(formTxValorUnitario) : null;

    const payload: Partial<FinanceTransaction> = {
      fazenda_id: activeFarmId,
      direction: formTxDirection,
      category_id: formTxCategoryId,
      valor_total: isNaN(valorNum) ? 0 : valorNum,
      status: formTxStatus,
      occurred_at: new Date(formTxOccurredAt).toISOString(),
      competence_date: formTxCompetenceDate || null,
      due_date: formTxDueDate || null,
      paid_at: formTxStatus === "realizado" ? new Date(formTxOccurredAt).toISOString() : null,
      contraparte_id: formTxContraparteId === "none_val" ? null : formTxContraparteId || null,
      centro_custo_tipo: formTxCentroCustoTipo,
      centro_custo_id: formTxCentroCustoTipo === "fazenda" ? null : formTxCentroCustoId || null,
      rateio_metodo: formTxRateioMetodo,
      quantidade: qtyNum,
      unidade: formTxUnidade || null,
      valor_unitario: unitPriceNum,
      origem: "manual",
      observacoes: formTxObservacoes || null,
    };

    const issues = validateFinanceTransaction(payload);
    if (issues.length > 0) {
      setTxErrors(issues);
      return;
    }

    const txId = crypto.randomUUID();
    const op = {
      table: "finance_transactions",
      action: "INSERT" as const,
      record: {
        id: txId,
        ...payload,
      },
    };

    try {
      await createGesture(activeFarmId, [op]);
      setIsTxModalOpen(false);
      // Reset Form
      setFormTxValorTotal("");
      setFormTxQuantidade("");
      setFormTxUnidade("");
      setFormTxValorUnitario("");
      setFormTxObservacoes("");
      setFormTxContraparteId("");
      setFormTxCentroCustoId("");
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setTxErrors([errMsg || "Erro desconhecido ao salvar transação."]);
    }
  };

  // Save Category
  const handleSaveCat = async () => {
    if (!activeFarmId) return;
    setCatErrors([]);

    if (!formCatNome.trim()) {
      setCatErrors(["Nome da categoria é obrigatório."]);
      return;
    }

    const slug = formCatNome
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const catId = crypto.randomUUID();
    const op = {
      table: "finance_categories",
      action: "INSERT" as const,
      record: {
        id: catId,
        fazenda_id: activeFarmId,
        nome: formCatNome.trim(),
        tipo: formCatTipo,
        grupo: formCatGrupo,
        slug,
        is_default: false,
        ativo: true,
        observacoes: formCatObservacoes || null,
      },
    };

    try {
      await createGesture(activeFarmId, [op]);
      setIsCatModalOpen(false);
      // Reset Form
      setFormCatNome("");
      setFormCatObservacoes("");
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setCatErrors([errMsg || "Erro desconhecido ao salvar categoria."]);
    }
  };

  return (
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        eyebrow="Ledger Gerencial Administrativo"
        title="Lançamentos Financeiros Gerenciais"
        meta={
          <StatusBadge tone="neutral">{rows.length} lançamento(s)</StatusBadge>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIsCatModalOpen(true)}>
              <FolderOpen className="h-4 w-4" />
              Nova categoria
            </Button>
            <Button onClick={() => setIsTxModalOpen(true)}>
              <PlusCircle className="h-4 w-4" />
              Novo lançamento
            </Button>
          </div>
        }
      />

      {/* Authorized simple indicators box */}
      <div className="grid gap-3 md:grid-cols-5">
        <Card className="border-border/70 shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-xs font-medium uppercase text-muted-foreground">
              <span>Entradas Realizadas</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </p>
            <p className="text-xl font-semibold tracking-tight text-emerald-600">
              {money.format(summary.entradasRealizadas)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-xs font-medium uppercase text-muted-foreground">
              <span>Saídas Realizadas</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </p>
            <p className="text-xl font-semibold tracking-tight text-red-600">
              {money.format(summary.saidasRealizadas)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-xs font-medium uppercase text-muted-foreground">
              <span>Saldo de Caixa Realizado</span>
              <BadgeDollarSign className="h-4 w-4 text-primary" />
            </p>
            <p
              className={`text-xl font-semibold tracking-tight ${
                summary.saldoRealizado >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {money.format(summary.saldoRealizado)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-xs font-medium uppercase text-muted-foreground">
              <span>Previstos a Receber</span>
              <span className="text-emerald-500 font-bold text-xs">+</span>
            </p>
            <p className="text-xl font-semibold tracking-tight text-muted-foreground">
              {money.format(summary.previstosAReceber)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-xs font-medium uppercase text-muted-foreground">
              <span>Previstos a Pagar</span>
              <span className="text-red-500 font-bold text-xs">-</span>
            </p>
            <p className="text-xl font-semibold tracking-tight text-muted-foreground">
              {money.format(summary.previstosAPagar)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filtering Toolbar */}
      <Toolbar className="bg-muted/20 shadow-none flex-wrap gap-y-3 p-4 rounded-xl border border-border/50">
        <ToolbarGroup className="flex-1 flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar por parceiro, observações..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select
            value={tipoFilter}
            onValueChange={(value) => setTipoFilter(value as "all" | "entrada" | "saida")}
          >
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue placeholder="Direção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Direções</SelectItem>
              <SelectItem value="entrada">Receita</SelectItem>
              <SelectItem value="saida">Despesa</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "all" | "previsto" | "realizado" | "cancelado")}
          >
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="realizado">Realizado</SelectItem>
              <SelectItem value="previsto">Previsto</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={setCategoryFilter}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {allCategoryNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={costCenterFilter}
            onValueChange={(value) => setCostCenterFilter(value as "all" | "fazenda" | "lote" | "pasto" | "animal")}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Centro Custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Centros</SelectItem>
              <SelectItem value="fazenda">Geral Fazenda</SelectItem>
              <SelectItem value="lote">Lotes</SelectItem>
              <SelectItem value="pasto">Pastos</SelectItem>
              <SelectItem value="animal">Animais</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={contraparteFilter}
            onValueChange={setContraparteFilter}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Parceiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Parceiros</SelectItem>
              {allCounterpartNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ToolbarGroup>

        <ToolbarGroup className="gap-2">
          <Input
            type="date"
            aria-label="Data inicial"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full sm:w-[140px]"
          />
          <Input
            type="date"
            aria-label="Data final"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full sm:w-[140px]"
          />
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setTipoFilter("all");
              setStatusFilter("all");
              setCategoryFilter("all");
              setCostCenterFilter("all");
              setContraparteFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpar Filtros
          </Button>
        </ToolbarGroup>
      </Toolbar>

      {/* Ledger Entries List */}
      {rows.length === 0 ? (
        <Card className="shadow-none border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground">
            <Receipt className="mx-auto mb-4 h-12 w-12 text-muted-foreground/60" />
            <p className="font-medium text-base text-foreground">Sem lançamentos gerenciais no filtro atual</p>
            <p className="text-sm mt-1">Crie despesas e receitas usando o botão "Novo lançamento" acima.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-border bg-background/95 p-4 shadow-sm transition-all hover:border-primary/30"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground text-sm sm:text-base">
                      {row.contraparteNome}
                    </p>
                    <Badge
                      className={
                        row.tipoOrigem === "legacy"
                          ? "border-amber-200 bg-amber-50 text-amber-700 font-medium"
                          : row.direction === "entrada"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-medium"
                            : "border-red-200 bg-red-50 text-red-700 font-medium"
                      }
                      variant="outline"
                    >
                      {row.naturezaLabel}
                    </Badge>

                    {row.status === "previsto" && (
                      <Badge variant="secondary" className="border-blue-200 bg-blue-50 text-blue-700">
                        Previsto
                      </Badge>
                    )}
                    {row.status === "cancelado" && (
                      <Badge variant="destructive" className="bg-red-100 text-red-800 line-through">
                        Cancelado
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-muted-foreground font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{row.categoriaNome}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span>{row.centroCustoLabel}</span>
                  </p>

                  {row.observacoes ? (
                    <p className="text-xs text-muted-foreground italic bg-muted/40 p-2 rounded-md max-w-xl">
                      {row.observacoes}
                    </p>
                  ) : null}
                </div>

                <div className="sm:text-right shrink-0">
                  <p
                    className={`text-base sm:text-lg font-bold tracking-tight ${
                      row.status === "cancelado"
                        ? "text-muted-foreground line-through"
                        : row.direction === "entrada"
                          ? "text-emerald-600"
                          : "text-red-600"
                    }`}
                  >
                    {row.direction === "entrada" ? "+" : "-"} {money.format(row.valorTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {toDateTime(row.occurredAt)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal - Novo Lançamento Gerencial */}
      <Dialog open={isTxModalOpen} onOpenChange={setIsTxModalOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Novo Lançamento Financeiro Gerencial</DialogTitle>
          </DialogHeader>

          {txErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
              <p className="font-semibold">Corrija as inconsistências:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {txErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Direção *</label>
                <Select
                  value={formTxDirection}
                  onValueChange={(val) => setFormTxDirection(val as FinanceTransactionDirectionEnum)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saida">Despesa (Saída)</SelectItem>
                    <SelectItem value="entrada">Receita (Entrada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Status *</label>
                <Select
                  value={formTxStatus}
                  onValueChange={(val) => setFormTxStatus(val as FinanceTransactionStatusEnum)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="previsto">Previsto</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Categoria *</label>
                <Select
                  value={formTxCategoryId}
                  onValueChange={setFormTxCategoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeFarmCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} ({c.tipo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Valor Total (R$) *</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={formTxValorTotal}
                  onChange={(e) => setFormTxValorTotal(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Data Registro *</label>
                <Input
                  type="date"
                  value={formTxOccurredAt}
                  onChange={(e) => setFormTxOccurredAt(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Data Competência</label>
                <Input
                  type="date"
                  value={formTxCompetenceDate}
                  onChange={(e) => setFormTxCompetenceDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Data Vencimento</label>
                <Input
                  type="date"
                  value={formTxDueDate}
                  onChange={(e) => setFormTxDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Parceiro (Contraparte)</label>
                <Select
                  value={formTxContraparteId}
                  onValueChange={setFormTxContraparteId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none_val">Nenhum</SelectItem>
                    {data?.contrapartes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Método de Rateio</label>
                <Select
                  value={formTxRateioMetodo}
                  onValueChange={(val) => setFormTxRateioMetodo(val as FinanceTransactionRateioMetodoEnum)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direto">Direto (Sem rateio)</SelectItem>
                    <SelectItem value="por_cabeca">Por Cabeça (Futuro)</SelectItem>
                    <SelectItem value="por_peso_vivo">Por Peso Vivo (Futuro)</SelectItem>
                    <SelectItem value="por_dias">Por Dias no Pasto (Futuro)</SelectItem>
                    <SelectItem value="por_area">Por Área (Futuro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Centro de Custo Tipo</label>
                <Select
                  value={formTxCentroCustoTipo}
                  onValueChange={(val) => {
                    setFormTxCentroCustoTipo(val as FinanceTransactionCentroCustoTipoEnum);
                    setFormTxCentroCustoId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fazenda">Geral Fazenda</SelectItem>
                    <SelectItem value="lote">Especificar Lote</SelectItem>
                    <SelectItem value="pasto">Especificar Pasto</SelectItem>
                    <SelectItem value="animal">Especificar Animal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formTxCentroCustoTipo !== "fazenda" && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Especificar Alvo CC</label>
                  <Select
                    value={formTxCentroCustoId}
                    onValueChange={setFormTxCentroCustoId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {formTxCentroCustoTipo === "lote" &&
                        data?.lotes.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            Lote: {l.nome}
                          </SelectItem>
                        ))}
                      {formTxCentroCustoTipo === "pasto" &&
                        data?.pastos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            Pasto: {p.nome}
                          </SelectItem>
                        ))}
                      {formTxCentroCustoTipo === "animal" &&
                        data?.animais.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            Brinco: {a.identificacao}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 border-t pt-2 mt-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Quantidade</label>
                <Input
                  type="number"
                  placeholder="ex: 10"
                  value={formTxQuantidade}
                  onChange={(e) => setFormTxQuantidade(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Unidade</label>
                <Input
                  type="text"
                  placeholder="ex: kg, cabeças"
                  value={formTxUnidade}
                  onChange={(e) => setFormTxUnidade(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Valor Unitário</label>
                <Input
                  type="number"
                  placeholder="0.0000"
                  step="0.0001"
                  value={formTxValorUnitario}
                  onChange={(e) => setFormTxValorUnitario(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Observações</label>
              <Input
                type="text"
                placeholder="Detalhes administrativos..."
                value={formTxObservacoes}
                onChange={(e) => setFormTxObservacoes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTxModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTx}>Salvar Lançamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal - Nova Categoria Gerencial */}
      <Dialog open={isCatModalOpen} onOpenChange={setIsCatModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Categoria Financeira Gerencial</DialogTitle>
          </DialogHeader>

          {catErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {catErrors[0]}
            </div>
          )}

          <div className="grid gap-4 py-2 text-sm">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Nome da Categoria *</label>
              <Input
                placeholder="ex: Diesel Trator, Suplementação"
                value={formCatNome}
                onChange={(e) => setFormCatNome(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Tipo de Categoria *</label>
              <Select
                value={formCatTipo}
                onValueChange={(val) => setFormCatTipo(val as FinanceCategoryTipoEnum)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="custo_variavel">Custo Variável</SelectItem>
                  <SelectItem value="custo_fixo">Custo Fixo</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Grupo Contábil *</label>
              <Select
                value={formCatGrupo}
                onValueChange={(val) => setFormCatGrupo(val as FinanceCategoryGrupoEnum)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda_animais">Venda de Animais</SelectItem>
                  <SelectItem value="compra_animais">Compra de Animais</SelectItem>
                  <SelectItem value="sanidade">Sanidade (Medicação/Vacina)</SelectItem>
                  <SelectItem value="nutricao">Nutrição (Sal/Ração)</SelectItem>
                  <SelectItem value="mao_obra">Mão de Obra e Salários</SelectItem>
                  <SelectItem value="combustivel">Combustível</SelectItem>
                  <SelectItem value="manutencao">Manutenção e Peças</SelectItem>
                  <SelectItem value="arrendamento">Arrendamento de Pastagem</SelectItem>
                  <SelectItem value="infraestrutura">Investimento Infraestrutura</SelectItem>
                  <SelectItem value="reproducao">Reprodução / Sêmen</SelectItem>
                  <SelectItem value="administrativo">Administrativo Escritório</SelectItem>
                  <SelectItem value="outros">Outros Lançamentos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Observações</label>
              <Input
                placeholder="Descrição adicional..."
                value={formCatObservacoes}
                onChange={(e) => setFormCatObservacoes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCatModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCat}>Salvar Categoria</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financeiro;
