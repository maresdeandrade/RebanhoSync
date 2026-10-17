import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  faqItems,
  howItWorksSteps,
  productAreas,
  trustPillars,
} from "@/components/marketing/marketingContent";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import {
  MarketingContainer,
  MarketingSectionHeader,
  ScreenshotPlaceholder,
  TrailConnector,
} from "@/components/marketing/MarketingPrimitives";

function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="py-14 sm:py-20 lg:py-24">
      <MarketingContainer>
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--brand-accent))]">
            {eyebrow}
          </p>
          <h1 className="marketing-heading mt-4 text-[2.5rem] font-bold leading-[1.05] sm:text-5xl lg:text-[3.5rem]">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-content-secondary">
            {description}
          </p>
        </div>
      </MarketingContainer>
    </section>
  );
}

function PageCta() {
  return (
    <section className="bg-brand py-14 text-brand-foreground sm:py-16">
      <MarketingContainer className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="marketing-heading text-3xl font-semibold">
            Veja o RebanhoSync no contexto da sua operação.
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/75">
            A demonstração assistida é o próximo passo recomendado durante o beta interno.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="bg-[hsl(var(--brand-secondary))] text-[hsl(var(--brand-secondary-foreground))] hover:bg-[hsl(var(--brand-secondary))]/90"
        >
          <Link to="/contato">
            Solicitar demonstração
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </MarketingContainer>
    </section>
  );
}

export function MarketingProduct() {
  return (
    <MarketingLayout
      title="Produto"
      description="Animais, lotes, manejo, operação de campo e contexto comercial conectados em uma plataforma operacional de gestão pecuária."
    >
      <PageIntro
        eyebrow="Produto"
        title="Uma plataforma para conectar a operação pecuária."
        description="O RebanhoSync organiza capacidades por trabalho real: acompanhar o rebanho, planejar e registrar manejo, trabalhar no campo, preservar contexto comercial e consultar a gestão."
      />

      <section className="bg-surface py-14 sm:py-20 lg:py-24">
        <MarketingContainer className="space-y-14">
          {productAreas.map((area, index) => (
            <article
              key={area.key}
              className="grid items-center gap-8 border-b border-border pb-14 last:border-0 last:pb-0 lg:grid-cols-12"
            >
              <div className={index % 2 === 1 ? "lg:order-2 lg:col-span-5" : "lg:col-span-5"}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--brand-accent))]">
                  {area.job}
                </p>
                <h2 className="marketing-heading mt-3 text-3xl font-semibold">{area.title}</h2>
                <p className="mt-4 text-base leading-7 text-content-secondary">{area.value}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {area.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="rounded-full border border-border bg-[hsl(var(--brand-background))] px-3 py-1.5 text-xs font-medium text-content-secondary"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              </div>
              <div className={index % 2 === 1 ? "lg:order-1 lg:col-span-7" : "lg:col-span-7"}>
                <ScreenshotPlaceholder
                  code={area.screenshot.split(" • ")[0]}
                  title={area.screenshot.split(" • ")[1] ?? area.screenshot}
                />
              </div>
            </article>
          ))}
        </MarketingContainer>
      </section>

      <section className="py-14 sm:py-20">
        <MarketingContainer>
          <div className="rounded-2xl border border-[hsl(var(--brand-secondary))]/55 bg-[hsl(var(--brand-secondary))]/10 p-6 sm:p-8">
            <h2 className="marketing-heading text-2xl font-semibold">O que o produto não transforma automaticamente em decisão</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-content-secondary">
              Histórico, tags, sinais e insights não equivalem a autorização de venda, abate, carência vencida ou aptidão operacional. Essas decisões exigem fonte e regra técnica explícitas.
            </p>
          </div>
        </MarketingContainer>
      </section>
      <PageCta />
    </MarketingLayout>
  );
}

export function MarketingHowItWorks() {
  return (
    <MarketingLayout
      title="Como funciona"
      description="Do registro no campo à informação disponível para gestão: entenda o fluxo operacional do RebanhoSync."
    >
      <PageIntro
        eyebrow="Como funciona"
        title="Do registro no campo à decisão na gestão."
        description="Quem executa registra. A plataforma preserva o histórico e mantém o estado atual separado. Quem gere consulta o contexto disponível quando precisa."
      />

      <section className="bg-surface py-14 sm:py-20 lg:py-24">
        <MarketingContainer>
          <div className="space-y-12">
            {howItWorksSteps.map((step, index) => (
              <article key={step.title} className="grid gap-6 lg:grid-cols-[80px_1fr_1.2fr] lg:items-center">
                <div className="hidden h-full flex-col items-center lg:flex">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                    {index + 1}
                  </span>
                  {index < howItWorksSteps.length - 1 ? <TrailConnector vertical className="mt-2 flex-1" /> : null}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--brand-accent))] lg:hidden">0{index + 1}</p>
                  <h2 className="marketing-heading mt-2 text-2xl font-semibold sm:text-3xl">{step.title}</h2>
                  <p className="mt-4 text-base leading-7 text-content-secondary">{step.description}</p>
                  <p className="mt-4 inline-flex rounded-full bg-[hsl(var(--brand-primary-subtle))] px-3 py-1.5 text-xs font-semibold text-brand">
                    {step.capability}
                  </p>
                </div>
                <ScreenshotPlaceholder code={step.screenshot.split(" • ")[0]} title={step.screenshot.split(" • ")[1] ?? step.screenshot} />
              </article>
            ))}
          </div>
        </MarketingContainer>
      </section>

      <section className="py-14 sm:py-20">
        <MarketingContainer>
          <div className="grid gap-6 rounded-2xl border border-border bg-surface p-6 sm:p-8 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--brand-accent))]">Planejamento</p>
              <h2 className="marketing-heading mt-2 text-2xl font-semibold">Agenda = intenção ou tarefa futura.</h2>
              <p className="mt-3 text-sm leading-6 text-content-secondary">O que precisa acontecer permanece como planejamento até que exista um fato executado.</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--brand-accent))]">Histórico</p>
              <h2 className="marketing-heading mt-2 text-2xl font-semibold">Evento = fato executado.</h2>
              <p className="mt-3 text-sm leading-6 text-content-secondary">A interface não apresenta uma intenção futura como se fosse um fato histórico.</p>
            </div>
          </div>
        </MarketingContainer>
      </section>
      <PageCta />
    </MarketingLayout>
  );
}

export function MarketingTrust() {
  return (
    <MarketingLayout
      title="Segurança e confiança"
      description="Conheça os princípios de acesso, isolamento, histórico e sincronização que sustentam a confiabilidade operacional do RebanhoSync."
    >
      <PageIntro
        eyebrow="Segurança e confiança"
        title="Confiança em informação operacional começa na arquitetura."
        description="O site comunica apenas contratos que podem ser sustentados. Claims absolutos de segurança, perda zero ou imutabilidade universal permanecem bloqueados sem validação técnica específica."
      />

      <section className="bg-surface py-14 sm:py-20 lg:py-24">
        <MarketingContainer>
          <div className="grid gap-6 md:grid-cols-2">
            {trustPillars.map((pillar, index) => (
              <article key={pillar.title} className="rounded-2xl border border-border bg-[hsl(var(--brand-background))] p-6">
                {index === 0 ? <ShieldCheck className="h-6 w-6 text-brand" /> : <LockKeyhole className="h-6 w-6 text-brand" />}
                <h2 className="marketing-heading mt-5 text-2xl font-semibold">{pillar.title}</h2>
                <p className="mt-3 text-sm leading-6 text-content-secondary">{pillar.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-[hsl(var(--brand-accent))]/40 bg-[hsl(var(--brand-accent))]/8 p-6 sm:p-8">
            <h2 className="marketing-heading text-2xl font-semibold">Claims deliberadamente bloqueados</h2>
            <p className="mt-3 text-sm leading-6 text-content-secondary">
              “100% seguro”, “nunca perde dados”, “zero conflito”, “zero duplicidade” e “eventos universalmente imutáveis” não fazem parte da copy pública desta V1.
            </p>
          </div>
        </MarketingContainer>
      </section>
      <PageCta />
    </MarketingLayout>
  );
}

export function MarketingFaq() {
  return (
    <MarketingLayout
      title="Perguntas frequentes"
      description="Respostas diretas sobre operação offline-first, múltiplos usuários, sincronização e escopo atual do RebanhoSync."
    >
      <PageIntro
        eyebrow="FAQ"
        title="Perguntas frequentes"
        description="Quando uma resposta ainda depende de política comercial ou validação técnica, isso é dito de forma explícita em vez de ser preenchido com promessa."
      />
      <section className="bg-surface py-12 sm:py-16 lg:py-20">
        <MarketingContainer>
          <div className="mx-auto max-w-[860px]">
            <Accordion type="single" collapsible>
              {faqItems.map((item, index) => (
                <AccordionItem key={item.question} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left text-base sm:text-lg">{item.question}</AccordionTrigger>
                  <AccordionContent className="text-base leading-7 text-content-secondary">{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </MarketingContainer>
      </section>
      <PageCta />
    </MarketingLayout>
  );
}

export function MarketingContact() {
  const [submittedPreview, setSubmittedPreview] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedPreview(true);
  };

  return (
    <MarketingLayout
      title="Solicitar demonstração"
      description="Solicite uma demonstração assistida do RebanhoSync. A integração comercial do formulário permanece bloqueada até política de privacidade e backend aprovados."
    >
      <PageIntro
        eyebrow="Demonstração"
        title="Veja o RebanhoSync com a sua operação em mente."
        description="Esta implementação entrega a experiência e validação do formulário. O envio real permanece desativado até existirem política de privacidade, destino comercial e SLA aprovados."
      />

      <section className="bg-surface py-12 sm:py-16 lg:py-20">
        <MarketingContainer>
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <MarketingSectionHeader
                eyebrow="Antes de publicar"
                title="Sem coleta silenciosa e sem formulário de fachada."
                description="A V1 de preview deixa claro que os dados não são transmitidos. Isso evita criar uma promessa operacional antes de o fluxo comercial estar definido."
              />
              <div className="mt-8 space-y-4 text-sm leading-6 text-content-secondary">
                <p>• Política de privacidade: pendente.</p>
                <p>• Backend/destino do lead: pendente.</p>
                <p>• SLA de retorno: pendente.</p>
                <p>• Pricing: não publicado.</p>
              </div>
            </div>

            <div className="lg:col-span-7">
              <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-[hsl(var(--brand-background))] p-5 sm:p-8" aria-describedby="demo-form-note">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-semibold text-content-primary">
                    <span>Nome</span>
                    <input required name="name" autoComplete="name" className="h-13 w-full rounded-xl border border-input bg-surface px-4 text-base font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-[hsl(var(--brand-primary-subtle))]" />
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-content-primary">
                    <span>Telefone / WhatsApp</span>
                    <input required name="phone" type="tel" inputMode="tel" autoComplete="tel" className="h-13 w-full rounded-xl border border-input bg-surface px-4 text-base font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-[hsl(var(--brand-primary-subtle))]" />
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-content-primary">
                    <span>E-mail</span>
                    <input required name="email" type="email" autoComplete="email" className="h-13 w-full rounded-xl border border-input bg-surface px-4 text-base font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-[hsl(var(--brand-primary-subtle))]" />
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-content-primary">
                    <span>Sua função</span>
                    <select required name="role" defaultValue="" className="h-13 w-full rounded-xl border border-input bg-surface px-4 text-base font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-[hsl(var(--brand-primary-subtle))]">
                      <option value="" disabled>Selecione</option>
                      <option value="proprietario">Proprietário</option>
                      <option value="gestor">Gestor</option>
                      <option value="campo">Equipe de campo</option>
                      <option value="tecnico">Veterinário / zootecnista</option>
                      <option value="outro">Outro</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-content-primary sm:col-span-2">
                    <span>Tamanho aproximado do rebanho <span className="font-normal text-content-muted">(opcional)</span></span>
                    <input name="herdSize" inputMode="numeric" className="h-13 w-full rounded-xl border border-input bg-surface px-4 text-base font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-[hsl(var(--brand-primary-subtle))]" />
                  </label>
                </div>

                <p id="demo-form-note" className="mt-5 text-sm leading-6 text-content-muted">
                  Preview técnico: este formulário não envia nem armazena dados. A integração permanece bloqueada até aprovação da política de privacidade e do fluxo comercial.
                </p>

                {submittedPreview ? (
                  <div role="status" className="mt-5 rounded-xl border border-[hsl(var(--brand-secondary))] bg-[hsl(var(--brand-secondary))]/12 p-4 text-sm leading-6 text-content-primary">
                    Validação da interface concluída. Nenhum dado foi transmitido nesta prévia.
                  </div>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="mt-6 w-full bg-brand text-brand-foreground hover:bg-[hsl(var(--brand-primary-hover))] focus-visible:ring-[hsl(var(--brand-accent))] sm:w-auto"
                >
                  Solicitar demonstração
                </Button>
              </form>
            </div>
          </div>
        </MarketingContainer>
      </section>
    </MarketingLayout>
  );
}
