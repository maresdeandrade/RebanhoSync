import type { ComponentProps } from "react";

import { RegistrarComplianceBlockSection, RegistrarSanitaryMovementBlockSection } from "@/pages/Registrar/components/RegistrarComplianceBlocks";
import { RegistrarTransitChecklistSection } from "@/pages/Registrar/components/RegistrarTransitChecklistSection";
import {
  TRANSIT_CHECKLIST_UF_OPTIONS,
  TRANSIT_PURPOSE_OPTIONS,
} from "@/pages/Registrar/components/useRegistrarSanitarioPackage";

type ComplianceGuardProps = {
  blockers: ComponentProps<typeof RegistrarComplianceBlockSection>["blockers"];
  warnings: ComponentProps<typeof RegistrarComplianceBlockSection>["warnings"];
};

export type RegistrarActionSectionSlotsInput = {
  transitChecklist: ComponentProps<typeof RegistrarTransitChecklistSection>["transitChecklist"];
  onTransitChecklistChange: ComponentProps<typeof RegistrarTransitChecklistSection>["onTransitChecklistChange"];
  officialTransitChecklistEnabled: ComponentProps<typeof RegistrarTransitChecklistSection>["officialTransitChecklistEnabled"];
  transitChecklistIssues: ComponentProps<typeof RegistrarTransitChecklistSection>["transitChecklistIssues"];
  showsTransitChecklist: boolean;
  blockedAnimals: ComponentProps<typeof RegistrarSanitaryMovementBlockSection>["blockedAnimals"];
  movementComplianceGuards: ComplianceGuardProps;
  nutritionComplianceGuards: ComplianceGuardProps;
};

export function buildRegistrarActionSectionSlots(
  input: RegistrarActionSectionSlotsInput,
) {
  const transitChecklistSection = input.showsTransitChecklist ? (
    <RegistrarTransitChecklistSection
      transitChecklist={input.transitChecklist}
      onTransitChecklistChange={input.onTransitChecklistChange}
      officialTransitChecklistEnabled={input.officialTransitChecklistEnabled}
      transitChecklistIssues={input.transitChecklistIssues}
      transitPurposeOptions={TRANSIT_PURPOSE_OPTIONS}
      ufOptions={TRANSIT_CHECKLIST_UF_OPTIONS}
    />
  ) : null;

  const sanitaryMovementBlockSection =
    input.showsTransitChecklist && input.blockedAnimals.length > 0 ? (
      <RegistrarSanitaryMovementBlockSection blockedAnimals={input.blockedAnimals} />
    ) : null;

  const movementComplianceBlockSection = (
    <RegistrarComplianceBlockSection
      title="Restricoes regulatorias de movimentacao"
      description="O overlay oficial detectou pendencias que afetam este fluxo de movimentacao."
      blockers={input.movementComplianceGuards.blockers}
      warnings={input.movementComplianceGuards.warnings}
    />
  );

  const nutritionComplianceBlockSection = (
    <RegistrarComplianceBlockSection
      title="Restricoes regulatorias de nutricao"
      description="O overlay oficial detectou risco alimentar ou operacional antes do lancamento deste manejo."
      blockers={input.nutritionComplianceGuards.blockers}
      warnings={input.nutritionComplianceGuards.warnings}
    />
  );

  return {
    transitChecklistSection,
    sanitaryMovementBlockSection,
    movementComplianceBlockSection,
    nutritionComplianceBlockSection,
  };
}
