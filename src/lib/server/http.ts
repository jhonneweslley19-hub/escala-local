import "server-only";
import { NextResponse } from "next/server";

export class ErroEntrada extends Error {}

export function json(dados: unknown, status = 200) {
  return NextResponse.json(dados, { status });
}

/** Executa o handler e converte erros em respostas JSON. */
export async function rota(fn: () => unknown | Promise<unknown>) {
  try {
    const r = await fn();
    return r instanceof Response ? r : json(r ?? { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    const status =
      e instanceof ErroEntrada ? 400
      : e instanceof Error && e.name === "ErroAcesso" ? (e as Error & { status: number }).status
      : e instanceof Error && e.name === "ErroRegra" ? 409
      : 500;
    return json({ erro: msg }, status);
  }
}

export function exigir<T>(cond: T, mensagem: string): asserts cond {
  if (!cond) throw new ErroEntrada(mensagem);
}

export const ehData = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const ehHora = (s: unknown): s is string => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
