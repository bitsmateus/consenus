import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Papel } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { segundoFatorPendente } from "@/lib/totp";
import { sair } from "@/acoes/autenticacao";

const ROTA_DE_SEGURANCA = "/seguranca";

/**
 * Itens do menu. `sprint` marca a tela ainda não construída: ela continua
 * visível, para o rito completo aparecer, mas não vira link — rota inexistente
 * devolve 404, e o Next ainda faria prefetch dela em toda página.
 */
type ItemDeMenu = { href: string; rotulo: string; sprint?: number };

const MENU_EQUIPE: ItemDeMenu[] = [
  { href: "/painel", rotulo: "Painel" },
  { href: "/atos", rotulo: "Procedimentos" },
  { href: "/pessoas", rotulo: "Interessados" },
  { href: "/equipe", rotulo: "Equipe" },
  { href: "/seguranca", rotulo: "Segurança" },
  { href: "/documentos", rotulo: "Documentos" },
  { href: "/auditoria", rotulo: "Auditoria" },
  { href: "/agenda", rotulo: "Agenda", sprint: 4 },
];

const MENU_EXTERNO: ItemDeMenu[] = [
  { href: "/painel", rotulo: "Procedimentos" },
  { href: "/seguranca", rotulo: "Segurança" },
  { href: "/documentos", rotulo: "Documentos" },
  { href: "/meus-dados", rotulo: "Meus dados" },
];

const SUBTITULO: Record<Papel, string> = {
  ADMIN: "Administração",
  OPERADOR: "Câmara de Conciliação",
  PARTE: "Área do interessado",
  PROCURADOR: "Área do procurador",
};

export default async function LayoutDaAplicacao({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();

  // Obrigatoriedade do segundo fator, imposta no servidor a cada requisição.
  // Lê do banco, não do token: o token é emitido no login e ficaria velho logo
  // depois de a pessoa ativar o segundo fator.
  const registro = await db.usuario.findUnique({
    where: { id: usuario.id },
    select: { totpAtivo: true },
  });
  const caminho = (await headers()).get("x-caminho") ?? "";

  if (
    segundoFatorPendente({ papel: usuario.papel, totpAtivo: registro?.totpAtivo ?? false }) &&
    !caminho.startsWith(ROTA_DE_SEGURANCA)
  ) {
    redirect(ROTA_DE_SEGURANCA);
  }

  const equipe = usuario.papel === Papel.ADMIN || usuario.papel === Papel.OPERADOR;
  const menu = equipe ? MENU_EQUIPE : MENU_EXTERNO;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 flex-none flex-col bg-preto-900 py-5 md:flex">
        <div className="border-b border-white/10 px-5 pb-4">
          <Image
            src="/marca/logo-consensus-one.png"
            alt="Consensus One"
            width={560}
            height={133}
            priority
            className="w-full max-w-[172px] mix-blend-lighten"
          />
          <p className="mt-2 text-[10px] uppercase tracking-widest text-white/40">
            {SUBTITULO[usuario.papel]}
          </p>
        </div>

        <nav className="mt-4 flex flex-col gap-px px-2">
          {menu.map((item) =>
            item.sprint ? (
              <span
                key={item.href}
                title={`Disponível na Sprint ${item.sprint}`}
                className="flex cursor-default items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-white/25"
              >
                {item.rotulo}
                <span className="text-[9px] uppercase tracking-wider text-dourado-400/50">
                  em breve
                </span>
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/5 hover:text-white"
              >
                {item.rotulo}
              </Link>
            )
          )}
        </nav>

        <div className="mt-auto border-t border-white/10 px-5 pt-4">
          <p className="text-xs font-medium text-white">{usuario.nome}</p>
          <p className="text-[11px] text-white/40">{SUBTITULO[usuario.papel]}</p>
          <form action={sair}>
            <button className="mt-2 text-[11px] text-dourado-400 hover:underline">Sair</button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
