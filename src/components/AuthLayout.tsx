import type { ReactNode } from "react"
import { LogoMark } from "./Brand.tsx"

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3 text-lg font-medium">
          <LogoMark size={40} />
          <span>Vozear</span>
        </div>
        <div className="grid gap-4">
          <h2 className="font-heading text-3xl font-medium tracking-tight">Cada aula no ritmo certo.</h2>
          <ul className="grid gap-2 text-sm text-primary-foreground/80">
            <li>Agenda semanal por professor</li>
            <li>Recados e links em cada aula</li>
            <li>Mensalidade com Pix e WhatsApp</li>
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/70">Escola de música</p>
      </aside>
      <div className="flex flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-2 text-lg font-medium lg:hidden">
          <LogoMark size={32} />
          <span>Vozear</span>
        </div>
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
