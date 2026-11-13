import { useSession } from "../../auth/session.tsx"
import { toneFor } from "../../agenda/model.ts"
import { PixBlock } from "../../components/PixBlock.tsx"
import { CardSkeleton, Empty, ErrorNote, Page, StatusBadge } from "../../components/chrome.tsx"
import { loadConfiguracao, loadInstrumentos, loadMatriculas, loadMensalidades } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, formatDate, formatMinute, formatMonth, saoPauloDate } from "../../lib/dates.ts"
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
  horarios: Map<string, string>
}

export function PaymentsPage() {
  const session = useSession()
  const query = useQuery(session.userId ? `aluno:pagamentos:${session.userId}` : null, async () => {
    const [items, school, instruments, enrollments] = await Promise.all([
      loadMensalidades(session.userId ?? undefined),
      loadConfiguracao(),
      loadInstrumentos(),
      loadMatriculas({ alunoId: session.userId ?? undefined }),
    ])
    return {
      charges: items,
      config: school,
      instrumentos: new Map(instruments.map((item) => [item.id, item.nome])),
      horarios: new Map(enrollments.map((item) => {
        const name = DIAS[item.dia_semana] ?? ""
        const day = name ? name.charAt(0).toUpperCase() + name.slice(1) : ""
        return [item.id, `${day}, ${formatMinute(item.inicio_minuto)}`]
      })),
    } satisfies PaymentsData
  })
  const charges = query.data?.charges ?? []
  const config = query.data?.config ?? null
  const instrumentos = query.data?.instrumentos ?? new Map<string, string>()
  const horarios = query.data?.horarios ?? new Map<string, string>()
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
          <section className="grid gap-3">
            <h2 className="font-heading text-base font-medium">A pagar</h2>
            {open.length === 0 ? <Empty>Nenhuma mensalidade em aberto.</Empty> : null}
            {open.map((charge) => {
              const instrumento = instrumentos.get(charge.instrumento_id) ?? "Aula"
              const horario = horarios.get(charge.matricula_id) ?? ""
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
                <article key={charge.id} className="grid gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid min-w-0 gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: tone.bar }} />
                        <strong className="font-medium">{[instrumento, horario].filter(Boolean).join(" · ")}</strong>
                      </span>
                      <p className="text-muted-foreground">{monthLabel(charge.competencia)}</p>
                    </div>
                    <div className="grid justify-items-end gap-1">
                      <span className="text-lg font-medium tabular-nums">{formatMoney(charge.valor_centavos)}</span>
                      <StatusBadge value={charge.situacao} />
                    </div>
                  </div>
                  <p className={late ? "font-medium text-[var(--warn)]" : "text-muted-foreground"}>
                    {late ? `Venceu em ${formatDate(charge.vencimento)}` : `Vence em ${formatDate(charge.vencimento)}`}
                  </p>
                  {payload ? <PixBlock payload={payload} /> : <p className="text-muted-foreground">A escola ainda não configurou a chave Pix.</p>}
                </article>
              )
            })}
          </section>
          {paid.length > 0 ? (
            <section className="grid gap-3">
              <h2 className="font-heading text-base font-medium">Pagas</h2>
              {paid.map((charge) => {
                const instrumento = instrumentos.get(charge.instrumento_id) ?? "Aula"
                const horario = horarios.get(charge.matricula_id) ?? ""
                const when = paidOn(charge.paga_em)
                return (
                  <article key={charge.id} className="grid gap-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid min-w-0 gap-0.5">
                        <strong className="font-medium">{[instrumento, horario].filter(Boolean).join(" · ")}</strong>
                        <p className="text-muted-foreground">{monthLabel(charge.competencia)}</p>
                      </div>
                      <div className="grid justify-items-end gap-1">
                        <span className="text-lg font-medium text-muted-foreground tabular-nums">{formatMoney(charge.valor_centavos)}</span>
                        <StatusBadge value={charge.situacao} />
                      </div>
                    </div>
                    <p className="text-muted-foreground">{when ? `Recebida em ${when}` : "Recebida"}</p>
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
