/**
 * Rótulo da ausência. Afastamento e licença podem revelar dado de saúde (LGPD, art. 11): fora do RH/DP
 * e do administrador (`detalhar` falso) aparecem só como "Ausente". Férias não são dado sensível.
 */
export function rotuloAusencia(motivo: string | undefined, detalhar: boolean): string {
  if (motivo === "FERIAS") return "Férias";
  if (!detalhar) return "Ausente";
  return { AFASTAMENTO: "Afastamento", LICENCA: "Licença" }[motivo ?? ""] ?? "Ausente";
}
