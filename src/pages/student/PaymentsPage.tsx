import { useEffect, useState } from "react"
import { useSession } from "../../auth/session.tsx"
import { PixBlock } from "../../components/PixBlock.tsx"
import { Empty, ErrorNote, Page, StatusBadge } from "../../components/ui.tsx"
import { loadConfiguracao, loadInstrumentos, loadMensalidades } from "../../data/api.ts"
import { formatDate, formatMonth, saoPauloDate } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney } from "../../lib/format.ts"
import { pixCopiaECola } from "../../lib/pix.ts"
import type { Configuracao, Instrumento, Mensalidade } from "../../types.ts"

export function PaymentsPage() {
  const session = useSession()
  const [charges, setCharges] = useState<Mensalidade[]>([])
  const [config, setConfig] = useState<Configuracao | null>(null)
  const [instrumentos, setInstrumentos] = useState<Map<string, Instrumento>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const today = saoPauloDate()

  useEffect(() => {
    if (!session.userId) return
    let alive = true
    Promise.all([loadMensalidades(session.userId), loadConfiguracao(), loadInstrumentos()])
      .then(([items, school, instruments]) => {
        if (!alive) return
        setCharges(items)
        setConfig(school)
        setInstrumentos(new Map(instruments.map((item) => [item.id, item])))
      })
      .catch((reason: { message?: string }) => {
        if (alive) setError(humanError(reason))
      })
    return () => {
      alive = false
    }
  }, [session.userId])

  return (
    <Page title="Pagamentos" lede="A mensalidade é de cada instrumento. O Pix não confirma sozinho: a escola dá baixa quando o valor cai.">
      <ErrorNote>{error}</ErrorNote>
      {charges.length === 0 ? <Empty>Nenhuma mensalidade gerada.</Empty> : null}
      <div className="stack">
        {charges.map((charge) => {
          const late = charge.situacao === "aberta" && charge.vencimento < today
          let payload = ""
          if (charge.situacao === "aberta" && config?.chave_pix) {
            payload = pixCopiaECola({
              chave: config.chave_pix,
              nome: config.nome_recebedor,
              cidade: config.cidade_recebedor,
              valor: charge.valor_centavos / 100,
              txid: charge.pix_txid,
            })
          }
          return (
            <article key={charge.id} className="card stack">
              <div className="row spread">
                <strong>{instrumentos.get(charge.instrumento_id)?.nome}</strong>
                <StatusBadge value={charge.situacao} />
              </div>
              <p>
                {formatMonth(charge.competencia)} · {formatMoney(charge.valor_centavos)}
              </p>
              <p className={late ? "late" : "muted"}>Vencimento {formatDate(charge.vencimento)}</p>
              {payload ? <PixBlock payload={payload} /> : null}
              {charge.situacao === "aberta" && !config?.chave_pix ? (
                <p className="muted">A escola ainda não configurou a chave Pix.</p>
              ) : null}
            </article>
          )
        })}
      </div>
    </Page>
  )
}
