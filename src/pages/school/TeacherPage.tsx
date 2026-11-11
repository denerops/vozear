import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { Glyph, instrumentGlyph, type GlyphName } from "../../components/glyphs.tsx"
import { CardSkeleton, Empty, ErrorNote, Menu, Page } from "../../components/ui.tsx"
import { loadInstrumentos, loadMatriculas, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, TIMEZONE, formatMinute, saoPauloDate } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import { whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Matricula, Pessoa } from "../../types.ts"
import { InstrumentPicks, sameIds } from "./TeachersPage.tsx"

type Tab = "aulas" | "alunos" | "instrumentos" | "historico" | "dados"

const TABS: { id: Tab; label: string; icon: GlyphName }[] = [
  { id: "aulas", label: "Aulas", icon: "calendar" },
  { id: "alunos", label: "Alunos", icon: "people" },
  { id: "instrumentos", label: "Instrumentos", icon: "note" },
  { id: "historico", label: "Histórico", icon: "clock" },
  { id: "dados", label: "Dados", icon: "user" },
]

const WASH = [
  { background: "#efe7fb", color: "#6d4ea3" },
  { background: "#fde7ee", color: "#a33b5c" },
  { background: "#f8eadf", color: "#a15a32" },
  { background: "#f3eee6", color: "#6d5b48" },
]

function washFor(name: string) {
  let index = 0
  for (const char of name) index = (index + char.charCodeAt(0)) % WASH.length
  return WASH[index] ?? WASH[0]
}

function dayName(day: number) {
  const name = DIAS[day] ?? ""
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : ""
}

function durationLabel(minutes: number) {
  if (minutes === 60) return "1 hora"
  if (minutes === 90) return "1 h 30"
  if (minutes === 120) return "2 horas"
  return `${minutes} min`
}

function ageOf(iso: string) {
  const birth = iso.slice(0, 10)
  const today = saoPauloDate()
  const [year, month, day] = birth.split("-").map(Number)
  const [nowYear, nowMonth, nowDay] = today.split("-").map(Number)
  let age = nowYear - year
  if (nowMonth < month || (nowMonth === month && nowDay < day)) age -= 1
  return age
}

function birthLabel(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-")
  const age = ageOf(iso)
  return `${day}/${month}/${year}${age >= 0 ? ` (${age} ${age === 1 ? "ano" : "anos"})` : ""}`
}

function sinceLabel(iso: string) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(new Date(iso))
  return label.replace(".", "").replace(" de ", "/")
}

type TeacherForm = {
  selected: string[]
  telefone: string
  instagram: string
  outraRede: string
  nascimento: string
}

function teacherForm(person: Pessoa): TeacherForm {
  return {
    selected: person.instrumentos,
    telefone: person.telefone,
    instagram: person.instagram,
    outraRede: person.outraRede,
    nascimento: person.nascimento ?? "",
  }
}

export function TeacherPage() {
  const { id = "" } = useParams()
  const query = useQuery(id ? `escola:professor:${id}` : null, async () => {
    const [teachers, instrumentList, enrollments, alunos] = await Promise.all([
      loadPessoas("professor"),
      loadInstrumentos(),
      loadMatriculas({ professorId: id }),
      loadPessoas("aluno"),
    ])
    return {
      person: teachers.find((item) => item.id === id) ?? null,
      instruments: instrumentList,
      matriculas: enrollments,
      students: new Map(alunos.map((item) => [item.id, item.nome])),
    }
  })
  const person = query.data?.person ?? null
  const instruments = query.data?.instruments ?? []
  const matriculas = query.data?.matriculas ?? []
  const students = query.data?.students ?? new Map<string, string>()
  const [selected, setSelected] = useState<string[]>([])
  const [telefone, setTelefone] = useState("")
  const [instagram, setInstagram] = useState("")
  const [outraRede, setOutraRede] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>("aulas")
  const [editContact, setEditContact] = useState(false)
  const seed = useRef("")
  const formRef = useRef<TeacherForm>({ selected, telefone, instagram, outraRede, nascimento })
  formRef.current = { selected, telefone, instagram, outraRede, nascimento }

  useEffect(() => {
    seed.current = ""
    setTab("aulas")
    setEditContact(false)
  }, [id])

  useEffect(() => {
    const found = query.data?.person
    if (!found) return
    const next = JSON.stringify(teacherForm(found))
    const previous = seed.current
    const current = JSON.stringify(formRef.current)
    seed.current = next
    if (previous && current !== previous) return
    const form = teacherForm(found)
    setSelected(form.selected)
    setTelefone(form.telefone)
    setInstagram(form.instagram)
    setOutraRede(form.outraRede)
    setNascimento(form.nascimento)
  }, [query.data])

  async function saveInstruments() {
    if (!person) return
    if (selected.length === 0) {
      setError("Escolha ao menos um instrumento.")
      return
    }
    const activeIds = new Set(
      matriculas.filter((item) => item.situacao === "ativa").map((item) => item.instrumento_id),
    )
    if ([...activeIds].some((item) => !selected.includes(item))) {
      setError("Há aula ativa neste instrumento. Encerre a matrícula antes de tirá-lo.")
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    const current = new Set(person.instrumentos)
    const next = new Set(selected)
    const toAdd = selected.filter((item) => !current.has(item))
    const toRemove = person.instrumentos.filter((item) => !next.has(item))
    if (toAdd.length > 0) {
      const { error: insertError } = await client()
        .from("professor_instrumentos")
        .insert(toAdd.map((instrumento_id) => ({ professor_id: person.id, instrumento_id })))
      if (insertError) {
        setBusy(false)
        setError(humanError(insertError))
        return
      }
    }
    if (toRemove.length > 0) {
      const { error: deleteError } = await client()
        .from("professor_instrumentos")
        .delete()
        .eq("professor_id", person.id)
        .in("instrumento_id", toRemove)
      if (deleteError) {
        setBusy(false)
        setError(humanError(deleteError))
        return
      }
    }
    setBusy(false)
    setNotice("Instrumentos salvos.")
    await query.refresh()
  }

  async function saveContact(event?: FormEvent) {
    event?.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error: contactError } = await client().from("contatos").upsert({
      perfil_id: id,
      telefone,
      instagram,
      outra_rede: outraRede,
      nascimento: nascimento || null,
    })
    setBusy(false)
    if (contactError) setError(humanError(contactError))
    else {
      setNotice("Contato salvo.")
      setEditContact(false)
      await query.refresh()
    }
  }

  if (query.pending && !person) {
    return (
      <Page bare title="Professor">
        <CardSkeleton />
      </Page>
    )
  }
  if (!person) {
    return (
      <Page bare title="Professor">
        <Link className="back" to="/escola/professores">Professores</Link>
        <ErrorNote>{error ?? query.error ?? "Professor não encontrado."}</ErrorNote>
      </Page>
    )
  }

  const names = new Map(instruments.map((item) => [item.id, item.nome]))
  const firstName = person.nome.trim().split(/\s+/)[0] || person.nome
  const admin = person.papeis.includes("administrador")
  const dirty = !sameIds(selected, person.instrumentos)
  const locked = [
    ...new Set(matriculas.filter((item) => item.situacao === "ativa").map((item) => item.instrumento_id)),
  ]
  const active = matriculas
    .filter((item) => item.situacao === "ativa")
    .sort((a, b) => a.dia_semana - b.dia_semana || a.inicio_minuto - b.inicio_minuto)
  const ended = matriculas
    .filter((item) => item.situacao !== "ativa")
    .sort((a, b) => a.dia_semana - b.dia_semana || a.inicio_minuto - b.inicio_minuto)
  const taught = person.instrumentos
    .map((item) => names.get(item) ?? "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
  const pupilIds = [...new Set(active.map((item) => item.aluno_id))]
  const wash = washFor(person.nome)
  const greeting = whatsAppUrl(person.telefone, `Oi, ${firstName}.`)

  return (
    <Page bare title={person.nome}>
      <div className="student-screen">
        <Link className="back" to="/escola/professores">Professores</Link>
        <header className="student-hero">
          <span className="student-avatar" style={{ background: wash.background, color: wash.color }} aria-hidden="true">
            {person.nome.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="student-identity">
            <h1>
              {person.nome}
              {admin ? <span className="badge hero-badge">Administra</span> : null}
            </h1>
            <p>
              {person.email ? <span>{person.email}</span> : null}
              {person.telefone ? <span>{formatPhone(person.telefone)}</span> : null}
              {person.criadoEm ? <span>Desde {sinceLabel(person.criadoEm)}</span> : null}
            </p>
          </div>
          <div className="student-hero-actions">
            {person.telefone ? (
              <a className="icon-btn" href={greeting} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <Glyph name="chat" size={16} />
              </a>
            ) : null}
            <Link className="icon-btn" to="/escola/agenda" aria-label="Agenda">
              <Glyph name="calendar" size={16} />
            </Link>
            <Menu label="Mais ações">
              <Link role="menuitem" to="/escola/agenda">Agenda</Link>
              <button role="menuitem" type="button" onClick={() => setTab("instrumentos")}>
                Instrumentos
              </button>
            </Menu>
          </div>
        </header>

        <div className="student-tabs" role="tablist" aria-label="Ficha do professor">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              <Glyph name={item.icon} size={15} />
              {item.label}
            </button>
          ))}
        </div>

        {tab !== "dados" ? (
          <div className="kpis student-kpis">
            <Kpi icon="calendar" tone="rose" value={String(active.length)} label="Aulas ativas" />
            <Kpi icon="people" tone="lilac" value={String(pupilIds.length)} label="Alunos" />
            <Kpi icon="note" tone="gold" value={String(taught.length)} label="Instrumentos" />
            <Kpi icon="cap" tone="sand" value={String(active.length)} label="Aulas na semana" />
          </div>
        ) : null}

        <ErrorNote>{error ?? query.error}</ErrorNote>
        {notice ? <p className="muted" role="status">{notice}</p> : null}

        {tab === "aulas" ? (
          <div className="student-board">
            <section className="panel">
              <div className="panel-head">
                <h2>Aulas</h2>
                <Link className="text-action" to="/escola/agenda">
                  <Glyph name="plus" size={14} />
                  Nova aula
                </Link>
              </div>
              {active.length === 0 ? <Empty>Nenhuma aula com este professor. A nova aula é criada na agenda.</Empty> : null}
              <div className="enroll-list">
                {active.map((matricula) => (
                  <ClassCard
                    key={matricula.id}
                    matricula={matricula}
                    instrument={names.get(matricula.instrumento_id) ?? "Aula"}
                    student={students.get(matricula.aluno_id) ?? "Aluno"}
                  />
                ))}
              </div>
            </section>
            <aside className="student-side">
              <section className="panel">
                <div className="panel-head">
                  <h2>Instrumentos</h2>
                  <button className="text-action" type="button" onClick={() => setTab("instrumentos")}>
                    <Glyph name="pencil" size={14} />
                    Editar
                  </button>
                </div>
                {taught.length === 0 ? <p className="muted">Nenhum instrumento.</p> : (
                  <span className="instrument-list">
                    {taught.map((name) => (
                      <span key={name} className="instrument-chip">
                        <Glyph name={instrumentGlyph(name)} size={15} />
                        {name}
                      </span>
                    ))}
                  </span>
                )}
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Contato</h2>
                  {editContact ? null : (
                    <button className="text-action" type="button" onClick={() => setEditContact(true)}>
                      <Glyph name="pencil" size={14} />
                      Editar
                    </button>
                  )}
                </div>
                {editContact ? (
                  <form className="stack" onSubmit={(event) => void saveContact(event)}>
                    <label>
                      Telefone
                      <input value={telefone} onChange={(event) => setTelefone(event.target.value)} required inputMode="tel" />
                    </label>
                    <label>
                      Nascimento
                      <input type="date" value={nascimento} onChange={(event) => setNascimento(event.target.value)} />
                    </label>
                    <label>
                      Instagram
                      <input value={instagram} onChange={(event) => setInstagram(event.target.value)} />
                    </label>
                    <label>
                      Outra rede
                      <input value={outraRede} onChange={(event) => setOutraRede(event.target.value)} />
                    </label>
                    <div className="row">
                      <button
                        className="btn secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setTelefone(person.telefone)
                          setInstagram(person.instagram)
                          setOutraRede(person.outraRede)
                          setNascimento(person.nascimento ?? "")
                          setEditContact(false)
                        }}
                      >
                        Cancelar
                      </button>
                      <button className="btn" type="submit" disabled={busy}>Salvar</button>
                    </div>
                  </form>
                ) : (
                  <ul className="fact-list">
                    <li>
                      <Glyph name="phone" size={15} />
                      <span>{formatPhone(person.telefone) || "Sem telefone"}</span>
                      {person.telefone ? (
                        <a className="mini-wa" href={greeting} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                          <Glyph name="chat" size={14} />
                        </a>
                      ) : null}
                    </li>
                    <li>
                      <Glyph name="mail" size={15} />
                      <span>{person.email || "Sem e-mail"}</span>
                    </li>
                    <li>
                      <Glyph name="cake" size={15} />
                      <span>{person.nascimento ? birthLabel(person.nascimento) : "—"}</span>
                    </li>
                    <li>
                      <Glyph name="user" size={15} />
                      <span>{person.instagram || "—"}</span>
                    </li>
                  </ul>
                )}
              </section>
            </aside>
          </div>
        ) : null}

        {tab === "alunos" ? (
          <section className="panel">
            {pupilIds.length === 0 ? <Empty>Nenhum aluno com aula ativa.</Empty> : (
              <ul className="record-list">
                {pupilIds.map((alunoId) => {
                  const classes = active.filter((item) => item.aluno_id === alunoId)
                  return (
                    <li key={alunoId}>
                      <Link to={`/escola/alunos/${alunoId}`}>
                        <strong>{students.get(alunoId) ?? "Aluno"}</strong>
                        <small>
                          {classes
                            .map((item) => `${names.get(item.instrumento_id) ?? "Aula"} · ${dayName(item.dia_semana)} ${formatMinute(item.inicio_minuto)}`)
                            .join(" · ")}
                        </small>
                      </Link>
                      <span className="badge" data-status="em-aula">
                        {classes.length === 1 ? "1 aula" : `${classes.length} aulas`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : null}

        {tab === "instrumentos" ? (
          <section className="panel stack data-form">
            <h2>Instrumentos</h2>
            <InstrumentPicks instruments={instruments} selected={selected} locked={locked} onChange={setSelected} />
            {locked.length > 0 ? <p className="muted">Instrumento com aula ativa permanece marcado.</p> : null}
            <button className="btn" type="button" disabled={!dirty || busy} onClick={() => void saveInstruments()}>
              Salvar instrumentos
            </button>
          </section>
        ) : null}

        {tab === "historico" ? (
          <section className="panel">
            {ended.length === 0 ? <Empty>Nenhuma aula encerrada.</Empty> : (
              <ul className="record-list">
                {ended.map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>{students.get(item.aluno_id) ?? "Aluno"}</strong>
                      <small>
                        {names.get(item.instrumento_id) ?? "Aula"} · {dayName(item.dia_semana)} {formatMinute(item.inicio_minuto)}
                      </small>
                    </span>
                    <span className="badge" data-status="cancelada">Encerrada</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === "dados" ? (
          <form className="panel stack data-form" onSubmit={(event) => void saveContact(event)}>
            <h2>Dados do professor</h2>
            <label>
              Telefone
              <input value={telefone} onChange={(event) => setTelefone(event.target.value)} required inputMode="tel" />
            </label>
            <p className="muted">{formatPhone(telefone) || "Sem telefone"}</p>
            <label>
              Nascimento
              <input type="date" value={nascimento} onChange={(event) => setNascimento(event.target.value)} />
            </label>
            <label>
              Instagram
              <input value={instagram} onChange={(event) => setInstagram(event.target.value)} />
            </label>
            <label>
              Outra rede
              <input value={outraRede} onChange={(event) => setOutraRede(event.target.value)} />
            </label>
            <button className="btn" type="submit" disabled={busy}>Salvar contato</button>
          </form>
        ) : null}
      </div>
    </Page>
  )
}

function Kpi({ icon, tone, value, label }: { icon: GlyphName; tone: string; value: string; label: string }) {
  return (
    <article className="kpi">
      <span className="kpi-icon" data-tone={tone}>
        <Glyph name={icon} />
      </span>
      <span>
        <strong>{value}</strong>
        <span>{label}</span>
      </span>
    </article>
  )
}

function ClassCard({ matricula, instrument, student }: { matricula: Matricula; instrument: string; student: string }) {
  const tone = toneFor(instrument)
  return (
    <article className="enroll-card">
      <span className="enroll-mark" style={{ background: tone.background, color: tone.bar }}>
        <Glyph name={instrumentGlyph(instrument)} size={16} />
      </span>
      <div className="enroll-copy">
        <div className="enroll-title">
          <strong>
            <Link to={`/escola/alunos/${matricula.aluno_id}`}>{student}</Link>
          </strong>
          <span className="badge" data-status="realizada">Ativa</span>
        </div>
        <p>{instrument}</p>
        <ul>
          <li>
            <Glyph name="calendar" size={14} />
            {dayName(matricula.dia_semana)}, {formatMinute(matricula.inicio_minuto)}
          </li>
          <li>
            <Glyph name="clock" size={14} />
            {durationLabel(matricula.duracao_minutos)}
          </li>
          <li>
            <Glyph name="coin" size={14} />
            {formatMoney(matricula.valor_mensal_centavos)} / mês
          </li>
        </ul>
      </div>
    </article>
  )
}
