import "server-only";
import { randomUUID } from "node:crypto";
import { executar, todos, transacao, um, type Linha } from "./db";
import { dimensionar, simularQuadro } from "../engine/dimensionamento";
import { gerarEscala } from "../engine/gerador";
import { validarEscala } from "../engine/validador";
import { aplicarHistorico, historicoAntes } from "../engine/historico";
import { addDias, hhmm } from "../engine/tempo";
import { lerPlanilha, normalizar } from "../importacao";
import type {
  Colaborador,
  DiaEscala,
  EntradaGeracao,
  Escala,
  Feriado,
  RegimeId,
  RegrasEmpresa,
  ResultadoEscala,
  Setor,
} from "../engine/types";

export interface Loja {
  id: string;
  nome: string;
  cidade: string;
  abre: string;
  fecha: string;
  abreDomingo: string;
  fechaDomingo: string;
}

export interface SetorLoja extends Setor {
  lojaId: string;
}

const toLoja = (r: Linha): Loja => ({
  id: String(r.id),
  nome: String(r.nome),
  cidade: String(r.cidade),
  abre: String(r.abre),
  fecha: String(r.fecha),
  abreDomingo: String(r.abre_domingo),
  fechaDomingo: String(r.fecha_domingo),
});

const toSetor = (r: Linha): SetorLoja => ({
  id: String(r.id),
  lojaId: String(r.loja_id),
  nome: String(r.nome),
  inicios: JSON.parse(String(r.inicios)),
  demanda: JSON.parse(String(r.demanda)),
});

// ---------- Empresa / regras ----------

/** Encarregado pelo tratamento de dados pessoais (LGPD, art. 41). */
export interface Encarregado {
  nome: string;
  email: string;
}

export async function obterEmpresa(): Promise<{ nome: string; regras: RegrasEmpresa; encarregado: Encarregado | null }> {
  const r = (await um("SELECT * FROM escala_empresa WHERE id = 1"))!;
  return { nome: String(r.nome), regras: JSON.parse(String(r.regras)), encarregado: r.encarregado ? JSON.parse(String(r.encarregado)) : null };
}

export async function salvarEncarregado(e: Encarregado | null) {
  await executar("UPDATE escala_empresa SET encarregado = ? WHERE id = 1", [e ? JSON.stringify(e) : null]);
}

export async function salvarRegras(regras: RegrasEmpresa) {
  await executar("UPDATE escala_empresa SET regras = ? WHERE id = 1", [JSON.stringify(regras)]);
}

export async function salvarNomeEmpresa(nome: string) {
  await executar("UPDATE escala_empresa SET nome = ? WHERE id = 1", [nome]);
}

/** Apaga lojas, setores, colaboradores e escalas (mantém regras e feriados) para começar com dados reais. */
export async function limparDados() {
  await transacao(async () => {
    for (const t of ["escala_escalas", "escala_colaboradores", "escala_setores", "escala_lojas"]) await executar(`DELETE FROM ${t}`);
  });
}

// ---------- Lojas e setores ----------

export async function listarLojas(): Promise<(Loja & { colaboradores: number; setores: number })[]> {
  const rows = await todos(
    `SELECT l.*, (SELECT COUNT(*) FROM escala_colaboradores c WHERE c.loja_id = l.id) AS n_colab,
            (SELECT COUNT(*) FROM escala_setores s WHERE s.loja_id = l.id) AS n_setores
     FROM escala_lojas l ORDER BY l.nome`,
  );
  return rows.map((r) => ({ ...toLoja(r), colaboradores: Number(r.n_colab), setores: Number(r.n_setores) }));
}

export async function obterLoja(id: string): Promise<Loja | null> {
  const r = await um("SELECT * FROM escala_lojas WHERE id = ?", [id]);
  return r ? toLoja(r) : null;
}

export async function criarLoja(dados: Omit<Loja, "id">): Promise<Loja> {
  const id = `loja-${randomUUID().slice(0, 8)}`;
  await executar("INSERT INTO escala_lojas VALUES (?, ?, ?, ?, ?, ?, ?)", [
    id, dados.nome, dados.cidade, dados.abre, dados.fecha, dados.abreDomingo, dados.fechaDomingo,
  ]);
  return { id, ...dados };
}

export async function listarSetores(lojaId: string): Promise<SetorLoja[]> {
  return (await todos("SELECT * FROM escala_setores WHERE loja_id = ? ORDER BY ordem, nome", [lojaId])).map(toSetor);
}

export async function obterSetor(id: string): Promise<SetorLoja | null> {
  const r = await um("SELECT * FROM escala_setores WHERE id = ?", [id]);
  return r ? toSetor(r) : null;
}

export async function criarSetor(lojaId: string, nome: string, inicios: number[], demanda: number[][]): Promise<SetorLoja> {
  const id = `${lojaId}:${randomUUID().slice(0, 8)}`;
  const ordem = Number((await um("SELECT COUNT(*) AS n FROM escala_setores WHERE loja_id = ?", [lojaId]))?.n ?? 0);
  await executar("INSERT INTO escala_setores VALUES (?, ?, ?, ?, ?, ?)", [id, lojaId, nome, JSON.stringify(inicios), JSON.stringify(demanda), ordem]);
  return { id, lojaId, nome, inicios, demanda };
}

export async function atualizarSetor(id: string, dados: Partial<Pick<Setor, "nome" | "inicios" | "demanda">>) {
  const atual = await obterSetor(id);
  if (!atual) throw new Error("Setor não encontrado");
  // Campos ausentes (undefined) mantêm o valor atual.
  const novo = { ...atual, nome: dados.nome ?? atual.nome, inicios: dados.inicios ?? atual.inicios, demanda: dados.demanda ?? atual.demanda };
  await executar("UPDATE escala_setores SET nome = ?, inicios = ?, demanda = ? WHERE id = ?", [
    novo.nome, JSON.stringify(novo.inicios), JSON.stringify(novo.demanda), id,
  ]);
  return novo;
}

// ---------- Colaboradores ----------

export async function listarColaboradores(lojaId?: string): Promise<(Colaborador & { lojaId: string })[]> {
  const rows = lojaId
    ? await todos("SELECT loja_id, dados FROM escala_colaboradores WHERE loja_id = ? ORDER BY nome", [lojaId])
    : await todos("SELECT loja_id, dados FROM escala_colaboradores ORDER BY nome");
  return rows.map((r) => ({ ...JSON.parse(String(r.dados)), lojaId: String(r.loja_id) }));
}

export async function obterColaborador(id: string): Promise<(Colaborador & { lojaId: string }) | null> {
  const r = await um("SELECT loja_id, dados FROM escala_colaboradores WHERE id = ?", [id]);
  return r ? { ...JSON.parse(String(r.dados)), lojaId: String(r.loja_id) } : null;
}

export async function salvarColaborador(lojaId: string, c: Omit<Colaborador, "id"> & { id?: string }): Promise<Colaborador> {
  const setor = await obterSetor(c.setorId);
  if (!setor || setor.lojaId !== lojaId) throw new Error("Setor inválido para a loja");
  const colab: Colaborador = { ...c, id: c.id ?? `${lojaId}:${randomUUID().slice(0, 8)}` };
  await executar(
    `INSERT INTO escala_colaboradores VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET loja_id = excluded.loja_id, setor_id = excluded.setor_id, nome = excluded.nome, dados = excluded.dados`,
    [colab.id, lojaId, colab.setorId, colab.nome, JSON.stringify(colab)],
  );
  return colab;
}

/** Importa colaboradores de uma planilha CSV para a loja; tudo ou nada. */
export async function importarColaboradores(lojaId: string, csv: string) {
  const setores = new Map((await listarSetores(lojaId)).map((s) => [normalizar(s.nome), s.id]));
  const r = lerPlanilha(csv, setores);
  if (r.erros.length) return { importados: 0, erros: r.erros };
  await transacao(async () => {
    for (const c of r.colaboradores) await salvarColaborador(lojaId, c);
  });
  return { importados: r.colaboradores.length, erros: [] };
}

export async function excluirColaborador(id: string) {
  await executar("DELETE FROM escala_colaboradores WHERE id = ?", [id]);
}

// ---------- Feriados ----------

/** Feriado nacional/estadual (lojaId = null, vale para todas as lojas) ou municipal de uma loja. */
export interface FeriadoLoja extends Feriado {
  id: number;
  lojaId: string | null;
}

const toFeriado = (r: Linha): FeriadoLoja => ({
  id: Number(r.id),
  data: String(r.data),
  nome: String(r.nome),
  lojaId: r.loja_id == null ? null : String(r.loja_id),
});

/** Sem `lojaId`: todos os feriados. Com `lojaId`: os gerais mais os daquela loja. */
export async function listarFeriados(lojaId?: string): Promise<FeriadoLoja[]> {
  const rows = lojaId
    ? await todos("SELECT * FROM escala_feriados WHERE loja_id IS NULL OR loja_id = ? ORDER BY data", [lojaId])
    : await todos("SELECT * FROM escala_feriados ORDER BY data, loja_id");
  return rows.map(toFeriado);
}

export async function salvarFeriado(f: Feriado & { lojaId?: string | null }) {
  const lojaId = f.lojaId || null;
  const existente = await um("SELECT id FROM escala_feriados WHERE data = ? AND COALESCE(loja_id, '') = COALESCE(?, '')", [f.data, lojaId]);
  if (existente) await executar("UPDATE escala_feriados SET nome = ? WHERE id = ?", [f.nome, Number(existente.id)]);
  else await executar("INSERT INTO escala_feriados (data, nome, loja_id) VALUES (?, ?, ?)", [f.data, f.nome, lojaId]);
}

export async function excluirFeriado(id: number) {
  await executar("DELETE FROM escala_feriados WHERE id = ?", [id]);
}

// ---------- Escalas ----------

export type StatusEscala = "RASCUNHO" | "PUBLICADA";

/** A escala guarda um retrato da entrada para que edições e revalidações sejam consistentes. */
export interface EscalaSalva {
  id: string;
  lojaId: string;
  status: StatusEscala;
  publicadoEm: string | null;
  publicadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  entrada: EntradaGeracao;
  resultado: ResultadoEscala;
}

export interface ResumoEscala {
  id: string;
  lojaId: string;
  loja: string;
  inicio: string;
  semanas: number;
  status: StatusEscala;
  regimeId: RegimeId | null;
  criadoEm: string;
  metricas: ResultadoEscala["metricas"];
  regimes: RegimeId[];
}

export type AcaoEvento = "GERADA" | "EDITADA" | "PUBLICADA" | "REABERTA";

export interface EventoEscala {
  id: number;
  quando: string;
  usuario: string;
  acao: AcaoEvento;
  detalhe: Record<string, unknown> | null;
}

export class ErroRegra extends Error {
  name = "ErroRegra";
}

export async function registrarEvento(escalaId: string, usuario: string, acao: AcaoEvento, detalhe?: Record<string, unknown>) {
  await executar("INSERT INTO escala_eventos (escala_id, quando, usuario, acao, detalhe) VALUES (?, ?, ?, ?, ?)", [
    escalaId, new Date().toISOString(), usuario, acao, detalhe ? JSON.stringify(detalhe) : null,
  ]);
}

export async function listarEventos(escalaId: string): Promise<EventoEscala[]> {
  return (await todos("SELECT * FROM escala_eventos WHERE escala_id = ? ORDER BY id DESC", [escalaId])).map((r) => ({
    id: Number(r.id),
    quando: String(r.quando),
    usuario: String(r.usuario),
    acao: r.acao as AcaoEvento,
    detalhe: r.detalhe ? JSON.parse(String(r.detalhe)) : null,
  }));
}

/**
 * Dias das escalas da loja nas 4 semanas anteriores a `inicio`, por colaborador.
 * Escalas publicadas têm prioridade sobre rascunhos; entre iguais, vale a mais recente.
 */
async function diasAnteriores(lojaId: string, inicio: string): Promise<Map<string, DiaEscala[]>> {
  const desde = addDias(inicio, -28);
  // Escalas que terminam depois de `desde` (filtradas aqui para o SQL servir aos dois bancos).
  const candidatas = (
    await todos("SELECT id, inicio, semanas, status, atualizado_em FROM escala_escalas WHERE loja_id = ? AND inicio < ?", [lojaId, inicio])
  )
    .filter((r) => addDias(String(r.inicio), Number(r.semanas) * 7) > desde)
    .sort((a, b) => Number(a.status === "PUBLICADA") - Number(b.status === "PUBLICADA") || String(a.atualizado_em).localeCompare(String(b.atualizado_em)));
  const rows: Linha[] = [];
  for (const c of candidatas) rows.push((await um("SELECT dados FROM escala_escalas WHERE id = ?", [c.id]))!);
  const porColab = new Map<string, Map<string, DiaEscala>>();
  for (const r of rows) {
    const dias = JSON.parse(String(r.dados)).resultado.escala.dias as Record<string, DiaEscala[]>;
    for (const [colab, lista] of Object.entries(dias)) {
      const m = porColab.get(colab) ?? new Map<string, DiaEscala>();
      for (const d of lista) if (d.data >= desde && d.data < inicio) m.set(d.data, d);
      porColab.set(colab, m);
    }
  }
  return new Map([...porColab].map(([k, m]) => [k, [...m.values()]]));
}

export async function criarEscala(lojaId: string, inicio: string, semanas: number, usuario: string, regimeId?: RegimeId): Promise<EscalaSalva> {
  const anteriores = await diasAnteriores(lojaId, inicio);
  let comHistorico = 0;
  const colaboradores = (await listarColaboradores(lojaId)).map(({ lojaId: _l, ...c }) => {
    const dias = anteriores.get(c.id);
    if (!dias?.length) return c;
    comHistorico++;
    return aplicarHistorico(c, historicoAntes(dias, inicio));
  });
  const entrada: EntradaGeracao = {
    inicio,
    semanas,
    regimeId,
    regras: (await obterEmpresa()).regras,
    setores: (await listarSetores(lojaId)).map(({ lojaId: _l, ...s }) => s),
    colaboradores,
    feriados: (await listarFeriados(lojaId)).map(({ data, nome }) => ({ data, nome })),
  };
  const resultado = gerarEscala(entrada);
  const agora = new Date().toISOString();
  const salva: EscalaSalva = {
    id: randomUUID(), lojaId, status: "RASCUNHO", publicadoEm: null, publicadoPor: null,
    criadoEm: agora, atualizadoEm: agora, entrada, resultado,
  };
  await transacao(async () => {
    await executar(
      `INSERT INTO escala_escalas (id, loja_id, inicio, semanas, regime_id, criado_em, atualizado_em, dados, metricas, regimes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [salva.id, lojaId, inicio, semanas, regimeId ?? null, agora, agora, JSON.stringify({ entrada, resultado }),
        JSON.stringify(resultado.metricas), JSON.stringify(resultado.escala.regimes)],
    );
    await registrarEvento(salva.id, usuario, "GERADA", {
      colaboradores: colaboradores.length,
      comHistorico,
      erros: resultado.metricas.erros,
      cobertura: resultado.metricas.coberturaPct,
    });
  });
  return salva;
}

export async function obterEscala(id: string): Promise<EscalaSalva | null> {
  const r = await um("SELECT * FROM escala_escalas WHERE id = ?", [id]);
  if (!r) return null;
  const { entrada, resultado } = JSON.parse(String(r.dados));
  return {
    id,
    lojaId: String(r.loja_id),
    status: r.status as StatusEscala,
    publicadoEm: r.publicado_em == null ? null : String(r.publicado_em),
    publicadoPor: r.publicado_por == null ? null : String(r.publicado_por),
    criadoEm: String(r.criado_em),
    atualizadoEm: String(r.atualizado_em),
    entrada,
    resultado,
  };
}

export async function listarEscalas(lojaId?: string): Promise<ResumoEscala[]> {
  const sql = `SELECT e.id, e.loja_id, e.inicio, e.semanas, e.status, e.regime_id, e.criado_em, e.metricas, e.regimes, l.nome AS loja
               FROM escala_escalas e JOIN escala_lojas l ON l.id = e.loja_id
               ${lojaId ? "WHERE e.loja_id = ?" : ""} ORDER BY e.criado_em DESC`;
  const rows = await todos(sql, lojaId ? [lojaId] : []);
  return rows.map((r) => ({
    id: String(r.id),
    lojaId: String(r.loja_id),
    loja: String(r.loja),
    inicio: String(r.inicio),
    semanas: Number(r.semanas),
    status: r.status as StatusEscala,
    regimeId: (r.regime_id as RegimeId | null) ?? null,
    criadoEm: String(r.criado_em),
    metricas: JSON.parse(String(r.metricas)),
    regimes: JSON.parse(String(r.regimes)),
  }));
}

const resumoDia = (d: DiaEscala) =>
  d.tipo === "T" ? `${hhmm(d.inicio!)}–${hhmm(d.fim!)}` : d.tipo === "F" ? "Folga" : `Ausência (${d.motivo ?? ""})`;

/** Revalida a escala alterada e grava o novo resultado. */
export async function salvarResultado(e: EscalaSalva, escala: Escala): Promise<ResultadoEscala> {
  const { violacoes, cobertura, metricas } = validarEscala({ ...e.entrada, escala });
  e.resultado = { escala, violacoes, cobertura, metricas };
  e.atualizadoEm = new Date().toISOString();
  await executar("UPDATE escala_escalas SET dados = ?, metricas = ?, atualizado_em = ? WHERE id = ?", [
    JSON.stringify({ entrada: e.entrada, resultado: e.resultado }), JSON.stringify(metricas), e.atualizadoEm, e.id,
  ]);
  return e.resultado;
}

/** Altera um dia da escala manualmente, revalida tudo e registra no histórico. */
export async function editarDia(id: string, colaboradorId: string, dia: DiaEscala, usuario: string): Promise<EscalaSalva> {
  return transacao(async () => {
    const e = await obterEscala(id);
    if (!e) throw new ErroRegra("Escala não encontrada");
    if (e.status === "PUBLICADA") throw new ErroRegra("Escala publicada não pode ser alterada. Reabra-a para edição.");
    const dias = e.resultado.escala.dias[colaboradorId];
    const idx = dias?.findIndex((d) => d.data === dia.data) ?? -1;
    if (idx < 0) throw new ErroRegra("Dia fora da escala");
    const antes = dias[idx];
    dias[idx] = dia;
    const { metricas } = await salvarResultado(e, e.resultado.escala);
    const nome = e.entrada.colaboradores.find((c) => c.id === colaboradorId)?.nome ?? colaboradorId;
    await registrarEvento(id, usuario, "EDITADA", { colaborador: nome, data: dia.data, antes: resumoDia(antes), depois: resumoDia(dia), erros: metricas.erros });
    return e;
  });
}

export async function publicarEscala(id: string, usuario: string, forcar = false): Promise<EscalaSalva> {
  return transacao(async () => {
    const e = await obterEscala(id);
    if (!e) throw new ErroRegra("Escala não encontrada");
    if (e.status === "PUBLICADA") return e;
    if (e.resultado.metricas.erros > 0 && !forcar) {
      throw new ErroRegra(`A escala tem ${e.resultado.metricas.erros} violações legais. Corrija antes de publicar.`);
    }
    const agora = new Date().toISOString();
    await executar("UPDATE escala_escalas SET status = 'PUBLICADA', publicado_em = ?, publicado_por = ? WHERE id = ?", [agora, usuario, id]);
    await registrarEvento(id, usuario, "PUBLICADA", { erros: e.resultado.metricas.erros });
    return { ...e, status: "PUBLICADA", publicadoEm: agora, publicadoPor: usuario };
  });
}

export async function reabrirEscala(id: string, usuario: string, motivo: string): Promise<EscalaSalva> {
  return transacao(async () => {
    const e = await obterEscala(id);
    if (!e) throw new ErroRegra("Escala não encontrada");
    if (e.status !== "PUBLICADA") return e;
    await executar("UPDATE escala_escalas SET status = 'RASCUNHO', publicado_em = NULL, publicado_por = NULL WHERE id = ?", [id]);
    await registrarEvento(id, usuario, "REABERTA", { motivo });
    return { ...e, status: "RASCUNHO", publicadoEm: null, publicadoPor: null };
  });
}

export async function excluirEscala(id: string) {
  const e = await obterEscala(id);
  if (e?.status === "PUBLICADA") throw new ErroRegra("Escala publicada não pode ser excluída. Reabra-a antes.");
  await executar("DELETE FROM escala_escalas WHERE id = ?", [id]);
}

// ---------- Dimensionamento ----------

export async function dimensionamentoLoja(lojaId: string) {
  return dimensionar(await listarSetores(lojaId), await listarColaboradores(lojaId), (await obterEmpresa()).regras);
}

export async function simulacaoLoja(lojaId: string) {
  return simularQuadro(await listarSetores(lojaId), await listarColaboradores(lojaId), (await obterEmpresa()).regras, gerarEscala);
}
