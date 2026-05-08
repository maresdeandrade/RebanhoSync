import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft,
  ClipboardCheck,
  Map as MapIcon,
  PawPrint,
  Pencil,
  Ruler,
  Trees,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type {
  PastoAguaStatusEnum,
  PastoAvaliacaoMomentoEnum,
  PastoCoberturaSoloEnum,
  PastoFezesScoreEnum,
  PastoInvasorasNivelEnum,
  SuplementoUnidadeEnum,
} from "@/lib/offline/types";
import { showError, showSuccess } from "@/utils/toast";

function parseOptionalNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return { value: null, valid: true };

  const parsed = Number(normalized);
  return {
    value: Number.isFinite(parsed) ? parsed : null,
    valid: Number.isFinite(parsed),
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return "Data nao informada";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

const labelize = (value?: string | null) =>
  value ? value.replaceAll("_", " ") : "Nao informado";

const ECC_OPTIONS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

const SUPLEMENTO_OPTIONS = [
  { value: "nenhum", label: "Nenhum", unidade: "" },
  { value: "sal_mineral", label: "Sal Mineral", unidade: "sacos" },
  { value: "sal_ureado", label: "Sal Ureado", unidade: "sacos" },
  {
    value: "proteinado",
    label: "Proteinado (Suplemento Proteico)",
    unidade: "sacos",
  },
  {
    value: "proteico_energetico",
    label: "Proteico-Energetico",
    unidade: "sacos",
  },
  { value: "racao", label: "Racao (Concentrado)", unidade: "kg" },
] as const;

type SuplementoTipoValue = (typeof SUPLEMENTO_OPTIONS)[number]["value"];

const SUPLEMENTO_BY_VALUE = new Map(
  SUPLEMENTO_OPTIONS.map((option) => [option.value, option]),
);

const PastoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rondaOpen, setRondaOpen] = useState(false);
  const [momento, setMomento] = useState<PastoAvaliacaoMomentoEnum>("ronda");
  const [alturaCm, setAlturaCm] = useState("");
  const [coberturaSolo, setCoberturaSolo] = useState<PastoCoberturaSoloEnum | "">("");
  const [invasorasNivel, setInvasorasNivel] = useState<PastoInvasorasNivelEnum | "">("");
  const [aguaStatus, setAguaStatus] = useState<PastoAguaStatusEnum | "">("");
  const [eccLoteMedio, setEccLoteMedio] = useState("");
  const [fezesScore, setFezesScore] = useState<PastoFezesScoreEnum | "">("");
  const [suplementoTipo, setSuplementoTipo] =
    useState<SuplementoTipoValue>("nenhum");
  const [suplementoQuantidade, setSuplementoQuantidade] = useState("");
  const [rondaObservacoes, setRondaObservacoes] = useState("");

  const pasto = useLiveQuery(() => (id ? db.state_pastos.get(id) : undefined), [id]);
  const lotes = useLiveQuery(
    () => (id ? db.state_lotes.where("pasto_id").equals(id).toArray() : []),
    [id],
  );
  const animaisCount = useLiveQuery(async () => {
    if (!id) return 0;

    const lotesNoPasto = await db.state_lotes.where("pasto_id").equals(id).toArray();
    let total = 0;
    for (const lote of lotesNoPasto) {
      total += await db.state_animais.where("lote_id").equals(lote.id).count();
    }
    return total;
  }, [id]);
  const ocupacaoAberta = useLiveQuery(
    () =>
      id
        ? db.state_pasto_ocupacoes
            .where("pasto_id")
            .equals(id)
            .filter((ocupacao) => ocupacao.status === "aberta" && !ocupacao.deleted_at)
            .first()
        : undefined,
    [id],
  );
  const avaliacoesPasto = useLiveQuery(async () => {
    if (!id) return [];

    const detalhes = await db.event_eventos_pasto_avaliacao
      .where("pasto_id")
      .equals(id)
      .toArray();
    const ativos = detalhes.filter((avaliacao) => !avaliacao.deleted_at);
    const eventos = await db.event_eventos.bulkGet(
      ativos.map((avaliacao) => avaliacao.evento_id),
    );
    const eventosById = new Map(
      eventos.filter(Boolean).map((evento) => [evento!.id, evento!]),
    );

    return ativos
      .map((avaliacao) => ({
        avaliacao,
        evento: eventosById.get(avaliacao.evento_id) ?? null,
      }))
      .sort((a, b) => {
        const aDate = a.evento?.occurred_at ?? a.avaliacao.created_at;
        const bDate = b.evento?.occurred_at ?? b.avaliacao.created_at;
        return bDate.localeCompare(aDate);
      });
  }, [id]);

  if (!id || !pasto) {
    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="Estrutura do rebanho"
          title="Pasto nao encontrado"
          description="O registro nao esta mais disponivel ou ainda nao foi sincronizado neste dispositivo."
          actions={
            <Button variant="outline" onClick={() => navigate("/pastos")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          }
        />
      </div>
    );
  }

  const infraestrutura = pasto.infraestrutura;
  const tipoAreaLabel = pasto.tipo_area || pasto.tipo_pasto || "Nao informado";
  const forrageiraLabel =
    pasto.forrageira_cultivar ||
    pasto.forrageira_nome ||
    pasto.forrageira_genero ||
    pasto.tipo_area ||
    pasto.tipo_pasto ||
    "Nao informado";
  const ultimaAvaliacao = avaliacoesPasto?.[0] ?? null;
  const suplementoSelecionado =
    SUPLEMENTO_BY_VALUE.get(suplementoTipo) ?? SUPLEMENTO_OPTIONS[0];
  const suplementoUnidade =
    suplementoSelecionado.unidade as SuplementoUnidadeEnum | "";

  const resetRondaForm = () => {
    setMomento("ronda");
    setAlturaCm("");
    setCoberturaSolo("");
    setInvasorasNivel("");
    setAguaStatus("");
    setEccLoteMedio("");
    setFezesScore("");
    setSuplementoTipo("nenhum");
    setSuplementoQuantidade("");
    setRondaObservacoes("");
  };

  const handleSalvarRonda = async () => {
    const alturaParsed = parseOptionalNumber(alturaCm);
    const eccParsed = parseOptionalNumber(eccLoteMedio);
    const suplementoParsed =
      suplementoTipo === "nenhum"
        ? { value: null, valid: true }
        : parseOptionalNumber(suplementoQuantidade);

    if (!alturaParsed.valid) {
      showError("Altura do capim deve ser um numero valido.");
      return;
    }
    if (alturaParsed.value !== null && alturaParsed.value <= 0) {
      showError("Altura do capim deve ser maior que zero.");
      return;
    }
    if (!eccParsed.valid) {
      showError("ECC medio deve ser um numero valido.");
      return;
    }
    if (
      eccParsed.value !== null &&
      (eccParsed.value < 1 || eccParsed.value > 5)
    ) {
      showError("ECC medio deve estar entre 1 e 5.");
      return;
    }
    if (!suplementoParsed.valid) {
      showError("Quantidade de suplemento deve ser um numero valido.");
      return;
    }
    if (suplementoParsed.value !== null && suplementoParsed.value < 0) {
      showError("Quantidade de suplemento deve ser maior ou igual a zero.");
      return;
    }

    try {
      const { ops } = buildEventGesture({
        dominio: "pastagem",
        fazendaId: pasto.fazenda_id,
        pastoId: pasto.id,
        loteId: ocupacaoAberta?.lote_id ?? null,
        ocupacaoId: ocupacaoAberta?.id ?? null,
        momento,
        alturaCm: alturaParsed.value,
        coberturaSolo: coberturaSolo || null,
        invasorasNivel: invasorasNivel || null,
        eccLoteMedio: eccParsed.value,
        aguaStatus: aguaStatus || null,
        fezesScore: fezesScore || null,
        suplementoTipo:
          suplementoTipo === "nenhum" ? null : suplementoSelecionado.label,
        suplementoQuantidade: suplementoParsed.value,
        suplementoUnidade: suplementoUnidade || null,
        observacoes: rondaObservacoes.trim() || null,
        payload: {},
      });

      await createGesture(pasto.fazenda_id, ops);
      showSuccess("Ronda registrada localmente.");
      resetRondaForm();
      setRondaOpen(false);
    } catch (error) {
      console.error(error);
      showError("Nao foi possivel registrar a ronda.");
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Estrutura do rebanho"
        title={pasto.nome}
        description="Leia area, lotacao e infraestrutura do pasto em uma unica superficie de consulta."
        meta={<StatusBadge tone="neutral">{pasto.tipo_pasto ?? "Tipo nao informado"}</StatusBadge>}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/pastos")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Link to={`/pastos/${id}/editar`}>
              <Button>
                <Pencil className="mr-2 h-4 w-4" />
                Editar cadastro
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setRondaOpen(true)}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Registrar ronda
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Area"
          value={pasto.area_ha}
          hint="Hectares declarados para o piquete."
          icon={<MapIcon className="h-4 w-4" />}
        />
        <MetricCard
          label="Capacidade"
          value={pasto.capacidade_ua ?? "Nao informada"}
          hint="UA usadas como referencia de lotacao."
          icon={<Ruler className="h-4 w-4" />}
        />
        <MetricCard
          label="Animais no pasto"
          value={animaisCount ?? 0}
          hint={`${lotes?.length ?? 0} lote(s) vinculados a este pasto.`}
          icon={<PawPrint className="h-4 w-4" />}
        />
      </div>

      <section className="app-surface space-y-5 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
            Manejo e Forrageira
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Metas de altura e detalhes da pastagem para decisao de entrada e saida de lotes.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <p className="mb-3 font-medium text-foreground">Pastagem</p>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <span>
                Tipo de pastagem: {tipoAreaLabel}
              </span>
              <span>Forrageira / cultivar: {forrageiraLabel}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <p className="mb-3 font-medium text-foreground">Metas de Manejo</p>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <span>
                Altura Entrada:{" "}
                {pasto.altura_entrada_alvo_cm
                  ? `${pasto.altura_entrada_alvo_cm} cm`
                  : "Nao informado"}
              </span>
              <span>
                Altura Saida:{" "}
                {pasto.altura_saida_alvo_cm
                  ? `${pasto.altura_saida_alvo_cm} cm`
                  : "Nao informado"}
              </span>
              <span>
                Capacidade Alvo:{" "}
                {pasto.capacidade_ua_alvo !== null && pasto.capacidade_ua_alvo !== undefined
                  ? `${pasto.capacidade_ua_alvo} UA`
                  : "Nao informado"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="app-surface space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
            Ultima ronda
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Registro historico mais recente da avaliacao de campo deste pasto.
          </p>
        </div>

        {ultimaAvaliacao ? (
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge tone="info">
                {labelize(ultimaAvaliacao.avaliacao.momento)}
              </StatusBadge>
              <span className="text-sm text-muted-foreground">
                {formatDateTime(
                  ultimaAvaliacao.evento?.occurred_at ??
                    ultimaAvaliacao.avaliacao.created_at,
                )}
              </span>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              <span>
                Altura:{" "}
                {ultimaAvaliacao.avaliacao.altura_cm
                  ? `${ultimaAvaliacao.avaliacao.altura_cm} cm`
                  : "Nao informado"}
              </span>
              <span>
                Cobertura/aspecto: {labelize(ultimaAvaliacao.avaliacao.cobertura_solo)}
              </span>
              <span>Agua: {labelize(ultimaAvaliacao.avaliacao.agua_status)}</span>
              <span>
                ECC: {ultimaAvaliacao.avaliacao.ecc_lote_medio ?? "Nao informado"}
              </span>
              <span>Fezes: {labelize(ultimaAvaliacao.avaliacao.fezes_score)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma ronda registrada para este pasto.
          </p>
        )}
      </section>

      {infraestrutura ? (
        <section className="app-surface space-y-5 p-5 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
              Infraestrutura
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Leitura objetiva dos recursos de suporte ao manejo neste pasto.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">Cochos</p>
                <StatusBadge
                  tone={
                    infraestrutura.cochos?.estado === "ruim" ? "danger" : "neutral"
                  }
                >
                  {infraestrutura.cochos?.estado || "Sem estado"}
                </StatusBadge>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span>Qtd: {infraestrutura.cochos?.quantidade || 0}</span>
                <span>Tipo: {infraestrutura.cochos?.tipo || "Nao informado"}</span>
                <span>Capacidade: {infraestrutura.cochos?.capacidade || 0} m</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">Bebedouros</p>
                <StatusBadge
                  tone={
                    infraestrutura.bebedouros?.estado === "ruim"
                      ? "danger"
                      : "neutral"
                  }
                >
                  {infraestrutura.bebedouros?.estado || "Sem estado"}
                </StatusBadge>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span>Qtd: {infraestrutura.bebedouros?.quantidade || 0}</span>
                <span>Tipo: {infraestrutura.bebedouros?.tipo || "Nao informado"}</span>
                <span>Capacidade: {infraestrutura.bebedouros?.capacidade || 0} L</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">Cerca</p>
                <StatusBadge
                  tone={infraestrutura.cerca?.estado === "ruim" ? "danger" : "neutral"}
                >
                  {infraestrutura.cerca?.estado || "Sem estado"}
                </StatusBadge>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span>Tipo: {infraestrutura.cerca?.tipo || "Nao informado"}</span>
                <span>
                  Extensao: {infraestrutura.cerca?.comprimento_metros || 0} m
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">Saleiros</p>
                <StatusBadge tone={infraestrutura.saleiros?.estado === "ruim" ? "danger" : "neutral"}>
                  {infraestrutura.saleiros?.estado || "Sem estado"}
                </StatusBadge>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span>Saleiros: {infraestrutura.saleiros?.quantidade || 0}</span>
                <span>Tipo: {infraestrutura.saleiros?.tipo || "Nao informado"}</span>
                <span>Capacidade: {infraestrutura.saleiros?.capacidade || 0}</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {lotes && lotes.length > 0 ? (
        <section className="app-surface space-y-4 p-5 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
              Lotes neste pasto
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Acesse rapidamente os grupos vinculados e a lotacao atual do campo.
            </p>
          </div>

          <div className="grid gap-3">
            {lotes.map((lote) => (
              <Link
                key={lote.id}
                to={`/lotes/${lote.id}`}
                className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{lote.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {lote.status === "ativo" ? "Em operacao" : "Fora da rotina principal"}
                  </p>
                </div>
                <StatusBadge tone={lote.status === "ativo" ? "success" : "neutral"}>
                  {lote.status}
                </StatusBadge>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Trees}
          title="Nenhum lote neste pasto"
          description="Vincule um lote ao pasto para acompanhar ocupacao e lotacao diretamente por aqui."
        />
      )}

      <Dialog open={rondaOpen} onOpenChange={setRondaOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Registrar ronda</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Momento</Label>
              <Select
                value={momento}
                onValueChange={(value) =>
                  setMomento(value as PastoAvaliacaoMomentoEnum)
                }
              >
                <SelectTrigger aria-label="Momento da ronda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saida</SelectItem>
                  <SelectItem value="ronda">Ronda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="altura-cm">Altura do capim (cm)</Label>
              <Input
                id="altura-cm"
                value={alturaCm}
                onChange={(event) => setAlturaCm(event.target.value)}
                inputMode="decimal"
              />
            </div>

            <div className="space-y-2">
              <Label>Taxa de cobertura do solo / Aspecto visual</Label>
              <Select
                value={coberturaSolo || "nao_informado"}
                onValueChange={(value) =>
                  setCoberturaSolo(
                    value === "nao_informado"
                      ? ""
                      : (value as PastoCoberturaSoloEnum),
                  )
                }
              >
                <SelectTrigger aria-label="Taxa de cobertura do solo / Aspecto visual">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Nao informado</SelectItem>
                  <SelectItem value="excelente">
                    Excelente (sem solo exposto)
                  </SelectItem>
                  <SelectItem value="media">Media (falhas leves)</SelectItem>
                  <SelectItem value="ruim">
                    Ruim (solo exposto e plantas daninhas)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Invasoras</Label>
              <Select
                value={invasorasNivel || "nao_informado"}
                onValueChange={(value) =>
                  setInvasorasNivel(
                    value === "nao_informado"
                      ? ""
                      : (value as PastoInvasorasNivelEnum),
                  )
                }
              >
                <SelectTrigger aria-label="Nivel de invasoras">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Nao informado</SelectItem>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  <SelectItem value="leve">Leve</SelectItem>
                  <SelectItem value="moderada">Moderada</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Agua</Label>
              <Select
                value={aguaStatus || "nao_informado"}
                onValueChange={(value) =>
                  setAguaStatus(
                    value === "nao_informado" ? "" : (value as PastoAguaStatusEnum),
                  )
                }
              >
                <SelectTrigger aria-label="Status da agua">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Nao informado</SelectItem>
                  <SelectItem value="limpo">Limpo</SelectItem>
                  <SelectItem value="sujo">Sujo</SelectItem>
                  <SelectItem value="nivel_baixo">Nivel baixo</SelectItem>
                  <SelectItem value="seco">Seco</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ECC medio do lote</Label>
              <div
                className="grid grid-cols-3 gap-2 sm:grid-cols-5"
                role="group"
                aria-label="ECC medio do lote"
              >
                {ECC_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={eccLoteMedio === option ? "default" : "outline"}
                    aria-pressed={eccLoteMedio === option}
                    onClick={() => setEccLoteMedio(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Escore de fezes</Label>
              <Select
                value={fezesScore || "nao_informado"}
                onValueChange={(value) =>
                  setFezesScore(
                    value === "nao_informado" ? "" : (value as PastoFezesScoreEnum),
                  )
                }
              >
                <SelectTrigger aria-label="Escore de fezes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Nao informado</SelectItem>
                  <SelectItem value="aneladas">Aneladas</SelectItem>
                  <SelectItem value="ressecadas_empilhadas">
                    Ressecadas empilhadas
                  </SelectItem>
                  <SelectItem value="liquidas">Liquidas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Suplemento tipo</Label>
              <Select
                value={suplementoTipo}
                onValueChange={(value) => {
                  setSuplementoTipo(value as SuplementoTipoValue);
                  setSuplementoQuantidade("");
                }}
              >
                <SelectTrigger aria-label="Suplemento tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPLEMENTO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="suplemento-quantidade">
                {suplementoUnidade === "kg"
                  ? "Quantidade (Kg)"
                  : suplementoUnidade === "sacos"
                    ? "Quantidade (Sacos)"
                    : "Quantidade"}
              </Label>
              <Input
                id="suplemento-quantidade"
                value={suplementoQuantidade}
                onChange={(event) => setSuplementoQuantidade(event.target.value)}
                inputMode="decimal"
                disabled={suplementoTipo === "nenhum"}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ronda-observacoes">Observacoes</Label>
              <Textarea
                id="ronda-observacoes"
                value={rondaObservacoes}
                onChange={(event) => setRondaObservacoes(event.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRondaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarRonda}>Salvar ronda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PastoDetalhe;
