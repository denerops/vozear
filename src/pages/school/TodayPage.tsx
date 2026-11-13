import { Link } from "react-router-dom"
import { Empty, ErrorNote, ListSkeleton, Page, StatsSkeleton, StatusBadge } from "../../components/chrome.tsx"
import { loadAulas, loadInstrumentos, loadMensalidades, loadPessoas, nomesPorId } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { addDays, formatMinute, formatWhen, saoPauloClock, saoPauloDate, saoPauloTimestamp } from "../../lib/dates.ts"
import { formatMoney } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import { confirmationMessage, confirmationUrl, whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Aula, Mensalidade } from "../../types.ts"
import { Button } from "@/components/ui/button"

type TodayData = {
  aulas: Aula[]
  abertas: Mensalidade[]
  nomes: Map<string, string>
  instrumentos: Map<string, string>
  telefones: Map<string, string>
  tokens: Map<string, string>
}

function lessonOpen(aula: Aula) {
  return (aula.situacao === "prevista" || aula.situacao === "remarcada") && new Date(aula.inicio).getTime() > Date.now()
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
    const openLessons = lessons.filter(lessonOpen)
    const [names, alunos, tokenResult] = await Promise.all([
      nomesPorId([
        ...lessons.flatMap((lesson) => [lesson.aluno_id, lesson.professor_id]),
        ...open.map((item) => item.aluno_id),
      ]),
      loadPessoas("aluno"),
      openLessons.length === 0
        ? Promise.resolve({ data: [] as { aula_id: string; token: string }[], error: null })
        : client().rpc("tokens_confirmacao", { p_aula_ids: openLessons.map((lesson) => lesson.id) }),
    ])
    if (tokenResult.error) throw tokenResult.error
    return {
      aulas: lessons,
      abertas: open,
      nomes: names,
      instrumentos: new Map(instruments.map((item) => [item.id, item.nome])),
      telefones: new Map(alunos.map((person) => [person.id, person.telefone])),
      tokens: new Map(
        ((tokenResult.data ?? []) as { aula_id: string; token: string }[]).map((item) => [item.aula_id, item.token]),
      ),
    }
  })
  const aulas = query.data?.aulas ?? []
  const abertas = query.data?.abertas ?? []
  const nomes = query.data?.nomes ?? new Map<string, string>()
  const instrumentos = query.data?.instrumentos ?? new Map<string, string>()
  const telefones = query.data?.telefones ?? new Map<string, string>()
  const tokens = query.data?.tokens ?? new Map<string, string>()
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
        <ul className="today-list">
          {aulas.map((aula) => {
            const nome = nomes.get(aula.aluno_id) ?? "Aluno"
            const instrumento = instrumentos.get(aula.instrumento_id) ?? "Aula"
            const professor = nomes.get(aula.professor_id) ?? "Professor"
            const telefone = telefones.get(aula.aluno_id) ?? ""
            const token = tokens.get(aula.id) ?? ""
            const open = lessonOpen(aula)
            const link = open && token && telefone
              ? whatsAppUrl(telefone, confirmationMessage(nome, instrumento, formatWhen(aula.inicio), confirmationUrl(token)))
              : ""
            return (
              <li key={aula.id} className="today-lesson">
                <Link className="today-lesson-main" to={`/escola/aulas/${aula.id}`}>
                  <time dateTime={aula.inicio}>{formatMinute(saoPauloClock(aula.inicio).minute)}</time>
                  <span>
                    <strong>{nome}</strong>
                    <span className="today-meta">{instrumento} · {professor}</span>
                  </span>
                  <span className="lesson-actions">
                    <StatusBadge value={aula.situacao} />
                    {aula.confirmacao === "confirmada" ? (
                      <span className="badge" data-status="realizada">Confirmada</span>
                    ) : null}
                    {open && aula.confirmacao === "pendente" ? (
                      <span className="badge" data-status="aberta">Aguardando</span>
                    ) : null}
                  </span>
                </Link>
                {link ? (
                  <Button variant="outline" nativeButton={false} render={<a href={link} target="_blank" rel="noreferrer" />} >
                    Enviar confirmação
                  </Button>
                ) : open && !telefone ? (
                  <span className="today-note">Sem telefone</span>
                ) : null}
              </li>
            )
          })}
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
