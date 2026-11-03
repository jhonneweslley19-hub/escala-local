"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { Perfil } from "@/lib/perfis";
import { ICONE } from "./Nav";
import { BotaoTema } from "./SeletorTema";
import { SairBotao } from "./SairBotao";

/** Rodapé do menu: o nome de quem está logado; ao clicar, abre as opções da conta. */
export function MenuUsuario({ nome, perfil, nomePerfil, comLogin }: { nome: string; perfil: Perfil; nomePerfil: string; comLogin: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    const fechar = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", fechar);
    return () => document.removeEventListener("click", fechar);
  }, []);
  // Fecha ao navegar para outra página.
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  const ativo = (href: string) => (path.startsWith(href) ? "ativo" : undefined);
  return (
    <details className="usuario" ref={ref}>
      <summary title={`${nome} · ${nomePerfil}`}>
        {ICONE.usuarios}
        <span className="usuario-nome">
          <b>{nome}</b>
          <small>{nomePerfil}</small>
        </span>
        <svg className="seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M7 15l5-5 5 5" /></svg>
      </summary>
      <div className="usuario-menu nav">
        {perfil === "ADMIN" && (
          <Link href="/usuarios" className={ativo("/usuarios")}>
            {ICONE.usuarios}
            <span>Usuários</span>
          </Link>
        )}
        {comLogin && (
          <Link href="/conta" className={ativo("/conta")}>
            {ICONE.senha}
            <span>Minha senha</span>
          </Link>
        )}
        <Link href="/privacidade" className={ativo("/privacidade")}>
          {ICONE.privacidade}
          <span>Privacidade</span>
        </Link>
        <BotaoTema />
        {comLogin && (
          <SairBotao>
            {ICONE.sair}
            <span>Sair</span>
          </SairBotao>
        )}
      </div>
    </details>
  );
}
