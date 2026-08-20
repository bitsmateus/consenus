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
 * Itens do menu do sistema.
 * Mantém apenas rotas já disponibilizadas ao usuário, sem placeholders de
 * desenvolvimento na interface.
 */
type ItemDeMenu = { href: string; rotulo: string };

const MENU_EQUIPE: ItemDeMenu[] = [
  { href: "/painel", rotulo: "Painel" },
  { href: "/atos", rotulo: "Procedimentos" },
  { href: "/pessoas", rotulo: "Interessados" },
  { href: "/equipe", rotulo: "Equipe" },
  { href: "/seguranca", rotulo: "Segurança" },
  { href: "/documentos", rotulo: "Documentos" },
  { href: "/auditoria", rotulo: "Auditoria" },
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
  const cabecalhos = await headers();

  // Requisição de Server Action NÃO é navegação: quem decide o destino é a
  // própria ação, que responde com o próprio redirecionamento. Desviar daqui no
  // meio dessa resposta entrega dois destinos ao navegador e o resultado é tela
  // branca — o formulário salva e a tela morre. A trava volta a valer no GET
  // seguinte, que é quando a pessoa de fato navega.
  if (!cabecalhos.has("next-action")) {
    const registro = await db.usuario.findUnique({
      where: { id: usuario.id },
      select: { totpAtivo: true },
    });

    if (!registro) {
      // Sessão apontando para usuário inexistente. Antes isto virava
      // "segundo fator pendente" e desviava em silêncio, escondendo o problema
      // real. Agora aparece no log e o acesso segue — as consultas já filtram
      // por usuário e não devolvem nada mesmo.
      console.error("[seguranca] usuário da sessão não encontrado:", usuario.id);
    }

    const caminho = cabecalhos.get("x-caminho") ?? "";

    if (
      registro &&
      segundoFatorPendente({ papel: usuario.papel, totpAtivo: registro.totpAtivo }) &&
      !caminho.startsWith(ROTA_DE_SEGURANCA)
    ) {
      console.info("[seguranca] segundo fator pendente, desviando de", caminho || "(sem caminho)");
      redirect(ROTA_DE_SEGURANCA);
    }
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
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.rotulo}
            </Link>
          ))}
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
