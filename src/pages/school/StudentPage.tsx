import { useEffect, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { Empty, ErrorNote, Page } from "../../components/ui.tsx"
import { loadInstrumentos, loadMatriculas, loadMensalidades, loadPessoas } from "../../data/api.ts"
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

export function StudentPage() {
  const { id = "" } = useParams()
  const [person, setPerson] = useState<Pessoa | null>(null)
  const [matriculas, setMatriculas] = useState<Matricula[]>([])
  const [instrumentos, setInstrumentos] = useState<Map<string, string>>(new Map())
  const [professores, setProfessores] = useState<Map<string, string>>(new Map())
  const [openFees, setOpenFees] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [telefone, setTelefone] = useState("")
  const [instagram, setInstagram] = useState("")
  const [outraRede, setOutraRede] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [observacao, setObservacao] = useState("")
  const [precos, setPrecos] = useState<Record<string, string>>({})

  async function reload() {
    const [students, enrollments, instruments, teachers, charges] = await Promise.all([
      loadPessoas("aluno"),
      loadMatriculas({ alunoId: id }),
      loadInstrumentos(),
      loadPessoas("professor"),
      loadMensalidades(id),
    ])
    const found = students.find((item) => item.id === id) ?? null
    setPerson(found)
    setMatriculas(enrollments)
    setInstrumentos(new Map(instruments.map((item) => [item.id, item.nome])))
    setProfessores(new Map(teachers.map((item) => [item.id, item.nome])))
    setOpenFees(charges.filter((item) => item.situacao === "aberta").length)
    if (found) {
      setTelefone(found.telefone)
      setInstagram(found.instagram)
      setOutraRede(found.outraRede)
      setNascimento(found.nascimento ?? "")
      setObservacao(found.observacao)
      setPrecos(
        Object.fromEntries(
          enrollments.map((item) => [item.id, (item.valor_mensal_centavos / 100).toFixed(2).replace(".", ",")]),
        ),
      )
    }
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
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
  }, [id])

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
      await reload()
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
      await reload()
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
      await reload()
    }
  }

  if (loading && !person) return <Page title="Aluno"><p className="muted">Carregando…</p></Page>
  if (!person) return <Page title="Aluno"><ErrorNote>{error ?? "Aluno não encontrado."}</ErrorNote></Page>

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
      <ErrorNote>{error}</ErrorNote>
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
