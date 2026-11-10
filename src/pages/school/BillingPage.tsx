import { useEffect, useState } from "react"
import { PixBlock } from "../../components/PixBlock.tsx"
import { Empty, ErrorNote, Page, StatusBadge } from "../../components/ui.tsx"
import { loadConfiguracao, loadInstrumentos, loadMensalidades, loadPessoas } from "../../data/api.ts"
import { currentMonth, formatDate, formatMonth, saoPauloDate } from "../../lib/dates.ts"
import { client } from "../../lib/supabase.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney } from "../../lib/format.ts"
import { pixCopiaECola } from "../../lib/pix.ts"
import { fillTemplate, whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Configuracao, Mensalidade, Pessoa } from "../../types.ts"

export function BillingPage() {
  const [month, setMonth] = useState(currentMonth())
  const [charges, setCharges] = useState<Mensalidade[]>([])
  const [people, setPeople] = useState<Pessoa[]>([])
  const [config, setConfig] = useState<Configuracao | null>(null)
  const [instrumentos, setInstrumentos] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const today = saoPauloDate()

  async function reload() {
    const [items, students, school, instruments] = await Promise.all([
      loadMensalidades(),
      loadPessoas("aluno"),
      loadConfiguracao(),
      loadInstrumentos(),
    ])
    setCharges(items)
    setPeople(students)
    setConfig(school)
    setInstrumentos(new Map(instruments.map((item) => [item.id, item.nome])))
  }

  useEffect(() => {
    let alive = true
    reload().catch((reason: { message?: string }) => {
      if (alive) setError(humanError(reason))
    })
    return () => {
      alive = false
    }
  }, [])

  const visible = charges.filter((item) => item.competencia.startsWith(month))
  const pessoas = new Map(people.map((person) => [person.id, person]))

  async function generate() {
    setError(null)
    setInfo(null)
    const { data, error: generateError } = await client().rpc("gerar_mensalidades", {
      p_competencia: `${month}-01`,
    })
    if (generateError) setError(humanError(generateError))
    else {
      setInfo(`${data ?? 0} mensalidade(s) nova(s).`)
      await reload()
    }
  }

  async function markPaid(id: string) {
    setError(null)
    const { error: payError } = await client().rpc("baixar_mensalidade", { p_id: id })
    if (payError) setError(humanError(payError))
    else await reload()
  }

  return (
    <Page
      title="Mensalidades"
      lede="Uma cobrança por matrícula. O botão abre o seu WhatsApp com o texto e o Pix; nada é enviado sozinho."
      action={
        <div className="row">
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          <button className="btn" type="button" onClick={generate}>Gerar mês</button>
        </div>
      }
    >
      <ErrorNote>{error}</ErrorNote>
      {info ? <p className="muted">{info}</p> : null}
      {visible.length === 0 ? <Empty>Nada neste mês. Gere as mensalidades das matrículas ativas.</Empty> : null}
      <div className="stack">
        {visible.map((charge) => {
          const person = pessoas.get(charge.aluno_id)
          const instrumento = instrumentos.get(charge.instrumento_id) ?? "Aula"
          const late = charge.situacao === "aberta" && charge.vencimento < today
          let payload = ""
          let link = ""
          if (config?.chave_pix) {
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
          return (
            <article key={charge.id} className="card stack">
              <div className="row spread">
                <strong>{person?.nome ?? "Aluno"} · {instrumento}</strong>
                <StatusBadge value={charge.situacao} />
              </div>
              <p>
                {formatMonth(charge.competencia)} · {formatMoney(charge.valor_centavos)}
              </p>
              <p className={late ? "late" : "muted"}>Vencimento {formatDate(charge.vencimento)}</p>
              {charge.situacao === "aberta" ? (
                <div className="row">
                  <button className="btn" type="button" onClick={() => markPaid(charge.id)}>
                    Marcar como paga
                  </button>
                  {link ? (
                    <a className="btn secondary" href={link} target="_blank" rel="noreferrer">
                      Cobrar no WhatsApp
                    </a>
                  ) : (
                    <span className="muted">Sem telefone ou sem chave Pix.</span>
                  )}
                </div>
              ) : null}
              {charge.situacao === "aberta" && payload ? <PixBlock payload={payload} /> : null}
            </article>
          )
        })}
      </div>
    </Page>
  )
}
