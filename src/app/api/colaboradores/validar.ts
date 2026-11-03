import { ehData, exigir } from "@/lib/server/http";
import type { Colaborador } from "@/lib/engine/types";

const TIPOS = ["FERIAS", "AFASTAMENTO", "LICENCA", "OUTRO"];

export function validarColaborador(b: Record<string, unknown>): Omit<Colaborador, "id"> {
  exigir(typeof b.nome === "string" && b.nome.trim(), "Informe o nome");
  exigir(typeof b.setorId === "string", "Informe o setor");
  exigir(typeof b.cargaSemanal === "number" && b.cargaSemanal > 0 && b.cargaSemanal <= 44, "Carga semanal deve estar entre 1 e 44h");
  const dias = (b.diasIndisponiveis ?? []) as unknown[];
  exigir(Array.isArray(dias) && dias.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6), "Dias indisponíveis inválidos");
  const ausencias = (b.ausencias ?? []) as Colaborador["ausencias"];
  exigir(
    Array.isArray(ausencias) && ausencias.every((a) => ehData(a.inicio) && ehData(a.fim) && a.inicio <= a.fim && TIPOS.includes(a.tipo)),
    "Ausências inválidas",
  );
  const minuto = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  const de = minuto(b.disponivelDe);
  const ate = minuto(b.disponivelAte);
  exigir(de == null || ate == null || de < ate, "Janela de disponibilidade inválida");
  exigir(b.ultimoDomingoFolga == null || b.ultimoDomingoFolga === "" || ehData(b.ultimoDomingoFolga), "Data do último domingo de folga inválida");
  return {
    nome: b.nome.trim(),
    setorId: b.setorId,
    cargaSemanal: b.cargaSemanal,
    domingoQuinzenal: Boolean(b.domingoQuinzenal),
    menorDeIdade: Boolean(b.menorDeIdade),
    diasIndisponiveis: dias as number[],
    disponivelDe: de,
    disponivelAte: ate,
    ausencias,
    ultimoDomingoFolga: (b.ultimoDomingoFolga as string) || undefined,
    diasConsecutivosAntes: b.diasConsecutivosAntes ? Number(b.diasConsecutivosAntes) : undefined,
  };
}
