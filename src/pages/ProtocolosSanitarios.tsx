import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { showError, showSuccess } from "@/utils/toast";
import { FarmProtocolManager } from "@/components/sanitario/FarmProtocolManager";
import { OfficialSanitaryPackManager } from "@/components/sanitario/OfficialSanitaryPackManager";
import { RegulatoryOverlayManager } from "@/components/sanitario/RegulatoryOverlayManager";
import { FormSection } from "@/components/ui/form-section";
import {
  Syringe,
  ShieldCheck,
  Pill,
  Bug,
  CheckCircle2,
  AlertTriangle,
  Info,
  CalendarDays,
} from "lucide-react";
import {
  buildVeterinaryProductMetadata,
  refreshVeterinaryProductsCatalog,
  resolveVeterinaryProductByName,
  type VeterinaryProductSelection,
} from "@/lib/sanitario/products";
import {
  STANDARD_PROTOCOLS,
  buildStandardProtocolItemPayload,
  buildStandardProtocolPayload,
  normalizeStandardProtocolInterval,
  type StandardProtocol,
} from "@/lib/sanitario/baseProtocols";
import { describeSanitaryCalendarSchedule } from "@/lib/sanitario/calendar";

// Biblioteca padrao extraida para src/lib/sanitario/baseProtocols.ts

const ProtocolosSanitarios = () => {
  const { activeFarmId, farmExperienceMode, role } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("vacinas");

  // --------------------------------------------------------------------------
  // HOOKS E CONSULTAS
  // --------------------------------------------------------------------------

  // Garante que os dados da fazenda estejam atualizados localmente ao montar o componente
  useEffect(() => {
    if (!activeFarmId) return;
    pullDataForFarm(
      activeFarmId,
      [
        "protocolos_sanitarios",
        "protocolos_sanitarios_itens",
        "fazenda_sanidade_config",
      ],
      { mode: "merge" }
    ).catch((error) => {
      console.warn(
        "[protocolos-sanitarios] failed to refresh protocols",
        error
      );
    });
  }, [activeFarmId]);

  useEffect(() => {
    refreshVeterinaryProductsCatalog().catch((error) => {
      console.warn(
        "[protocolos-sanitarios] failed to refresh veterinary products",
        error,
      );
    });
  }, []);

  const catalogProducts = useLiveQuery(() => {
    return db.catalog_produtos_veterinarios.orderBy("nome").toArray();
  }, []);
  
  // Consulta protocolos JÃ CADASTRADOS na fazenda ativa para indicar status visualmente
  // Isso evita que o usuÃ¡rio adicione o mesmo protocolo padrÃ£o mÃºltiplas vezes sem necessidade
  const protocolosExistentes = useLiveQuery(() => {
    if (!activeFarmId) return [];
    return db.state_protocolos_sanitarios
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((p) => !p.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const protocolosItensExistentes = useLiveQuery(() => {
    if (!activeFarmId) return [];
    return db.state_protocolos_sanitarios_itens
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((item) => !item.deleted_at)
      .toArray();
  }, [activeFarmId]);

  // Helper para verificar se um protocolo especÃ­fico jÃ¡ existe na lista
  const isProtocoloAdicionado = (nomeProtocolo: string) => {
    return protocolosExistentes?.some(
      (p) => p.nome === nomeProtocolo && p.ativo
    );
  };

  const canManageProtocols = role === "manager" || role === "owner";

  const createAutomaticProductSelection = (
    product: { id: string; nome: string; categoria: string | null },
    matchMode: VeterinaryProductSelection["matchMode"],
  ): VeterinaryProductSelection => ({
    id: product.id,
    nome: product.nome,
    categoria: product.categoria,
    origem: "catalogo_automatico",
    matchMode,
  });

  // --------------------------------------------------------------------------
  // AÃ‡Ã•ES
  // --------------------------------------------------------------------------

  /**
   * Adiciona um protocolo padrao a fazenda ativa.
   * Utiliza gestures para garantir sincronizacao offline-first.
   * Cria tanto o cabecalho quanto as etapas do protocolo.
   */
  const handleAdicionarProtocolo = async (protocolo: StandardProtocol) => {
    if (!activeFarmId) {
      showError("Nenhuma fazenda ativa selecionada.");
      return;
    }

    if (!canManageProtocols) {
      showError("Apenas manager e owner podem alterar protocolos da fazenda.");
      return;
    }

    try {
      const protocoloId = crypto.randomUUID();

      // 1. Preparar operaÃ§Ã£o para criar o protocolo (cabeÃ§alho)
      // O payload armazena metadados da origem para rastreabilidade futura
      const opProtocolo = {
        table: "protocolos_sanitarios",
        action: "INSERT",
        record: {
          id: protocoloId,
          nome: protocolo.nome,
          descricao: protocolo.descricao,
          ativo: true,
          payload: buildStandardProtocolPayload(protocolo),
        },
      };

      // 2. Preparar operaÃ§Ãµes para criar os itens do protocolo
      // Mapeia cada etapa do padrÃ£o para um registro na tabela protocolos_sanitarios_itens
      const opsItens = protocolo.itens.map((item) => {
        const resolvedProduct = resolveVeterinaryProductByName(
          item.produto,
          catalogProducts ?? [],
          {
            sanitaryType: item.tipo,
          },
        );
        const productSelection = resolvedProduct.product
          ? createAutomaticProductSelection(
              resolvedProduct.product,
              resolvedProduct.matchMode,
            )
          : null;

        return {
          table: "protocolos_sanitarios_itens",
          action: "INSERT",
          record: {
            id: crypto.randomUUID(),
            protocolo_id: protocoloId,
            protocol_item_id: crypto.randomUUID(),
            version: 1,
            tipo: item.tipo,
            produto: item.produto,
            intervalo_dias: normalizeStandardProtocolInterval(item),
            dose_num: item.dose_num,
            gera_agenda: item.gera_agenda,
            dedup_template: item.dedup_template || null,
            payload: {
              ...buildStandardProtocolItemPayload(item),
              ...buildVeterinaryProductMetadata({
                selectedProduct: productSelection,
                typedName: item.produto,
                source: productSelection?.origem,
                matchMode: productSelection?.matchMode ?? null,
              }),
            },
          },
        };
      });

      // Executa todas as operacoes em uma unica transacao.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createGesture(activeFarmId, [opProtocolo, ...opsItens] as any);

      showSuccess(
        `Protocolo "${protocolo.nome}" adicionado a fazenda com sucesso!`
      );
    } catch (error) {
      console.error("Erro ao adicionar protocolo:", error);
      showError("Erro ao adicionar o protocolo. Tente novamente.");
    }
  };

  const renderProtocoloCard = (protocolo: StandardProtocol) => {
    const adicionado = isProtocoloAdicionado(protocolo.nome);

    return (
      <Card key={protocolo.id} className="mb-4 border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg font-bold text-primary">
                  {protocolo.nome}
                </CardTitle>
                {protocolo.obrigatorio && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> ObrigatÃ³rio
                  </Badge>
                )}
                {adicionado && (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-green-100 text-green-800 hover:bg-green-100"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Ativo na Fazenda
                  </Badge>
                )}
              </div>
              <CardDescription className="text-base">
                {protocolo.descricao}
              </CardDescription>
              <p className="text-xs text-muted-foreground mt-1">
                Calendario-base: {protocolo.calendario_base.label}
              </p>
              {protocolo.referencia && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Fonte: {protocolo.referencia}
                </p>
              )}
            </div>
            <Button
              variant={adicionado ? "outline" : "default"}
              size="sm"
              onClick={() => handleAdicionarProtocolo(protocolo)}
              disabled={adicionado || !canManageProtocols}
            >
              {adicionado ? "JÃ¡ Adicionado" : "Adicionar Ã  Fazenda"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="itens">
              <AccordionTrigger>
                Ver Detalhes do Protocolo ({protocolo.itens.length} etapas)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {protocolo.itens.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg border"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span className="flex items-center gap-2">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                            {item.dose_num}Âª Etapa
                          </span>
                          {item.produto}
                        </span>
                        <Badge variant="outline">{item.tipo}</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          <span>
                            Calendario-base:{" "}
                            {describeSanitaryCalendarSchedule({
                              intervalDays: item.intervalo_dias,
                              geraAgenda: item.gera_agenda,
                              payload: buildStandardProtocolItemPayload(item),
                            })}
                          </span>
                        </div>
                        <div>
                          <strong>IndicaÃ§Ã£o:</strong> {item.indicacao}
                        </div>
                        {(item.sexo_alvo ||
                          item.idade_min_dias !== undefined) && (
                          <div className="col-span-1 md:col-span-2">
                            <strong>Alvo:</strong>{" "}
                            {item.sexo_alvo === "M"
                              ? "Machos"
                              : item.sexo_alvo === "F"
                              ? "FÃªmeas"
                              : "Todos"}
                            {item.idade_min_dias !== undefined
                              ? ` | ${item.idade_min_dias} a ${
                                  item.idade_max_dias || "sem limite"
                                } dias`
                              : ""}
                          </div>
                        )}
                        {item.observacoes && (
                          <div className="col-span-1 md:col-span-2 italic bg-yellow-50/50 p-2 rounded text-yellow-800 dark:text-yellow-200 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/50">
                            Nota: {item.observacoes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 container mx-auto pb-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">
            Protocolos Sanitarios
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Estrutura sanitaria animal-centric com nucleo federal, overlay
          estadual e ajuste por risco da fazenda. O pack oficial abaixo ativa a
          base regulatoria versionada, o overlay operacional executa checklists
          procedurais e o editor da fazenda ajusta a execucao local.
        </p>
        {!canManageProtocols ? (
          <p className="text-sm text-muted-foreground">
            Seu perfil esta em modo leitura para protocolos. Edicao estrutural e
            liberada para manager e owner.
          </p>
        ) : null}
      </div>

      {activeFarmId ? (
        <OfficialSanitaryPackManager
          activeFarmId={activeFarmId}
          canManage={canManageProtocols}
        />
      ) : null}

      {activeFarmId ? (
        <RegulatoryOverlayManager activeFarmId={activeFarmId} />
      ) : null}

      {activeFarmId ? (
        <FarmProtocolManager
          activeFarmId={activeFarmId}
          farmExperienceMode={farmExperienceMode}
          catalogProducts={catalogProducts ?? []}
          protocols={protocolosExistentes ?? []}
          protocolItems={protocolosItensExistentes ?? []}
          canManage={canManageProtocols}
        />
      ) : null}

      <FormSection
        title="Biblioteca complementar"
        description="Importe protocolos tecnicos prontos para dentro da camada operacional da fazenda. Esta biblioteca e secundaria: ela nao substitui a base regulatoria nem o editor operacional acima."
        className="border border-dashed border-border/70 bg-muted/10 shadow-none"
        contentClassName="pt-3"
      >
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem
            value="biblioteca-complementar"
            className="rounded-2xl border border-border/70 bg-background px-4"
          >
            <AccordionTrigger className="text-left">
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">
                  Abrir biblioteca complementar
                </div>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Use esta secao apenas quando quiser acelerar a criacao de um
                  protocolo complementar de vacinacao, vermifugacao ou
                  medicamento.
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-2 pt-2">
              <Tabs
                defaultValue="vacinas"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
                  <TabsTrigger value="vacinas" className="flex items-center gap-2">
                    <Syringe className="h-4 w-4" /> Vacinas
                  </TabsTrigger>
                  <TabsTrigger
                    value="vermifugacao"
                    className="flex items-center gap-2"
                  >
                    <Bug className="h-4 w-4" /> Vermifugacao
                  </TabsTrigger>
                  <TabsTrigger
                    value="medicamentos"
                    className="flex items-center gap-2"
                  >
                    <Pill className="h-4 w-4" /> Medicamentos
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="vacinas"
                  className="mt-6 animate-in fade-in-50 duration-500"
                >
                  <div className="grid gap-6">
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-100 dark:border-blue-900 flex gap-3 items-start text-sm text-blue-800 dark:text-blue-200">
                      <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Importante:</strong> O Brasil-base oficial nao gera
                        mais vacina de febre aftosa como rotina padrao. Use o pack
                        oficial para obrigacoes regulatorias e esta biblioteca apenas
                        para protocolos complementares do manejo.
                      </div>
                    </div>
                    {STANDARD_PROTOCOLS.filter((p) => p.categoria === "vacinas").map(
                      renderProtocoloCard
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="vermifugacao"
                  className="mt-6 animate-in fade-in-50 duration-500"
                >
                  <div className="grid gap-6">
                    <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-100 dark:border-green-900 flex gap-3 items-start text-sm text-green-800 dark:text-green-200">
                      <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Dica de Manejo:</strong> A rotacao de principios ativos
                        (bases quimicas) e fundamental para evitar resistencia
                        parasitaria. O protocolo 5-7-9 e uma estrategia consagrada
                        para otimizar o controle durante a seca.
                      </div>
                    </div>
                    {STANDARD_PROTOCOLS.filter(
                      (p) => p.categoria === "vermifugacao"
                    ).map(renderProtocoloCard)}
                  </div>
                </TabsContent>

                <TabsContent
                  value="medicamentos"
                  className="mt-6 animate-in fade-in-50 duration-500"
                >
                  <div className="grid gap-6">
                    <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-100 dark:border-amber-900 flex gap-3 items-start text-sm text-amber-800 dark:text-amber-200">
                      <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Uso Responsavel:</strong> Medicamentos como
                        antibioticos devem ser utilizados sob orientacao
                        veterinaria e respeitando rigorosamente os periodos de
                        carencia (abate e leite) descritos na bula.
                      </div>
                    </div>
                    {STANDARD_PROTOCOLS.filter(
                      (p) => p.categoria === "medicamentos"
                    ).map(renderProtocoloCard)}
                  </div>
                </TabsContent>
              </Tabs>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </FormSection>
    </div>
  );
};

export default ProtocolosSanitarios;

