import { useMemo, useState } from "react";
import { type Collection } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  ChevronRight,
  FilterX,
  PawPrint,
  Upload,
  CornerDownRight,
} from "lucide-react";
import { AnimalCategoryBadge } from "@/components/animals/AnimalCategoryBadge";
import { AnimalKinshipBadges } from "@/components/animals/AnimalKinshipBadges";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  getPendingAnimalLifecycleTransitions,
  resolveAnimalLifecycleSnapshot,
} from "@/lib/animals/lifecycle";
import {
  buildAnimalTaxonomyReproContextMap,
  deriveAnimalTaxonomy,
} from "@/lib/animals/taxonomy";
import { buildAnimalFamilyRows } from "@/lib/animals/familyOrder";
import { db } from "@/lib/offline/db";
import { type Animal } from "@/lib/offline/types";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLotes } from "@/hooks/useLotes";
import { cn } from "@/lib/utils";
import { getReproductionEventsJoined } from "@/lib/reproduction/selectors";

const CATEGORY_FILTERS = [
  { value: "all", label: "Todas categorias" },
  { value: "bezerra", label: "Bezerra" },
  { value: "novilha", label: "Novilha" },
  { value: "vaca", label: "Vaca" },
  { value: "bezerro", label: "Bezerro" },
  { value: "garrote", label: "Garrote" },
  { value: "boi_terminacao", label: "Boi" },
  { value: "touro", label: "Touro" },
] as const;

const VETERINARY_PHASE_FILTERS = [
  { value: "all", label: "Todas fases" },
  { value: "neonatal", label: "Neonatal" },
  { value: "pre_desmama", label: "Pré-desmama" },
  { value: "pos_desmama", label: "Pós-desmama" },
  { value: "pre_pubere", label: "Pré-púbere" },
  { value: "pubere", label: "Púbere" },
  { value: "gestante", label: "Gestante" },
  { value: "puerperio", label: "Puerpério" },
] as const;

const PRODUCTIVE_STATE_FILTERS = [
  { value: "all", label: "Todos estados" },
  { value: "vazia", label: "Vazia" },
  { value: "prenhe", label: "Prenhe" },
  { value: "pre_parto_imediato", label: "Amojando" },
  { value: "seca", label: "Seca" },
  { value: "recem_parida", label: "Vaca parida" },
  { value: "lactacao", label: "Vaca em lactação" },
  { value: "inteiro", label: "Inteiro" },
  { value: "castrado", label: "Castrado" },
  { value: "reprodutor", label: "Reprodutor" },
  { value: "terminacao", label: "Terminação" },
] as const;

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

const Animais = () => {
  const navigate = useNavigate();
  const { activeFarmId, farmLifecycleConfig } = useAuth();
  const [search, setSearch] = useState("");
  const [loteFilter, setLoteFilter] = useState<string>("all");
  const [sexoFilter, setSexoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("ativo");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [productiveStateFilter, setProductiveStateFilter] =
    useState<string>("all");
  const debouncedSearch = useDebouncedValue(search, 300);
  const lotes = useLotes();
  const animaisFamilia = useLiveQuery(async () => {
    let collection: Collection<Animal, string>;

    if (activeFarmId) {
      collection = db.state_animais.where("fazenda_id").equals(activeFarmId);
    } else {
      collection = db.state_animais.toCollection();
    }

    return await collection.filter((animal) => !animal.deleted_at).toArray();
  }, [activeFarmId]);
  const reproductionEvents = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return await getReproductionEventsJoined(activeFarmId);
  }, [activeFarmId]);

  const lotesMap = useMemo(
    () => new Map((lotes ?? []).map((lote) => [lote.id, lote])),
    [lotes],
  );
  const animaisMap = useMemo(
    () => new Map((animaisFamilia ?? []).map((animal) => [animal.id, animal])),
    [animaisFamilia],
  );
  const calvesByMother = useMemo(() => {
    const map = new Map<string, Animal[]>();

    for (const animal of animaisFamilia ?? []) {
      if (!animal.mae_id) continue;
      const current = map.get(animal.mae_id) ?? [];
      current.push(animal);
      map.set(animal.mae_id, current);
    }

    return map;
  }, [animaisFamilia]);

  const animais = useLiveQuery(async () => {
    let collection: Collection<Animal, string>;

    if (activeFarmId) {
      if (loteFilter !== "all" && loteFilter !== "none") {
        collection = db.state_animais
          .where("[fazenda_id+lote_id]")
          .equals([activeFarmId, loteFilter]);
      } else {
        collection = db.state_animais.where("fazenda_id").equals(activeFarmId);
      }
    } else if (loteFilter !== "all" && loteFilter !== "none") {
      collection = db.state_animais.where("lote_id").equals(loteFilter);
    } else {
      collection = db.state_animais.toCollection();
    }

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      collection = collection.filter((animal) =>
        animal.identificacao?.toLowerCase().includes(searchLower),
      );
    }

    if (loteFilter === "none") {
      collection = collection.filter((animal) => !animal.lote_id);
    }
    if (sexoFilter !== "all") {
      collection = collection.filter((animal) => animal.sexo === sexoFilter);
    }
    if (statusFilter !== "all") {
      collection = collection.filter((animal) => animal.status === statusFilter);
    }

    return await collection.toArray();
  }, [activeFarmId, debouncedSearch, loteFilter, sexoFilter, statusFilter]);
  const taxonomyByAnimal = useMemo(() => {
    const reproContextMap = buildAnimalTaxonomyReproContextMap(
      reproductionEvents ?? [],
    );

    return new Map(
      (animaisFamilia ?? []).map((animal) => [
        animal.id,
        deriveAnimalTaxonomy(animal, {
          config: farmLifecycleConfig,
          reproContext: reproContextMap.get(animal.id) ?? null,
        }),
      ]),
    );
  }, [animaisFamilia, farmLifecycleConfig, reproductionEvents]);
  const filteredAnimals = useMemo(() => {
    return (animais ?? []).filter((animal) => {
      const taxonomy = taxonomyByAnimal.get(animal.id);
      if (!taxonomy) return true;
      if (
        categoryFilter !== "all" &&
        taxonomy.categoria_zootecnica !== categoryFilter
      ) {
        return false;
      }
      if (
        phaseFilter !== "all" &&
        taxonomy.fase_veterinaria !== phaseFilter
      ) {
        return false;
      }
      if (
        productiveStateFilter !== "all" &&
        taxonomy.estado_produtivo_reprodutivo !== productiveStateFilter
      ) {
        return false;
      }
      return true;
    });
  }, [animais, categoryFilter, phaseFilter, productiveStateFilter, taxonomyByAnimal]);
  const animalRows = useMemo(() => {
    return buildAnimalFamilyRows(filteredAnimals, animaisFamilia ?? []);
  }, [filteredAnimals, animaisFamilia]);
  const lifecyclePendings = useMemo(() => {
    const queue = getPendingAnimalLifecycleTransitions(
      animaisFamilia ?? [],
      farmLifecycleConfig,
    );
    return new Map(queue.map((item) => [item.animalId, item]));
  }, [animaisFamilia, farmLifecycleConfig]);

  const hasFilters =
    search ||
    loteFilter !== "all" ||
    sexoFilter !== "all" ||
    statusFilter !== "ativo" ||
    categoryFilter !== "all" ||
    phaseFilter !== "all" ||
    productiveStateFilter !== "all";
  const lifecyclePendingCount = lifecyclePendings.size;
  const lifecycleStrategicCount = useMemo(
    () =>
      Array.from(lifecyclePendings.values()).filter(
        (item) => item.queueKind === "decisao_estrategica",
      ).length,
    [lifecyclePendings],
  );
  const lifecycleBiologicalCount = lifecyclePendingCount - lifecycleStrategicCount;

  if (!animais || (animais.length === 0 && !hasFilters)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Animais</h1>
          <div className="flex items-center gap-2">
            <Link to="/animais/importar">
              <Button size="sm" variant="outline">
                <Upload className="mr-2 h-4 w-4" /> Importar planilha
              </Button>
            </Link>
            <Link to="/animais/novo">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> Novo
              </Button>
            </Link>
          </div>
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
        <div className="flex items-center gap-2">
          <Link to="/animais/importar">
            <Button size="sm" variant="outline">
              <Upload className="mr-2 h-4 w-4" /> Importar planilha
            </Button>
          </Link>
          <Link to="/animais/novo">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Novo
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar animais por identificacao"
            placeholder="Buscar por identificacao..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={loteFilter} onValueChange={setLoteFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Lote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os lotes</SelectItem>
              <SelectItem value="none">Sem lote</SelectItem>
              {lotes?.map((lote) => (
                <SelectItem key={lote.id} value={lote.id}>
                  {lote.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sexoFilter} onValueChange={setSexoFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Sexo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ambos</SelectItem>
              <SelectItem value="M">Macho</SelectItem>
              <SelectItem value="F">Femea</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="vendido">Vendido</SelectItem>
              <SelectItem value="morto">Morto</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_FILTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={phaseFilter} onValueChange={setPhaseFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Fase vet." />
            </SelectTrigger>
            <SelectContent>
              {VETERINARY_PHASE_FILTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={productiveStateFilter}
            onValueChange={setProductiveStateFilter}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTIVE_STATE_FILTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              aria-label="Limpar filtros"
              variant="ghost"
              size="icon"
              onClick={() => {
                setSearch("");
                setLoteFilter("all");
                setSexoFilter("all");
                setStatusFilter("ativo");
                setCategoryFilter("all");
                setPhaseFilter("all");
                setProductiveStateFilter("all");
              }}
            >
              <FilterX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {lifecyclePendingCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {lifecyclePendingCount} animal(is) com transicao de estagio pendente.
          {" "}
          {lifecycleStrategicCount} decisao(oes) estrategica(s) e{" "}
          {lifecycleBiologicalCount} marco(s) biologico(s).
          {" "}
          Abra a ficha para confirmar o marco ou use a{" "}
          <Link to="/animais/transicoes" className="font-medium underline">
            mutacao em lote
          </Link>
          .
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[150px]">Identificacao</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead>Fase Vet.</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Vinculo</TableHead>
                <TableHead>Estagio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acao</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {animalRows.map(({ animal, depth }) => {
                const taxonomy = taxonomyByAnimal.get(animal.id);
                const categoriaLabel = taxonomy?.display.categoria ?? null;
                const mother = animal.mae_id
                  ? animaisMap.get(animal.mae_id) ?? null
                  : null;
                const father = animal.pai_id
                  ? animaisMap.get(animal.pai_id) ?? null
                  : null;
                const calves = calvesByMother.get(animal.id) ?? [];
                const lifecyclePending = lifecyclePendings.get(animal.id);

                return (
                  <TableRow
                    key={animal.id}
                    className={cn(
                      "transition-colors hover:bg-muted/30",
                      lifecyclePending && "bg-amber-50/60",
                      depth > 0 && "bg-muted/15",
                    )}
                  >
                    <TableCell className="font-bold">
                      <div
                        className="flex items-center gap-2"
                        style={{ paddingLeft: `${depth * 18}px` }}
                      >
                        {depth > 0 && (
                          <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="space-y-0.5">
                          <div>{animal.identificacao}</div>
                          {depth > 0 && mother && (
                            <div className="text-[11px] font-normal text-muted-foreground">
                              junto da matriz {mother.identificacao}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AnimalCategoryBadge
                        animal={animal}
                        categoriaLabel={categoriaLabel}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {calcularIdade(animal.data_nascimento) || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {taxonomy ? (
                        <Badge
                          variant="outline"
                          className="border-violet-200 bg-violet-50 text-violet-800"
                        >
                          {taxonomy.display.fase_veterinaria}
                        </Badge>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Sem fase
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {animal.lote_id ? (
                        <Badge variant="secondary" className="font-normal">
                          {lotesMap.get(animal.lote_id)?.nome || "..."}
                        </Badge>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Sem lote
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AnimalKinshipBadges
                        mother={mother}
                        father={father}
                        calves={calves}
                      />
                    </TableCell>
                    <TableCell>
                      {lifecyclePending ? (
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className={
                              lifecyclePending.canAutoApply
                                ? "border-sky-200 bg-sky-50 text-sky-800"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                            }
                          >
                            {getAnimalLifeStageLabel(lifecyclePending.currentStage)} para{" "}
                            {getAnimalLifeStageLabel(lifecyclePending.targetStage)}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground">
                            {lifecyclePending.canAutoApply
                              ? "Ajuste automatico/hibrido"
                              : "Confirmacao pendente"}
                          </p>
                          <p className="text-[11px] font-medium text-muted-foreground">
                            {getPendingAnimalLifecycleKindLabel(
                              lifecyclePending.queueKind,
                            )}
                          </p>
                        </div>
                      ) : (
                        <Badge variant="outline">
                          {getAnimalLifeStageLabel(
                            resolveAnimalLifecycleSnapshot(animal, farmLifecycleConfig)
                              .currentStage,
                          )}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {taxonomy ? (
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-800"
                          >
                            {taxonomy.display.estado_alias}
                          </Badge>
                          {taxonomy.display.estado_alias !==
                            taxonomy.display.estado_canonico && (
                            <p className="text-[11px] text-muted-foreground">
                              {taxonomy.display.estado_canonico}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge
                          variant={
                            animal.status === "ativo" ? "outline" : "secondary"
                          }
                          className="capitalize"
                        >
                          {animal.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/animais/${animal.id}`}>
                        <Button
                          aria-label={`Ver detalhes do animal ${animal.identificacao}`}
                          variant="ghost"
                          size="icon"
                          className="rounded-full"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {animalRows.length === 0 && hasFilters && (
                <TableRow>
                  <TableCell
                    colSpan={9}
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
