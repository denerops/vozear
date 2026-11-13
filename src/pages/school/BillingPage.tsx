import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { PixBlock } from "../../components/PixBlock.tsx"
import { CardSkeleton, Empty, ErrorNote, Page, StatsSkeleton, StatusBadge } from "../../components/chrome.tsx"
import { loadConfiguracao, loadInstrumentos, loadMensalidades, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { currentMonth, formatDate, formatMonth, saoPauloDate } from "../../lib/dates.ts"
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
}

async function loadBilling(month: string): Promise<BillingData> {
  if (month === currentMonth()) {
    const { error: generateError } = await client().rpc("gerar_mensalidades", {
      p_competencia: `${month}-01`,
    })
    if (generateError) throw generateError
  }
  const [items, students, school, instruments] = await Promise.all([
    loadMensalidades(),
    loadPessoas("aluno"),
    loadConfiguracao(),
    loadInstrumentos(),
  ])
  return {
    charges: items,
    people: students,
    config: school,
    instrumentos: new Map(instruments.map((item) => [item.id, item.nome])),
  }
}

export function BillingPage() {
  const [month, setMonth] = useState(currentMonth())
  const billing = useQuery(`escola:mensalidades:${month}`, () => loadBilling(month))
  const charges = billing.data?.charges ?? []
  const people = billing.data?.people ?? []
  const config = billing.data?.config ?? null
  const instrumentos = billing.data?.instrumentos ?? new Map<string, string>()
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
        <div className="month-nav">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <strong>{monthTitle(month)}</strong>
          <button type="button" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
      }
    >
      <ErrorNote>{payError ?? billing.error}</ErrorNote>
      {info ? <p className="muted" role="status">{info}</p> : null}
      {loading ? <StatsSkeleton /> : <div className="stats">
        <article>
          <strong>{formatMoney(openSum)}</strong>
          <span>em aberto</span>
        </article>
        <article>
          <strong>{late.length}</strong>
          <span>{late.length === 1 ? "vencida" : "vencidas"}</span>
        </article>
        <article>
          <strong>{formatMoney(paidSum)}</strong>
          <span>recebido</span>
        </article>
      </div>}
      <div className="roster-tools">
        <Input
          className="roster-search"
          type="search"
          value={search}
          placeholder="Buscar aluno ou instrumento"
          aria-label="Buscar mensalidade"
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="roster-filters" role="group" aria-label="Situação">
          <button type="button" aria-pressed={view === "todas"} onClick={() => setView("todas")}>Todas</button>
          <button type="button" aria-pressed={view === "aberta"} onClick={() => setView("aberta")}>Em aberto</button>
          <button type="button" aria-pressed={view === "vencida"} onClick={() => setView("vencida")}>Vencidas</button>
          <button type="button" aria-pressed={view === "paga"} onClick={() => setView("paga")}>Pagas</button>
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
        <div className="stack">
          {visible.map((charge) => {
            const person = pessoas.get(charge.aluno_id)
            const instrumento = instrumentos.get(charge.instrumento_id) ?? "Aula"
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
              <article key={charge.id} className={`card enrollment pay-card${isPaid ? " is-paid" : ""}`}>
                <span className="enrollment-bar" style={{ background: tone.bar }} />
                <div className="row spread">
                  <strong>
                    {person ? <Link to={`/escola/alunos/${person.id}`}>{person.nome}</Link> : "Aluno"}
                  </strong>
                  <StatusBadge value={charge.situacao} />
                </div>
                <p className="muted">{instrumento}</p>
                <p className="pay-amount">{formatMoney(charge.valor_centavos)}</p>
                <p className={isLate ? "late" : "muted"}>
                  {isPaid ? (when ? `Recebida em ${when}` : "Recebida") : isLate ? `Venceu em ${when}` : `Vence em ${when}`}
                </p>
                {charge.situacao === "aberta" ? (
                  <div className="row">
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
                      <span className="muted">Este aluno está sem telefone.</span>
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
