import { describe, it, expect, vi, afterEach } from "vitest";
import { showSuccess, showError, showInfo, dismissToast } from "../toast";
import { toast } from "sonner";

// Mock the sonner module
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe("Toast Utilities", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("showSuccess", () => {
    it("should call toast.success with the correct message", () => {
      const message = "Operation successful";
      showSuccess(message);
      expect(toast.success).toHaveBeenCalledWith(message);
      expect(toast.success).toHaveBeenCalledTimes(1);
    });
  });

  describe("showError", () => {
    it("should call toast.error with the correct message", () => {
      const message = "Something went wrong";
      showError(message);
      expect(toast.error).toHaveBeenCalledWith(message);
      expect(toast.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("showInfo", () => {
    it("should call toast.info with the correct message", () => {
      const message = "Just so you know";
      showInfo(message);
      expect(toast.info).toHaveBeenCalledWith(message);
      expect(toast.info).toHaveBeenCalledTimes(1);
    });
  });

  describe("dismissToast", () => {
    it("should call toast.dismiss with the correct toastId", () => {
      const toastId = "toast-123";
      dismissToast(toastId);
      expect(toast.dismiss).toHaveBeenCalledWith(toastId);
      expect(toast.dismiss).toHaveBeenCalledTimes(1);
    });
  });
});
