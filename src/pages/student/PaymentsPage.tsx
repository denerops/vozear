import { useSession } from "../../auth/session.tsx"
import { toneFor } from "../../agenda/model.ts"
import { PixBlock } from "../../components/PixBlock.tsx"
import { CardSkeleton, Empty, ErrorNote, Page, StatusBadge } from "../../components/ui.tsx"
import { loadConfiguracao, loadInstrumentos, loadMensalidades } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { formatDate, formatMonth, saoPauloDate } from "../../lib/dates.ts"
import { formatMoney } from "../../lib/format.ts"
import { pixCopiaECola } from "../../lib/pix.ts"
import type { Configuracao, Mensalidade } from "../../types.ts"

function monthLabel(value: string) {
  const label = formatMonth(value)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function paidOn(value: string | null) {
  if (!value) return null
  return formatDate(value.slice(0, 10))
}

type PaymentsData = {
  charges: Mensalidade[]
  config: Configuracao | null
  instrumentos: Map<string, string>
}

export function PaymentsPage() {
  const session = useSession()
  const query = useQuery(session.userId ? `aluno:pagamentos:${session.userId}` : null, async () => {
    const [items, school, instruments] = await Promise.all([
      loadMensalidades(session.userId ?? undefined),
      loadConfiguracao(),
      loadInstrumentos(),
    ])
    return {
      charges: items,
      config: school,
      instrumentos: new Map(instruments.map((item) => [item.id, item.nome])),
    } satisfies PaymentsData
  })
  const charges = query.data?.charges ?? []
  const config = query.data?.config ?? null
  const instrumentos = query.data?.instrumentos ?? new Map<string, string>()
  const loading = query.pending && !query.data
  const today = saoPauloDate()

  const open = charges
    .filter((item) => item.situacao === "aberta")
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  const paid = charges
    .filter((item) => item.situacao === "paga")
    .sort((a, b) => b.competencia.localeCompare(a.competencia))
  const due = open.reduce((sum, item) => sum + item.valor_centavos, 0)

  return (
    <Page
      title="Pagamentos"
      lede={loading ? "Buscando pagamentos…" : open.length === 0 ? "Nada em aberto." : `${formatMoney(due)} em aberto`}
    >
      <ErrorNote>{query.error}</ErrorNote>
      {loading ? <CardSkeleton /> : charges.length === 0 ? (
        <Empty>Nenhuma mensalidade ainda.</Empty>
      ) : (
        <>
          <section className="stack">
            <h2>A pagar</h2>
            {open.length === 0 ? <Empty>Nenhuma mensalidade em aberto.</Empty> : null}
            {open.map((charge) => {
              const instrumento = instrumentos.get(charge.instrumento_id) ?? "Aula"
              const tone = toneFor(instrumento)
              const late = charge.vencimento < today
              const payload = config?.chave_pix
                ? pixCopiaECola({
                    chave: config.chave_pix,
                    nome: config.nome_recebedor,
                    cidade: config.cidade_recebedor,
                    valor: charge.valor_centavos / 100,
                    txid: charge.pix_txid,
                  })
                : ""
              return (
                <article key={charge.id} className="card enrollment pay-card">
                  <span className="enrollment-bar" style={{ background: tone.bar }} />
                  <div className="row spread">
                    <strong>{instrumento}</strong>
                    <StatusBadge value={charge.situacao} />
                  </div>
                  <p className="muted">{monthLabel(charge.competencia)}</p>
                  <p className="pay-amount">{formatMoney(charge.valor_centavos)}</p>
                  <p className={late ? "late" : "muted"}>
                    {late ? `Venceu em ${formatDate(charge.vencimento)}` : `Vence em ${formatDate(charge.vencimento)}`}
                  </p>
                  {payload ? <PixBlock payload={payload} /> : <p className="muted">A escola ainda não configurou a chave Pix.</p>}
                </article>
              )
            })}
          </section>
          {paid.length > 0 ? (
            <section className="stack">
              <h2>Pagas</h2>
              {paid.map((charge) => {
                const instrumento = instrumentos.get(charge.instrumento_id) ?? "Aula"
                const when = paidOn(charge.paga_em)
                return (
                  <article key={charge.id} className="card enrollment pay-card is-paid">
                    <span className="enrollment-bar" style={{ background: toneFor(instrumento).bar }} />
                    <div className="row spread">
                      <strong>{instrumento}</strong>
                      <StatusBadge value={charge.situacao} />
                    </div>
                    <p className="muted">{monthLabel(charge.competencia)}</p>
                    <p className="pay-amount">{formatMoney(charge.valor_centavos)}</p>
                    <p className="muted">{when ? `Recebida em ${when}` : "Recebida"}</p>
                  </article>
                )
              })}
            </section>
          ) : null}
        </>
      )}
    </Page>
  )
}
