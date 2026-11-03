"use client";
import { useEffect, useState } from "react";

export type Tema = "claro" | "escuro" | "auto";

export const CHAVE_TEMA = "escala-tema";

/**
 * Script executado no <head> antes da pintura: aplica o tema salvo e evita
 * o "piscar" de cores ao abrir a página.
 */
export const SCRIPT_TEMA = `try{var t=localStorage.getItem("${CHAVE_TEMA}");if(t==="claro")document.documentElement.dataset.theme="light";else if(t==="escuro")document.documentElement.dataset.theme="dark"}catch(e){}`;

function aplicar(tema: Tema) {
  const raiz = document.documentElement;
  if (tema === "auto") delete raiz.dataset.theme;
  else raiz.dataset.theme = tema === "claro" ? "light" : "dark";
  try {
    if (tema === "auto") localStorage.removeItem(CHAVE_TEMA);
    else localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // navegação privada sem armazenamento: o tema vale só nesta página
  }
}

const ICONES: Record<Tema, React.ReactNode> = {
  claro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  escuro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  auto: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
};

const ROTULOS: Record<Tema, string> = { claro: "Claro", escuro: "Escuro", auto: "Automático (segue o sistema)" };

export function SeletorTema({ compacto = false }: { compacto?: boolean }) {
  const [tema, setTema] = useState<Tema>("auto");

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_TEMA);
      if (salvo === "claro" || salvo === "escuro") setTema(salvo);
    } catch {
      // sem armazenamento: fica no automático
    }
  }, []);

  return (
    <div className="tema" role="group" aria-label="Tema de cores">
      {(["claro", "escuro", "auto"] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={tema === t}
          title={ROTULOS[t]}
          onClick={() => {
            setTema(t);
            aplicar(t);
          }}
        >
          {ICONES[t]}
          {!compacto && <span>{t === "auto" ? "Auto" : ROTULOS[t]}</span>}
        </button>
      ))}
    </div>
  );
}

const PROXIMO: Record<Tema, Tema> = { claro: "escuro", escuro: "auto", auto: "claro" };

/** Item do menu que alterna o tema: claro → escuro → automático. */
export function BotaoTema() {
  const [tema, setTema] = useState<Tema>("auto");
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_TEMA);
      if (salvo === "claro" || salvo === "escuro") setTema(salvo);
    } catch {
      // sem armazenamento: fica no automático
    }
  }, []);
  return (
    <button
      type="button"
      title="Trocar o tema: claro, escuro ou automático (segue o sistema)"
      onClick={() => {
        const t = PROXIMO[tema];
        setTema(t);
        aplicar(t);
      }}
    >
      {ICONES[tema]}
      <span>Tema: {tema === "auto" ? "automático" : tema}</span>
    </button>
  );
}
