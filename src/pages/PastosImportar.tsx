import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Download,
  Loader2,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { normalizeLookupValue } from "@/lib/import/animaisCsv";
import { parsePastoImportCsv } from "@/lib/import/estruturasCsv";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { OperationInput } from "@/lib/offline/types";
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";
import { showError, showSuccess } from "@/utils/toast";

const TEMPLATE_CSV = [
  "nome;area_ha;capacidade_ua;tipo_pasto;observacoes",
  "Piquete 1;12.5;18;cultivado;Entrada principal",
  "Reserva;8;;nativo;Uso estrategico na seca",
].join("\n");

const PastosImportar = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { activeFarmId } = useAuth();
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const pastosExistentes = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.state_pastos
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((pasto) => !pasto.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const parsed = useMemo(() => parsePastoImportCsv(csvText), [csvText]);

  const validation = useMemo(() => {
    const issues = [...parsed.issues];
    const existingNames = new Set(
      (pastosExistentes ?? []).map((pasto) => normalizeLookupValue(pasto.nome)),
    );

    parsed.rows.forEach((row) => {
      if (existingNames.has(normalizeLookupValue(row.nome))) {
        issues.push({
          lineNumber: row.lineNumber,
          field: "nome",
          message: `Pasto "${row.nome}" ja existe na fazenda ativa.`,
        });
      }
    });

    return { issues };
  }, [parsed, pastosExistentes]);

  const canImport =
    Boolean(activeFarmId) &&
    parsed.rows.length > 0 &&
    validation.issues.length === 0 &&
    !isImporting;

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setCsvText(await file.text());
  };

  const handleTemplateDownload = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_importacao_pastos.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!activeFarmId) {
      showError("Fazenda ativa nao encontrada.");
      return;
    }

    if (validation.issues.length > 0) {
      showError("Corrija a planilha antes de importar.");
      return;
    }

    setIsImporting(true);

    try {
      const now = new Date().toISOString();
      const ops: OperationInput[] = parsed.rows.map((row) => ({
        table: "pastos",
        action: "INSERT",
        record: {
          id: crypto.randomUUID(),
          fazenda_id: activeFarmId,
          nome: row.nome,
          area_ha: row.areaHa,
          capacidade_ua: row.capacidadeUa,
          tipo_pasto: row.tipoPasto,
          infraestrutura: {},
          observacoes: row.observacoes,
          payload: {
            import_source: fileName ?? "csv",
            import_line: row.lineNumber,
          },
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      }));

      await createGesture(activeFarmId, ops);
      await trackPilotMetric({
        fazendaId: activeFarmId,
        eventName: "import_completed",
        status: "success",
        entity: "pastos",
        quantity: parsed.rows.length,
        payload: {
          file_name: fileName ?? "csv",
        },
      });
      showSuccess(`${parsed.rows.length} pasto(s) importado(s) localmente.`);
      navigate("/pastos");
    } catch (error) {
      console.error("[PastosImportar] failed to import pastures", error);
      showError("Nao foi possivel importar os pastos.");
      setIsImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageIntro
        eyebrow="Estrutura"
        title="Importar pastos por planilha"
        description="Traga a malha territorial da fazenda em lote. Area, capacidade e tipo de pasto entram no mesmo gesto local antes da sincronizacao."
        meta={
          <>
            <StatusBadge tone={parsed.rows.length > 0 ? "info" : "neutral"}>
              {parsed.rows.length} linha(s) valida(s)
            </StatusBadge>
            <StatusBadge tone={validation.issues.length === 0 ? "success" : "warning"}>
              {validation.issues.length === 0
                ? "Planilha pronta para importar"
                : `${validation.issues.length} alerta(s) para revisar`}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/pastos")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar para pastos
            </Button>
            <Button variant="outline" onClick={handleTemplateDownload}>
              <Download className="mr-2 h-4 w-4" />
              Baixar modelo CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Linhas validas"
          value={parsed.rows.length}
          hint="Cada linha valida gera um pasto local antes da sincronizacao."
          tone={parsed.rows.length > 0 ? "info" : "default"}
        />
        <MetricCard
          label="Alertas"
          value={validation.issues.length}
          hint="Pastos duplicados bloqueiam a importacao."
          tone={validation.issues.length === 0 ? "success" : "warning"}
        />
        <MetricCard
          label="Pastos existentes"
          value={pastosExistentes?.length ?? 0}
          hint="A checagem impede duplicar nomes ja cadastrados na fazenda ativa."
        />
      </div>

      <FormSection
        title="Modelo e arquivo"
        description="Use o cabecalho recomendado para importar nome, area, capacidade e tipo do pasto."
        actions={
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Enviar arquivo CSV
          </Button>
        }
      >
        <Input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,.txt"
          className="hidden"
          onChange={handleFileUpload}
        />
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/20 p-4 font-mono text-sm whitespace-pre-wrap">
            {TEMPLATE_CSV}
          </div>
          <p className="text-sm text-muted-foreground">
            {fileName
              ? `Arquivo atual: ${fileName}`
              : "Cole o CSV abaixo ou envie um arquivo para revisar a importacao."}
          </p>
        </div>
      </FormSection>

      <FormSection
        title="Conteudo da planilha"
        description="Revise o CSV exatamente como sera validado antes de enviar para a fila local."
      >
        <Textarea
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          placeholder={TEMPLATE_CSV}
          className="min-h-[220px] font-mono text-sm"
        />
      </FormSection>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Preview da importacao</CardTitle>
            <CardDescription>
              {parsed.rows.length} linha(s) valida(s) pronta(s) para importar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {parsed.rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma linha valida encontrada ainda. Revise os campos
                obrigatorios da planilha.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Area (ha)</TableHead>
                      <TableHead>Capacidade</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.slice(0, 12).map((row) => (
                      <TableRow key={`${row.lineNumber}-${row.nome}`}>
                        <TableCell>{row.lineNumber}</TableCell>
                        <TableCell className="font-medium">{row.nome}</TableCell>
                        <TableCell>{row.areaHa}</TableCell>
                        <TableCell>{row.capacidadeUa ?? "-"}</TableCell>
                        <TableCell>{row.tipoPasto}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validacao</CardTitle>
            <CardDescription>
              A importacao so libera quando a estrutura estiver consistente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={
                  validation.issues.length === 0 ? "secondary" : "destructive"
                }
              >
                {validation.issues.length === 0
                  ? "Sem erros"
                  : `${validation.issues.length} erro(s)`}
              </Badge>
              <Badge variant="outline">
                {pastosExistentes?.length ?? 0} pasto(s) ja cadastrado(s)
              </Badge>
            </div>

            {validation.issues.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Arquivo pronto para importacao.
                </div>
                <p className="mt-2 text-emerald-800">
                  Os pastos serao criados localmente e entram na fila normal de
                  sincronizacao.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {validation.issues.slice(0, 8).map((issue) => (
                  <div
                    key={`${issue.lineNumber}-${issue.field}-${issue.message}`}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Linha {issue.lineNumber} - {issue.field}
                    </div>
                    <p className="mt-1">{issue.message}</p>
                  </div>
                ))}
                {validation.issues.length > 8 ? (
                  <p className="text-sm text-muted-foreground">
                    Mais {validation.issues.length - 8} erro(s) oculto(s) no
                    preview.
                  </p>
                ) : null}
              </div>
            )}

            <Button onClick={handleImport} disabled={!canImport} className="w-full">
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar {parsed.rows.length} pasto(s)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default PastosImportar;
