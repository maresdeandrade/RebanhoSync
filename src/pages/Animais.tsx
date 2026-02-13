import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ChevronRight, FilterX, PawPrint } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLotes } from "@/hooks/useLotes";
import { EmptyState } from "@/components/EmptyState";
import { calcularStatusReprodutivo, StatusReprodutivo } from "@/lib/domain/reproducao";
import { classificarAnimal } from "@/lib/domain/categorias";
import { Animal, CategoriaZootecnica } from "@/lib/offline/types";

const Animais = () => {
  const navigate = useNavigate();
  const fazendaId = localStorage.getItem("gestao_agro_active_fazenda_id");
  const [search, setSearch] = useState("");
  const [loteFilter, setLoteFilter] = useState<string>("all");
  const [sexoFilter, setSexoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reproStatusFilter, setReproStatusFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all"); // Added Category Filter

  // P1.2 FIX: Debounce search to avoid query on every keystroke
  const debouncedSearch = useDebouncedValue(search, 300);

  // P2.4 FIX: Use centralized useLotes hook
  const lotes = useLotes();

  // P1.1 FIX: Pre-compute Map for O(n) lookup instead of O(n²)
  const lotesMap = useMemo(
    () => new Map(lotes?.map((l) => [l.id, l])),
    [lotes],
  );

  // Carregar Categorias para classificação e filtro
  const categorias = useLiveQuery(async () => {
    if (!fazendaId) return [];
    const list = await db.state_categorias_zootecnicas
      .where("fazenda_id")
      .equals(fazendaId)
      .filter((c) => !c.deleted_at)
      .toArray();

     // Ordenação (copiada de Categorias.tsx/categorias.ts)
    return list.sort((a, b) => {
        if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
        const orderA = (a.payload as any)?.order ?? 9999;
        const orderB = (b.payload as any)?.order ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        const minA = a.idade_min_dias ?? 0;
        const minB = b.idade_min_dias ?? 0;
        return minA - minB;
    });
  }, [fazendaId]);

  // Função para calcular idade
  const calcularIdade = (
    dataNascimento: string | null | undefined,
  ): string | null => {
    if (!dataNascimento) return null;
    const hoje = new Date();
    const nasc = new Date(dataNascimento);
    const diffTime = hoje.getTime() - nasc.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const meses = Math.floor(diffDays / 30);
    const anos = Math.floor(meses / 12);

    if (anos > 0) return `${anos} ano${anos > 1 ? "s" : ""}`;
    if (meses > 0) return `${meses} mes${meses !== 1 ? "es" : ""}`;
    return `${diffDays} dia${diffDays !== 1 ? "s" : ""}`;
  };

  const animaisData = useLiveQuery(async () => {
    if (!fazendaId) return [];

    // Buscar animais
    let collection = db.state_animais
      .where("fazenda_id")
      .equals(fazendaId);

    let results = await collection.toArray();
    results = results.filter(a => !a.deleted_at);

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      results = results.filter((a) =>
        a.identificacao?.toLowerCase().includes(searchLower),
      );
    }

    // Filtro por lote
    if (loteFilter === "none") {
      results = results.filter((a) => !a.lote_id);
    } else if (loteFilter !== "all") {
      results = results.filter((a) => a.lote_id === loteFilter);
    }

    // Filtro por sexo
    if (sexoFilter !== "all") {
      results = results.filter((a) => a.sexo === sexoFilter);
    }

    // Filtro por status
    if (statusFilter !== "all") {
      results = results.filter((a) => a.status === statusFilter);
    }

    // Calcular Status Reprodutivo e Categoria Zootécnica para cada animal

    const animalIds = new Set(results.map(a => a.id));

    // Buscar eventos de reprodução
    const eventosReproBase = await db.event_eventos
      .where("fazenda_id")
      .equals(fazendaId)
      .filter(e => e.dominio === 'reproducao' && !e.deleted_at && animalIds.has(e.animal_id || ''))
      .toArray();

    const eventoIds = new Set(eventosReproBase.map(e => e.id)); // Otimização Set

    // Buscar detalhes (Otimizado com Set)
    const detalhesRepro = await db.event_eventos_reproducao
      .where("fazenda_id")
      .equals(fazendaId)
      .filter(d => !d.deleted_at && eventoIds.has(d.evento_id)) // O(1) lookup
      .toArray();

    const detalhesMap = new Map(detalhesRepro.map(d => [d.evento_id, d]));

    const eventosComDetalhes = eventosReproBase.map(e => ({
        ...e,
        details_reproducao: detalhesMap.get(e.id)
    }));

    // Agrupar eventos por animal
    const eventosPorAnimal = new Map<string, typeof eventosComDetalhes>();
    for (const evt of eventosComDetalhes) {
        if (!evt.animal_id) continue;
        const list = eventosPorAnimal.get(evt.animal_id) || [];
        list.push(evt);
        eventosPorAnimal.set(evt.animal_id, list);
    }

    // Buscar agenda para desmame pendente
    const agendaItens = await db.state_agenda_itens
        .where("fazenda_id")
        .equals(fazendaId)
        .filter(i => !i.deleted_at && i.status === 'agendado' && animalIds.has(i.animal_id || ''))
        .toArray();

    const agendaPorAnimal = new Map<string, typeof agendaItens>();
    for (const item of agendaItens) {
        if (!item.animal_id) continue;
        const list = agendaPorAnimal.get(item.animal_id) || [];
        list.push(item);
        agendaPorAnimal.set(item.animal_id, list);
    }

    // Enriquecer animais
    const animaisEnriquecidos = results.map(animal => {
        const cat = categorias ? classificarAnimal(animal, categorias) : null;
        const statusRepro = calcularStatusReprodutivo(
            animal,
            eventosPorAnimal.get(animal.id) || [],
            agendaPorAnimal.get(animal.id) || []
        );
        return {
            ...animal,
            categoria_nome: cat?.nome,
            status_reprodutivo: statusRepro
        };
    });

    // Filtrar por status reprodutivo
    let filtered = animaisEnriquecidos;
    if (reproStatusFilter !== "all") {
        filtered = filtered.filter(a => a.status_reprodutivo === reproStatusFilter);
    }

    // Filtrar por categoria zootécnica
    if (categoriaFilter !== "all") {
        filtered = filtered.filter(a => a.categoria_nome === categoriaFilter);
    }

    return filtered;
  }, [debouncedSearch, loteFilter, sexoFilter, statusFilter, reproStatusFilter, categoriaFilter, fazendaId, categorias]);

  const hasFilters =
    search ||
    loteFilter !== "all" ||
    sexoFilter !== "all" ||
    statusFilter !== "all" ||
    reproStatusFilter !== "all" ||
    categoriaFilter !== "all";

  // Show empty state if no animals and no filters
  if (!animaisData || (animaisData.length === 0 && !hasFilters)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Animais</h1>
          <Link to="/animais/novo">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" /> Novo
            </Button>
          </Link>
        </div>
        <EmptyState
          icon={PawPrint}
          title="Nenhum animal cadastrado"
          description="Comece cadastrando os primeiros animais da sua fazenda para acompanhar seu rebanho."
          action={{
            label: "Cadastrar Primeiro Animal",
            onClick: () => navigate("/animais/novo"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Animais</h1>
        <Link to="/animais/novo">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
            <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Buscar por identificação..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            </div>
             {hasFilters && (
                <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                    setSearch("");
                    setLoteFilter("all");
                    setSexoFilter("all");
                    setStatusFilter("all");
                    setReproStatusFilter("all");
                    setCategoriaFilter("all");
                }}
                >
                <FilterX className="h-4 w-4" />
                </Button>
            )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {/* Category Filter */}
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categ.</SelectItem>
              {categorias?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.nome}>
                      {cat.nome}
                  </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={loteFilter} onValueChange={setLoteFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Lote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Lotes</SelectItem>
              <SelectItem value="none">Sem Lote</SelectItem>
              {lotes?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sexoFilter} onValueChange={setSexoFilter}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Sexo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ambos</SelectItem>
              <SelectItem value="M">Macho</SelectItem>
              <SelectItem value="F">Fêmea</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="vendido">Vendido</SelectItem>
              <SelectItem value="morto">Morto</SelectItem>
            </SelectContent>
          </Select>

          <Select value={reproStatusFilter} onValueChange={setReproStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Reprodutivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Repro.</SelectItem>
              <SelectItem value="VAZIA">Vazia</SelectItem>
              <SelectItem value="SERVIDA">Servida</SelectItem>
              <SelectItem value="PRENHA">Prenha</SelectItem>
              <SelectItem value="PARIDA">Parida</SelectItem>
              <SelectItem value="LACTANTE">Lactante</SelectItem>
              <SelectItem value="REPETIDORA">Repetidora</SelectItem>
              <SelectItem value="DESMAME_PENDENTE">Desmame Pend.</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Categoria / Idade</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Status Reprodutivo</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {animaisData?.map((animal) => (
                <TableRow
                  key={animal.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <TableCell>
                     <div className="font-bold">{animal.identificacao}</div>
                     <div className="text-xs text-muted-foreground">{animal.sexo === 'M' ? 'Macho' : 'Fêmea'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{animal.categoria_nome || "-"}</div>
                    <span className="text-xs text-muted-foreground">
                      {calcularIdade(animal.data_nascimento) || "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {animal.lote_id ? (
                      <Badge variant="secondary" className="font-normal">
                        {lotesMap.get(animal.lote_id)?.nome || "..."}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">
                        Sem lote
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {animal.sexo === 'F' && animal.status_reprodutivo !== 'VAZIA' ? (
                        <Badge variant={
                            animal.status_reprodutivo === 'PRENHA' ? 'default' :
                            animal.status_reprodutivo === 'PARIDA' ? 'destructive' : // Destaque para atenção
                            'secondary'
                        }>
                            {animal.status_reprodutivo}
                        </Badge>
                    ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/animais/${animal.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {animaisData?.length === 0 && hasFilters && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Nenhum animal encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default Animais;
