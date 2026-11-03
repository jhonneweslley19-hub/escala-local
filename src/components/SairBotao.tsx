"use client";

export function SairBotao({ children }: { children?: React.ReactNode }) {
  return (
    <a
      href="#"
      onClick={async (e) => {
        e.preventDefault();
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      {children ?? "Sair"}
    </a>
  );
}
