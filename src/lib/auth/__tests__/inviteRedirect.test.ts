import { describe, expect, it } from "vitest";
import {
  getInviteAuthPath,
  getInviteRedirect,
  getPostAuthDestination,
} from "../inviteRedirect";

const path = "/invites/11111111-1111-4111-8111-111111111111";
describe("invite redirect allowlist", () => {
  it("prioriza o convite validado e preserva os fallbacks normais", () => {
    expect(getPostAuthDestination(`?redirect=${path}`, "farm")).toBe(path);
    expect(getPostAuthDestination(`?redirect=${path}`, null)).toBe(path);
    expect(
      getPostAuthDestination("?redirect=https://example.test", "farm"),
    ).toBe("/home");
    expect(getPostAuthDestination("", null)).toBe("/select-fazenda");
  });
  it.each([
    path,
    encodeURIComponent(path),
    path.toUpperCase().replace("/INVITES/", "/invites/"),
  ])("aceita caminho interno canonico: %s", (value) => {
    expect(getInviteRedirect(`?redirect=${value}`)).toBe(
      decodeURIComponent(value),
    );
  });
  it.each([
    "",
    "https://example.test" + path,
    "//example.test" + path,
    "javascript:alert(1)",
    "data:text/html,test",
    "/home",
    "/invites/token-123",
    path + "/",
    path + "/extra",
    path + "?next=https://example.test",
    path + "#fragment",
    path + "\n",
    " " + path,
    path.replace("/invites/", "/invites/../invites/"),
    path.replace("/invites/", "/invites\\"),
    path.replace("/invites/", "//invites/"),
    path.replace("1111", "11%2f11"),
    encodeURIComponent(path),
    "%",
    path + "\0",
    path.replace("1", "１"),
  ])("rejeita destino externo ou ambiguo: %s", (value) => {
    const search = new URLSearchParams({ redirect: value }).toString();
    expect(getInviteRedirect(search)).toBeNull();
    expect(getInviteAuthPath("login", search)).toBe("/login");
    expect(getInviteAuthPath("signup", search)).toBe("/signup");
  });
  it("rejeita parametros duplicados e encoding malformado", () => {
    expect(getInviteRedirect(`?redirect=${path}&redirect=${path}`)).toBeNull();
    expect(getInviteRedirect("?redirect=%E0%A4%A")).toBeNull();
    expect(getInviteRedirect("?other=value")).toBeNull();
  });
  it("preserva apenas o convite validado no link entre formularios", () => {
    const target = getInviteAuthPath("signup", `?other=value&redirect=${path}`);
    expect(target).toBe(`/signup?${new URLSearchParams({ redirect: path })}`);
  });
});
