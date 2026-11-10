import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { Empty, ErrorNote, Page } from "../../components/ui.tsx"
import { loadInstrumentos, loadMatriculas, loadMensalidades, loadPessoas } from "../../data/api.ts"
import { DIAS, formatMinute } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { accessRedirect, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import type { Matricula, Pessoa } from "../../types.ts"

type View = "todos" | "aula" | "livre"

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

function dayName(day: number) {
  const name = DIAS[day] ?? ""
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : ""
}

export function StudentsPage() {
  const [people, setPeople] = useState<Pessoa[]>([])
  const [matriculas, setMatriculas] = useState<Matricula[]>([])
  const [instruments, setInstruments] = useState<Map<string, string>>(new Map())
  const [teachers, setTeachers] = useState<Map<string, string>>(new Map())
  const [openFees, setOpenFees] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [view, setView] = useState<View>("todos")
  const [instrumentId, setInstrumentId] = useState("")
  const [inviting, setInviting] = useState(false)

  async function reload() {
    const [students, enrollments, instrumentList, teacherList, charges] = await Promise.all([
      loadPessoas("aluno"),
      loadMatriculas(),
      loadInstrumentos(),
      loadPessoas("professor"),
      loadMensalidades(),
    ])
    setPeople(students)
    setMatriculas(enrollments)
    setInstruments(new Map(instrumentList.map((item) => [item.id, item.nome])))
    setTeachers(new Map(teacherList.map((item) => [item.id, item.nome])))
    const fees = new Map<string, number>()
    for (const charge of charges) {
      if (charge.situacao !== "aberta") continue
      fees.set(charge.aluno_id, (fees.get(charge.aluno_id) ?? 0) + 1)
    }
    setOpenFees(fees)
  }

  useEffect(() => {
    let alive = true
    reload()
      .catch((reason: { message?: string }) => {
        if (alive) setError(humanError(reason))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const activeByStudent = useMemo(() => {
    const grouped = new Map<string, Matricula[]>()
    for (const item of matriculas) {
      if (item.situacao !== "ativa") continue
      const list = grouped.get(item.aluno_id) ?? []
      list.push(item)
      grouped.set(item.aluno_id, list)
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.dia_semana - b.dia_semana || a.inicio_minuto - b.inicio_minuto)
    }
    return grouped
  }, [matriculas])

  const instrumentOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const list of activeByStudent.values()) {
      for (const item of list) ids.add(item.instrumento_id)
    }
    return [...ids]
      .map((id) => ({ id, nome: instruments.get(id) ?? "Instrumento" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  }, [activeByStudent, instruments])

  const withClass = people.filter((person) => (activeByStudent.get(person.id)?.length ?? 0) > 0).length
  const query = fold(search.trim())
  const digits = search.replace(/\D/g, "")
  const visible = people.filter((person) => {
    const classes = activeByStudent.get(person.id) ?? []
    if (view === "aula" && classes.length === 0) return false
    if (view === "livre" && classes.length > 0) return false
    if (instrumentId && !classes.some((item) => item.instrumento_id === instrumentId)) return false
    if (!query) return true
    const haystack = fold(
      [
        person.nome,
        person.email,
        person.telefone,
        ...classes.flatMap((item) => [
          teachers.get(item.professor_id) ?? "",
          instruments.get(item.instrumento_id) ?? "",
        ]),
      ].join(" "),
    )
    if (haystack.includes(query)) return true
    return digits.length > 0 && person.telefone.replace(/\D/g, "").includes(digits)
  })

  const lede = loading
    ? "Carregando…"
    : `${people.length} ${people.length === 1 ? "aluno" : "alunos"} · ${withClass} com aula`

  return (
    <Page
      title="Alunos"
      lede={lede}
      action={
        <button className="btn" type="button" onClick={() => setInviting(true)}>
          Convidar
        </button>
      }
    >
      <ErrorNote>{error}</ErrorNote>
      <div className="roster-tools">
        <input
          className="roster-search"
          type="search"
          value={search}
          placeholder="Buscar nome, telefone ou instrumento"
          aria-label="Buscar aluno"
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="roster-filters" role="group" aria-label="Situação">
          <button type="button" aria-pressed={view === "todos"} onClick={() => setView("todos")}>
            Todos
          </button>
          <button
            type="button"
            aria-pressed={view === "aula"}
            onClick={() => setView("aula")}
          >
            Com aula
          </button>
          <button
            type="button"
            aria-pressed={view === "livre"}
            onClick={() => {
              setView("livre")
              setInstrumentId("")
            }}
          >
            Sem aula
          </button>
        </div>
        {view !== "livre" && instrumentOptions.length > 0 ? (
          <div className="roster-filters" role="group" aria-label="Instrumento">
            {instrumentOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={instrumentId === item.id}
                onClick={() => {
                  const next = instrumentId === item.id ? "" : item.id
                  setInstrumentId(next)
                  if (next) setView("aula")
                }}
              >
                {item.nome}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? null : people.length === 0 ? (
        <Empty>Nenhum aluno ainda. O convite chega por e-mail e a pessoa cria a própria senha.</Empty>
      ) : visible.length === 0 ? (
        <Empty>Nenhum aluno encontrado.</Empty>
      ) : (
        <ul className="roster">
          {visible.map((person) => {
            const classes = activeByStudent.get(person.id) ?? []
            const tone = toneFor(classes[0] ? instruments.get(classes[0].instrumento_id) ?? "" : "")
            const fees = openFees.get(person.id) ?? 0
            return (
              <li key={person.id}>
                <Link className="roster-card" to={`/escola/alunos/${person.id}`}>
                  <span
                    className="roster-avatar"
                    style={
                      classes.length > 0
                        ? { background: tone.background, color: tone.bar }
                        : undefined
                    }
                    aria-hidden="true"
                  >
                    {person.nome.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="roster-body">
                    <strong>{person.nome}</strong>
                    <span className="roster-meta">{formatPhone(person.telefone) || person.email}</span>
                    {classes.length === 0 ? (
                      <span className="roster-meta">Sem aula semanal</span>
                    ) : (
                      classes.map((item) => {
                        const name = instruments.get(item.instrumento_id) ?? "Aula"
                        const dot = toneFor(name)
                        return (
                          <span key={item.id} className="roster-class">
                            <i style={{ background: dot.dot }} />
                            <span>
                              {name} · {teachers.get(item.professor_id) ?? "Professor"} · {dayName(item.dia_semana)}{" "}
                              {formatMinute(item.inicio_minuto)}
                            </span>
                          </span>
                        )
                      })
                    )}
                  </span>
                  {fees > 0 ? (
                    <span className="badge" data-status="aberta">
                      {fees === 1 ? "1 em aberto" : `${fees} em aberto`}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {inviting ? (
        <InviteDialog
          onClose={() => setInviting(false)}
          onCreated={async () => {
            setInviting(false)
            await reload()
          }}
        />
      ) : null}
    </Page>
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
