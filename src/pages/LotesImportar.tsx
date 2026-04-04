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
import { createGesture } from "@/lib/offline/ops";
import type { OperationInput } from "@/lib/offline/types";
import { useAuth } from "@/hooks/useAuth";
import { normalizeLookupValue } from "@/lib/import/animaisCsv";
import { parseLoteImportCsv } from "@/lib/import/estruturasCsv";
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TEMPLATE_CSV = [
  "nome;status;pasto;observacoes",
  "Matrizes;ativo;Piquete 1;Lote principal da estacao",
  "Recria;ativo;Reserva;Animais jovens",
].join("\n");

const LotesImportar = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { activeFarmId } = useAuth();
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const lotesExistentes = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.state_lotes
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((lote) => !lote.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const pastosDisponiveis = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.state_pastos
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((pasto) => !pasto.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const parsed = useMemo(() => parseLoteImportCsv(csvText), [csvText]);

  const validation = useMemo(() => {
    const issues = [...parsed.issues];
    const existingNames = new Set(
      (lotesExistentes ?? []).map((lote) => normalizeLookupValue(lote.nome)),
    );
    const pastoMap = new Map(
      (pastosDisponiveis ?? []).map((pasto) => [
        normalizeLookupValue(pasto.nome),
        pasto.id,
      ]),
    );

    parsed.rows.forEach((row) => {
      if (existingNames.has(normalizeLookupValue(row.nome))) {
        issues.push({
          lineNumber: row.lineNumber,
          field: "nome",
          message: `Lote "${row.nome}" ja existe na fazenda ativa.`,
        });
      }

      if (row.pastoNome && !pastoMap.has(normalizeLookupValue(row.pastoNome))) {
        issues.push({
          lineNumber: row.lineNumber,
          field: "pasto",
          message: `Pasto "${row.pastoNome}" nao encontrado na fazenda ativa.`,
        });
      }
    });

    return {
      issues,
      pastoMap,
    };
  }, [lotesExistentes, parsed, pastosDisponiveis]);

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
    link.download = "modelo_importacao_lotes.csv";
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
        table: "lotes",
        action: "INSERT",
        record: {
          id: crypto.randomUUID(),
          fazenda_id: activeFarmId,
          nome: row.nome,
          status: row.status,
          pasto_id: row.pastoNome
            ? validation.pastoMap.get(normalizeLookupValue(row.pastoNome)) ?? null
            : null,
          touro_id: null,
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
        entity: "lotes",
        quantity: parsed.rows.length,
        payload: {
          file_name: fileName ?? "csv",
        },
      });
      showSuccess(`${parsed.rows.length} lote(s) importado(s) localmente.`);
      navigate("/lotes");
    } catch (error) {
      console.error("[LotesImportar] failed to import lots", error);
      showError("Nao foi possivel importar os lotes.");
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/lotes")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Importar lotes por planilha</h1>
          <p className="text-sm text-muted-foreground">
            Organize a estrutura do rebanho em massa antes de trazer os animais.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelo recomendado</CardTitle>
          <CardDescription>
            Use este cabecalho para criar lotes e vincular ao pasto certo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 font-mono text-sm whitespace-pre-wrap">
            {TEMPLATE_CSV}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleTemplateDownload}>
              <Download className="h-4 w-4" />
              Baixar modelo CSV
            </Button>
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
          <CardTitle>Conteudo da planilha</CardTitle>
          <CardDescription>
            {fileName
              ? `Arquivo atual: ${fileName}`
              : "Cole o CSV aqui ou envie um arquivo."}
          </CardDescription>
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
            <CardTitle>Preview da importacao</CardTitle>
            <CardDescription>
              {parsed.rows.length} linha(s) valida(s) pronta(s) para importar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {parsed.rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma linha valida encontrada ainda. Revise o cabecalho e o
                nome dos pastos vinculados.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pasto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.slice(0, 12).map((row) => (
                      <TableRow key={`${row.lineNumber}-${row.nome}`}>
                        <TableCell>{row.lineNumber}</TableCell>
                        <TableCell className="font-medium">{row.nome}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.pastoNome ?? "Sem pasto"}</TableCell>
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
              Os lotes precisam usar nomes unicos e, quando houver pasto, o
              vinculo precisa existir.
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
                {pastosDisponiveis?.length ?? 0} pasto(s) disponivel(is)
              </Badge>
            </div>

            {validation.issues.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Arquivo pronto para importacao.
                </div>
                <p className="mt-2 text-emerald-800">
                  Os lotes serao criados localmente e entram na fila normal de
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
                      Linha {issue.lineNumber} · {issue.field}
                    </div>
                    <p className="mt-1">{issue.message}</p>
                  </div>
                ))}
                {validation.issues.length > 8 && (
                  <p className="text-sm text-muted-foreground">
                    Mais {validation.issues.length - 8} erro(s) oculto(s) no
                    preview.
                  </p>
                )}
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
                  Importar {parsed.rows.length} lote(s)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default LotesImportar;
