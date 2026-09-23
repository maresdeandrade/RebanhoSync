import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  ClipboardCheck,
  CloudOff,
  FileClock,
  History,
  Layers3,
  MessageSquareText,
  Scale,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  benefits,
  faqItems,
  howItWorksSteps,
  productAreas,
  transformationSteps,
  trustPillars,
  useCases,
} from "@/components/marketing/marketingContent";
import {
  MarketingContainer,
  MarketingSectionHeader,
  RastroGlyph,
  ScreenshotPlaceholder,
  TrailConnector,
} from "@/components/marketing/MarketingPrimitives";
import { cn } from "@/lib/utils";

const benefitIcons = [History, UsersRound, Layers3, CloudOff, BookOpenText];

export function HeroSection() {
  return (
    <section className="overflow-hidden py-14 sm:py-20 lg:py-24">
      <MarketingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--brand-accent))]">
              Plataforma operacional de gestão pecuária
            </p>
            <h1 className="marketing-heading mt-4 text-[2.55rem] font-bold leading-[1.04] text-content-primary sm:text-5xl lg:text-[3.75rem]">
              O que acontece no campo, pronto para decidir.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-content-secondary">
              O RebanhoSync registra a rotina da fazenda — manejos, sanidade, peso e movimentação —, preserva o histórico da operação e coloca essa informação na mão de quem precisa gerir, mesmo onde o sinal nem sempre acompanha.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-brand text-brand-foreground hover:bg-[hsl(var(--brand-primary-hover))] focus-visible:ring-[hsl(var(--brand-accent))]"
              >
                <Link to="/contato">
                  Solicitar demonstração
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>
            <p className="mt-4 text-sm leading-6 text-content-muted">
              Beta interno. Demonstração assistida; publicação comercial ainda depende dos gates de conteúdo e operação.
            </p>
          </div>

          <div className="relative lg:col-span-7">
            <div className="absolute -left-4 top-12 hidden h-28 w-28 rounded-full bg-[hsl(var(--brand-secondary))]/20 blur-2xl sm:block" />
            <div className="relative grid gap-4 sm:grid-cols-[0.85fr_1.15fr] sm:items-end">
              <div className="hidden rounded-[1.5rem] bg-brand p-6 text-brand-foreground sm:block">
                <RastroGlyph className="h-11 w-11 text-[hsl(var(--brand-secondary))]" />
                <p className="marketing-heading mt-10 text-2xl font-semibold leading-tight">
                  Campo real. Registro estruturado. Decisão com contexto.
                </p>
                <p className="mt-4 text-sm leading-6 text-white/75">
                  A fotografia documental final entra antes da publicação. Esta composição preserva o espaço sem simular evidência inexistente.
                </p>
              </div>
              <ScreenshotPlaceholder
                code="SP1"
                title="Dashboard real"
                className="sm:-ml-3 sm:mb-5"
              />
            </div>
            <TrailConnector className="absolute -bottom-3 left-10 right-10 hidden text-[hsl(var(--brand-accent))] sm:block" />
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

export function ProblemSection() {
  const fragments = [
    { icon: FileClock, label: "Caderno", text: "Registro ficou no campo." },
    { icon: MessageSquareText, label: "Mensagem", text: "Decisão se perdeu na conversa." },
    { icon: ClipboardCheck, label: "Planilha", text: "Base chegou atrasada ao escritório." },
  ];

  return (
    <section className="bg-surface py-16 sm:py-20 lg:py-24">
      <MarketingContainer>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <MarketingSectionHeader
              eyebrow="O problema"
              title="A informação da sua operação está em quantos lugares?"
            />
          </div>
          <div className="lg:col-span-7">
            <p className="text-lg leading-8 text-content-secondary">
              Papel, WhatsApp e planilhas não são o problema. O problema é quando a fonte operacional fica fragmentada: o que acontece no campo chega incompleto à gestão e reconstruir o histórico passa a depender da memória de quem estava lá.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {fragments.map(({ icon: Icon, label, text }) => (
                <div key={label} className="rounded-2xl border border-border bg-[hsl(var(--brand-background))] p-5">
                  <Icon className="h-5 w-5 text-[hsl(var(--brand-accent))]" />
                  <p className="mt-4 text-sm font-semibold text-content-primary">{label}</p>
                  <p className="mt-2 text-sm leading-6 text-content-secondary">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

export function TransformationSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <MarketingContainer>
        <MarketingSectionHeader
          eyebrow="Continuidade"
          title="Da informação fragmentada à decisão com contexto."
          description="O RebanhoSync organiza o caminho entre o que acontece no campo e o que precisa ser recuperado depois — sem confundir intenção, fato histórico e estado atual."
          align="center"
        />

        <div className="mt-12 hidden items-center md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
          {transformationSteps.map((step, index) => (
            <div key={step} className="contents">
              <div className="rounded-2xl border border-border bg-surface px-4 py-5 text-center text-sm font-semibold text-content-primary">
                {step}
              </div>
              {index < transformationSteps.length - 1 ? (
                <TrailConnector className="w-12 lg:w-20" />
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-[20px_1fr] gap-x-4 md:hidden">
          <TrailConnector vertical className="row-span-5" />
          <div className="space-y-4">
            {transformationSteps.map((step) => (
              <div key={step} className="rounded-xl border border-border bg-surface px-4 py-4 text-sm font-semibold text-content-primary">
                {step}
              </div>
            ))}
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="bg-surface py-16 sm:py-20 lg:py-28">
      <MarketingContainer>
        <MarketingSectionHeader
          eyebrow="Como funciona"
          title="Quem executa registra. A plataforma preserva. Quem gere consulta."
          description="Cinco passos explicam o fluxo sem transformar a tecnologia em protagonista."
        />

        <div className="mt-12 space-y-8 lg:space-y-12">
          {howItWorksSteps.map((step, index) => (
            <div
              key={step.title}
              className={cn(
                "grid items-center gap-8 lg:grid-cols-12",
                index % 2 === 1 && "lg:[&>div:first-child]:order-2",
              )}
            >
              <div className="lg:col-span-5">
                <p className="text-sm font-semibold text-[hsl(var(--brand-accent))]">0{index + 1}</p>
                <h3 className="marketing-heading mt-2 text-2xl font-semibold text-content-primary sm:text-3xl">
                  {step.title}
                </h3>
                <p className="mt-4 text-base leading-7 text-content-secondary">{step.description}</p>
                <p className="mt-4 inline-flex rounded-full bg-[hsl(var(--brand-primary-subtle))] px-3 py-1.5 text-xs font-semibold text-brand">
                  {step.capability}
                </p>
              </div>
              <div className="lg:col-span-7">
                <ScreenshotPlaceholder code={step.screenshot.split(" • ")[0]} title={step.screenshot.split(" • ")[1] ?? step.screenshot} />
              </div>
            </div>
          ))}
        </div>
      </MarketingContainer>
    </section>
  );
}

export function BenefitsSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <MarketingContainer>
        <MarketingSectionHeader
          eyebrow="Benefícios"
          title="O que muda no dia a dia"
          description="O valor está na continuidade do registro e na capacidade de recuperar contexto — não em promessas automáticas de resultado produtivo."
          align="center"
        />
        <div className="mt-10 grid gap-4 md:grid-cols-6">
          {benefits.map((benefit, index) => {
            const Icon = benefitIcons[index] ?? History;
            return (
              <article
                key={benefit.title}
                className={cn(
                  "rounded-2xl border border-border bg-surface p-6",
                  index < 3 ? "md:col-span-2" : "md:col-span-3",
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--brand-primary-subtle))] text-brand">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="marketing-heading mt-5 text-xl font-semibold text-content-primary">{benefit.title}</h3>
                <p className="mt-3 text-sm leading-6 text-content-secondary">{benefit.description}</p>
              </article>
            );
          })}
        </div>
      </MarketingContainer>
    </section>
  );
}

export function ProductSection() {
  return (
    <section className="bg-surface py-16 sm:py-20 lg:py-28">
      <MarketingContainer>
        <MarketingSectionHeader
          eyebrow="Produto"
          title="Uma plataforma para conectar a operação pecuária."
          description="As capacidades são organizadas pelo trabalho que ajudam a executar, não por uma parede de funcionalidades."
        />
        <div className="mt-12 divide-y divide-border border-y border-border">
          {productAreas.map((area) => (
            <div key={area.key} className="grid gap-6 py-8 md:grid-cols-[0.7fr_1fr_1fr] md:items-start">
              <h3 className="marketing-heading text-2xl font-semibold text-content-primary">{area.title}</h3>
              <div>
                <p className="text-sm font-semibold text-content-primary">{area.job}</p>
                <p className="mt-2 text-sm leading-6 text-content-secondary">{area.value}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {area.capabilities.map((capability) => (
                  <span key={capability} className="rounded-full border border-border bg-[hsl(var(--brand-background))] px-3 py-1.5 text-xs font-medium text-content-secondary">
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link to="/produto">Conhecer o produto</Link>
          </Button>
        </div>
      </MarketingContainer>
    </section>
  );
}

export function OfflineSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <MarketingContainer>
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <CloudOff className="h-8 w-8 text-[hsl(var(--brand-accent))]" />
            <h2 className="marketing-heading mt-5 text-3xl font-semibold leading-tight sm:text-4xl">
              O trabalho acontece onde o sinal nem sempre acompanha.
            </h2>
            <p className="mt-5 text-base leading-7 text-content-secondary sm:text-lg">
              Nos fluxos compatíveis com operação offline, o RebanhoSync permite continuar registrando localmente. As operações pendentes podem ser sincronizadas quando a conexão retorna, com o estado desse processo visível na interface.
            </p>
            <p className="mt-4 text-sm leading-6 text-content-muted">
              A cobertura exata por funcionalidade permanece como gate de publicação; o site não promete “100% offline”.
            </p>
          </div>
          <div className="lg:col-span-7">
            <ScreenshotPlaceholder code="SP8" title="Estados reais de sincronização" />
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

export function RastroSection() {
  return (
    <section className="bg-brand py-16 text-brand-foreground sm:py-20 lg:py-28">
      <MarketingContainer>
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <RastroGlyph className="h-12 w-12 text-[hsl(var(--brand-secondary))]" />
            <h2 className="marketing-heading mt-6 text-4xl font-semibold leading-tight sm:text-5xl">
              O campo acontece. A informação fica.
            </h2>
            <p className="mt-5 text-base leading-7 text-white/75 sm:text-lg">
              Cada ação registrada contribui para um rastro operacional que pode ser recuperado depois, sem depender exclusivamente da memória das pessoas.
            </p>
          </div>
          <div className="lg:col-span-7">
            <div className="grid grid-cols-[20px_1fr] gap-x-5 sm:grid-cols-1">
              <TrailConnector vertical className="sm:hidden text-[hsl(var(--brand-secondary))]" />
              <div className="space-y-3 sm:grid sm:grid-cols-5 sm:items-center sm:gap-2 sm:space-y-0">
                {["Ação", "Registro", "Histórico", "Contexto", "Decisão"].map((item, index, items) => (
                  <div key={item} className="contents">
                    <div className="rounded-xl border border-white/20 bg-white/5 px-3 py-4 text-center text-sm font-semibold">{item}</div>
                    {index < items.length - 1 ? (
                      <ArrowRight className="mx-auto hidden h-4 w-4 text-[hsl(var(--brand-secondary))] sm:block" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

export function ProductTourSection() {
  const [activeKey, setActiveKey] = useState(productAreas[0].key);
  const activeArea = useMemo(
    () => productAreas.find((area) => area.key === activeKey) ?? productAreas[0],
    [activeKey],
  );

  return (
    <section className="bg-surface py-16 sm:py-20 lg:py-28">
      <MarketingContainer>
        <MarketingSectionHeader
          eyebrow="Produto em ação"
          title="Veja o RebanhoSync por tarefa"
          description="A V1 usa placeholders explícitos até que as capturas reais SP1–SP9 sejam aprovadas."
        />

        <div className="mt-10 hidden gap-8 md:grid md:grid-cols-[280px_1fr]">
          <div role="tablist" aria-label="Áreas do produto" className="space-y-2">
            {productAreas.map((area) => (
              <button
                key={area.key}
                type="button"
                role="tab"
                aria-selected={activeKey === area.key}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeKey === area.key
                    ? "border-brand bg-[hsl(var(--brand-primary-subtle))] text-brand"
                    : "border-border bg-[hsl(var(--brand-background))] text-content-secondary hover:border-border-strong",
                )}
                onClick={() => setActiveKey(area.key)}
              >
                {area.title}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
            <div>
              <h3 className="marketing-heading text-2xl font-semibold">{activeArea.title}</h3>
              <p className="mt-3 text-sm leading-6 text-content-secondary">{activeArea.value}</p>
            </div>
            <ScreenshotPlaceholder code={activeArea.screenshot.split(" • ")[0]} title={activeArea.screenshot.split(" • ")[1] ?? activeArea.screenshot} />
          </div>
        </div>

        <Accordion type="single" collapsible defaultValue={productAreas[0].key} className="mt-8 md:hidden">
          {productAreas.map((area) => (
            <AccordionItem key={area.key} value={area.key}>
              <AccordionTrigger className="text-left text-base">{area.title}</AccordionTrigger>
              <AccordionContent>
                <p className="mb-4 leading-6 text-content-secondary">{area.value}</p>
                <ScreenshotPlaceholder code={area.screenshot.split(" • ")[0]} title={area.screenshot.split(" • ")[1] ?? area.screenshot} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </MarketingContainer>
    </section>
  );
}

export function UseCasesSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <MarketingContainer>
        <MarketingSectionHeader
          eyebrow="Casos de uso"
          title="Feito para a rotina real da fazenda"
          description="Cenários em que continuidade e rastreabilidade importam mais do que uma lista extensa de funcionalidades."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map((item) => (
            <article key={item.title} className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="marketing-heading text-xl font-semibold text-content-primary">{item.title}</h3>
              <p className="mt-3 text-sm font-medium text-content-primary">{item.situation}</p>
              <p className="mt-3 text-sm leading-6 text-content-secondary">{item.outcome}</p>
            </article>
          ))}
        </div>
      </MarketingContainer>
    </section>
  );
}

export function TrustSection() {
  return (
    <section className="bg-surface py-16 sm:py-20 lg:py-28">
      <MarketingContainer>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <ShieldCheck className="h-8 w-8 text-brand" />
            <MarketingSectionHeader
              eyebrow="Confiança"
              title="Confiabilidade começa na forma como a informação é tratada."
            />
          </div>
          <div className="divide-y divide-border border-y border-border lg:col-span-8">
            {trustPillars.map((pillar) => (
              <div key={pillar.title} className="grid gap-2 py-5 sm:grid-cols-[180px_1fr] sm:gap-6">
                <p className="font-semibold text-content-primary">{pillar.title}</p>
                <p className="text-sm leading-6 text-content-secondary">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
        <Button asChild variant="outline" className="mt-8">
          <Link to="/seguranca-e-confianca">Ver segurança e confiança</Link>
        </Button>
      </MarketingContainer>
    </section>
  );
}

export function FaqPreviewSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <MarketingContainer>
        <div className="mx-auto max-w-[860px]">
          <MarketingSectionHeader eyebrow="FAQ" title="Perguntas antes de começar" align="center" />
          <Accordion type="single" collapsible className="mt-8">
            {faqItems.slice(0, 4).map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger className="text-left text-base">{item.question}</AccordionTrigger>
                <AccordionContent className="text-base leading-7 text-content-secondary">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-7 text-center">
            <Button asChild variant="outline">
              <Link to="/faq">Ver todas as perguntas</Link>
            </Button>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="bg-brand py-16 text-brand-foreground sm:py-20">
      <MarketingContainer>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--brand-secondary))]">Próximo passo</p>
            <h2 className="marketing-heading mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Veja o RebanhoSync com a sua operação em mente.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/75">
              A demonstração assistida é o caminho recomendado nesta fase. Pricing e onboarding self-service ainda não são apresentados como capacidades públicas.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="bg-[hsl(var(--brand-secondary))] text-[hsl(var(--brand-secondary-foreground))] hover:bg-[hsl(var(--brand-secondary))]/90 focus-visible:ring-white"
          >
            <Link to="/contato">
              Solicitar demonstração
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </MarketingContainer>
    </section>
  );
}
