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
import { useLotes } from "@/hooks/useLotes";
import {
  normalizeAnimalIdentifier,
  normalizeLookupValue,
  parseAnimalImportCsv,
} from "@/lib/import/animaisCsv";
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
  "identificacao;sexo;lote;data_nascimento;data_entrada;origem;raca;nome;rfid",
  "BR-001;F;Matrizes;2023-01-15;;nascimento;Nelore;Estrela;",
  "BR-002;M;Recria;2022-11-03;2024-02-10;compra;Angus;Trovão;982000123456789",
].join("\n");

const AnimaisImportar = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { activeFarmId } = useAuth();
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

  const parsed = useMemo(() => parseAnimalImportCsv(csvText), [csvText]);

  const validation = useMemo(() => {
    const issues = [...parsed.issues];
    const loteMap = new Map(
      (lotes ?? []).map((lote) => [normalizeLookupValue(lote.nome), lote.id]),
    );
    const existingIds = new Set(
      (animaisExistentes ?? []).map((animal) =>
        normalizeAnimalIdentifier(animal.identificacao),
      ),
    );

    parsed.rows.forEach((row) => {
      if (row.loteNome && !loteMap.has(normalizeLookupValue(row.loteNome))) {
        issues.push({
          lineNumber: row.lineNumber,
          field: "lote",
          message: `Lote "${row.loteNome}" nao encontrado na fazenda ativa.`,
        });
      }

      if (existingIds.has(normalizeAnimalIdentifier(row.identificacao))) {
        issues.push({
          lineNumber: row.lineNumber,
          field: "identificacao",
          message: `Identificacao "${row.identificacao}" ja existe na fazenda.`,
        });
      }
    });

    return {
      issues,
      loteMap,
    };
  }, [animaisExistentes, lotes, parsed]);

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
    link.download = "modelo_importacao_animais.csv";
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
        table: "animais",
        action: "INSERT",
        record: {
          id: crypto.randomUUID(),
          fazenda_id: activeFarmId,
          identificacao: row.identificacao,
          sexo: row.sexo,
          status: "ativo",
          lote_id: row.loteNome
            ? validation.loteMap.get(normalizeLookupValue(row.loteNome)) ?? null
            : null,
          data_nascimento: row.dataNascimento,
          data_entrada: row.dataEntrada,
          data_saida: null,
          pai_id: null,
          mae_id: null,
          nome: row.nome,
          rfid: row.rfid,
          origem: row.origem,
          raca: row.raca,
          papel_macho: null,
          habilitado_monta: false,
          observacoes: null,
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
        entity: "animais",
        quantity: parsed.rows.length,
        payload: {
          file_name: fileName ?? "csv",
        },
      });
      showSuccess(`${parsed.rows.length} animal(is) importado(s) localmente.`);
      navigate("/animais");
    } catch (error) {
      console.error("[AnimaisImportar] failed to import animals", error);
      showError("Nao foi possivel importar os animais.");
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/animais")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Importar animais por planilha</h1>
          <p className="text-sm text-muted-foreground">
            Aceita CSV exportado do Excel com delimitador `;`, `,` ou tab.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelo recomendado</CardTitle>
          <CardDescription>
            Comece pelo modelo abaixo para evitar erro de cabecalho.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm font-mono whitespace-pre-wrap">
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
                Nenhuma linha valida encontrada ainda. Use o modelo de cabecalho
                e revise os campos obrigatorios.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>Identificacao</TableHead>
                      <TableHead>Sexo</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Origem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.slice(0, 12).map((row) => (
                      <TableRow key={`${row.lineNumber}-${row.identificacao}`}>
                        <TableCell>{row.lineNumber}</TableCell>
                        <TableCell className="font-medium">
                          {row.identificacao}
                        </TableCell>
                        <TableCell>{row.sexo}</TableCell>
                        <TableCell>{row.loteNome ?? "Sem lote"}</TableCell>
                        <TableCell>{row.origem ?? "Nao informada"}</TableCell>
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
              A importacao so libera quando o arquivo esta consistente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={validation.issues.length === 0 ? "secondary" : "destructive"}>
                {validation.issues.length === 0 ? "Sem erros" : `${validation.issues.length} erro(s)`}
              </Badge>
              <Badge variant="outline">
                {lotes?.length ?? 0} lote(s) disponivel(is) para vinculo
              </Badge>
            </div>

            {validation.issues.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Arquivo pronto para importacao.
                </div>
                <p className="mt-2 text-emerald-800">
                  Os animais serao criados localmente e entram na fila normal de
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
                    Mais {validation.issues.length - 8} erro(s) oculto(s) no preview.
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
                  Importar {parsed.rows.length} animal(is)
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
