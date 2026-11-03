import { describe, expect, it } from "vitest";
import { ehAdmin, exigirAdmin, exigirGestao, exigirLoja, exigirRH, filtrarPorLoja, podeAlterarEscala, podeVerLoja, type Usuario } from "./auth";

const u = (perfil: Usuario["perfil"], lojaId: string | null = null): Usuario => ({ id: perfil, login: perfil.toLowerCase(), nome: perfil, perfil, lojaId, ativo: true });
const admin = u("ADMIN");
const rh = u("RH");
const gerente = u("GERENTE", "loja-a");

describe("perfis de acesso", () => {
  it("administrador altera tudo", () => {
    expect(ehAdmin(admin)).toBe(true);
    expect(podeAlterarEscala(admin)).toBe(true);
    expect(() => exigirAdmin(admin)).not.toThrow();
    expect(() => exigirGestao(admin)).not.toThrow();
    expect(podeVerLoja(admin, "loja-b")).toBe(true);
  });

  it("RH/DP organiza e valida as escalas de todas as lojas, mas não mexe em usuários nem na empresa", () => {
    expect(podeAlterarEscala(rh)).toBe(true);
    expect(() => exigirRH(rh)).not.toThrow();
    expect(() => exigirGestao(rh)).not.toThrow();
    expect(podeVerLoja(rh, "loja-b")).toBe(true);
    expect(filtrarPorLoja(rh, ["loja-a", "loja-b"], (x) => x)).toEqual(["loja-a", "loja-b"]);
    expect(() => exigirAdmin(rh)).toThrow(/administradores/);
  });

  it("gerente consulta só a própria loja e não altera a escala", () => {
    expect(podeAlterarEscala(gerente)).toBe(false);
    expect(() => exigirRH(gerente)).toThrow(/RH\/DP/);
    expect(() => exigirGestao(gerente)).toThrow();
    expect(() => exigirAdmin(gerente)).toThrow();
    expect(() => exigirLoja(gerente, "loja-a")).not.toThrow();
    expect(() => exigirLoja(gerente, "loja-b")).toThrow(/Sem acesso/);
    expect(filtrarPorLoja(gerente, ["loja-a", "loja-b"], (x) => x)).toEqual(["loja-a"]);
  });
});
