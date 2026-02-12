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
import type { SanitarioTipoEnum } from "@/lib/offline/types";

// ============================================================================
// DEFINIÇÃO DOS PROTOCOLOS PADRÃO (MAPA & SBMV)
// ============================================================================

interface StandardProtocolItem {
  tipo: SanitarioTipoEnum;
  produto: string;
  intervalo_dias: number;
  dose_num: number;
  gera_agenda: boolean;
  indicacao: string;
  sexo_alvo?: "M" | "F" | "todos";
  idade_min_dias?: number;
  idade_max_dias?: number;
  observacoes?: string;
  dedup_template?: string;
}

interface StandardProtocol {
  id: string; // ID estático para referência
  nome: string;
  descricao: string;
  categoria: "vacinas" | "vermifugacao" | "medicamentos";
  obrigatorio?: boolean;
  referencia?: string; // Fonte da recomendação (MAPA, SBMV, Embrapa)
  itens: StandardProtocolItem[];
}

const STANDARD_PROTOCOLS: StandardProtocol[] = [
  // --------------------------------------------------------------------------
  // VACINAS (Imunização)
  // --------------------------------------------------------------------------
  {
    id: "vac-aftosa",
    nome: "Febre Aftosa (Obrigatória)",
    descricao:
      "Protocolo oficial de erradicação da Febre Aftosa conforme calendário nacional do MAPA.",
    categoria: "vacinas",
    obrigatorio: true,
    referencia: "MAPA - PNEFA",
    itens: [
      {
        tipo: "vacinacao",
        produto: "Vacina Febre Aftosa (Bivalente/Trivalente)",
        intervalo_dias: 180, // Semestral (Maio e Novembro geralmente)
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Todo o rebanho ou conforme calendário estadual (ex: jovens em Maio, todos em Novembro).",
        sexo_alvo: "todos",
        observacoes:
          "Verificar calendário específico do estado. Dose padrão: 2ml subcutânea. Manter refrigerada (2-8°C).",
        dedup_template: "vacina:aftosa:{ano}:{mes}",
      },
    ],
  },
  {
    id: "vac-brucelose",
    nome: "Brucelose (Obrigatória - Fêmeas)",
    descricao:
      "Vacinação obrigatória de fêmeas entre 3 e 8 meses de idade com vacina B19. Zoonose grave.",
    categoria: "vacinas",
    obrigatorio: true,
    referencia: "MAPA - PNCEBT",
    itens: [
      {
        tipo: "vacinacao",
        produto: "Vacina Brucelose B19 (Viva)",
        intervalo_dias: 0, // Dose única
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Fêmeas (bezerras) entre 3 e 8 meses de idade. Obrigatória marcação com ferro candente (V + algarismo final do ano) ou tatuagem.",
        sexo_alvo: "F",
        idade_min_dias: 90, // 3 meses
        idade_max_dias: 240, // 8 meses
        observacoes:
          "APENAS Médico Veterinário ou vacinador auxiliar cadastrado pode aplicar. Vacina viva (CUIDADO).",
        dedup_template: "vacina:brucelose:{animal_id}",
      },
    ],
  },
  {
    id: "vac-raiva",
    nome: "Raiva dos Herbívoros",
    descricao:
      "Vacinação contra Raiva. Obrigatória em regiões endêmicas e recomendada em todo o território nacional.",
    categoria: "vacinas",
    obrigatorio: false, // Depende da região, mas marcamos como recomendada
    referencia: "MAPA - PNCRH",
    itens: [
      {
        tipo: "vacinacao",
        produto: "Vacina Antirrábica",
        intervalo_dias: 365, // Anual
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Todo o rebanho a partir de 3 meses. Primovacinação requer reforço após 30 dias.",
        sexo_alvo: "todos",
        idade_min_dias: 90,
        observacoes:
          "Em áreas de foco, revacinação pode ser semestral ou conforme determinação da defesa sanitária.",
        dedup_template: "vacina:raiva:{ano}",
      },
    ],
  },
  {
    id: "vac-clostridioses",
    nome: "Clostridioses (Manqueira/Polivalente)",
    descricao:
      "Prevenção contra Carbúnculo Sintomático, Gangrena Gasosa, Enterotoxemias e Botulismo.",
    categoria: "vacinas",
    obrigatorio: false,
    referencia: "SBMV / Embrapa",
    itens: [
      {
        tipo: "vacinacao",
        produto: "Vacina Polivalente Clostridioses",
        intervalo_dias: 365, // Anual
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Todo o rebanho. Animais jovens: primovacinação aos 3-4 meses + reforço 4 semanas depois.",
        sexo_alvo: "todos",
        observacoes:
          "Essencial em sistemas intensivos e regiões com histórico da doença.",
        dedup_template: "vacina:clostridio:{ano}",
      },
    ],
  },
  {
    id: "vac-reprodutiva",
    nome: "Reprodutiva (IBR/BVD/Leptospirose)",
    descricao:
      "Prevenção de perdas gestacionais e infertilidade causadas por vírus e bactérias.",
    categoria: "vacinas",
    obrigatorio: false,
    referencia: "SBMV / Embrapa",
    itens: [
      {
        tipo: "vacinacao",
        produto: "Vacina Reprodutiva (IBR/BVD/Lepto)",
        intervalo_dias: 365, // Anual (pré-estação)
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Fêmeas em idade reprodutiva e touros. Aplicar 30 dias antes da estação de monta.",
        sexo_alvo: "todos", // Touros também vacinam
        observacoes: "Primovacinação requer reforço.",
        dedup_template: "vacina:reprodutiva:{ano}",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // VERMIFUGAÇÃO (Controle Parasitário)
  // --------------------------------------------------------------------------
  {
    id: "vermi-estrategica-seca",
    nome: "Controle Estratégico (5-7-9)",
    descricao:
      "Esquema clássico de vermifugação estratégica no início, meio e fim da seca (Maio, Julho, Setembro).",
    categoria: "vermifugacao",
    referencia: "Embrapa Gado de Corte",
    itens: [
      {
        tipo: "vermifugacao",
        produto: "Vermífugo (Base Avermectina 1%)",
        intervalo_dias: 60,
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Mês 5 (Maio) - Início da seca. Reduzir carga parasitária nos animais e pastagens.",
        dedup_template: "vermi:579:maio:{ano}",
      },
      {
        tipo: "vermifugacao",
        produto: "Vermífugo (Base Levamisol/Albendazol)",
        intervalo_dias: 60,
        dose_num: 2,
        gera_agenda: true,
        indicacao:
          "Mês 7 (Julho) - Meio da seca. Rotação de princípio ativo para evitar resistência.",
        dedup_template: "vermi:579:julho:{ano}",
      },
      {
        tipo: "vermifugacao",
        produto: "Vermífugo (Base Moxidectina/Avermectina)",
        intervalo_dias: 60,
        dose_num: 3,
        gera_agenda: true,
        indicacao:
          "Mês 9 (Setembro) - Fim da seca / Início das chuvas. Preparação para época das águas.",
        dedup_template: "vermi:579:setembro:{ano}",
      },
    ],
  },
  {
    id: "vermi-desmama",
    nome: "Vermifugação à Desmama",
    descricao:
      "Controle parasitário em bezerros no momento da desmama (fase de alto estresse e suscetibilidade).",
    categoria: "vermifugacao",
    referencia: "Prática Zootécnica Padrão",
    itens: [
      {
        tipo: "vermifugacao",
        produto: "Vermífugo (Endectocida)",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: true,
        indicacao: "Bezerros(as) na desmama (6-8 meses).",
        idade_min_dias: 180,
        idade_max_dias: 270,
        dedup_template: "vermi:desmama:{animal_id}",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // MEDICAMENTOS (Terapêuticos e Preventivos)
  // --------------------------------------------------------------------------
  {
    id: "med-cura-umbigo",
    nome: "Cura de Umbigo (Recém-Nascidos)",
    descricao:
      "Protocolo essencial para prevenção de onfaloflebites, miíases e infecções sistêmicas.",
    categoria: "medicamentos",
    referencia: "Boas Práticas de Manejo (BPM)",
    itens: [
      {
        tipo: "medicamento",
        produto: "Iodo 10% (tintura) + Repelente spray",
        intervalo_dias: 1,
        dose_num: 1,
        gera_agenda: false, // É diário/imediato, não agenda futura distante
        indicacao:
          "Imediatamente após o nascimento. Cortar umbigo se necessário (2 dedos). Mergulhar no iodo.",
        idade_min_dias: 0,
        idade_max_dias: 30,
        observacoes: "Repetir diariamente até a secagem completa (3-5 dias).",
        dedup_template: "med:umbigo:{animal_id}",
      },
    ],
  },
  {
    id: "med-tpb",
    nome: "Tratamento Tristeza Parasitária (TPB)",
    descricao:
      "Protocolo terapêutico para casos de Babesiose e Anaplasmose (Carrapato).",
    categoria: "medicamentos",
    referencia: "Protocolo Clínico Veterinário",
    itens: [
      {
        tipo: "medicamento",
        produto: "Diminazeno (Ganaseg/Outros)",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: false,
        indicacao: "Combate à Babesia. Aplicar intramuscular profunda conforme bula.",
        observacoes: "Dose geralmente 3,5mg/kg.",
      },
      {
        tipo: "medicamento",
        produto: "Oxitetraciclina L.A.",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: false,
        indicacao: "Combate à Anaplasma. Aplicar intramuscular profunda.",
        observacoes: "Dose geralmente 20mg/kg.",
      },
      {
        tipo: "medicamento",
        produto: "Antitérmico/Anti-inflamatório (Dipirona/Melo)",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: false,
        indicacao: "Controle da febre e dor. Suporte.",
      },
    ],
  },
  {
    id: "med-mastite-seca",
    nome: "Terapia de Vaca Seca (Mastite)",
    descricao:
      "Prevenção e cura de mastite no período seco em vacas leiteiras ou corte com alta produção.",
    categoria: "medicamentos",
    referencia: "SBMV - Qualidade do Leite",
    itens: [
      {
        tipo: "medicamento",
        produto: "Antibiótico Intramamário (Vaca Seca)",
        intervalo_dias: 0,
        dose_num: 1,
        gera_agenda: true,
        indicacao:
          "Vacas no encerramento da lactação (60 dias antes do parto previsto).",
        sexo_alvo: "F",
        observacoes:
          "Aplicar em todos os quartos após a última ordenha. Usar selante de teto se possível.",
        dedup_template: "med:secagem:{animal_id}",
      },
    ],
  },
];

const ProtocolosSanitarios = () => {
  const { activeFarmId } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("vacinas");

  // --------------------------------------------------------------------------
  // HOOKS E CONSULTAS
  // --------------------------------------------------------------------------

  // Garante que os dados da fazenda estejam atualizados localmente ao montar o componente
  useEffect(() => {
    if (!activeFarmId) return;
    pullDataForFarm(
      activeFarmId,
      ["protocolos_sanitarios", "protocolos_sanitarios_itens"],
      { mode: "merge" }
    ).catch((error) => {
      console.warn(
        "[protocolos-sanitarios] failed to refresh protocols",
        error
      );
    });
  }, [activeFarmId]);

  // Consulta protocolos JÁ CADASTRADOS na fazenda ativa para indicar status visualmente
  // Isso evita que o usuário adicione o mesmo protocolo padrão múltiplas vezes sem necessidade
  const protocolosExistentes = useLiveQuery(() => {
    if (!activeFarmId) return [];
    return db.state_protocolos_sanitarios
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((p) => !p.deleted_at)
      .toArray();
  }, [activeFarmId]);

  // Helper para verificar se um protocolo específico já existe na lista
  const isProtocoloAdicionado = (nomeProtocolo: string) => {
    return protocolosExistentes?.some(
      (p) => p.nome === nomeProtocolo && p.ativo
    );
  };

  // --------------------------------------------------------------------------
  // AÇÕES
  // --------------------------------------------------------------------------

  /**
   * Adiciona um protocolo padrão à fazenda ativa.
   * Utiliza o sistema de "Gestures" (createGesture) para garantir sincronização offline-first.
   * Cria tanto o registro do protocolo (cabeçalho) quanto seus itens (etapas).
   */
  const handleAdicionarProtocolo = async (protocolo: StandardProtocol) => {
    if (!activeFarmId) {
      showError("Nenhuma fazenda ativa selecionada.");
      return;
    }

    try {
      const protocoloId = crypto.randomUUID();

      // 1. Preparar operação para criar o protocolo (cabeçalho)
      // O payload armazena metadados da origem para rastreabilidade futura
      const opProtocolo = {
        table: "protocolos_sanitarios",
        action: "INSERT",
        record: {
          id: protocoloId,
          nome: protocolo.nome,
          descricao: protocolo.descricao,
          ativo: true,
          payload: {
            origem: "template_padrao",
            referencia: protocolo.referencia,
            standard_id: protocolo.id,
          },
        },
      };

      // 2. Preparar operações para criar os itens do protocolo
      // Mapeia cada etapa do padrão para um registro na tabela protocolos_sanitarios_itens
      const opsItens = protocolo.itens.map((item) => ({
        table: "protocolos_sanitarios_itens",
        action: "INSERT",
        record: {
          id: crypto.randomUUID(),
          protocolo_id: protocoloId,
          protocol_item_id: crypto.randomUUID(),
          version: 1,
          tipo: item.tipo,
          produto: item.produto,
          intervalo_dias: item.intervalo_dias,
          dose_num: item.dose_num,
          gera_agenda: item.gera_agenda,
          dedup_template: item.dedup_template || null,
          payload: {
            indicacao: item.indicacao,
            sexo_alvo: item.sexo_alvo || null,
            idade_min_dias: item.idade_min_dias || null,
            idade_max_dias: item.idade_max_dias || null,
            observacoes: item.observacoes || null,
          },
        },
      }));

      // Executa todas as operações em uma única transação (Gesture)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createGesture(activeFarmId, [opProtocolo, ...opsItens] as any);

      showSuccess(
        `Protocolo "${protocolo.nome}" adicionado à fazenda com sucesso!`
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
                    <AlertTriangle className="h-3 w-3" /> Obrigatório
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
              disabled={adicionado}
            >
              {adicionado ? "Já Adicionado" : "Adicionar à Fazenda"}
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
                            {item.dose_num}ª Etapa
                          </span>
                          {item.produto}
                        </span>
                        <Badge variant="outline">{item.tipo}</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          <span>
                            Periodicidade:{" "}
                            {item.intervalo_dias > 0
                              ? `${item.intervalo_dias} dias`
                              : "Dose Única / Imediato"}
                          </span>
                        </div>
                        <div>
                          <strong>Indicação:</strong> {item.indicacao}
                        </div>
                        {(item.sexo_alvo ||
                          item.idade_min_dias !== undefined) && (
                          <div className="col-span-1 md:col-span-2">
                            <strong>Alvo:</strong>{" "}
                            {item.sexo_alvo === "M"
                              ? "Machos"
                              : item.sexo_alvo === "F"
                              ? "Fêmeas"
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
            Protocolos Sanitários Oficiais
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Biblioteca de protocolos sanitários baseada nas recomendações do
          Ministério da Agricultura (MAPA) e Sociedade Brasileira de Medicina
          Veterinária (SBMV). Selecione e adicione os protocolos recomendados
          para garantir a conformidade legal e a saúde do seu rebanho.
        </p>
      </div>

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
          <TabsTrigger value="vermifugacao" className="flex items-center gap-2">
            <Bug className="h-4 w-4" /> Vermifugação
          </TabsTrigger>
          <TabsTrigger value="medicamentos" className="flex items-center gap-2">
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
                <strong>Atenção:</strong> O calendário de vacinação contra Febre
                Aftosa varia conforme o estado. Consulte sempre o órgão de
                defesa sanitária da sua região para datas exatas e
                obrigatoriedade.
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
                <strong>Dica de Manejo:</strong> A rotação de princípios ativos
                (bases químicas) é fundamental para evitar a resistência
                parasitária. O protocolo 5-7-9 é uma estratégia consagrada para
                otimizar o controle durante a seca.
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
                <strong>Uso Responsável:</strong> Medicamentos como antibióticos
                devem ser utilizados sob orientação veterinária e respeitando
                rigorosamente os períodos de carência (abate e leite) descritos
                na bula.
              </div>
            </div>
            {STANDARD_PROTOCOLS.filter(
              (p) => p.categoria === "medicamentos"
            ).map(renderProtocoloCard)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProtocolosSanitarios;
