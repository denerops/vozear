import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { CardSkeleton, Empty, ErrorNote, Page } from "../../components/ui.tsx"
import { loadInstrumentos, loadMatriculas, loadMensalidades, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, formatMinute } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import { whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Matricula, Pessoa } from "../../types.ts"

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

function centsOf(value: string) {
  const cents = Math.round(Number(value.replace(",", ".")) * 100)
  return Number.isFinite(cents) ? cents : 0
}

type StudentForm = {
  telefone: string
  instagram: string
  outraRede: string
  nascimento: string
  observacao: string
  precos: Record<string, string>
}

function studentForm(person: Pessoa, enrollments: Matricula[]): StudentForm {
  return {
    telefone: person.telefone,
    instagram: person.instagram,
    outraRede: person.outraRede,
    nascimento: person.nascimento ?? "",
    observacao: person.observacao,
    precos: Object.fromEntries(
      enrollments.map((item) => [item.id, (item.valor_mensal_centavos / 100).toFixed(2).replace(".", ",")]),
    ),
  }
}

export function StudentPage() {
  const { id = "" } = useParams()
  const query = useQuery(id ? `escola:aluno:${id}` : null, async () => {
    const [students, enrollments, instruments, teachers, charges] = await Promise.all([
      loadPessoas("aluno"),
      loadMatriculas({ alunoId: id }),
      loadInstrumentos(),
      loadPessoas("professor"),
      loadMensalidades(id),
    ])
    return {
      person: students.find((item) => item.id === id) ?? null,
      matriculas: enrollments,
      instrumentos: new Map(instruments.map((item) => [item.id, item.nome])),
      professores: new Map(teachers.map((item) => [item.id, item.nome])),
      openFees: charges.filter((item) => item.situacao === "aberta").length,
    }
  })
  const person = query.data?.person ?? null
  const matriculas = query.data?.matriculas ?? []
  const instrumentos = query.data?.instrumentos ?? new Map<string, string>()
  const professores = query.data?.professores ?? new Map<string, string>()
  const openFees = query.data?.openFees ?? 0
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [telefone, setTelefone] = useState("")
  const [instagram, setInstagram] = useState("")
  const [outraRede, setOutraRede] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [observacao, setObservacao] = useState("")
  const [precos, setPrecos] = useState<Record<string, string>>({})
  const seed = useRef("")
  const formRef = useRef<StudentForm>({ telefone, instagram, outraRede, nascimento, observacao, precos })
  formRef.current = { telefone, instagram, outraRede, nascimento, observacao, precos }

  useEffect(() => {
    seed.current = ""
  }, [id])

  useEffect(() => {
    const found = query.data?.person
    if (!found || !query.data) return
    const next = JSON.stringify(studentForm(found, query.data.matriculas))
    const previous = seed.current
    const current = JSON.stringify(formRef.current)
    seed.current = next
    if (previous && current !== previous) return
    const form = studentForm(found, query.data.matriculas)
    setTelefone(form.telefone)
    setInstagram(form.instagram)
    setOutraRede(form.outraRede)
    setNascimento(form.nascimento)
    setObservacao(form.observacao)
    setPrecos(form.precos)
  }, [query.data])

  async function saveContact(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    const [{ error: contactError }, { error: noteError }] = await Promise.all([
      client().from("contatos").upsert({
        perfil_id: id,
        telefone,
        instagram,
        outra_rede: outraRede,
        nascimento: nascimento || null,
      }),
      client().from("observacoes_internas").upsert({ aluno_id: id, texto: observacao }),
    ])
    setBusy(false)
    if (contactError || noteError) setError(humanError(contactError ?? noteError))
    else {
      setNotice("Contato salvo.")
      await query.refresh()
    }
  }

  async function savePrice(matricula: Matricula) {
    const cents = centsOf(precos[matricula.id] ?? "")
    if (cents <= 0) {
      setError("Informe um valor mensal maior que zero.")
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error: updateError } = await client()
      .from("matriculas")
      .update({ valor_mensal_centavos: cents })
      .eq("id", matricula.id)
    setBusy(false)
    if (updateError) setError(humanError(updateError))
    else {
      setNotice("Mensalidade atualizada.")
      await query.refresh()
    }
  }

  async function closeEnrollment(matricula: Matricula) {
    const instrument = instrumentos.get(matricula.instrumento_id) ?? "esta matrícula"
    if (!window.confirm(`Encerrar ${instrument}? As próximas aulas são canceladas. As mensalidades já geradas continuam.`)) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error: updateError } = await client()
      .from("matriculas")
      .update({ situacao: "encerrada" })
      .eq("id", matricula.id)
    setBusy(false)
    if (updateError) setError(humanError(updateError))
    else {
      setNotice("Matrícula encerrada.")
      await query.refresh()
    }
  }

  if (query.pending && !person) return <Page title="Aluno"><CardSkeleton /></Page>
  if (!person) return <Page title="Aluno"><ErrorNote>{error ?? query.error ?? "Aluno não encontrado."}</ErrorNote></Page>

  const firstName = person.nome.trim().split(/\s+/)[0] || person.nome
  const classes = [...matriculas].sort((a, b) => {
    if (a.situacao !== b.situacao) return a.situacao === "ativa" ? -1 : 1
    return a.dia_semana - b.dia_semana || a.inicio_minuto - b.inicio_minuto
  })

  return (
    <Page
      title={person.nome}
      lede={person.email}
      action={
        person.telefone ? (
          <a className="btn" href={whatsAppUrl(person.telefone, `Oi, ${firstName}.`)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        ) : null
      }
    >
      <Link className="back" to="/escola/alunos">Alunos</Link>
      <ErrorNote>{error ?? query.error}</ErrorNote>
      {notice ? <p className="muted" role="status">{notice}</p> : null}
      <div className="student-layout">
        <section className="stack">
          <h2>Matrículas</h2>
          {openFees > 0 ? (
            <p className="roster-alert">
              {openFees === 1 ? "1 mensalidade em aberto." : `${openFees} mensalidades em aberto.`}{" "}
              <Link to="/escola/mensalidades">Ver mensalidades</Link>
            </p>
          ) : null}
          {classes.length === 0 ? <Empty>Nenhuma matrícula ainda.</Empty> : null}
          {classes.map((matricula) => {
            const instrument = instrumentos.get(matricula.instrumento_id) ?? "Aula"
            const tone = toneFor(instrument)
            const active = matricula.situacao === "ativa"
            const dirty = centsOf(precos[matricula.id] ?? "") !== matricula.valor_mensal_centavos
            return (
              <article key={matricula.id} className="card enrollment">
                <span className="enrollment-bar" style={{ background: tone.bar }} />
                <div className="row spread">
                  <strong>{instrument}</strong>
                  <span className="badge" data-status={active ? "realizada" : "cancelada"}>
                    {active ? "Ativa" : "Encerrada"}
                  </span>
                </div>
                <p className="muted">{professores.get(matricula.professor_id) ?? "Professor"}</p>
                <p>
                  {dayName(matricula.dia_semana)} · {formatMinute(matricula.inicio_minuto)} · {durationLabel(matricula.duracao_minutos)}
                </p>
                {active ? (
                  <>
                    <label>
                      Mensalidade (R$)
                      <input
                        inputMode="decimal"
                        value={precos[matricula.id] ?? ""}
                        onChange={(event) => setPrecos({ ...precos, [matricula.id]: event.target.value })}
                      />
                    </label>
                    <div className="row">
                      <button className="btn" type="button" disabled={!dirty || busy} onClick={() => void savePrice(matricula)}>
                        Atualizar
                      </button>
                      <button className="btn danger" type="button" disabled={busy} onClick={() => void closeEnrollment(matricula)}>
                        Encerrar
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="muted">Valor combinado: {formatMoney(matricula.valor_mensal_centavos)}</p>
                )}
              </article>
            )
          })}
        </section>

        <form className="card stack" onSubmit={saveContact}>
          <h2>Contato</h2>
          <label>
            Telefone
            <input value={telefone} onChange={(event) => setTelefone(event.target.value)} required inputMode="tel" />
          </label>
          <p className="muted">WhatsApp da cobrança: {formatPhone(telefone) || "sem telefone"}</p>
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
            <textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} rows={4} />
          </label>
          <button className="btn" type="submit" disabled={busy}>Salvar contato</button>
        </form>
      </div>
    </Page>
  )
}
