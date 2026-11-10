import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Empty, ErrorNote, Page, StatusBadge } from "../../components/ui.tsx"
import { loadAulas, loadInstrumentos, loadMensalidades, nomesPorId } from "../../data/api.ts"
import { addDays, formatWhen, saoPauloDate, saoPauloTimestamp } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney } from "../../lib/format.ts"
import type { Aula, Mensalidade } from "../../types.ts"

export function TodayPage() {
  const today = saoPauloDate()
  const [aulas, setAulas] = useState<Aula[]>([])
  const [abertas, setAbertas] = useState<Mensalidade[]>([])
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [instrumentos, setInstrumentos] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      loadAulas({
        from: saoPauloTimestamp(today, "00:00"),
        until: saoPauloTimestamp(addDays(today, 1), "00:00"),
      }),
      loadMensalidades(),
      loadInstrumentos(),
    ])
      .then(async ([lessons, charges, instruments]) => {
        const open = charges.filter((item) => item.situacao === "aberta")
        const names = await nomesPorId([
          ...lessons.flatMap((lesson) => [lesson.aluno_id, lesson.professor_id]),
          ...open.map((item) => item.aluno_id),
        ])
        if (!alive) return
        setAulas(lessons)
        setAbertas(open)
        setNomes(names)
        setInstrumentos(new Map(instruments.map((item) => [item.id, item.nome])))
      })
      .catch((reason: { message?: string }) => {
        if (alive) setError(humanError(reason))
      })
    return () => {
      alive = false
    }
  }, [today])

  const atrasadas = abertas.filter((item) => item.vencimento < today)

  return (
    <Page title="Hoje" lede="Aulas do dia e mensalidades que ainda estão em aberto.">
      <ErrorNote>{error}</ErrorNote>
      <div className="stats">
        <article>
          <strong>{aulas.length}</strong>
          <span>aulas hoje</span>
        </article>
        <article>
          <strong>{atrasadas.length}</strong>
          <span>mensalidades vencidas</span>
        </article>
        <article>
          <strong>{formatMoney(abertas.reduce((sum, item) => sum + item.valor_centavos, 0))}</strong>
          <span>em aberto</span>
        </article>
      </div>
      <section className="stack">
        <h2>Aulas</h2>
        {aulas.length === 0 ? <Empty>Nenhuma aula hoje.</Empty> : null}
        <ul className="lesson-list">
          {aulas.map((aula) => (
            <li key={aula.id}>
              <Link to={`/escola/aulas/${aula.id}`}>
                <strong>{formatWhen(aula.inicio)}</strong>
                <span>{nomes.get(aula.aluno_id)}</span>
                <span>{instrumentos.get(aula.instrumento_id)}</span>
                <span>{nomes.get(aula.professor_id)}</span>
                <StatusBadge value={aula.situacao} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {atrasadas.length > 0 ? (
        <p>
          <Link to="/escola/mensalidades">Cobrar as mensalidades vencidas</Link>
        </p>
      ) : null}
    </Page>
  )
}
