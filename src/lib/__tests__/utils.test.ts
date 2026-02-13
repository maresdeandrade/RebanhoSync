import { cn } from "@/lib/utils";
import { describe, expect, it } from "vitest";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", true && "bar", false && "baz")).toBe("foo bar");
  });

  it("handles arrays", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("handles objects", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
  });

  it("merges tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("px-2 py-1", "p-4")).toBe("p-4");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("merges tailwind classes with conditionals", () => {
    expect(cn("p-4", true && "p-2")).toBe("p-2");
    expect(cn("p-4", false && "p-2")).toBe("p-4");
  });

  it("merges tailwind classes with arrays", () => {
    expect(cn("p-4", ["p-2"])).toBe("p-2");
  });

  it("merges tailwind classes with objects", () => {
    expect(cn("p-4", { "p-2": true })).toBe("p-2");
    expect(cn("p-4", { "p-2": false })).toBe("p-4");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined/null inputs", () => {
    expect(cn(undefined, null, false)).toBe("");
  });

  it("handles mixed inputs", () => {
    expect(cn("foo", ["bar", { baz: true }])).toBe("foo bar baz");
  });

  it("handles variadic arguments", () => {
    expect(cn("foo", "bar", "baz")).toBe("foo bar baz");
  });
});
