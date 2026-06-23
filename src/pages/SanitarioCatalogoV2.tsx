import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  buildSanitaryItemLimitationPresentationV2,
  buildSanitaryProductRequirementDisplayV2,
  buildSanitaryProtocolCatalogSummaryV2,
  formatSanitaryActionTypeV2,
  formatSanitaryBooleanPtBrV2,
  formatSanitaryItemStatusV2,
  formatSanitaryProtocolItemLabelV2,
  readLocalSanitaryProtocolCatalogV2,
  type JsonRecord,
  type SanitaryProtocolCatalogReadModelV2,
  type SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

const fixedReadOnlyAlerts = [
  "Catálogo read-only. Produto real, dose e carência são definidos somente na execução.",
];

const GLOBAL_PRODUCT_EXECUTION_WARNINGS = new Set([
  "Produto real continua obrigatório na execução.",
  "Exige produto real registrado na execução.",
  "Dose, via e carência dependem do produto executado.",
  "Dose, via e carência dependem da bula do produto executado.",
  "Dose deve seguir a bula do produto executado.",
  "Carência deve seguir o produto executado.",
]);

const readMetadataString = (metadata: JsonRecord, key: string): string | null => {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

const hasPreviewAllowed = (protocol: SanitaryProtocolV2ReadModel) =>
  readMetadataString(protocol.metadata, "automationStatus") === "preview_allowed" ||
  readMetadataString(protocol.metadata, "automation_status") === "preview_allowed";

const hasManualOnly = (protocol: SanitaryProtocolV2ReadModel) =>
  readMetadataString(protocol.metadata, "automationStatus") === "manual_only" ||
  readMetadataString(protocol.metadata, "automation_status") === "manual_only";

const getCurationStatus = (protocol: SanitaryProtocolV2ReadModel) =>
  readMetadataString(protocol.metadata, "curationStatus") ??
  readMetadataString(protocol.metadata, "curation_status") ??
  "Não informado";

const getAutomationStatus = (protocol: SanitaryProtocolV2ReadModel) =>
  readMetadataString(protocol.metadata, "automationStatus") ??
  readMetadataString(protocol.metadata, "automation_status") ??
  "Não informado";

const selectPrimaryItemWarnings = (warnings: string[]): string[] => {
  const contextualWarnings = warnings.filter(
    (warning) => !GLOBAL_PRODUCT_EXECUTION_WARNINGS.has(warning),
  );
  return (contextualWarnings.length > 0 ? contextualWarnings : warnings).slice(0, 2);
};

export default function SanitarioCatalogoV2() {
  const [catalog, setCatalog] =
    useState<SanitaryProtocolCatalogReadModelV2 | null>(null);
  const [selectedFamilyCode, setSelectedFamilyCode] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    readLocalSanitaryProtocolCatalogV2()
      .then((readModel) => {
        if (!active) return;
        setCatalog(readModel);
        setSelectedFamilyCode(readModel.protocols[0]?.familyCode ?? null);
      })
      .catch((currentError: unknown) => {
        if (!active) return;
        setError(
          currentError instanceof Error
            ? currentError.message
            : "Falha ao ler catalogo sanitario local.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(
    () => (catalog ? buildSanitaryProtocolCatalogSummaryV2(catalog) : null),
    [catalog],
  );
  const productClassGroupItemCount = useMemo(
    () =>
      catalog
        ? catalog.items.filter(
            (item) => item.productRequirementKind === "product_class_group",
          ).length
        : 0,
    [catalog],
  );
  const isCatalogEmpty =
    summary !== null &&
    summary.protocolCount === 0 &&
    summary.itemCount === 0 &&
    summary.productClassGroupCount === 0;

  const filteredProtocols = useMemo(() => {
    if (!catalog) return [];
    const normalizedFilter = filter.trim().toLowerCase();
    if (!normalizedFilter) return catalog.protocols;

    return catalog.protocols.filter(
      (protocol) =>
        protocol.name.toLowerCase().includes(normalizedFilter) ||
        protocol.familyCode.toLowerCase().includes(normalizedFilter),
    );
  }, [catalog, filter]);

  const selectedProtocol =
    filteredProtocols.find((protocol) => protocol.familyCode === selectedFamilyCode) ??
    filteredProtocols[0] ??
    null;

  const selectedItems = useMemo(() => {
    if (!catalog || !selectedProtocol) return [];
    return catalog.items.filter((item) => item.protocolId === selectedProtocol.id);
  }, [catalog, selectedProtocol]);

  return (
    <div className="container mx-auto space-y-5 pb-10">
      <PageIntro
        eyebrow="Sanitário"
        title="Catálogo sanitário v2"
        description="Consulta local/offline dos Protocolos Sanitários v2 importados. Esta superfície é somente leitura."
        meta={
          <>
            <StatusBadge tone="neutral">Read-only</StatusBadge>
            <StatusBadge tone="info">Dexie local</StatusBadge>
          </>
        }
      />

      <section>
        {fixedReadOnlyAlerts.map((alert) => (
          <div
            key={alert}
            className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-muted-foreground"
          >
            {alert}
          </div>
        ))}
      </section>

      {isLoading ? (
        <EmptyState icon={ShieldCheck} title="Carregando catalogo local" />
      ) : null}

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Falha ao carregar catalogo</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!isLoading && !error && catalog && summary ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Protocolos" value={summary.protocolCount} />
            <Metric label="Itens" value={summary.itemCount} />
            <Metric
              label="Grupos técnicos"
              value={summary.productClassGroupCount}
            />
            <Metric
              label="Members bloqueados"
              value={summary.memberImportBlockedCount}
            />
            <Metric
              label="B19 nacional presente"
              value={formatSanitaryBooleanPtBrV2(summary.hasB19NationalRule)}
            />
            <Metric
              label="Aftosa bloqueada presente"
              value={formatSanitaryBooleanPtBrV2(summary.hasAftosaBlockedRule)}
            />
            <Metric
              label="Agenda automática habilitada"
              value={formatSanitaryBooleanPtBrV2(summary.hasAgendaAutoEnabled)}
            />
            <Metric
              label="Itens com grupo técnico"
              value={productClassGroupItemCount}
            />
            <Metric
              label="Protocolo aprovado"
              value={formatSanitaryBooleanPtBrV2(
                summary.hasApprovedCatalogProtocol,
              )}
            />
          </section>

          {isCatalogEmpty ? (
            <EmptyState
              icon={ShieldCheck}
              title="Catálogo local ainda não sincronizado."
              description="Execute a sincronização para baixar os protocolos sanitários v2."
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Protocolos v2</CardTitle>
                  <CardDescription>
                    Lista local filtrável. Nenhuma ação operacional é exposta.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    aria-label="Filtrar protocolos"
                    placeholder="Filtrar por nome ou familyCode"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  />
                  <div className="space-y-2">
                    {filteredProtocols.map((protocol) => (
                      <button
                        key={protocol.id}
                        type="button"
                        className="w-full rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/40"
                        onClick={() => setSelectedFamilyCode(protocol.familyCode)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {protocol.name}
                          </span>
                          <Badge variant="outline">{protocol.familyCode}</Badge>
                          <Badge variant="secondary">
                            {formatSanitaryItemStatusV2(protocol.status)}
                          </Badge>
                          <Badge variant="secondary">
                            {formatSanitaryItemStatusV2(protocol.approvalStatus)}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>
                            Curadoria:{" "}
                            {formatSanitaryItemStatusV2(getCurationStatus(protocol))}
                          </span>
                          <span>
                            Automação:{" "}
                            {formatSanitaryItemStatusV2(
                              getAutomationStatus(protocol),
                            )}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {protocol.familyCode === "febre_aftosa" ? (
                            <Badge variant="destructive">
                              Bloqueado/retirado
                            </Badge>
                          ) : null}
                          {protocol.familyCode === "brucelose_b19" &&
                          hasManualOnly(protocol) ? (
                            <Badge variant="outline">Manual</Badge>
                          ) : null}
                          {hasPreviewAllowed(protocol) ? (
                            <Badge variant="outline">Prévia permitida</Badge>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedProtocol
                      ? selectedProtocol.name
                      : "Selecione um protocolo"}
                  </CardTitle>
                  {selectedProtocol ? (
                    <CardDescription>{selectedProtocol.familyCode}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum item local para o protocolo selecionado.
                    </p>
                  ) : null}
                  {selectedItems.map((item) => {
                    const limitationPresentation =
                      buildSanitaryItemLimitationPresentationV2(
                        item,
                        selectedProtocol,
                      );
                    const primaryWarnings = selectPrimaryItemWarnings(
                      limitationPresentation.operational,
                    );
                    const productRequirementDisplay =
                      buildSanitaryProductRequirementDisplayV2(
                        item,
                        catalog.productClassGroups,
                      );
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            {formatSanitaryProtocolItemLabelV2(item)}
                          </span>
                          <Badge variant="outline">
                            {formatSanitaryItemStatusV2(item.itemStatus)}
                          </Badge>
                          <Badge variant="secondary">
                            {formatSanitaryActionTypeV2(item.actionType)}
                          </Badge>
                        </div>
                        <dl className="mt-3 text-sm">
                          <Detail
                            label={productRequirementDisplay.title}
                            value={productRequirementDisplay.value}
                            qualifier={productRequirementDisplay.qualifier}
                          />
                        </dl>
                        {primaryWarnings.length > 0 ? (
                          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            {primaryWarnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        ) : null}
                        <Accordion type="single" collapsible className="mt-2">
                          <AccordionItem
                            value={`technical-${item.id}`}
                            className="border-b-0"
                          >
                            <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:no-underline">
                              Limitações e detalhes técnicos
                            </AccordionTrigger>
                            <AccordionContent className="space-y-3 pb-1">
                              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                                <Detail
                                  label="Chave técnica"
                                  value={item.logicalItemKey}
                                />
                                <Detail
                                  label="Requisito técnico interno"
                                  value={item.productRequirementKind}
                                />
                                <Detail
                                  label="Classe técnica interna"
                                  value={item.productClass ?? "Não se aplica"}
                                />
                                <Detail
                                  label="Agenda automática"
                                  value={formatSanitaryBooleanPtBrV2(
                                    item.allowsAgendaAuto,
                                  )}
                                />
                              </dl>
                              <div className="space-y-1 text-sm">
                                <div className="text-xs font-medium text-muted-foreground">
                                  Limitações operacionais
                                </div>
                                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                  {limitationPresentation.operational.map(
                                    (limitation) => (
                                      <li key={limitation}>{limitation}</li>
                                    ),
                                  )}
                                </ul>
                              </div>
                              {limitationPresentation.technical.length > 0 ? (
                                <div className="space-y-1 text-sm">
                                  <div className="text-xs font-medium text-muted-foreground">
                                    Detalhes técnicos
                                  </div>
                                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                    {limitationPresentation.technical.map(
                                      (limitation) => (
                                        <li key={limitation}>{limitation}</li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              ) : null}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="text-xs font-medium uppercase text-muted-foreground">
          {label}
        </div>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function Detail({
  label,
  value,
  qualifier,
}: {
  label: string;
  value: string;
  qualifier?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium text-foreground">{value}</dd>
      {qualifier ? (
        <dd className="mt-1 text-xs font-medium text-muted-foreground">
          {qualifier}
        </dd>
      ) : null}
    </div>
  );
}
