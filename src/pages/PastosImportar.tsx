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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { previewPastosImportV2 } from "@/lib/import/importV2";
import { persistImportV2Preview } from "@/lib/import/importV2Persistence";
import { db } from "@/lib/offline/db";
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";
import { showError, showSuccess } from "@/utils/toast";

const TEMPLATE_CSV = [
  "nome;area_ha;capacidade_ua;tipo_pasto;tipo_area;forrageira_genero;forrageira;cultivar;altura_entrada;altura_saida;capacidade_ua_alvo;observacoes;schema_version;template_version",
  "Piquete 1;12.5;18;cultivado;cultivado;Panicum;Mombaca;;35;15;20;Entrada principal;2;import-v2",
  "Reserva;8;;nativo;;;;;;;;;Uso estrategico na seca;2;import-v2",
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

  const preview = useMemo(
    () =>
      previewPastosImportV2({
        entity: "pastos",
        fazendaId: activeFarmId ?? "",
        rawText: csvText,
        fileName,
        existing: { pastos: pastosExistentes ?? [] },
      }),
    [activeFarmId, csvText, fileName, pastosExistentes],
  );

  const canImport =
    Boolean(activeFarmId) && preview.summary.valid > 0 && !isImporting;

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
    if (preview.summary.valid === 0) {
      showError("Nenhuma linha válida para importar.");
      return;
    }

    setIsImporting(true);
    try {
      const result = await persistImportV2Preview(preview);
      await trackPilotMetric({
        fazendaId: activeFarmId,
        eventName: "import_completed",
        status: result.summary.retryable > 0 ? "error" : "success",
        entity: "pastos",
        quantity: result.summary.imported,
        payload: {
          file_name: fileName ?? "csv",
          import_id: result.importId,
          rejected: result.summary.rejected,
          conflicts: result.summary.conflicts,
          retryable: result.summary.retryable,
        },
      });
      if (result.summary.retryable > 0) {
        showError(`${result.summary.retryable} linha(s) aguardam retry.`);
        return;
      }
      showSuccess(
        `${result.summary.imported} pasto(s) importado(s); ${result.summary.rejected + result.summary.conflicts} linha(s) rejeitada(s) ou em conflito.`,
      );
      navigate("/pastos");
    } catch (error) {
      console.error("[PastosImportar] failed to import pastures", error);
      showError("Nao foi possivel importar os pastos.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageIntro
       variant="plain"
        eyebrow="Estrutura"
        title="Importar pastos por planilha"
        meta={
          <>
            <StatusBadge tone={preview.summary.valid > 0 ? "info" : "neutral"}>
              {preview.summary.valid} linha(s) pronta(s)
            </StatusBadge>
            <StatusBadge
              tone={preview.summary.rejected + preview.summary.conflicts === 0 ? "success" : "warning"}
            >
              {preview.summary.rejected + preview.summary.conflicts === 0
                ? "Preview sem rejeições"
                : `${preview.summary.rejected + preview.summary.conflicts} rejeição(ões)/conflito(s)`}
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

      <FormSection
        title="Modelo e arquivo"
        actions={
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
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
          {fileName ? <Badge variant="outline">{fileName}</Badge> : null}
        </div>
      </FormSection>

      <FormSection title="Conteudo da planilha">
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Preview</CardTitle>
              <Badge variant="secondary">
                {preview.summary.valid} linha(s) válida(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {preview.totalLines === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma linha encontrada.
              </div>
            ) : (
              <div className="grid gap-3">
                {preview.lineResults
                  .filter((line) => line.status === "valid")
                  .slice(0, 12)
                  .map((line) => (
                    <div
                      key={`${line.lineNumber}-${line.identity}`}
                      className="rounded-xl border border-border/70 bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {line.identity ?? "Identidade não informada"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Linha {line.lineNumber} · operação pronta
                          </p>
                        </div>
                        <Badge variant="outline">valid</Badge>
                      </div>
                      {line.warnings.length > 0 ? (
                        <p className="mt-2 text-xs text-amber-700">
                          {line.warnings.length} warning(s) não bloqueante(s)
                        </p>
                      ) : null}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validacao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={
                  preview.summary.rejected + preview.summary.conflicts === 0
                    ? "secondary"
                    : "destructive"
                }
              >
                {preview.summary.rejected + preview.summary.conflicts === 0
                  ? "Sem erros"
                  : `${preview.summary.rejected + preview.summary.conflicts} erro(s)/conflito(s)`}
              </Badge>
              <Badge variant="outline">
                {pastosExistentes?.length ?? 0} pasto(s) ja cadastrado(s)
              </Badge>
            </div>

            {preview.summary.rejected + preview.summary.conflicts === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Arquivo pronto para importacao.
                </div>
                <p className="mt-2 text-emerald-800">
                  Os pastos serao criados localmente.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {preview.lineResults
                  .flatMap((line) =>
                    line.issues.map((issue) => ({ ...issue, status: line.status })),
                  )
                  .slice(0, 8)
                  .map((issue) => (
                    <div
                      key={`${issue.lineNumber}-${issue.field}-${issue.code}`}
                      className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        Linha {issue.lineNumber} - {issue.field} - {issue.code}
                      </div>
                      <p className="mt-1">{issue.message}</p>
                    </div>
                  ))}
                {preview.summary.rejected + preview.summary.conflicts > 8 ? (
                  <p className="text-sm text-muted-foreground">
                    Mais {preview.summary.rejected + preview.summary.conflicts - 8} erro(s) oculto(s) no preview.
                  </p>
                ) : null}
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={!canImport}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar {preview.summary.valid} pasto(s)
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


