"use client";
import { useEffect } from "react";

/** Botão de impressão; também liga o filtro de setor da barra (select[data-nav]) à URL. */
export function BotaoImprimir({ urlBase }: { urlBase: string }) {
  useEffect(() => {
    const sel = document.querySelector<HTMLSelectElement>("select[data-nav]");
    if (!sel) return;
    const ir = () => {
      const u = new URL(urlBase, window.location.origin);
      if (sel.value) u.searchParams.set("setor", sel.value);
      window.location.href = u.pathname + u.search;
    };
    sel.addEventListener("change", ir);
    return () => sel.removeEventListener("change", ir);
  }, [urlBase]);
  return (
    <button className="primario" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
