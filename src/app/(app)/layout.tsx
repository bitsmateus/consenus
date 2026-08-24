import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Papel } from "@prisma/client";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { itemAtivo, montarMenu } from "@/lib/menu";
import { exigirUsuario } from "@/lib/sessao";
import { segundoFatorPendente } from "@/lib/totp";
import { sair } from "@/acoes/autenticacao";
import { MenuMobile } from "./menu-mobile";

const ROTA_DE_SEGURANCA = "/seguranca";

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

  const menu = montarMenu(usuario.papel);
  // o middleware carimba o caminho no cabeçalho: dá para destacar o item ativo
  // sem transformar a barra inteira em Client Component
  const ativo = itemAtivo(cabecalhos.get("x-caminho") ?? "", menu);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 flex-none flex-col bg-preto-900 py-5 md:flex">
        <div className="flex-none border-b border-white/10 px-5 pb-4">
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

        <nav className="mt-4 flex flex-1 flex-col gap-px overflow-y-auto px-2">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo === item.href ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                ativo === item.href
                  ? "bg-white/10 font-medium text-white"
                  : "text-white/75 hover:bg-white/5 hover:text-white"
              )}
            >
              {item.rotulo}
            </Link>
          ))}
        </nav>

        <div className="flex-none border-t border-white/10 px-5 pt-4">
          <p className="text-xs font-medium text-white">{usuario.nome}</p>
          <p className="text-[11px] text-white/40">{SUBTITULO[usuario.papel]}</p>
          <form action={sair}>
            <button className="mt-2 text-[11px] text-dourado-400 hover:underline">Sair</button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <MenuMobile
          itens={menu}
          nome={usuario.nome}
          subtitulo={SUBTITULO[usuario.papel]}
        />
        {children}
      </div>
    </div>
  );
}
