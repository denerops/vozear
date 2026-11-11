import { Link } from "react-router-dom"
import { Empty, ErrorNote, ListSkeleton, Page, StatsSkeleton, StatusBadge } from "../../components/ui.tsx"
import { loadAulas, loadInstrumentos, loadMensalidades, nomesPorId } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { addDays, formatWhen, saoPauloDate, saoPauloTimestamp } from "../../lib/dates.ts"
import { formatMoney } from "../../lib/format.ts"
import type { Aula, Mensalidade } from "../../types.ts"

type TodayData = {
  aulas: Aula[]
  abertas: Mensalidade[]
  nomes: Map<string, string>
  instrumentos: Map<string, string>
}

export function TodayPage() {
  const today = saoPauloDate()
  const query = useQuery(`escola:hoje:${today}`, async (): Promise<TodayData> => {
    const [lessons, charges, instruments] = await Promise.all([
      loadAulas({
        from: saoPauloTimestamp(today, "00:00"),
        until: saoPauloTimestamp(addDays(today, 1), "00:00"),
      }),
      loadMensalidades(),
      loadInstrumentos(),
    ])
    const open = charges.filter((item) => item.situacao === "aberta")
    const names = await nomesPorId([
      ...lessons.flatMap((lesson) => [lesson.aluno_id, lesson.professor_id]),
      ...open.map((item) => item.aluno_id),
    ])
    return {
      aulas: lessons,
      abertas: open,
      nomes: names,
      instrumentos: new Map(instruments.map((item) => [item.id, item.nome])),
    }
  })
  const aulas = query.data?.aulas ?? []
  const abertas = query.data?.abertas ?? []
  const nomes = query.data?.nomes ?? new Map<string, string>()
  const instrumentos = query.data?.instrumentos ?? new Map<string, string>()
  const loading = query.pending && !query.data

  const atrasadas = abertas.filter((item) => item.vencimento < today)

  return (
    <Page title="Hoje" lede="Aulas do dia e mensalidades que ainda estão em aberto.">
      <ErrorNote>{query.error}</ErrorNote>
      {loading ? (
        <>
          <StatsSkeleton />
          <ListSkeleton rows={3} />
        </>
      ) : (
        <>
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
        </>
      )}
    </Page>
  )
}
