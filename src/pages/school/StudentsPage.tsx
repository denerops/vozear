import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { Glyph, instrumentGlyph } from "../../components/glyphs.tsx"
import { Empty, ErrorNote, ListSkeleton, Menu, Page } from "../../components/ui.tsx"
import { loadInstrumentos, loadMatriculas, loadMensalidades, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, TIMEZONE, formatMinute, saoPauloDate, timeToMinute } from "../../lib/dates.ts"
import { accessRedirect, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import { whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Matricula, Pessoa } from "../../types.ts"

type View = "todos" | "aula" | "livre"
type Layout = "tabela" | "cartoes"
type SortKey = "nome" | "instrumento" | "proxima" | "status"

const SHORT_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const WASH = [
  { background: "#efe7fb", color: "#6d4ea3" },
  { background: "#fde7ee", color: "#a33b5c" },
  { background: "#f8eadf", color: "#a15a32" },
  { background: "#f3eee6", color: "#6d5b48" },
  { background: "#e7f3ee", color: "#1f7a52" },
  { background: "#e7eefb", color: "#2c5d9b" },
]

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

function weekIndex(day: number) {
  return day === 0 ? 7 : day
}

function saoPauloNow(date = new Date()) {
  const iso = saoPauloDate(date)
  const [year, month, day] = iso.split("-").map(Number)
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
  return { weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), minute: timeToMinute(time) }
}

function stillThisWeek(day: number, minute: number, nowDay: number, nowMinute: number) {
  const left = weekIndex(day)
  const now = weekIndex(nowDay)
  if (left > now) return true
  return left === now && minute > nowMinute
}

function waitMinutes(day: number, minute: number, nowDay: number, nowMinute: number) {
  let delta = weekIndex(day) - weekIndex(nowDay)
  if (delta < 0 || (delta === 0 && minute <= nowMinute)) delta += 7
  return delta * 24 * 60 + (minute - nowMinute)
}

function washFor(name: string) {
  let index = 0
  for (const char of name) index = (index + char.charCodeAt(0)) % WASH.length
  return WASH[index] ?? WASH[0]
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?"
}

type StudentsData = {
  people: Pessoa[]
  matriculas: Matricula[]
  instruments: Map<string, string>
  teachers: Map<string, string>
  openFees: Map<string, number>
}

async function loadStudents(): Promise<StudentsData> {
  const [students, enrollments, instrumentList, teacherList, charges] = await Promise.all([
    loadPessoas("aluno"),
    loadMatriculas(),
    loadInstrumentos(),
    loadPessoas("professor"),
    loadMensalidades(),
  ])
  const fees = new Map<string, number>()
  for (const charge of charges) {
    if (charge.situacao !== "aberta") continue
    fees.set(charge.aluno_id, (fees.get(charge.aluno_id) ?? 0) + 1)
  }
  return {
    people: students,
    matriculas: enrollments,
    instruments: new Map(instrumentList.map((item) => [item.id, item.nome])),
    teachers: new Map(teacherList.map((item) => [item.id, item.nome])),
    openFees: fees,
  }
}

function statusOf(classes: number, fees: number) {
  if (fees > 0) return { label: fees === 1 ? "1 em aberto" : `${fees} em aberto`, tone: "aberta", rank: 1 }
  if (classes > 0) return { label: "Em aula", tone: "em-aula", rank: 0 }
  return { label: "Sem aula", tone: "sem-aula", rank: 2 }
}

export function StudentsPage() {
  const list = useQuery("escola:alunos", loadStudents)
  const people = list.data?.people ?? []
  const matriculas = list.data?.matriculas ?? []
  const instruments = list.data?.instruments ?? new Map<string, string>()
  const teachers = list.data?.teachers ?? new Map<string, string>()
  const openFees = list.data?.openFees ?? new Map<string, number>()
  const loading = list.pending && !list.data
  const [search, setSearch] = useState("")
  const [view, setView] = useState<View>("todos")
  const [layout, setLayout] = useState<Layout>("tabela")
  const [sort, setSort] = useState<SortKey>("nome")
  const [ascending, setAscending] = useState(true)
  const [inviting, setInviting] = useState(false)
  const now = saoPauloNow()

  const activeByStudent = useMemo(() => {
    const grouped = new Map<string, Matricula[]>()
    for (const item of matriculas) {
      if (item.situacao !== "ativa") continue
      const rows = grouped.get(item.aluno_id) ?? []
      rows.push(item)
      grouped.set(item.aluno_id, rows)
    }
    return grouped
  }, [matriculas])

  const withClass = people.filter((person) => (activeByStudent.get(person.id)?.length ?? 0) > 0).length
  const withoutClass = people.length - withClass
  const openLessons = [...activeByStudent.values()]
    .flat()
    .filter((item) => stillThisWeek(item.dia_semana, item.inicio_minuto, now.weekday, now.minute)).length

  const query = fold(search.trim())
  const digits = search.replace(/\D/g, "")
  const rows = people
    .map((person) => {
      const classes = activeByStudent.get(person.id) ?? []
      const names = [...new Set(classes.map((item) => instruments.get(item.instrumento_id) ?? "Aula"))]
      let next: Matricula | null = null
      let wait = Number.POSITIVE_INFINITY
      for (const item of classes) {
        const ahead = waitMinutes(item.dia_semana, item.inicio_minuto, now.weekday, now.minute)
        if (ahead < wait) {
          next = item
          wait = ahead
        }
      }
      const fees = openFees.get(person.id) ?? 0
      return { person, classes, names, next, wait, fees, status: statusOf(classes.length, fees) }
    })
    .filter((row) => {
      if (view === "aula" && row.classes.length === 0) return false
      if (view === "livre" && row.classes.length > 0) return false
      if (!query) return true
      const haystack = fold(
        [
          row.person.nome,
          row.person.email,
          row.person.telefone,
          ...row.classes.flatMap((item) => [
            teachers.get(item.professor_id) ?? "",
            instruments.get(item.instrumento_id) ?? "",
          ]),
        ].join(" "),
      )
      if (haystack.includes(query)) return true
      return digits.length > 0 && row.person.telefone.replace(/\D/g, "").includes(digits)
    })
    .sort((a, b) => {
      const direction = ascending ? 1 : -1
      if (sort === "instrumento") return a.names.join(" ").localeCompare(b.names.join(" "), "pt-BR") * direction
      if (sort === "proxima") return (a.wait - b.wait) * direction
      if (sort === "status") return (a.status.rank - b.status.rank) * direction || a.person.nome.localeCompare(b.person.nome, "pt-BR")
      return a.person.nome.localeCompare(b.person.nome, "pt-BR") * direction
    })

  function toggleSort(key: SortKey) {
    if (sort === key) setAscending((value) => !value)
    else {
      setSort(key)
      setAscending(true)
    }
  }

  return (
    <Page
      kicker="Alunos"
      title="Alunos"
      lede="Gerencie seus alunos, turmas e aulas em um só lugar."
      action={
        <button className="btn" type="button" onClick={() => setInviting(true)}>
          <Glyph name="plus" size={16} />
          Convidar aluno
        </button>
      }
    >
      <ErrorNote>{list.error}</ErrorNote>
      {loading ? (
        <div className="kpis" aria-busy="true" aria-label="Carregando">
          {Array.from({ length: 4 }, (_, index) => (
            <article key={index} className="kpi skeleton-kpi" />
          ))}
        </div>
      ) : (
        <div className="kpis">
          <Kpi icon="people" tone="rose" value={people.length} label="Alunos ativos" />
          <Kpi icon="cap" tone="lilac" value={withClass} label="Com aula esta semana" />
          <Kpi icon="calendar" tone="sand" value={withoutClass} label="Sem aula" />
          <Kpi icon="clock" tone="gold" value={openLessons} label={openLessons === 1 ? "Aula em aberto" : "Aulas em aberto"} />
        </div>
      )}

      <section className="directory">
        <div className="directory-bar">
          <div className="directory-filters" role="group" aria-label="Situação">
            <button type="button" aria-pressed={view === "todos"} onClick={() => setView("todos")}>
              Todos ({people.length})
            </button>
            <button type="button" aria-pressed={view === "aula"} onClick={() => setView("aula")}>
              Com aula ({withClass})
            </button>
            <button type="button" aria-pressed={view === "livre"} onClick={() => setView("livre")}>
              Sem aula ({withoutClass})
            </button>
          </div>
          <input
            className="roster-search"
            type="search"
            value={search}
            placeholder="Buscar aluno, telefone ou instrumento..."
            aria-label="Buscar aluno"
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="view-switch" role="group" aria-label="Visualização">
            <button type="button" aria-pressed={layout === "tabela"} aria-label="Lista" onClick={() => setLayout("tabela")}>
              <Glyph name="list" size={16} />
            </button>
            <button type="button" aria-pressed={layout === "cartoes"} aria-label="Cartões" onClick={() => setLayout("cartoes")}>
              <Glyph name="grid" size={16} />
            </button>
          </div>
        </div>

        {loading ? <ListSkeleton /> : people.length === 0 ? (
          <Empty>Nenhum aluno ainda. O convite chega por e-mail e a pessoa cria a própria senha.</Empty>
        ) : rows.length === 0 ? (
          <Empty>Nenhum aluno encontrado.</Empty>
        ) : layout === "cartoes" ? (
          <ul className="person-grid">
            {rows.map((row) => (
              <li key={row.person.id}>
                <StudentTile
                  person={row.person}
                  names={row.names}
                  next={row.next}
                  teachers={teachers}
                  instruments={instruments}
                  status={row.status}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="table-scroll">
            <table className="person-table">
              <thead>
                <tr>
                  <SortHead label="Aluno" active={sort === "nome"} ascending={ascending} onClick={() => toggleSort("nome")} />
                  <SortHead label="Instrumento(s)" active={sort === "instrumento"} ascending={ascending} onClick={() => toggleSort("instrumento")} />
                  <SortHead label="Próxima aula" active={sort === "proxima"} ascending={ascending} onClick={() => toggleSort("proxima")} />
                  <SortHead label="Status" active={sort === "status"} ascending={ascending} onClick={() => toggleSort("status")} />
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.person.id}>
                    <td>
                      <PersonLink person={row.person} />
                    </td>
                    <td>
                      {row.names.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className="instrument-list">
                          {row.names.map((name) => (
                            <span key={name} className="instrument-chip">
                              <Glyph name={instrumentGlyph(name)} size={15} />
                              {name}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td>
                      <NextLesson next={row.next} teachers={teachers} instruments={instruments} />
                    </td>
                    <td>
                      <span className="badge" data-status={row.status.tone}>{row.status.label}</span>
                    </td>
                    <td className="person-actions">
                      <RowActions person={row.person} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inviting ? (
        <InviteDialog
          onClose={() => setInviting(false)}
          onCreated={async () => {
            setInviting(false)
            await list.refresh()
          }}
        />
      ) : null}
    </Page>
  )
}

function Kpi({
  icon,
  tone,
  value,
  label,
}: {
  icon: "people" | "cap" | "calendar" | "clock"
  tone: string
  value: number
  label: string
}) {
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

function SortHead({
  label,
  active,
  ascending,
  onClick,
}: {
  label: string
  active: boolean
  ascending: boolean
  onClick: () => void
}) {
  return (
    <th aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={onClick}>
        {label}
      </button>
    </th>
  )
}

function PersonLink({ person }: { person: Pessoa }) {
  const wash = washFor(person.nome)
  return (
    <Link className="person-id" to={`/escola/alunos/${person.id}`}>
      <span className="person-avatar" style={{ background: wash.background, color: wash.color }} aria-hidden="true">
        {initial(person.nome)}
      </span>
      <span>
        <strong>{person.nome}</strong>
        <small>{formatPhone(person.telefone) || person.email}</small>
      </span>
    </Link>
  )
}

function NextLesson({
  next,
  teachers,
  instruments,
}: {
  next: Matricula | null
  teachers: Map<string, string>
  instruments: Map<string, string>
}) {
  if (!next) {
    return (
      <span className="next-lesson">
        <strong>Sem aula semanal</strong>
      </span>
    )
  }
  const day = SHORT_DAYS[next.dia_semana] ?? DIAS[next.dia_semana] ?? ""
  return (
    <span className="next-lesson">
      <strong>
        {day}, {formatMinute(next.inicio_minuto)}
      </strong>
      <small>
        {instruments.get(next.instrumento_id) ?? "Aula"} · {teachers.get(next.professor_id) ?? "Professor"}
      </small>
    </span>
  )
}

function RowActions({ person }: { person: Pessoa }) {
  const first = person.nome.trim().split(/\s+/)[0] || person.nome
  return (
    <>
      <Link className="icon-btn" to="/escola/agenda" aria-label={`Agenda de ${person.nome}`}>
        <Glyph name="calendar" size={16} />
      </Link>
      <Menu label={`Ações de ${person.nome}`}>
        <Link role="menuitem" to={`/escola/alunos/${person.id}`}>Abrir ficha</Link>
        <Link role="menuitem" to="/escola/agenda">Abrir agenda</Link>
        {person.telefone ? (
          <a role="menuitem" href={whatsAppUrl(person.telefone, `Oi, ${first}.`)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        ) : null}
      </Menu>
    </>
  )
}

function StudentTile({
  person,
  names,
  next,
  teachers,
  instruments,
  status,
}: {
  person: Pessoa
  names: string[]
  next: Matricula | null
  teachers: Map<string, string>
  instruments: Map<string, string>
  status: { label: string; tone: string }
}) {
  return (
    <article className="person-tile">
      <PersonLink person={person} />
      <span className="badge" data-status={status.tone}>{status.label}</span>
      {names.length > 0 ? (
        <span className="instrument-list">
          {names.map((name) => (
            <span key={name} className="instrument-chip">
              <Glyph name={instrumentGlyph(name)} size={15} />
              {name}
            </span>
          ))}
        </span>
      ) : (
        <span className="muted">Sem instrumento</span>
      )}
      <NextLesson next={next} teachers={teachers} instruments={instruments} />
      <div className="person-actions">
        <RowActions person={person} />
      </div>
    </article>
  )
}

function InviteDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [instagram, setInstagram] = useState("")
  const [outraRede, setOutraRede] = useState("")
  const [observacao, setObservacao] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    nameRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose, pending])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const { error: invokeError } = await client().functions.invoke("invite-user", {
      body: {
        email,
        fullName: nome,
        phone: telefone,
        role: "aluno",
        alsoAdmin: false,
        birthDate: nascimento || null,
        instagram,
        otherSocial: outraRede,
        internalNote: observacao,
        instrumentIds: [],
        redirectTo: accessRedirect(),
      },
    })
    if (invokeError) {
      const context = (invokeError as { context?: Response }).context
      const payload = context ? ((await context.json().catch(() => null)) as { error?: string } | null) : null
      setError(payload?.error ?? invokeError.message)
      setPending(false)
      return
    }
    await onCreated()
  }

  return (
    <div
      className="sheet"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose()
      }}
    >
      <form
        className="sheet-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        onSubmit={onSubmit}
      >
        <h2 id="invite-title">Convidar aluno</h2>
        <p className="muted">O convite chega por e-mail. A pessoa define a própria senha.</p>
        <label>
          Nome
          <input ref={nameRef} value={nome} onChange={(event) => setNome(event.target.value)} required />
        </label>
        <label>
          E-mail
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Telefone
          <input
            value={telefone}
            onChange={(event) => setTelefone(event.target.value)}
            required
            inputMode="tel"
            placeholder="11988887777"
          />
        </label>
        <details>
          <summary>Nascimento, redes e observação</summary>
          <div className="stack">
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
            <label>
              Observação interna
              <textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} rows={3} />
            </label>
          </div>
        </details>
        <ErrorNote>{error}</ErrorNote>
        <div className="row">
          <button className="btn secondary" type="button" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Enviando…" : "Enviar convite"}
          </button>
        </div>
      </form>
    </div>
  )
}
