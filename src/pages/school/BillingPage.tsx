import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { PixBlock } from "../../components/PixBlock.tsx"
import { CardSkeleton, Empty, ErrorNote, Page, Stat, StatGrid, StatsSkeleton, StatusBadge } from "../../components/chrome.tsx"
import { loadConfiguracao, loadInstrumentos, loadMatriculas, loadMensalidades, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, currentMonth, formatDate, formatMinute, formatMonth, saoPauloDate } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney } from "../../lib/format.ts"
import { pixCopiaECola } from "../../lib/pix.ts"
import { client } from "../../lib/supabase.ts"
import { fillTemplate, whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Configuracao, Mensalidade, Pessoa } from "../../types.ts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type View = "todas" | "aberta" | "vencida" | "paga"

function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number)
  const next = new Date(Date.UTC(year, value - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`
}

function monthTitle(month: string) {
  const label = formatMonth(`${month}-01`)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

function paidOn(value: string | null) {
  if (!value) return null
  return formatDate(value.slice(0, 10))
}

type BillingData = {
  charges: Mensalidade[]
  people: Pessoa[]
  config: Configuracao | null
  instrumentos: Map<string, string>
  horarios: Map<string, string>
}

function slotOf(day: number, minute: number) {
  const name = DIAS[day] ?? ""
  const label = name ? name.charAt(0).toUpperCase() + name.slice(1) : ""
  return `${label}, ${formatMinute(minute)}`
}

async function loadBilling(month: string): Promise<BillingData> {
  if (month === currentMonth()) {
    const { error: generateError } = await client().rpc("gerar_mensalidades", {
      p_competencia: `${month}-01`,
    })
    if (generateError) throw generateError
  }
  const [items, students, school, instruments, enrollments] = await Promise.all([
    loadMensalidades(),
    loadPessoas("aluno"),
    loadConfiguracao(),
    loadInstrumentos(),
    loadMatriculas(),
  ])
  return {
    charges: items,
    people: students,
    config: school,
    instrumentos: new Map(instruments.map((item) => [item.id, item.nome])),
    horarios: new Map(enrollments.map((item) => [item.id, slotOf(item.dia_semana, item.inicio_minuto)])),
  }
}

export function BillingPage() {
  const [month, setMonth] = useState(currentMonth())
  const billing = useQuery(`escola:mensalidades:${month}`, () => loadBilling(month))
  const charges = billing.data?.charges ?? []
  const people = billing.data?.people ?? []
  const config = billing.data?.config ?? null
  const instrumentos = billing.data?.instrumentos ?? new Map<string, string>()
  const horarios = billing.data?.horarios ?? new Map<string, string>()
  const [payError, setPayError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const loading = billing.pending && !billing.data
  const [view, setView] = useState<View>("todas")
  const [search, setSearch] = useState("")
  const [pixId, setPixId] = useState<string | null>(null)
  const today = saoPauloDate()

  const pessoas = useMemo(() => new Map(people.map((person) => [person.id, person])), [people])
  const monthCharges = charges.filter((item) => item.competencia.startsWith(month))
  const open = monthCharges.filter((item) => item.situacao === "aberta")
  const late = open.filter((item) => item.vencimento < today)
  const paid = monthCharges.filter((item) => item.situacao === "paga")
  const openSum = open.reduce((sum, item) => sum + item.valor_centavos, 0)
  const paidSum = paid.reduce((sum, item) => sum + item.valor_centavos, 0)
  const query = fold(search.trim())
  const visible = monthCharges
    .filter((item) => {
      const isLate = item.situacao === "aberta" && item.vencimento < today
      if (view === "aberta" && item.situacao !== "aberta") return false
      if (view === "vencida" && !isLate) return false
      if (view === "paga" && item.situacao !== "paga") return false
      if (!query) return true
      const person = pessoas.get(item.aluno_id)
      const instrument = instrumentos.get(item.instrumento_id) ?? ""
      return fold(`${person?.nome ?? ""} ${instrument}`).includes(query)
    })
    .sort((a, b) => {
      const rank = (item: Mensalidade) => (item.situacao === "paga" ? 2 : item.vencimento < today ? 0 : 1)
      return rank(a) - rank(b) || a.vencimento.localeCompare(b.vencimento) || (pessoas.get(a.aluno_id)?.nome ?? "").localeCompare(pessoas.get(b.aluno_id)?.nome ?? "", "pt-BR")
    })

  async function markPaid(id: string) {
    setPayError(null)
    setInfo(null)
    const { error: payError } = await client().rpc("baixar_mensalidade", { p_id: id })
    if (payError) setPayError(humanError(payError))
    else {
      setPixId(null)
      setInfo("Baixa registrada.")
      await billing.refresh()
    }
  }

  const lede = loading
    ? "Buscando mensalidades…"
    : monthCharges.length === 0
      ? month === currentMonth()
        ? "Nenhuma matrícula ativa."
        : "Nada neste mês."
      : `${open.length} em aberto · ${formatMoney(openSum)}`

  return (
    <Page
      title="Mensalidades"
      lede={lede}
      action={
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="outline" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </Button>
          <strong className="min-w-28 text-center text-sm font-medium">{monthTitle(month)}</strong>
          <Button type="button" size="icon" variant="outline" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </Button>
        </div>
      }
    >
      <ErrorNote>{payError ?? billing.error}</ErrorNote>
      {info ? <p className="muted" role="status">{info}</p> : null}
      {loading ? <StatsSkeleton /> : (
        <StatGrid>
          <Stat value={formatMoney(openSum)} label="em aberto" />
          <Stat value={late.length} label={late.length === 1 ? "vencida" : "vencidas"} />
          <Stat value={formatMoney(paidSum)} label="recebido" />
        </StatGrid>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          className="lg:max-w-xs"
          type="search"
          value={search}
          placeholder="Buscar aluno ou instrumento"
          aria-label="Buscar mensalidade"
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Situação">
          <Button type="button" size="sm" variant={view === "todas" ? "secondary" : "ghost"} aria-pressed={view === "todas"} onClick={() => setView("todas")}>Todas</Button>
          <Button type="button" size="sm" variant={view === "aberta" ? "secondary" : "ghost"} aria-pressed={view === "aberta"} onClick={() => setView("aberta")}>Em aberto</Button>
          <Button type="button" size="sm" variant={view === "vencida" ? "secondary" : "ghost"} aria-pressed={view === "vencida"} onClick={() => setView("vencida")}>Vencidas</Button>
          <Button type="button" size="sm" variant={view === "paga" ? "secondary" : "ghost"} aria-pressed={view === "paga"} onClick={() => setView("paga")}>Pagas</Button>
        </div>
      </div>
      {loading ? (
        <CardSkeleton />
      ) : monthCharges.length === 0 ? (
        <Empty>
          {month === currentMonth() ? "Nenhuma matrícula ativa para cobrar." : "Nenhuma mensalidade neste mês."}
        </Empty>
      ) : visible.length === 0 ? (
        <Empty>Nenhuma mensalidade encontrada.</Empty>
      ) : (
        <div className="grid gap-3">
          {visible.map((charge) => {
            const person = pessoas.get(charge.aluno_id)
            const instrumento = instrumentos.get(charge.instrumento_id) ?? "Aula"
            const horario = horarios.get(charge.matricula_id) ?? ""
            const tone = toneFor(instrumento)
            const isLate = charge.situacao === "aberta" && charge.vencimento < today
            const isPaid = charge.situacao === "paga"
            let payload = ""
            let link = ""
            if (!isPaid && config?.chave_pix) {
              payload = pixCopiaECola({
                chave: config.chave_pix,
                nome: config.nome_recebedor,
                cidade: config.cidade_recebedor,
                valor: charge.valor_centavos / 100,
                txid: charge.pix_txid,
              })
              if (person?.telefone) {
                link = whatsAppUrl(
                  person.telefone,
                  fillTemplate(config.mensagem_whatsapp, {
                    nome: person.nome,
                    instrumento,
                    valor: formatMoney(charge.valor_centavos),
                    vencimento: formatDate(charge.vencimento),
                    pix: payload,
                  }),
                )
              }
            }
            const when = isPaid ? paidOn(charge.paga_em) : formatDate(charge.vencimento)
            return (
              <article key={charge.id} className="grid gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid min-w-0 gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: tone.bar }} />
                      <strong className="font-medium">
                        {person ? <Link to={`/escola/alunos/${person.id}`}>{person.nome}</Link> : "Aluno"}
                      </strong>
                    </span>
                    <p className="text-muted-foreground">{[instrumento, horario].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="grid justify-items-end gap-1">
                    <span className={`text-lg font-medium tabular-nums ${isPaid ? "text-muted-foreground" : ""}`}>{formatMoney(charge.valor_centavos)}</span>
                    <StatusBadge value={charge.situacao} />
                  </div>
                </div>
                <p className={isLate ? "font-medium text-[var(--warn)]" : "text-muted-foreground"}>
                  {isPaid ? (when ? `Recebida em ${when}` : "Recebida") : isLate ? `Venceu em ${when}` : `Vence em ${when}`}
                </p>
                {charge.situacao === "aberta" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button  type="button" onClick={() => void markPaid(charge.id)}>
                      Dar baixa
                    </Button>
                    {link ? (
                      <Button variant="outline" nativeButton={false} render={<a href={link} target="_blank" rel="noreferrer" />} >
                        WhatsApp
                      </Button>
                    ) : !config?.chave_pix ? (
                      <Button variant="outline" nativeButton={false} render={<Link to="/escola/configuracao" />}>Configurar Pix</Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Este aluno está sem telefone.</span>
                    )}
                    {payload ? (
                      <Button variant="outline" type="button" onClick={() => setPixId(pixId === charge.id ? null : charge.id)}>
                        {pixId === charge.id ? "Ocultar Pix" : "Ver Pix"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {pixId === charge.id && payload ? <PixBlock payload={payload} /> : null}
              </article>
            )
          })}
        </div>
      )}
    </Page>
  )
}
