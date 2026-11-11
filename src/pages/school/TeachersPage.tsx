import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { Empty, ErrorNote, ListSkeleton, Page } from "../../components/ui.tsx"
import { loadInstrumentos, loadMatriculas, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, formatMinute } from "../../lib/dates.ts"
import { accessRedirect, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import type { Instrumento, Matricula, Pessoa } from "../../types.ts"

type View = "todos" | "aula" | "livre"

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

function dayName(day: number) {
  const name = DIAS[day] ?? ""
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : ""
}

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const ids = new Set(right)
  return left.every((id) => ids.has(id))
}

export function InstrumentPicks({
  instruments,
  selected,
  locked = [],
  onChange,
}: {
  instruments: Instrumento[]
  selected: string[]
  locked?: string[]
  onChange: (ids: string[]) => void
}) {
  const choices = instruments.filter((item) => item.ativo || selected.includes(item.id))
  return (
    <div className="instrument-picks" role="group" aria-label="Instrumentos">
      {choices.map((item) => {
        const on = selected.includes(item.id)
        const fixed = locked.includes(item.id)
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={on}
            disabled={fixed}
            title={fixed ? "Há aula ativa neste instrumento" : undefined}
            onClick={() =>
              onChange(on ? selected.filter((id) => id !== item.id) : [...selected, item.id])
            }
          >
            <i style={{ background: toneFor(item.nome).dot }} />
            {item.nome}
          </button>
        )
      })}
    </div>
  )
}

type TeachersData = {
  people: Pessoa[]
  instruments: Instrumento[]
  matriculas: Matricula[]
  students: Map<string, string>
}

async function loadTeachers(): Promise<TeachersData> {
  const [teachers, instrumentList, enrollments, alunos] = await Promise.all([
    loadPessoas("professor"),
    loadInstrumentos(),
    loadMatriculas(),
    loadPessoas("aluno"),
  ])
  return {
    people: teachers,
    instruments: instrumentList,
    matriculas: enrollments,
    students: new Map(alunos.map((person) => [person.id, person.nome])),
  }
}

export function TeachersPage() {
  const list = useQuery("escola:professores", loadTeachers)
  const people = list.data?.people ?? []
  const instruments = list.data?.instruments ?? []
  const matriculas = list.data?.matriculas ?? []
  const students = list.data?.students ?? new Map<string, string>()
  const loading = list.pending && !list.data
  const [search, setSearch] = useState("")
  const [view, setView] = useState<View>("todos")
  const [instrumentId, setInstrumentId] = useState("")
  const [inviting, setInviting] = useState(false)

  const names = useMemo(() => new Map(instruments.map((item) => [item.id, item.nome])), [instruments])
  const activeByTeacher = useMemo(() => {
    const grouped = new Map<string, Matricula[]>()
    for (const item of matriculas) {
      if (item.situacao !== "ativa") continue
      const list = grouped.get(item.professor_id) ?? []
      list.push(item)
      grouped.set(item.professor_id, list)
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.dia_semana - b.dia_semana || a.inicio_minuto - b.inicio_minuto)
    }
    return grouped
  }, [matriculas])

  const instrumentOptions = useMemo(() => {
    const ids = new Set(people.flatMap((person) => person.instrumentos))
    return [...ids]
      .map((id) => ({ id, nome: names.get(id) ?? "Instrumento" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  }, [people, names])

  const withStudents = people.filter((person) => (activeByTeacher.get(person.id)?.length ?? 0) > 0).length
  const query = fold(search.trim())
  const digits = search.replace(/\D/g, "")
  const visible = people.filter((person) => {
    const classes = activeByTeacher.get(person.id) ?? []
    if (view === "aula" && classes.length === 0) return false
    if (view === "livre" && classes.length > 0) return false
    if (instrumentId && !person.instrumentos.includes(instrumentId)) return false
    if (!query) return true
    const haystack = fold(
      [
        person.nome,
        person.email,
        person.telefone,
        ...person.instrumentos.map((id) => names.get(id) ?? ""),
        ...classes.map((item) => students.get(item.aluno_id) ?? ""),
      ].join(" "),
    )
    if (haystack.includes(query)) return true
    return digits.length > 0 && person.telefone.replace(/\D/g, "").includes(digits)
  })

  const lede = loading
    ? "Buscando professores…"
    : `${people.length} ${people.length === 1 ? "professor" : "professores"} · ${withStudents} com alunos`

  return (
    <Page
      title="Professores"
      lede={lede}
      action={
        <button className="btn" type="button" onClick={() => setInviting(true)}>
          Convidar
        </button>
      }
    >
      <ErrorNote>{list.error}</ErrorNote>
      <div className="roster-tools">
        <input
          className="roster-search"
          type="search"
          value={search}
          placeholder="Buscar nome, instrumento ou aluno"
          aria-label="Buscar professor"
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="roster-filters" role="group" aria-label="Situação">
          <button type="button" aria-pressed={view === "todos"} onClick={() => setView("todos")}>
            Todos
          </button>
          <button type="button" aria-pressed={view === "aula"} onClick={() => setView("aula")}>
            Com alunos
          </button>
          <button
            type="button"
            aria-pressed={view === "livre"}
            onClick={() => {
              setView("livre")
              setInstrumentId("")
            }}
          >
            Sem alunos
          </button>
        </div>
        {instrumentOptions.length > 0 ? (
          <div className="roster-filters" role="group" aria-label="Instrumento">
            {instrumentOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={instrumentId === item.id}
                onClick={() => setInstrumentId(instrumentId === item.id ? "" : item.id)}
              >
                {item.nome}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? <ListSkeleton /> : people.length === 0 ? (
        <Empty>Nenhum professor ainda. O convite chega por e-mail e a pessoa cria a própria senha.</Empty>
      ) : visible.length === 0 ? (
        <Empty>Nenhum professor encontrado.</Empty>
      ) : (
        <ul className="roster">
          {visible.map((person) => {
            const classes = activeByTeacher.get(person.id) ?? []
            const taught = person.instrumentos
              .map((id) => names.get(id) ?? "")
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, "pt-BR"))
            const tone = toneFor(taught[0] ?? "")
            const preview = classes.slice(0, 3)
            const extra = classes.length - preview.length
            const admin = person.papeis.includes("administrador")
            return (
              <li key={person.id}>
                <Link className="roster-card" to={`/escola/professores/${person.id}`}>
                  <span
                    className="roster-avatar"
                    style={taught.length > 0 ? { background: tone.background, color: tone.bar } : undefined}
                    aria-hidden="true"
                  >
                    {person.nome.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="roster-body">
                    <strong>{person.nome}</strong>
                    <span className="roster-meta">{formatPhone(person.telefone) || person.email}</span>
                    <span className="roster-class">
                      {taught.map((name) => (
                        <i key={name} style={{ background: toneFor(name).dot }} />
                      ))}
                      <span>{taught.length > 0 ? taught.join(" · ") : "Sem instrumento"}</span>
                    </span>
                    {preview.map((item) => (
                      <span key={item.id} className="roster-meta">
                        {students.get(item.aluno_id) ?? "Aluno"} · {names.get(item.instrumento_id) ?? "Aula"} ·{" "}
                        {dayName(item.dia_semana)} {formatMinute(item.inicio_minuto)}
                      </span>
                    ))}
                    {extra > 0 ? <span className="roster-meta">e mais {extra}</span> : null}
                  </span>
                  {admin ? <span className="badge">Administra</span> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {inviting ? (
        <InviteDialog
          instruments={instruments}
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

function InviteDialog({
  instruments,
  onClose,
  onCreated,
}: {
  instruments: Instrumento[]
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [instagram, setInstagram] = useState("")
  const [outraRede, setOutraRede] = useState("")
  const [instrumentIds, setInstrumentIds] = useState<string[]>([])
  const [alsoAdmin, setAlsoAdmin] = useState(false)
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
    if (instrumentIds.length === 0) {
      setError("Escolha ao menos um instrumento.")
      return
    }
    setPending(true)
    setError(null)
    const { error: invokeError } = await client().functions.invoke("invite-user", {
      body: {
        email,
        fullName: nome,
        phone: telefone,
        role: "professor",
        alsoAdmin,
        birthDate: nascimento || null,
        instagram,
        otherSocial: outraRede,
        internalNote: "",
        instrumentIds,
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
      <form className="sheet-card" role="dialog" aria-modal="true" aria-labelledby="invite-teacher" onSubmit={onSubmit}>
        <h2 id="invite-teacher">Convidar professor</h2>
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
        <div className="stack">
          <span className="eyebrow">Instrumentos</span>
          <InstrumentPicks instruments={instruments} selected={instrumentIds} onChange={setInstrumentIds} />
        </div>
        <label className="check">
          <input type="checkbox" checked={alsoAdmin} onChange={(event) => setAlsoAdmin(event.target.checked)} />
          Também administra a escola
        </label>
        <details>
          <summary>Nascimento e redes</summary>
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

export { sameIds }
