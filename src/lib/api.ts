/** Chamada JSON para a API interna; lança erro com a mensagem do servidor. */
export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((dados as { erro?: string }).erro ?? `Erro ${r.status}`);
  return dados as T;
}

export const fmtData = (iso: string) => iso.split("-").reverse().join("/");
export const fmtNum = (n: number, casas = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });
