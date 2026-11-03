"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { Perfil } from "@/lib/perfis";

/** Ícones de traço, 16px, no estilo do restante da interface. */
const I = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
export const ICONE = {
  painel: I("M4 13h6V4H4zM14 20h6v-9h-6zM14 4h6v4h-6zM4 20h6v-3H4z"),
  escalas: I("M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12h3M8 16h3M14 12h2M14 16h2"),
  dimensionamento: I("M4 20V10M10 20V4M16 20v-7M22 20H2"),
  colaboradores: I("M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8"),
  lojas: I("M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6"),
  configuracoes: I("M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4"),
  usuarios: I("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"),
  acessos: I("M9 4h6M8 8h8M5 4h0M5 8h0M5 12h0M8 12h8M8 16h5M5 16h0M5 20h14"),
  senha: I("M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2"),
  privacidade: I("M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"),
  sair: I("M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"),
};

type Item = { href: string; rotulo: string; icone: keyof typeof ICONE; perfis?: Perfil[] };
const GRUPOS: { titulo?: string; itens: Item[] }[] = [
  { itens: [{ href: "/", rotulo: "Painel", icone: "painel" }] },
  {
    titulo: "Escalas",
    itens: [
      { href: "/escalas", rotulo: "Escalas", icone: "escalas" },
      { href: "/dimensionamento", rotulo: "Dimensionamento", icone: "dimensionamento" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/colaboradores", rotulo: "Colaboradores", icone: "colaboradores" },
      { href: "/lojas", rotulo: "Lojas e demanda", icone: "lojas" },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { href: "/regras", rotulo: "Configurações", icone: "configuracoes", perfis: ["ADMIN", "RH"] },
      { href: "/acessos", rotulo: "Registro de acessos", icone: "acessos", perfis: ["ADMIN"] },
    ],
  },
];

export function Nav({ perfil }: { perfil: Perfil }) {
  const path = usePathname();
  const ref = useRef<HTMLElement>(null);
  // No celular o menu vira uma faixa que rola de lado: mostra o item da página aberta.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("a.ativo")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [path]);
  return (
    <nav className="nav" ref={ref}>
      {GRUPOS.map((g, n) => {
        const itens = g.itens.filter((i) => !i.perfis || i.perfis.includes(perfil));
        if (!itens.length) return null;
        return (
          <div className="nav-grupo" key={n}>
            {g.titulo && <div className="nav-titulo">{g.titulo}</div>}
            {itens.map((i) => {
              const ativo = i.href === "/" ? path === "/" : path.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} className={ativo ? "ativo" : undefined} aria-current={ativo ? "page" : undefined}>
                  {ICONE[i.icone]}
                  <span>{i.rotulo}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
