import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useSession } from "../../auth/session.tsx"
import { Empty, ErrorNote, Page, StatusBadge } from "../../components/ui.tsx"
import { loadAulas, loadHorarios, loadInstrumentos, loadMatriculas, loadPessoas, nomesPorId } from "../../data/api.ts"
import {
  DIAS,
  addDays,
  formatMinute,
  formatWhen,
  mondayOf,
  saoPauloDate,
  saoPauloTimestamp,
  timeToMinute,
} from "../../lib/dates.ts"
import { client } from "../../lib/supabase.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney } from "../../lib/format.ts"
import type { Aula, Horario, Instrumento, Matricula, Pessoa } from "../../types.ts"

export function AgendaPage({ mode }: { mode: "escola" | "professor" }) {
  const session = useSession()
  const [cursor, setCursor] = useState(saoPauloDate())
  const [teacherId, setTeacherId] = useState("")
  const [teachers, setTeachers] = useState<Pessoa[]>([])
  const [students, setStudents] = useState<Pessoa[]>([])
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [matriculas, setMatriculas] = useState<Matricula[]>([])
  const [aulas, setAulas] = useState<Aula[]>([])
  const [labels, setLabels] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [dia, setDia] = useState(2)
  const [hora, setHora] = useState("19:00")
  const [duracao, setDuracao] = useState(50)
  const monday = mondayOf(cursor)
  const selectedTeacher = mode === "professor" ? session.userId ?? "" : teacherId
  const school = mode === "escola"

  async function reload() {
    const professorFilter = selectedTeacher || undefined
    const [teacherList, studentList, instruments, slots, enrollments, lessons] = await Promise.all([
      school ? loadPessoas("professor") : Promise.resolve([] as Pessoa[]),
      school ? loadPessoas("aluno") : Promise.resolve([] as Pessoa[]),
      loadInstrumentos(),
      loadHorarios(professorFilter),
      loadMatriculas(professorFilter ? { professorId: professorFilter } : undefined),
      loadAulas({
        from: saoPauloTimestamp(monday, "00:00"),
        until: saoPauloTimestamp(addDays(monday, 7), "00:00"),
        professorId: professorFilter,
      }),
    ])
    setTeachers(teacherList)
    setStudents(studentList)
    setInstrumentos(instruments)
    setHorarios(slots)
    setMatriculas(enrollments)
    setAulas(lessons)
    setLabels(
      await nomesPorId([
        ...lessons.flatMap((lesson) => [lesson.aluno_id, lesson.professor_id]),
        ...enrollments.flatMap((item) => [item.aluno_id, item.professor_id]),
      ]),
    )
    if (school && !teacherId && teacherList[0]) setTeacherId(teacherList[0].id)
  }

  useEffect(() => {
    if (mode === "professor" && !session.userId) return
    let alive = true
    reload().catch((reason: { message?: string }) => {
      if (alive) setError(humanError(reason))
    })
    return () => {
      alive = false
    }
  }, [mode, session.userId, selectedTeacher, monday])

  const names = new Map<string, string>([
    ...labels,
    ...teachers.map((person) => [person.id, person.nome] as const),
    ...students.map((person) => [person.id, person.nome] as const),
  ])
  if (session.userId && session.nome) names.set(session.userId, session.nome)

  async function createSlot(event: FormEvent) {
    event.preventDefault()
    if (!selectedTeacher) return
    setError(null)
    const { error: insertError } = await client().from("horarios").insert({
      professor_id: selectedTeacher,
      dia_semana: dia,
      inicio_minuto: timeToMinute(hora),
      duracao_minutos: duracao,
    })
    if (insertError) setError(humanError(insertError))
    else await reload()
  }

  async function enroll(event: FormEvent<HTMLFormElement>, horario: Horario) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const alunoId = String(form.get("aluno") ?? "")
    const instrumentoId = String(form.get("instrumento") ?? "")
    const cents = Math.round(Number(String(form.get("valor") ?? "").replace(",", ".")) * 100)
    const inicio = String(form.get("inicio") ?? saoPauloDate())
    if (!alunoId || !instrumentoId || cents <= 0) {
      setError("Escolha aluno, instrumento e um valor mensal.")
      return
    }
    setError(null)
    const { data, error: insertError } = await client()
      .from("matriculas")
      .insert({
        aluno_id: alunoId,
        professor_id: horario.professor_id,
        instrumento_id: instrumentoId,
        horario_id: horario.id,
        valor_mensal_centavos: cents,
        inicio_em: inicio,
      })
      .select("id")
      .single()
    if (insertError || !data) {
      setError(humanError(insertError))
      return
    }
    const { error: generateError } = await client().rpc("gerar_aulas", {
      p_matricula_id: data.id,
      p_ate: addDays(saoPauloDate(), 84),
    })
    if (generateError) setError(humanError(generateError))
    await reload()
  }

  const teacher = teachers.find((person) => person.id === selectedTeacher)

  return (
    <Page
      title={school ? "Agenda da escola" : "Minha semana"}
      lede="Um horário recebe um aluno. Remarcar muda só aquela data."
      action={
        <div className="week-nav">
          <button type="button" onClick={() => setCursor(addDays(monday, -7))}>Semana anterior</button>
          <button type="button" onClick={() => setCursor(addDays(monday, 7))}>Próxima semana</button>
        </div>
      }
    >
      <ErrorNote>{error}</ErrorNote>
      {school ? (
        <label>
          Professor
          <select value={selectedTeacher} onChange={(event) => setTeacherId(event.target.value)}>
            {teachers.map((person) => (
              <option key={person.id} value={person.id}>{person.nome}</option>
            ))}
          </select>
        </label>
      ) : null}

      <form className="card row" onSubmit={createSlot}>
        <label>
          Dia
          <select value={dia} onChange={(event) => setDia(Number(event.target.value))}>
            {DIAS.map((label, index) => (
              <option key={label} value={index}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Início
          <input type="time" value={hora} onChange={(event) => setHora(event.target.value)} required />
        </label>
        <label>
          Duração
          <select value={duracao} onChange={(event) => setDuracao(Number(event.target.value))}>
            {[30, 45, 50, 60].map((minutes) => (
              <option key={minutes} value={minutes}>{minutes} min</option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit" disabled={!selectedTeacher}>Abrir horário</button>
      </form>

      <section className="stack">
        <h2>Aulas da semana</h2>
        {aulas.length === 0 ? <Empty>Nenhuma aula gerada nesta semana.</Empty> : null}
        <ul className="lesson-list">
          {aulas.map((aula) => (
            <li key={aula.id}>
              <Link to={`${school ? "/escola" : "/professor"}/aulas/${aula.id}`}>
                <strong>{formatWhen(aula.inicio)}</strong>
                <span>{names.get(aula.aluno_id) ?? "Aluno"}</span>
                <span>{instrumentos.find((item) => item.id === aula.instrumento_id)?.nome}</span>
                <StatusBadge value={aula.situacao} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack">
        <h2>Horários semanais</h2>
        {horarios.length === 0 ? <Empty>Nenhum horário aberto.</Empty> : null}
        {horarios.map((horario) => {
          const matricula = matriculas.find((item) => item.horario_id === horario.id && item.situacao === "ativa")
          const options = instrumentos.filter(
            (item) => item.ativo && (teacher ? teacher.instrumentos.includes(item.id) : item.id === matricula?.instrumento_id),
          )
          const defaultPrice = options[0] ? (options[0].valor_mensal_centavos / 100).toFixed(2) : ""
          return (
            <article key={horario.id} className="card stack">
              <div className="row spread">
                <strong>
                  {DIAS[horario.dia_semana]} {formatMinute(horario.inicio_minuto)} · {horario.duracao_minutos} min
                </strong>
                <span className="muted">{horario.ativo ? "Ativo" : "Inativo"}</span>
              </div>
              {matricula ? (
                <p>
                  {names.get(matricula.aluno_id) ?? "Aluno"} ·{" "}
                  {instrumentos.find((item) => item.id === matricula.instrumento_id)?.nome} ·{" "}
                  {formatMoney(matricula.valor_mensal_centavos)}
                </p>
              ) : (
                <p className="muted">Horário livre</p>
              )}
              {school && horario.ativo && !matricula ? (
                <form className="row" onSubmit={(event) => enroll(event, horario)}>
                  <label>
                    Aluno
                    <select name="aluno" required defaultValue="">
                      <option value="" disabled>Escolher</option>
                      {students.map((person) => (
                        <option key={person.id} value={person.id}>{person.nome}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Instrumento
                    <select name="instrumento" required defaultValue={options[0]?.id ?? ""}>
                      {options.map((item) => (
                        <option key={item.id} value={item.id}>{item.nome}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Mensalidade
                    <input name="valor" defaultValue={defaultPrice} required />
                  </label>
                  <label>
                    Começa em
                    <input name="inicio" type="date" defaultValue={saoPauloDate()} required />
                  </label>
                  <button className="btn" type="submit">Matricular</button>
                </form>
              ) : null}
              <div className="row">
                {matricula ? (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={async () => {
                      const { error: generateError } = await client().rpc("gerar_aulas", {
                        p_matricula_id: matricula.id,
                        p_ate: addDays(saoPauloDate(), 84),
                      })
                      if (generateError) setError(humanError(generateError))
                      else await reload()
                    }}
                  >
                    Gerar próximas aulas
                  </button>
                ) : null}
                {horario.ativo && !matricula ? (
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={async () => {
                      const { error: updateError } = await client()
                        .from("horarios")
                        .update({ ativo: false })
                        .eq("id", horario.id)
                      if (updateError) setError(humanError(updateError))
                      else await reload()
                    }}
                  >
                    Desativar
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </section>
    </Page>
  )
}
