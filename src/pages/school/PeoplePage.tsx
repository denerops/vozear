import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { Empty, ErrorNote, Page } from "../../components/ui.tsx"
import { loadInstrumentos, loadPessoas } from "../../data/api.ts"
import { client } from "../../lib/supabase.ts"
import { humanError } from "../../lib/errors.ts"
import { accessRedirect, formatPhone } from "../../lib/format.ts"
import type { Instrumento, Pessoa } from "../../types.ts"

function TeacherRow({
  person,
  instrumentos,
  onSaved,
}: {
  person: Pessoa
  instrumentos: Instrumento[]
  onSaved: () => Promise<void>
}) {
  const [selected, setSelected] = useState(person.instrumentos)
  const [rowError, setRowError] = useState<string | null>(null)

  async function save() {
    setRowError(null)
    const current = new Set(person.instrumentos)
    const next = new Set(selected)
    const toAdd = selected.filter((id) => !current.has(id))
    const toRemove = person.instrumentos.filter((id) => !next.has(id))
    if (toAdd.length > 0) {
      const { error } = await client()
        .from("professor_instrumentos")
        .insert(toAdd.map((instrumento_id) => ({ professor_id: person.id, instrumento_id })))
      if (error) {
        setRowError(humanError(error))
        return
      }
    }
    if (toRemove.length > 0) {
      const { error } = await client()
        .from("professor_instrumentos")
        .delete()
        .eq("professor_id", person.id)
        .in("instrumento_id", toRemove)
      if (error) {
        setRowError(humanError(error))
        return
      }
    }
    await onSaved()
  }

  return (
    <div className="stack">
      <div>
        <strong>{person.nome}</strong>
        <span>{formatPhone(person.telefone)}</span>
        <span>{person.email}</span>
        {person.papeis.includes("administrador") ? <span>Também administra</span> : null}
      </div>
      <div className="checks">
        {instrumentos.filter((item) => item.ativo || selected.includes(item.id)).map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, item.id]
                    : selected.filter((id) => id !== item.id),
                )
              }
            />
            {item.nome}
          </label>
        ))}
      </div>
      <ErrorNote>{rowError}</ErrorNote>
      <button className="btn secondary" type="button" onClick={() => void save()}>
        Salvar instrumentos
      </button>
    </div>
  )
}

export function PeoplePage({ kind }: { kind: "aluno" | "professor" }) {
  const [people, setPeople] = useState<Pessoa[]>([])
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [instagram, setInstagram] = useState("")
  const [outraRede, setOutraRede] = useState("")
  const [observacao, setObservacao] = useState("")
  const [alsoAdmin, setAlsoAdmin] = useState(false)
  const [instrumentIds, setInstrumentIds] = useState<string[]>([])

  async function reload() {
    const [list, instruments] = await Promise.all([
      loadPessoas(kind),
      loadInstrumentos(),
    ])
    setPeople(list)
    setInstrumentos(instruments)
  }

  useEffect(() => {
    let alive = true
    reload().catch((reason: { message?: string }) => {
      if (alive) setError(humanError(reason))
    })
    return () => {
      alive = false
    }
  }, [kind])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const { error: invokeError } = await client().functions.invoke("invite-user", {
      body: {
        email,
        fullName: nome,
        phone: telefone,
        role: kind,
        alsoAdmin: kind === "professor" && alsoAdmin,
        birthDate: nascimento || null,
        instagram,
        otherSocial: outraRede,
        internalNote: kind === "aluno" ? observacao : "",
        instrumentIds: kind === "professor" ? instrumentIds : [],
        redirectTo: accessRedirect(),
      },
    })
    setPending(false)
    if (invokeError) {
      const context = (invokeError as { context?: Response }).context
      const payload = context ? ((await context.json().catch(() => null)) as { error?: string } | null) : null
      setError(payload?.error ?? invokeError.message)
      return
    }
    setNome("")
    setEmail("")
    setTelefone("")
    setNascimento("")
    setInstagram("")
    setOutraRede("")
    setObservacao("")
    setAlsoAdmin(false)
    setInstrumentIds([])
    await reload()
  }

  const title = kind === "aluno" ? "Alunos" : "Professores"
  const ativos = instrumentos.filter((item) => item.ativo)

  return (
    <Page
      title={title}
      lede={
        kind === "aluno"
          ? "O convite chega por e-mail. A pessoa define a própria senha."
          : "Um professor pode lecionar mais de um instrumento. Quem também administra a escola marca a opção abaixo."
      }
    >
      <form className="card stack" onSubmit={onSubmit}>
        <h2>Convidar</h2>
        <div className="row">
          <label>
            Nome
            <input value={nome} onChange={(event) => setNome(event.target.value)} required />
          </label>
          <label>
            E-mail
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Telefone
            <input value={telefone} onChange={(event) => setTelefone(event.target.value)} required placeholder="11988887777" />
          </label>
        </div>
        <div className="row">
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
        {kind === "aluno" ? (
          <label>
            Observação interna
            <textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} rows={2} />
          </label>
        ) : (
          <>
            <fieldset>
              <legend>Instrumentos</legend>
              <div className="checks">
                {ativos.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={instrumentIds.includes(item.id)}
                      onChange={(event) =>
                        setInstrumentIds(
                          event.target.checked
                            ? [...instrumentIds, item.id]
                            : instrumentIds.filter((id) => id !== item.id),
                        )
                      }
                    />
                    {item.nome}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="check">
              <input type="checkbox" checked={alsoAdmin} onChange={(event) => setAlsoAdmin(event.target.checked)} />
              Também é administrador
            </label>
          </>
        )}
        <ErrorNote>{error}</ErrorNote>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar convite"}
        </button>
      </form>

      {people.length === 0 ? <Empty>Ninguém convidado ainda.</Empty> : null}
      <ul className="people">
        {people.map((person) => (
          <li key={person.id}>
            {kind === "aluno" ? (
              <Link to={`/escola/alunos/${person.id}`}>
                <strong>{person.nome}</strong>
                <span>{formatPhone(person.telefone)}</span>
                <span>{person.email}</span>
              </Link>
            ) : (
              <TeacherRow
                key={`${person.id}:${person.instrumentos.join()}`}
                person={person}
                instrumentos={instrumentos}
                onSaved={reload}
              />
            )}
          </li>
        ))}
      </ul>
    </Page>
  )
}
