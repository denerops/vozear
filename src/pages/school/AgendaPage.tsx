import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useSession } from "../../auth/session.tsx"
import { WeekCalendar, WeekNav, hourMarks, type CellPaint, type Slot } from "../../components/WeekCalendar.tsx"
import { ErrorNote, Page } from "../../components/ui.tsx"
import { loadAulas, loadHorarios, loadInstrumentos, loadMatriculas, loadPessoas, nomesPorId } from "../../data/api.ts"
import { DIAS, addDays, agendaStartMinute, dateOfWeekday, formatMinute, mondayOf, saoPauloClock, saoPauloDate, saoPauloTimestamp } from "../../lib/dates.ts"
import { client } from "../../lib/supabase.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney } from "../../lib/format.ts"
import type { Aula, Horario, Instrumento, Matricula, Pessoa, UsoHorario } from "../../types.ts"

function describeSlots(slots: Slot[]) {
  const days = [...new Set(slots.map((slot) => slot.day))].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
  const minutes = slots.map((slot) => slot.minute)
  const from = Math.min(...minutes)
  const until = Math.max(...minutes) + 60
  return `${days.map((day) => DIAS[day]).join(", ")} · ${formatMinute(from)}–${formatMinute(until)}`
}

export function AgendaPage({ mode }: { mode: "escola" | "professor" }) {
  const session = useSession()
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(saoPauloDate())
  const [teacherId, setTeacherId] = useState("")
  const [teachers, setTeachers] = useState<Pessoa[]>([])
  const [students, setStudents] = useState<Pessoa[]>([])
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [matriculas, setMatriculas] = useState<Matricula[]>([])
  const [aulas, setAulas] = useState<Aula[]>([])
  const [labels, setLabels] = useState<Map<string, string>>(new Map())
  const [selection, setSelection] = useState<Slot[] | null>(null)
  const [anchorMinute, setAnchorMinute] = useState(agendaStartMinute)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const active = horarios.filter((item) => item.ativo && item.professor_id === selectedTeacher)
  const paints: CellPaint[] = []
  for (const minute of hourMarks()) {
    for (const day of [1, 2, 3, 4, 5, 6, 0]) {
      const date = dateOfWeekday(monday, day)
      const aula = aulas.find((item) => {
        if (item.situacao === "cancelada") return false
        const clock = saoPauloClock(item.inicio)
        return clock.date === date && clock.minute >= minute && clock.minute < minute + 60
      })
      const horario = active.find(
        (item) => item.dia_semana === day && item.inicio_minuto <= minute && minute < item.inicio_minuto + item.duracao_minutos,
      )
      const matricula = horario
        ? matriculas.find((item) => item.horario_id === horario.id && item.situacao === "ativa")
        : undefined
      if (aula) {
        paints.push({
          day,
          minute,
          kind: "aula",
          aulaId: aula.id,
          title: names.get(aula.aluno_id) ?? "Aluno",
          detail: instrumentos.find((item) => item.id === aula.instrumento_id)?.nome,
        })
      } else if (horario?.uso === "bloqueado") {
        paints.push({ day, minute, kind: "bloqueado" })
      } else if (horario) {
        paints.push({
          day,
          minute,
          kind: "disponivel",
          title: matricula ? (names.get(matricula.aluno_id) ?? "Aluno") : "Livre",
          detail: matricula ? instrumentos.find((item) => item.id === matricula.instrumento_id)?.nome : undefined,
        })
      }
    }
  }

  const single = selection?.length === 1 ? selection[0] : null
  const singleHorario = single
    ? active.find((item) => item.dia_semana === single.day && item.inicio_minuto === single.minute && item.duracao_minutos === 60)
    : undefined
  const singleMatricula = singleHorario
    ? matriculas.find((item) => item.horario_id === singleHorario.id && item.situacao === "ativa")
    : undefined
  const teacher = teachers.find((person) => person.id === selectedTeacher)
  const options = instrumentos.filter((item) => item.ativo && (teacher ? teacher.instrumentos.includes(item.id) : true))

  function exactHorario(slot: Slot) {
    return active.find((item) => item.dia_semana === slot.day && item.inicio_minuto === slot.minute && item.duracao_minutos === 60)
  }

  const selectedHorarios = (selection ?? []).flatMap((slot) => {
    const exact = exactHorario(slot)
    return exact ? [exact] : []
  })
  const enrolledSelection = selectedHorarios.some((item) => matriculas.some((matricula) => matricula.horario_id === item.id))

  async function mark(uso: UsoHorario) {
    if (!selection || !selectedTeacher || busy) return
    setError(null)
    setBusy(true)
    const inserts: { professor_id: string; dia_semana: number; inicio_minuto: number; duracao_minutos: number; uso: UsoHorario }[] = []
    const updates: string[] = []
    for (const slot of selection) {
      const exact = exactHorario(slot)
      if (exact) {
        if (exact.uso !== uso) updates.push(exact.id)
        continue
      }
      const overlap = active.some(
        (item) => item.dia_semana === slot.day && item.inicio_minuto < slot.minute + 60 && slot.minute < item.inicio_minuto + item.duracao_minutos,
      )
      if (overlap) {
        setError("Esse intervalo já tem um horário com outra duração.")
        setBusy(false)
        return
      }
      inserts.push({
        professor_id: selectedTeacher,
        dia_semana: slot.day,
        inicio_minuto: slot.minute,
        duracao_minutos: 60,
        uso,
      })
    }
    if (inserts.length > 0) {
      const { error: insertError } = await client().from("horarios").insert(inserts)
      if (insertError) {
        setError(humanError(insertError))
        setBusy(false)
        return
      }
    }
    for (const id of updates) {
      const { error: updateError } = await client().from("horarios").update({ uso }).eq("id", id)
      if (updateError) {
        setError(humanError(updateError))
        setBusy(false)
        await reload()
        return
      }
    }
    const keep = school && uso === "disponivel" && selection.length === 1
    if (!keep) setSelection(null)
    await reload()
    setBusy(false)
  }

  async function clearSelection() {
    if (!selection || busy || enrolledSelection || selectedHorarios.length === 0) return
    setError(null)
    setBusy(true)
    const { error: deleteError } = await client().from("horarios").delete().in("id", selectedHorarios.map((item) => item.id))
    if (deleteError) {
      setError(humanError(deleteError))
      setBusy(false)
      return
    }
    setSelection(null)
    await reload()
    setBusy(false)
  }

  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!singleHorario || busy) return
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
    setBusy(true)
    const { data, error: insertError } = await client()
      .from("matriculas")
      .insert({
        aluno_id: alunoId,
        professor_id: singleHorario.professor_id,
        instrumento_id: instrumentoId,
        horario_id: singleHorario.id,
        valor_mensal_centavos: cents,
        inicio_em: inicio,
      })
      .select("id")
      .single()
    if (insertError || !data) {
      setError(humanError(insertError))
      setBusy(false)
      return
    }
    const { error: generateError } = await client().rpc("gerar_aulas", {
      p_matricula_id: data.id,
      p_ate: addDays(saoPauloDate(), 84),
    })
    if (generateError) setError(humanError(generateError))
    setSelection(null)
    await reload()
    setBusy(false)
  }

  return (
    <Page
      title={school ? "Agenda da escola" : "Minha semana"}
      lede="Arraste na horizontal para marcar horários de 1 hora."
      action={
        <WeekNav
          monday={monday}
          onShift={(days) => {
            setCursor(addDays(monday, days))
            setAnchorMinute(16 * 60)
          }}
          onToday={() => {
            setCursor(saoPauloDate())
            setAnchorMinute(agendaStartMinute())
          }}
        />
      }
    >
      {selection ? null : <ErrorNote>{error}</ErrorNote>}
      {school ? (
        <label>
          Professor
          <select
            value={selectedTeacher}
            onChange={(event) => {
              setSelection(null)
              setTeacherId(event.target.value)
            }}
          >
            {teachers.map((person) => (
              <option key={person.id} value={person.id}>{person.nome}</option>
            ))}
          </select>
        </label>
      ) : null}

      {selection ? (
        <section className="card stack cal-sheet" role="dialog" aria-label="Horários selecionados" aria-busy={busy}>
          <ErrorNote>{error}</ErrorNote>
          <div className="row spread">
            <strong>{describeSlots(selection)}</strong>
            <button className="btn ghost" type="button" onClick={() => setSelection(null)}>Cancelar</button>
          </div>
          <p className="muted">
            {selection.length === 1 ? "1 horário de 1 hora" : `${selection.length} horários de 1 hora`}
          </p>
          <div className="row">
            <button className="btn" type="button" disabled={busy} onClick={() => mark("disponivel")}>
              {busy ? "Salvando…" : "Disponível para aulas"}
            </button>
            <button className="btn secondary" type="button" disabled={busy} onClick={() => mark("bloqueado")}>Bloqueado</button>
            {selectedHorarios.length > 0 && !enrolledSelection ? (
              <button className="btn danger" type="button" disabled={busy} onClick={() => clearSelection()}>Tirar da agenda</button>
            ) : null}
          </div>
          {enrolledSelection ? <p className="muted">Encerre a matrícula antes de tirar este horário da agenda.</p> : null}
          {singleMatricula ? (
            <p>
              {names.get(singleMatricula.aluno_id) ?? "Aluno"} ·{" "}
              {instrumentos.find((item) => item.id === singleMatricula.instrumento_id)?.nome} ·{" "}
              {formatMoney(singleMatricula.valor_mensal_centavos)}
            </p>
          ) : null}
          {school && singleHorario?.uso === "disponivel" && !singleMatricula ? (
            <form className="row" onSubmit={enroll}>
              <label>
                Aluno
                <select name="aluno" required defaultValue="" disabled={busy}>
                  <option value="" disabled>Escolher</option>
                  {students.map((person) => (
                    <option key={person.id} value={person.id}>{person.nome}</option>
                  ))}
                </select>
              </label>
              <label>
                Instrumento
                <select name="instrumento" required defaultValue={options[0]?.id ?? ""} disabled={busy}>
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                </select>
              </label>
              <label>
                Mensalidade
                <input name="valor" defaultValue={options[0] ? (options[0].valor_mensal_centavos / 100).toFixed(2) : ""} required disabled={busy} />
              </label>
              <label>
                Começa em
                <input name="inicio" type="date" defaultValue={saoPauloDate()} required disabled={busy} />
              </label>
              <button className="btn" type="submit" disabled={busy}>{busy ? "Salvando…" : "Matricular"}</button>
            </form>
          ) : null}
        </section>
      ) : null}

      <div className="cal-legend" aria-hidden="true">
        <span><i className="swatch disponivel" /> Livre</span>
        <span><i className="swatch bloqueado" /> Bloqueado</span>
        <span><i className="swatch aula" /> Aula</span>
      </div>
      <WeekCalendar
        monday={monday}
        cells={paints}
        anchorMinute={anchorMinute}
        label={school ? "Agenda da escola" : "Semana do professor"}
        onCommit={setSelection}
        onOpenLesson={(aulaId) => navigate(`${school ? "/escola" : "/professor"}/aulas/${aulaId}`)}
      />
    </Page>
  )
}
