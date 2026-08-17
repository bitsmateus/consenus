import { cn } from "@/lib/cn";
import type { TomDeStatus } from "@/lib/formato";

const tons: Record<TomDeStatus, string> = {
  neutro: "bg-carvao-100 text-carvao-700",
  andamento: "bg-dourado-100 text-dourado-600",
  atencao: "bg-atencao-bg text-atencao",
  sucesso: "bg-sucesso-bg text-sucesso",
  encerrado: "bg-erro-bg text-erro",
};

export function Etiqueta({
  tom = "neutro",
  children,
  className,
}: {
  tom?: TomDeStatus;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium",
        tons[tom],
        className
      )}
    >
      {children}
    </span>
  );
}
