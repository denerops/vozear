import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { CardSkeleton, Empty, ErrorNote, Page } from "../../components/ui.tsx"
import { loadInstrumentos, loadMatriculas, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, formatMinute } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import { whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Pessoa } from "../../types.ts"
import { InstrumentPicks, sameIds } from "./TeachersPage.tsx"

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
  const seed = useRef("")
  const formRef = useRef<TeacherForm>({ selected, telefone, instagram, outraRede, nascimento })
  formRef.current = { selected, telefone, instagram, outraRede, nascimento }

  useEffect(() => {
    seed.current = ""
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

  async function saveContact(event: FormEvent) {
    event.preventDefault()
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
      await query.refresh()
    }
  }

  if (query.pending && !person) return <Page title="Professor"><CardSkeleton /></Page>
  if (!person) return <Page title="Professor"><ErrorNote>{error ?? query.error ?? "Professor não encontrado."}</ErrorNote></Page>

  const names = new Map(instruments.map((item) => [item.id, item.nome]))
  const firstName = person.nome.trim().split(/\s+/)[0] || person.nome
  const admin = person.papeis.includes("administrador")
  const dirty = !sameIds(selected, person.instrumentos)
  const locked = [
    ...new Set(matriculas.filter((item) => item.situacao === "ativa").map((item) => item.instrumento_id)),
  ]
  const classes = [...matriculas].sort((a, b) => {
    if (a.situacao !== b.situacao) return a.situacao === "ativa" ? -1 : 1
    return a.dia_semana - b.dia_semana || a.inicio_minuto - b.inicio_minuto
  })

  return (
    <Page
      title={person.nome}
      lede={person.email}
      action={
        <div className="row">
          {admin ? <span className="badge">Administra</span> : null}
          {person.telefone ? (
            <a className="btn" href={whatsAppUrl(person.telefone, `Oi, ${firstName}.`)} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          ) : null}
        </div>
      }
    >
      <Link className="back" to="/escola/professores">Professores</Link>
      <ErrorNote>{error ?? query.error}</ErrorNote>
      {notice ? <p className="muted" role="status">{notice}</p> : null}
      <div className="student-layout">
        <section className="stack">
          <h2>Aulas</h2>
          {classes.length === 0 ? <Empty>Nenhuma aula com este professor.</Empty> : null}
          {classes.map((matricula) => {
            const instrument = names.get(matricula.instrumento_id) ?? "Aula"
            const tone = toneFor(instrument)
            const active = matricula.situacao === "ativa"
            return (
              <article key={matricula.id} className="card enrollment">
                <span className="enrollment-bar" style={{ background: tone.bar }} />
                <div className="row spread">
                  <strong>
                    <Link to={`/escola/alunos/${matricula.aluno_id}`}>{students.get(matricula.aluno_id) ?? "Aluno"}</Link>
                  </strong>
                  <span className="badge" data-status={active ? "realizada" : "cancelada"}>
                    {active ? "Ativa" : "Encerrada"}
                  </span>
                </div>
                <p className="muted">{instrument}</p>
                <p>
                  {dayName(matricula.dia_semana)} · {formatMinute(matricula.inicio_minuto)} · {durationLabel(matricula.duracao_minutos)}
                </p>
                <p className="muted">{formatMoney(matricula.valor_mensal_centavos)} por mês</p>
              </article>
            )
          })}
        </section>
        <div className="stack">
          <section className="card stack">
            <h2>Instrumentos</h2>
            <InstrumentPicks
              instruments={instruments}
              selected={selected}
              locked={locked}
              onChange={setSelected}
            />
            {locked.length > 0 ? (
              <p className="muted">Instrumento com aula ativa permanece marcado.</p>
            ) : null}
            <button className="btn" type="button" disabled={!dirty || busy} onClick={() => void saveInstruments()}>
              Salvar instrumentos
            </button>
          </section>
          <form className="card stack" onSubmit={saveContact}>
            <h2>Contato</h2>
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
        </div>
      </div>
    </Page>
  )
}
