import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { applyTheme } from "@/lib/theme";

describe("applyTheme", () => {
  let classListMock: { add: Mock; remove: Mock };
  let matchMediaMock: Mock;

  // Backup globals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalWindow = (global as any).window;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalDocument = (global as any).document;

  beforeEach(() => {
    // Mock classList
    classListMock = {
      add: vi.fn(),
      remove: vi.fn(),
    };

    // Mock document
    const documentMock = {
      documentElement: {
        classList: classListMock,
      },
    };

    // Mock matchMedia
    matchMediaMock = vi.fn();

    // Mock window
    const windowMock = {
      matchMedia: matchMediaMock,
      document: documentMock,
    };

    // Set globals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window = windowMock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).document = documentMock;
  });

  afterEach(() => {
    // Restore globals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window = originalWindow;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).document = originalDocument;
  });

  it("applies light theme correctly", () => {
    applyTheme("light");
    expect(classListMock.remove).toHaveBeenCalledWith("light", "dark");
    expect(classListMock.add).toHaveBeenCalledWith("light");
  });

  it("applies dark theme correctly", () => {
    applyTheme("dark");
    expect(classListMock.remove).toHaveBeenCalledWith("light", "dark");
    expect(classListMock.add).toHaveBeenCalledWith("dark");
  });

  it("applies system theme (dark) correctly", () => {
    matchMediaMock.mockReturnValue({ matches: true });
    applyTheme("system");
    expect(classListMock.remove).toHaveBeenCalledWith("light", "dark");
    expect(matchMediaMock).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(classListMock.add).toHaveBeenCalledWith("dark");
  });

  it("applies system theme (light) correctly", () => {
    matchMediaMock.mockReturnValue({ matches: false });
    applyTheme("system");
    expect(classListMock.remove).toHaveBeenCalledWith("light", "dark");
    expect(matchMediaMock).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(classListMock.add).toHaveBeenCalledWith("light");
  });
});
