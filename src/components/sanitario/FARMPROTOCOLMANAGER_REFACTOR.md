/**
 * Guia de Refactor — FarmProtocolManager + Novo Draft Model
 *
 * Este arquivo descreve a integração step-by-step do novo draft model
 * no componente existente. Não é código executável, é documentação.
 *
 * ## ESTADO ATUAL
 *
 * FarmProtocolManager.tsx usa:
 * - ItemEditorState com SanitaryProtocolItemDraft (do arquivo customization.ts)
 * - Validação manual com validateProtocolItemDraft (do customization.ts)
 * - Campos espalhados em state
 *
 * ## PROBLEMA
 *
 * O componente trata edição de maneira manual:
 * - Estado fragmentado
 * - Validação não é reativa
 * - Campos dinâmicos por mode não mudam visibilidade automaticamente
 * - Dedup é editável (dedup_template) em vez de calculado
 *
 * ## SOLUÇÃO
 *
 * Integrar hook useProtocolItemDraft que:
 * - Encapsula estado + validação + conversão
 * - Oferece API simples (updateDraft, toDomain, fromDomain)
 * - Feedback em tempo real (errors, isValid, isDirty)
 *
 * ## PASSOS DE REFACTOR
 *
 * ### Passo 1: Importar novos módulos
 *
 * ```typescript
 * // Antes
 * import {
 *   createEmptyProtocolItemDraft,
 *   validateProtocolItemDraft as validateDraftOld,
 * } from "@/lib/sanitario/customization";
 *
 * // Depois
 * import { useProtocolItemDraft } from "@/hooks/useProtocolItemDraft";
 * import { ProtocolItemDraftEditor } from "@/components/sanitario/ProtocolItemDraftEditor";
 * import type { ProtocolItemDraft } from "@/lib/sanitario/draft";
 * ```
 *
 * ### Passo 2: Substituir ItemEditorState
 *
 * ```typescript
 * // Antes
 * interface ItemEditorState {
 *   item: ProtocoloSanitarioItem | null;
 *   protocolId: string;
 *   draft: SanitaryProtocolItemDraft;
 *   selectedProduct: VeterinaryProductSelection | null;
 * }
 *
 * // Depois (no componente)
 * const itemDraft = useProtocolItemDraft();
 * const [selectedProduct, setSelectedProduct] = useState<VeterinaryProductSelection | null>(null);
 * const [currentItemId, setCurrentItemId] = useState<string>("");
 * ```
 *
 * ### Passo 3: Refactor handleEditItem
 *
 * ```typescript
 * // Antes
 * const handleEditItem = (item: ProtocoloSanitarioItem) => {
 *   const draft = readProtocolItemDraft(item.payload);
 *   setItemEditorState({
 *     item,
 *     protocolId: item.protocol_id,
 *     draft,
 *     selectedProduct: null,
 *   });
 *   setOpenItemEditor(true);
 * };
 *
 * // Depois
 * const handleEditItem = (item: ProtocoloSanitarioItem) => {
 *   const domain = readProtocolItemDraft(item.payload); // adaptar para domínio
 *   itemDraft.fromDomain(domain);
 *   setCurrentItemId(item.id);
 *   setOpenItemEditor(true);
 * };
 * ```
 *
 * ### Passo 4: Refactor handleSaveItem
 *
 * ```typescript
 * // Antes
 * const handleSaveItem = async () => {
 *   const errors = validateProtocolItemDraft(itemEditorState.draft);
 *   if (errors.length > 0) {
 *     showError(errors[0]);
 *     return;
 *   }
 *   // ... custom logic para serializar
 * };
 *
 * // Depois
 * const handleSaveItem = async () => {
 *   const domain = itemDraft.toDomain();
 *   if (!domain) {
 *     showError("Dados inválidos. Confira os erros acima.");
 *     return;
 *   }
 *
 *   try {
 *     const record = buildProtocolItemInsertRecord(domain);
 *     const gesture = createGesture({
 *       table: "protocolos_sanitarios_itens",
 *       action: currentItemId ? "UPDATE" : "INSERT",
 *       record,
 *     });
 *     await syncGesture(gesture);
 *     showSuccess("Item salvo com sucesso");
 *     setOpenItemEditor(false);
 *     itemDraft.resetToEmpty();
 *   } catch (error) {
 *     showError("Erro ao salvar item");
 *   }
 * };
 * ```
 *
 * ### Passo 5: Substituir diálogo de editor
 *
 * ```typescript
 * // Antes
 * <Dialog open={openItemEditor} onOpenChange={setOpenItemEditor}>
 *   <DialogContent>
 *     {/* ~200 linhas de formulário inline */}
 *     <FormSection>
 *       <Label>Tipo</Label>
 *       <Select value={itemEditorState.draft.tipo} onChange={...}>
 *         {/* options */}
 *       </Select>
 *     </FormSection>
 *     {/* ... muitos outros campos manuais */}
 *   </DialogContent>
 * </Dialog>
 *
 * // Depois
 * <Dialog open={openItemEditor} onOpenChange={setOpenItemEditor}>
 *   <DialogContent className="max-w-2xl">
 *     <DialogHeader>
 *       <DialogTitle>
 *         {currentItemId ? "Editar item" : "Novo item"}
 *       </DialogTitle>
 *     </DialogHeader>
 *
 *     <ProtocolItemDraftEditor
 *       draft={itemDraft.draft}
 *       onUpdateDraft={itemDraft.updateDraft}
 *       errors={itemDraft.errors}
 *     />
 *
 *     <DialogFooter>
 *       <Button variant="outline" onClick={() => setOpenItemEditor(false)}>
 *         Cancelar
 *       </Button>
 *       <Button
 *         onClick={handleSaveItem}
 *         disabled={!itemDraft.isValid}
 *       >
 *         Salvar
 *       </Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 * ```
 *
 * ### Passo 6: Adaptar handleNewItem
 *
 * ```typescript
 * // Antes
 * const handleNewItem = () => {
 *   setItemEditorState({
 *     item: null,
 *     protocolId: activeProtocolId,
 *     draft: createEmptyProtocolItemDraft(),
 *     selectedProduct: null,
 *   });
 *   setOpenItemEditor(true);
 * };
 *
 * // Depois
 * const handleNewItem = () => {
 *   itemDraft.resetToEmpty();
 *   setCurrentItemId("");
 *   setOpenItemEditor(true);
 * };
 * ```
 *
 * ### Passo 7: Remover lógica de validação manual
 *
 * ```typescript
 * // Remover funções locais:
 * // - validateMode()
 * // - validateAge()
 * // - validateInterval()
 * // - buildDedupPreview()
 *
 * // Estas estão agora encapsuladas em:
 * // - validateProtocolItemDraft() em draft.ts
 * // - getVisibleFieldsByMode() em draft.ts
 * // - buildSanitaryDedupKey() em dedup.ts (via editor)
 * ```
 *
 * ## BENEFÍCIOS DA REFACTOR
 *
 * 1. **Redução de LOC**: ~200 linhas de formulário → 1 componente importado
 * 2. **Validação reativa**: Erros aparecem em tempo real conforme digita
 * 3. **Campos dinâmicos**: Automáticos de acordo com mode
 * 4. **Single source of truth**: Hook centraliza todo estado de draft
 * 5. **Dedup preview automático**: Não é editável, é calculado
 * 6. **Roundtrip seguro**: draft → domain → draft é determinístico
 *
 * ## TIMING
 *
 * Refactor incremental:
 * 1. Adicionar imports (novo código coexiste com antigo)
 * 2. Substituir ItemEditorState por itemDraft hook
 * 3. Remover formulário inline, usar componente
 * 4. Testar fluxo completo (novo item, editar, salvar)
 * 5. Remover código antigo (customization.ts fields desnecessários)
 *
 * Tempo: 2–4 horas
 *
 * ## RISCOS MITIGADOS
 *
 * - Compatibilidade: Hook é pure, pode coexistir com stato antigo
 * - Queda funcional: Componente novo cobre 100% da funcionalidade antiga
 * - Teste: Testes existentes ajustados incrementalmente
 */

export const FarmProtocolManagerRefactorPlan = "See comments for step-by-step refactor guide";
