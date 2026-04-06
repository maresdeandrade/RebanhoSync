import { useMemo, useState } from "react";
import { type Collection } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CornerDownRight,
  FilterX,
  PawPrint,
  Plus,
  Search,
  Upload,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { AnimalCategoryBadge } from "@/components/animals/AnimalCategoryBadge";
import { AnimalKinshipBadges } from "@/components/animals/AnimalKinshipBadges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLotes } from "@/hooks/useLotes";
import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  getPendingAnimalLifecycleTransitions,
  resolveAnimalLifecycleSnapshot,
} from "@/lib/animals/lifecycle";
import { buildAnimalFamilyRows } from "@/lib/animals/familyOrder";
import {
  buildAnimalTaxonomyReproContextMap,
  deriveAnimalTaxonomy,
} from "@/lib/animals/taxonomy";
import { db } from "@/lib/offline/db";
import { type Animal } from "@/lib/offline/types";
import { getReproductionEventsJoined } from "@/lib/reproduction/selectors";
import { cn } from "@/lib/utils";

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
  { value: "pre_desmama", label: "Pre-desmama" },
  { value: "pos_desmama", label: "Pos-desmama" },
  { value: "pre_pubere", label: "Pre-pubere" },
  { value: "pubere", label: "Pubere" },
  { value: "gestante", label: "Gestante" },
  { value: "puerperio", label: "Puerperio" },
] as const;

const PRODUCTIVE_STATE_FILTERS = [
  { value: "all", label: "Todos estados" },
  { value: "vazia", label: "Vazia" },
  { value: "prenhe", label: "Prenhe" },
  { value: "pre_parto_imediato", label: "Amojando" },
  { value: "seca", label: "Seca" },
  { value: "recem_parida", label: "Vaca parida" },
  { value: "lactacao", label: "Vaca em lactacao" },
  { value: "inteiro", label: "Inteiro" },
  { value: "castrado", label: "Castrado" },
  { value: "reprodutor", label: "Reprodutor" },
  { value: "terminacao", label: "Terminacao" },
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

function getProductiveTone(animalStatus: string) {
  if (animalStatus === "ativo") return "success";
  if (animalStatus === "vendido") return "warning";
  return "danger";
}

function getLifecycleTone(canAutoApply: boolean) {
  return canAutoApply ? "info" : "warning";
}

export default function Animais() {
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
      if (phaseFilter !== "all" && taxonomy.fase_veterinaria !== phaseFilter) {
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
  const semLoteCount = useMemo(
    () => filteredAnimals.filter((animal) => !animal.lote_id).length,
    [filteredAnimals],
  );

  if (!animais || (animais.length === 0 && !hasFilters)) {
    return (
      <div className="space-y-5">
        <PageIntro
          eyebrow="Rebanho"
          title="Animais"
          description="Cadastro e leitura operacional do rebanho, com foco em estrutura, classificacao e proximo passo por animal."
          actions={
            <>
              <Button asChild variant="outline">
                <Link to="/animais/importar">
                  <Upload className="h-4 w-4" />
                  Importar planilha
                </Link>
              </Button>
              <Button asChild>
                <Link to="/animais/novo">
                  <Plus className="h-4 w-4" />
                  Novo animal
                </Link>
              </Button>
            </>
          }
        />

        <EmptyState
          icon={PawPrint}
          title="Nenhum animal cadastrado"
          description="Comece cadastrando os primeiros animais da fazenda para liberar agenda, historico e acompanhamento do rebanho."
          action={{
            label: "Cadastrar primeiro animal",
            onClick: () => navigate("/animais/novo"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Rebanho"
        title="Animais"
        description="Leitura operacional do rebanho com classificacao, vinculos familiares e transicoes de estagio visiveis sem poluir a tabela."
        meta={
          <>
            <StatusBadge tone="neutral">
              {animalRows.length} animal(is) no recorte
            </StatusBadge>
            {hasFilters ? <StatusBadge tone="info">Filtros ativos</StatusBadge> : null}
            {lifecyclePendingCount > 0 ? (
              <StatusBadge tone="warning">
                {lifecyclePendingCount} transicao(oes) pendente(s)
              </StatusBadge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/animais/importar">
                <Upload className="h-4 w-4" />
                Importar planilha
              </Link>
            </Button>
            <Button asChild>
              <Link to="/animais/novo">
                <Plus className="h-4 w-4" />
                Novo animal
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Base do rebanho"
          value={animaisFamilia?.length ?? 0}
          hint="Total de animais cadastrados na fazenda."
        />
        <MetricCard
          label="No recorte atual"
          value={animalRows.length}
          hint={hasFilters ? "Resultado da busca e dos filtros atuais." : "Sem filtros aplicados."}
        />
        <MetricCard
          label="Sem lote"
          value={semLoteCount}
          hint={
            lifecyclePendingCount > 0
              ? `${lifecycleStrategicCount} estrategica(s) e ${lifecycleBiologicalCount} biologica(s) em transicao.`
              : "Sem alerta de transicao no momento."
          }
          tone={lifecyclePendingCount > 0 ? "warning" : "default"}
        />
      </section>

      <Toolbar>
        <ToolbarGroup className="flex-1 gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Buscar animais por identificacao"
              placeholder="Buscar por identificacao"
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select value={loteFilter} onValueChange={setLoteFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
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
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Sexo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ambos</SelectItem>
              <SelectItem value="M">Macho</SelectItem>
              <SelectItem value="F">Femea</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="vendido">Vendido</SelectItem>
              <SelectItem value="morto">Morto</SelectItem>
            </SelectContent>
          </Select>
        </ToolbarGroup>

        <ToolbarGroup className="gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
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
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Fase veterinaria" />
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
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue placeholder="Estado produtivo" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTIVE_STATE_FILTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters ? (
            <Button
              aria-label="Limpar filtros"
              variant="outline"
              size="sm"
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
              Limpar
            </Button>
          ) : null}
        </ToolbarGroup>
      </Toolbar>

      {lifecyclePendingCount > 0 ? (
        <Card className="border-warning/20 bg-warning-muted/70 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Transicoes de estagio no radar
            </CardTitle>
            <CardDescription>
              {lifecyclePendingCount} animal(is) com ajuste pendente. {lifecycleStrategicCount} decisao(oes) estrategica(s) e {lifecycleBiologicalCount} marco(s) biologico(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link to="/animais/transicoes">Abrir mutacao em lote</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/agenda">Cruzar com agenda</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Leitura operacional do rebanho</CardTitle>
          <CardDescription>
            O conteudo principal fica na tabela: identificacao, classificacao, contexto familiar e proximo marco visivel por animal.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">Identificacao</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead>Fase vet.</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Vinculo</TableHead>
                <TableHead>Estagio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Abrir</TableHead>
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
                      depth > 0 && "bg-muted/20",
                      lifecyclePending && "bg-warning-muted/50",
                    )}
                  >
                    <TableCell className="align-top">
                      <div
                        className="flex items-start gap-2"
                        style={{ paddingLeft: `${depth * 18}px` }}
                      >
                        {depth > 0 ? (
                          <CornerDownRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        ) : null}
                        <div className="space-y-0.5">
                          <p className="font-medium">{animal.identificacao}</p>
                          {depth > 0 && mother ? (
                            <p className="text-xs text-muted-foreground">
                              junto da matriz {mother.identificacao}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <AnimalCategoryBadge
                        animal={animal}
                        categoriaLabel={categoriaLabel}
                      />
                    </TableCell>

                    <TableCell className="align-top text-sm text-muted-foreground">
                      {calcularIdade(animal.data_nascimento) || "-"}
                    </TableCell>

                    <TableCell className="align-top">
                      {taxonomy ? (
                        <StatusBadge tone="neutral">
                          {taxonomy.display.fase_veterinaria}
                        </StatusBadge>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Sem fase
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      {animal.lote_id ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {lotesMap.get(animal.lote_id)?.nome || "..."}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Sem lote
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      <AnimalKinshipBadges
                        mother={mother}
                        father={father}
                        calves={calves}
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      {lifecyclePending ? (
                        <div className="space-y-2">
                          <StatusBadge tone={getLifecycleTone(lifecyclePending.canAutoApply)}>
                            {getAnimalLifeStageLabel(lifecyclePending.currentStage)} para{" "}
                            {getAnimalLifeStageLabel(lifecyclePending.targetStage)}
                          </StatusBadge>
                          <p className="text-xs text-muted-foreground">
                            {getPendingAnimalLifecycleKindLabel(
                              lifecyclePending.queueKind,
                            )}
                          </p>
                        </div>
                      ) : (
                        <StatusBadge tone="neutral">
                          {getAnimalLifeStageLabel(
                            resolveAnimalLifecycleSnapshot(animal, farmLifecycleConfig)
                              .currentStage,
                          )}
                        </StatusBadge>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      {taxonomy ? (
                        <div className="space-y-1">
                          <StatusBadge tone="neutral">
                            {taxonomy.display.estado_alias}
                          </StatusBadge>
                          {taxonomy.display.estado_alias !==
                          taxonomy.display.estado_canonico ? (
                            <p className="text-xs text-muted-foreground">
                              {taxonomy.display.estado_canonico}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <StatusBadge tone={getProductiveTone(animal.status)}>
                          {animal.status}
                        </StatusBadge>
                      )}
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/animais/${animal.id}`}>Abrir ficha</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {animalRows.length === 0 && hasFilters ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Nenhum animal encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
