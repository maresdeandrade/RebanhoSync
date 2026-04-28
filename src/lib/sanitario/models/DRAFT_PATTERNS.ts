/**
 * Documentação — Draft Model Patterns & Integration
 *
 * Guia prático de como usar o novo draft model em componentes.
 */

/**
 * ## Pattern 1: Edição Simples com Hook
 *
 * Componente que encapsula estado de draft com validação automática.
 * Ideal para editores modais ou forms.
 *
 * ```typescript
 * import { useProtocolItemDraft } from "@/hooks/useProtocolItemDraft";
 * import { ProtocolItemDraftEditor } from "@/components/sanitario/ProtocolItemDraftEditor";
 *
 * export function MyProtocolEditor() {
 *   const draft = useProtocolItemDraft(); // ou com initialDraft
 *
 *   const handleSave = () => {
 *     const domain = draft.toDomain();
 *     if (!domain) {
 *       showError("Dados inválidos.");
 *       return;
 *     }
 *     // Salvar domain puro
 *     await saveProtocol(domain);
 *   };
 *
 *   return (
 *     <>
 *       <ProtocolItemDraftEditor
 *         draft={draft.draft}
 *         onUpdateDraft={draft.updateDraft}
 *         errors={draft.errors}
 *       />
 *       <Button
 *         onClick={handleSave}
 *         disabled={!draft.isValid}
 *       >
 *         Salvar
 *       </Button>
 *     </>
 *   );
 * }
 * ```
 */

/**
 * ## Pattern 2: Sincronização com Dados Remotos
 *
 * Quando carregar protocolo do servidor, converter para draft e permitir edição.
 *
 * ```typescript
 * import { useEffect } from "react";
 * import { useProtocolItemDraft } from "@/hooks/useProtocolItemDraft";
 *
 * export function EditProtocolModal({ itemId, onSave }) {
 *   const draft = useProtocolItemDraft();
 *
 *   useEffect(() => {
 *     // 1. Carregar domínio puro do servidor
 *     const domain = await fetchProtocol(itemId);
 *
 *     // 2. Deserializar para draft (para edição)
 *     draft.fromDomain(domain);
 *   }, [itemId]);
 *
 *   const handleSave = () => {
 *     // 1. Validar e converter draft para domínio puro
 *     const updated = draft.toDomain();
 *     if (!updated) return;
 *
 *     // 2. Enviar domínio puro para servidor
 *     await updateProtocol(itemId, updated);
 *     onSave();
 *   };
 *
 *   return (
 *     <ProtocolItemDraftEditor
 *       draft={draft.draft}
 *       onUpdateDraft={draft.updateDraft}
 *       errors={draft.errors}
 *     />
 *   );
 * }
 * ```
 */

/**
 * ## Pattern 3: Validação em Tempo Real
 *
 * Componentes podem reagir a mudanças de validação em tempo real.
 *
 * ```typescript
 * import { useProtocolItemDraft } from "@/hooks/useProtocolItemDraft";
 *
 * export function FormWithValidation() {
 *   const draft = useProtocolItemDraft();
 *
 *   return (
 *     <form>
 *       <ProtocolItemDraftEditor
 *         draft={draft.draft}
 *         onUpdateDraft={draft.updateDraft}
 *         errors={draft.errors}
 *       />
 *
 *       {!draft.isValid && (
 *         <Alert variant="destructive">
 *           Preencha todos os campos obrigatórios
 *         </Alert>
 *       )}
 *
 *       <Button
 *         type="submit"
 *         disabled={!draft.isValid || draft.errors.length > 0}
 *       >
 *         Salvar
 *       </Button>
 *     </form>
 *   );
 * }
 * ```
 */

/**
 * ## Pattern 4: Campos Dinâmicos por Mode
 *
 * Componentes mostram/ocultam fields baseado em `draft.mode`.
 * Já implementado em `ProtocolItemDraftEditor.tsx`.
 *
 * ```typescript
 * import { getVisibleFieldsByMode } from "@/lib/sanitario/models/draft";
 *
 * export function DynamicFields({ draft, onUpdate }) {
 *   const visible = getVisibleFieldsByMode(draft.mode);
 *
 *   return (
 *     <>
 *       {visible.campaignFields && (
 *         <CampaignFieldsSection />
 *       )}
 *       {visible.ageWindowFields && (
 *         <AgeWindowFieldsSection />
 *       )}
 *       {visible.intervalFields && (
 *         <IntervalFieldsSection />
 *       )}
 *       {visible.triggerEventField && (
 *         <TriggerEventFieldsSection />
 *       )}
 *     </>
 *   );
 * }
 * ```
 */

/**
 * ## Pattern 5: Roundtrip Draft ↔ Domain
 *
 * Garantir que conversão é determinística e reversível.
 *
 * ```typescript
 * import {
 *   mapDraftToDomain,
 *   mapDomainToDraft,
 *   validateProtocolItemDraft
 * } from "@/lib/sanitario/models/draft";
 *
 * // Draft → Domain → Draft (deve ser igual)
 * const originalDraft = createEmptyProtocolItemDraft({...});
 * const domain = mapDraftToDomain(originalDraft);
 * const reconstructedDraft = mapDomainToDraft(domain);
 *
 * assert(JSON.stringify(reconstructedDraft) === JSON.stringify(originalDraft));
 * ```
 */

/**
 * ## Pattern 6: Integração com FarmProtocolManager
 *
 * Refactor parcial do componente principal para usar novo draft model.
 *
 * ### Antes:
 * ```typescript
 * function FarmProtocolManager() {
 *   const [itemDraft, setItemDraft] = useState<SanitaryProtocolItemDraft>(
 *     createEmptyProtocolItemDraft()
 *   );
 *   // ... validação manual, estado espalhado
 * }
 * ```
 *
 * ### Depois:
 * ```typescript
 * import { useProtocolItemDraft } from "@/hooks/useProtocolItemDraft";
 *
 * function FarmProtocolManager() {
 *   const itemDraft = useProtocolItemDraft();
 *
 *   const handleSaveItem = async () => {
 *     const domain = itemDraft.toDomain();
 *     if (!domain) {
 *       showError("Dados inválidos");
 *       return;
 *     }
 *
 *     // Salvar domínio puro
 *     const gesture = createGesture({
 *       table: "protocolos_sanitarios_itens",
 *       action: "INSERT",
 *       record: buildProtocolItemInsertRecord(domain),
 *     });
 *     await syncGesture(gesture);
 *   };
 *
 *   return (
 *     <Dialog open={openItemEditor} onOpenChange={setOpenItemEditor}>
 *       <DialogContent>
 *         <ProtocolItemDraftEditor
 *           draft={itemDraft.draft}
 *           onUpdateDraft={itemDraft.updateDraft}
 *           errors={itemDraft.errors}
 *         />
 *         <DialogFooter>
 *           <Button
 *             onClick={handleSaveItem}
 *             disabled={!itemDraft.isValid}
 *           >
 *             Salvar
 *           </Button>
 *         </DialogFooter>
 *       </DialogContent>
 *     </Dialog>
 *   );
 * }
 * ```
 */

/**
 * ## Pattern 7: Validação Estrutural vs. Temporal
 *
 * Draft valida ESTRUTURA (campos obrigatórios, tipos).
 * Scheduler valida TEMPORALIDADE (datas, janelas, dependências).
 *
 * ```typescript
 * // 1. Validação estrutural (draft)
 * const errors = validateProtocolItemDraft(draft);
 * if (errors.length > 0) {
 *   return "Draft inválido";
 * }
 *
 * // 2. Conversão para domínio puro
 * const domain = mapDraftToDomain(draft);
 *
 * // 3. Validação do domínio (scheduler usa isto)
 * const result = computeNextSanitaryOccurrence({
 *   item: domain,
 *   subject,
 *   history,
 *   now,
 * });
 *
 * if (result.reasonCode !== "ready") {
 *   return `Agendamento bloqueado: ${result.reasonMessage}`;
 * }
 * ```
 */

/**
 * ## Pattern 8: Estados Intermediários na UI
 *
 * Draft permite states incompletos enquanto usuário digita.
 * Domínio deve estar SEMPRE válido (ou conversão falha).
 *
 * ```typescript
 * // Usuário começa a digitar
 * draft = {
 *   layer: "sanitario",
 *   scopeType: undefined,  // Not typed yet
 *   mode: undefined,       // Not selected
 *   // ...
 * }
 *
 * errors = ["Escopo é obrigatório", "Modo é obrigatório"]
 * isValid = false
 *
 * // Botão salvar desabilitado
 * <Button disabled={!isValid}>Salvar</Button>
 *
 * // Quando preenchido completamente:
 * draft = {
 *   layer: "sanitario",
 *   scopeType: "animal",
 *   mode: "campanha",
 *   anchor: "entrada_fazenda",
 *   campaignMonths: [5, 6],
 * }
 *
 * errors = []
 * isValid = true
 *
 * // Botão habilitado, conversão é segura
 * const domain = mapDraftToDomain(draft);
 * ```
 */

/**
 * ## Pattern 9: Dependências entre Items
 *
 * Items podem depender de outros (ex: dose 2 depende de dose 1).
 *
 * ```typescript
 * const draftDose1 = createEmptyProtocolItemDraft({
 *   familyCode: "raiva",
 *   itemCode: "dose_1",
 *   // ...
 * });
 *
 * const draftDose2 = createEmptyProtocolItemDraft({
 *   familyCode: "raiva",
 *   itemCode: "dose_2",
 *   dependsOnItemCode: "dose_1",  // Depende de dose_1
 *   // ...
 * });
 *
 * // Ao salvar, ambos são validados no servidor
 * // Scheduler detecta ciclos e rejeita
 * ```
 */

/**
 * ## Pattern 10: Compliance e Documentação
 *
 * Item pode exigir documentação (laudo, atestado).
 *
 * ```typescript
 * const draft = createEmptyProtocolItemDraft({
 *   isComplianceRequired: true,
 *   complianceDocType: "laudo_veterinario",
 *   // ...
 * });
 *
 * // UI mostra aviso: "Este protocolo requer documentação"
 * // Em runtime, agenda valida presença de documento
 * ```
 */

export const DraftPatterns = "See comments above for 10 patterns of draft model usage";
