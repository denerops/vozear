import type { ReactNode } from "react"
import type { SituacaoAula, SituacaoMensalidade } from "../types.ts"
import { SITUACAO_AULA, SITUACAO_MENSALIDADE } from "../lib/format.ts"

export function Page({
  title,
  lede,
  children,
  action,
}: {
  title: string
  lede?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {lede ? <p className="lede">{lede}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </main>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="error" role="alert">
      {children}
    </p>
  )
}

export function StatusBadge({ value }: { value: SituacaoAula | SituacaoMensalidade }) {
  const label = value in SITUACAO_AULA
    ? SITUACAO_AULA[value as SituacaoAula]
    : SITUACAO_MENSALIDADE[value as SituacaoMensalidade]
  return (
    <span className="badge" data-status={value}>
      {label}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}
