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
import { db } from "@/lib/offline/db";
import {
  persistImportV2Preview,
} from "@/lib/import/importV2Persistence";
import { previewAnimalsImportV2 } from "@/lib/import/importV2";
import { useAuth } from "@/hooks/useAuth";
import { useLotes } from "@/hooks/useLotes";
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";

const TEMPLATE_CSV = [
  "identificacao;sexo;especie;lote;data_nascimento;data_entrada;origem;raca;nome;rfid;schema_version;template_version",
  "BR-001;F;bovino;Matrizes;2023-01-15;;nascimento;Nelore;Estrela;;2;import-v2",
  "BR-002;M;bubalino;Recria;2022-11-03;2024-02-10;compra;Angus;Trovão;982000123456789;2;import-v2",
].join("\n");

const AnimaisImportar = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { activeFarmId, farmLifecycleConfig } = useAuth();
  const lotes = useLotes();
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const animaisExistentes = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.state_animais
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((animal) => !animal.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const preview = useMemo(
    () =>
      previewAnimalsImportV2({
        entity: "animais",
        fazendaId: activeFarmId ?? "",
        rawText: csvText,
        fileName,
        existing: {
          animais: animaisExistentes ?? [],
          lotes: lotes ?? [],
        },
        lifecycleConfig: farmLifecycleConfig,
      }),
    [
      activeFarmId,
      animaisExistentes,
      csvText,
      farmLifecycleConfig,
      fileName,
      lotes,
    ],
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
    link.download = "modelo_importacao_animais.csv";
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
        entity: "animais",
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
        showError(
          `${result.summary.retryable} linha(s) aguardam retry; as demais foram processadas.`,
        );
        return;
      }
      showSuccess(
        `${result.summary.imported} animal(is) importado(s); ${result.summary.rejected + result.summary.conflicts} linha(s) rejeitada(s) ou em conflito.`,
      );
      navigate("/animais");
    } catch (error) {
      console.error("[AnimaisImportar] failed to import animals", error);
      showError("Nao foi possivel importar os animais.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageIntro
        variant="plain"
        eyebrow="Rebanho"
        title="Importar animais por planilha"
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
            <Button variant="outline" onClick={() => navigate("/animais")}>
              <ChevronLeft className="h-4 w-4" />
              Voltar para animais
            </Button>
            <Button variant="outline" onClick={handleTemplateDownload}>
              <Download className="h-4 w-4" />
              Baixar modelo CSV
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Modelo recomendado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm font-mono whitespace-pre-wrap">
            {TEMPLATE_CSV}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Enviar arquivo CSV
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Conteudo da planilha</CardTitle>
            {fileName ? <Badge variant="outline">{fileName}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder={TEMPLATE_CSV}
            className="min-h-[220px] font-mono text-sm"
          />
        </CardContent>
      </Card>

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
                {lotes?.length ?? 0} lote(s) disponivel(is) para vinculo
              </Badge>
            </div>

            {preview.summary.rejected + preview.summary.conflicts === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Arquivo pronto para importacao.
                </div>
                <p className="mt-2 text-emerald-800">
                  Os animais serao criados localmente.
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
                        Linha {issue.lineNumber} · {issue.field} · {issue.code}
                      </div>
                      <p className="mt-1">{issue.message}</p>
                    </div>
                  ))}
                {preview.summary.rejected + preview.summary.conflicts > 8 && (
                  <p className="text-sm text-muted-foreground">
                    Mais {preview.summary.rejected + preview.summary.conflicts - 8} erro(s) oculto(s) no preview.
                  </p>
                )}
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
                  Importar {preview.summary.valid} animal(is)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default AnimaisImportar;

