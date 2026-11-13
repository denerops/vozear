import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MoreHorizontal } from "lucide-react"
import type { SituacaoAula, SituacaoMensalidade } from "../types.ts"
import { SITUACAO_AULA, SITUACAO_MENSALIDADE } from "../lib/format.ts"

export function Page({
  title,
  lede,
  children,
  action,
  kicker,
  bare = false,
}: {
  title: string
  lede?: string
  children: ReactNode
  action?: ReactNode
  kicker?: string
  bare?: boolean
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6" aria-label={bare ? title : undefined}>
      {bare ? null : (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            {kicker ? <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{kicker}</p> : null}
            <h1 className="font-heading text-2xl font-medium tracking-tight">{title}</h1>
            {lede ? <p className="max-w-2xl text-sm text-muted-foreground">{lede}</p> : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </div>
  )
}

export function Menu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={label} />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

const BADGE_CLASS: Record<string, string> = {
  realizada: "border-transparent bg-[var(--ok-soft)] text-[var(--ok)]",
  paga: "border-transparent bg-[var(--ok-soft)] text-[var(--ok)]",
  "em-aula": "border-transparent bg-[var(--ok-soft)] text-[var(--ok)]",
  aberta: "border-transparent bg-[var(--warn-soft)] text-[var(--warn)]",
  remarcada: "border-transparent bg-[var(--info-soft)] text-[var(--info)]",
  prevista: "border-transparent bg-secondary text-secondary-foreground",
  "sem-aula": "border-transparent bg-muted text-muted-foreground",
}

export function ToneBadge({ tone, children }: { tone?: string; children: ReactNode }) {
  const variant = tone === "cancelada" || tone === "falta" ? "destructive" : "outline"
  return (
    <Badge variant={variant} className={tone ? BADGE_CLASS[tone] : undefined}>
      {children}
    </Badge>
  )
}

export function StatusBadge({ value }: { value: SituacaoAula | SituacaoMensalidade | string }) {
  const label = value in SITUACAO_AULA
    ? SITUACAO_AULA[value as SituacaoAula]
    : value in SITUACAO_MENSALIDADE
      ? SITUACAO_MENSALIDADE[value as SituacaoMensalidade]
      : value
  const variant = value === "cancelada" || value === "falta" ? "destructive" : "outline"
  return (
    <Badge variant={variant} className={BADGE_CLASS[value]}>
      {label}
    </Badge>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="grid place-items-center rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl border p-3">
          <Skeleton className="size-10 rounded-full" />
          <span className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </span>
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid gap-2 rounded-xl border p-4">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-8 w-1/4" />
        </div>
      ))}
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}

export function Stat({ value, label, icon }: { value: ReactNode; label: string; icon?: ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        {icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">{icon}</span>
        ) : null}
        <span className="grid min-w-0">
          <strong className="text-xl leading-none font-medium tracking-tight">{value}</strong>
          <span className="mt-1 text-sm text-muted-foreground">{label}</span>
        </span>
      </CardContent>
    </Card>
  )
}

export function Panel({
  title,
  action,
  children,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      {title ? (
        <CardHeader className="border-b">
          <CardTitle>{title}</CardTitle>
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  )
}

export function Record({
  title,
  detail,
  extra,
  to,
}: {
  title: ReactNode
  detail?: ReactNode
  extra?: ReactNode
  to?: string
}) {
  const body = (
    <span className="grid min-w-0 gap-0.5">
      <span className="text-sm font-medium">{title}</span>
      {detail ? <span className="text-sm text-muted-foreground">{detail}</span> : null}
    </span>
  )
  return (
    <li className="flex items-center justify-between gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      {to ? <Link className="min-w-0" to={to}>{body}</Link> : body}
      {extra ? <span className="flex shrink-0 items-center gap-2">{extra}</span> : null}
    </li>
  )
}

export function PersonMark({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?"
  return (
    <Avatar>
      <AvatarFallback>{letter}</AvatarFallback>
    </Avatar>
  )
}

export function StatsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="grid gap-2 rounded-xl border p-4">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-1/3" />
        </div>
      ))}
    </div>
  )
}
