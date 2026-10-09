import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import {
  BenefitsSection,
  FaqPreviewSection,
  FinalCtaSection,
  HeroSection,
  HowItWorksSection,
  OfflineSection,
  ProblemSection,
  ProductSection,
  ProductTourSection,
  RastroSection,
  TransformationSection,
  TrustSection,
  UseCasesSection,
} from "./HomeSections";

const MarketingHome = () => (
  <MarketingLayout
    title="Plataforma operacional de gestão pecuária"
    description="Registre o que acontece no campo, preserve o histórico da operação e consulte informação confiável para gestão e decisão."
  >
    <HeroSection />
    <ProblemSection />
    <TransformationSection />
    <HowItWorksSection />
    <BenefitsSection />
    <ProductSection />
    <OfflineSection />
    <RastroSection />
    <ProductTourSection />
    <UseCasesSection />
    <TrustSection />
    {/* Social proof permanece deliberadamente oculto até existir material real aprovado. */}
    <FaqPreviewSection />
    <FinalCtaSection />
  </MarketingLayout>
);

export default MarketingHome;
