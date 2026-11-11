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

export function Bone({ width = "100%", height = "0.75rem" }: { width?: string; height?: string }) {
  return <span className="bone" style={{ width, height }} />
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="card skeleton-row">
          <Bone width="2.6rem" height="2.6rem" />
          <span>
            <Bone width={`${46 - (index % 3) * 8}%`} height="0.95rem" />
            <Bone width={`${68 - (index % 2) * 12}%`} height="0.7rem" />
          </span>
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="card skeleton-card">
          <Bone width="38%" height="0.95rem" />
          <Bone width="62%" height="0.7rem" />
          <Bone width="28%" height="1.4rem" />
        </div>
      ))}
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="stats skeleton" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: 3 }, (_, index) => (
        <article key={index}>
          <Bone width="46%" height="0.7rem" />
          <Bone width="58%" height="1.5rem" />
        </article>
      ))}
    </div>
  )
}
