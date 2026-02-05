/**
 * Toast notification utilities
 * 
 * P2.3 NOTE: These "trivial wrappers" implement the Facade Pattern.
 * 
 * Benefits:
 * - **Abstraction**: Decouples codebase from Sonner library (easy to swap)
 * - **Consistency**: Single import `@/utils/toast` across all components
 * - **Testability**: Easier to mock in tests (`vi.mock('@/utils/toast')`)
 * - **Future-proof**: Change implementation in one place
 * 
 * DO NOT remove these wrappers.
 */

import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showInfo = (message: string) => {
  toast.info(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
