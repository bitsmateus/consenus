import Image from "next/image";

/** Moldura das telas públicas de acesso: painel da marca de um lado, formulário do outro. */
export function MolduraDeAcesso({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen">
      <section className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-black to-[#1A1C20] p-12 md:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(204,153,51,.28), transparent 68%)" }}
        />
        <Image
          src="/marca/logo-consensus-one.png"
          alt="Consensus One"
          width={560}
          height={133}
          priority
          className="relative z-10 w-full max-w-[300px] mix-blend-lighten"
        />
        <p className="relative z-10 max-w-xs font-serif text-3xl leading-tight text-dourado-400">
          Duas posições.
          <br />
          Uma solução.
        </p>
        <p className="relative z-10 text-xs text-white/40">
          Sistema de gestão de procedimentos de composição consensual
        </p>
      </section>

      <section className="flex w-full flex-col justify-center bg-white px-6 py-12 md:w-[400px] md:px-10">
        <div className="mb-8 text-center md:hidden">
          <Image
            src="/marca/selo-dourado.png"
            alt=""
            width={220}
            height={220}
            className="mx-auto mb-3 w-16"
          />
          <p className="font-serif text-xl text-preto-900">Consensus One</p>
        </div>

        <h1 className="mb-1 text-xl font-semibold text-preto-900">{titulo}</h1>
        <p className="mb-6 text-sm text-carvao-500">{descricao}</p>

        {children}

        <p className="mt-8 text-center text-xs leading-relaxed text-carvao-300">
          Acesso monitorado e registrado.
          <br />
          Uso restrito a pessoas autorizadas.
        </p>
      </section>
    </main>
  );
}
