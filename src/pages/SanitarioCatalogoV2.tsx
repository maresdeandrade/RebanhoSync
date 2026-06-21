import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
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
  buildSanitaryProtocolCatalogSummaryV2,
  readLocalSanitaryProtocolCatalogV2,
  type JsonRecord,
  type SanitaryProtocolCatalogReadModelV2,
  type SanitaryProtocolItemV2ReadModel,
  type SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

const fixedReadOnlyAlerts = [
  "Catalogo read-only.",
  "Nao cria agenda.",
  "Nao registra evento.",
  "Nao movimenta estoque.",
  "Nao calcula carencia ativa.",
  "Produto real continua obrigatorio na execucao.",
];

const readMetadataString = (metadata: JsonRecord, key: string): string | null => {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

const formatBoolean = (value: boolean) => (value ? "sim" : "nao");

const formatLimitations = (item: SanitaryProtocolItemV2ReadModel): string => {
  const values = Object.values(item.limitations)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string");

  return values.length > 0 ? values.slice(0, 3).join(", ") : "Sem limitacao textual";
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
  "nao informado";

const getAutomationStatus = (protocol: SanitaryProtocolV2ReadModel) =>
  readMetadataString(protocol.metadata, "automationStatus") ??
  readMetadataString(protocol.metadata, "automation_status") ??
  "nao informado";

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
        eyebrow="Sanitario"
        title="Catalogo sanitario v2"
        description="Consulta local/offline dos Protocolos Sanitarios v2 importados. Esta superficie e somente leitura."
        meta={
          <>
            <StatusBadge tone="neutral">Read-only</StatusBadge>
            <StatusBadge tone="info">Dexie local</StatusBadge>
          </>
        }
      />

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
              label="ProductClassGroups"
              value={summary.productClassGroupCount}
            />
            <Metric
              label="Members bloqueados"
              value={summary.memberImportBlockedCount}
            />
            <Metric
              label="B19 nacional presente"
              value={summary.hasB19NationalRule ? "sim" : "nao"}
            />
            <Metric
              label="Aftosa bloqueada presente"
              value={summary.hasAftosaBlockedRule ? "sim" : "nao"}
            />
            <Metric
              label="Agenda automatica habilitada"
              value={summary.hasAgendaAutoEnabled ? "sim" : "nao"}
            />
            <Metric
              label="Itens ProductClassGroup"
              value={productClassGroupItemCount}
            />
            <Metric
              label="Protocolo aprovado"
              value={summary.hasApprovedCatalogProtocol ? "sim" : "nao"}
            />
          </section>

          {isCatalogEmpty ? (
            <EmptyState
              icon={ShieldCheck}
              title="Catalogo local ainda nao sincronizado."
              description="Execute a sincronizacao para baixar os protocolos sanitarios v2."
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Protocolos v2</CardTitle>
                  <CardDescription>
                    Lista local filtravel. Nenhuma acao operacional e exposta.
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
                          <Badge variant="secondary">{protocol.status}</Badge>
                          <Badge variant="secondary">
                            {protocol.approvalStatus}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>curadoria: {getCurationStatus(protocol)}</span>
                          <span>automacao: {getAutomationStatus(protocol)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {protocol.familyCode === "febre_aftosa" ? (
                            <Badge variant="destructive">bloqueado/retired</Badge>
                          ) : null}
                          {protocol.familyCode === "brucelose_b19" &&
                          hasManualOnly(protocol) ? (
                            <Badge variant="outline">manual_only</Badge>
                          ) : null}
                          {hasPreviewAllowed(protocol) ? (
                            <Badge variant="outline">preview_allowed</Badge>
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
                  {selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{item.logicalItemKey}</span>
                        <Badge variant="outline">{item.itemStatus}</Badge>
                        <Badge variant="secondary">{item.actionType}</Badge>
                      </div>
                      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <Detail
                          label="ProductRequirement"
                          value={item.productRequirementKind}
                        />
                        <Detail
                          label="ProductClass"
                          value={item.productClass ?? "nenhum"}
                        />
                        <Detail
                          label="ProductClassGroupId"
                          value={item.productClassGroupId ?? "nenhum"}
                        />
                        <Detail
                          label="allowsAgendaAuto"
                          value={formatBoolean(item.allowsAgendaAuto)}
                        />
                        <Detail label="Limitacoes" value={formatLimitations(item)} />
                      </dl>
                    </div>
                  ))}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}
