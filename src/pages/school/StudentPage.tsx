import { useEffect, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { Empty, ErrorNote, Page } from "../../components/ui.tsx"
import { loadInstrumentos, loadMatriculas, loadPessoas } from "../../data/api.ts"
import { DIAS, formatMinute } from "../../lib/dates.ts"
import { client } from "../../lib/supabase.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney, formatPhone } from "../../lib/format.ts"
import type { Instrumento, Matricula, Pessoa } from "../../types.ts"

export function StudentPage() {
  const { id = "" } = useParams()
  const [person, setPerson] = useState<Pessoa | null>(null)
  const [matriculas, setMatriculas] = useState<Matricula[]>([])
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [professores, setProfessores] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [telefone, setTelefone] = useState("")
  const [instagram, setInstagram] = useState("")
  const [outraRede, setOutraRede] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [observacao, setObservacao] = useState("")
  const [precos, setPrecos] = useState<Record<string, string>>({})

  async function reload() {
    const [students, enrollments, instruments, teachers] = await Promise.all([
      loadPessoas("aluno"),
      loadMatriculas({ alunoId: id }),
      loadInstrumentos(),
      loadPessoas("professor"),
    ])
    const found = students.find((item) => item.id === id) ?? null
    setPerson(found)
    setMatriculas(enrollments)
    setInstrumentos(instruments)
    setProfessores(new Map(teachers.map((item) => [item.id, item.nome])))
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
    reload().catch((reason: { message?: string }) => {
      if (alive) setError(humanError(reason))
    })
    return () => {
      alive = false
    }
  }, [id])

  async function saveContact(event: FormEvent) {
    event.preventDefault()
    setError(null)
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
    if (contactError || noteError) setError(humanError(contactError ?? noteError))
    else await reload()
  }

  async function savePrice(matricula: Matricula) {
    const cents = Math.round(Number((precos[matricula.id] ?? "").replace(",", ".")) * 100)
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Informe um valor mensal maior que zero.")
      return
    }
    const { error: updateError } = await client()
      .from("matriculas")
      .update({ valor_mensal_centavos: cents })
      .eq("id", matricula.id)
    if (updateError) setError(humanError(updateError))
    else await reload()
  }

  async function closeEnrollment(matricula: Matricula) {
    if (!window.confirm("Encerrar a matrícula cancela as próximas aulas. As mensalidades já geradas continuam.")) return
    const { error: updateError } = await client()
      .from("matriculas")
      .update({ situacao: "encerrada" })
      .eq("id", matricula.id)
    if (updateError) setError(humanError(updateError))
    else await reload()
  }

  if (!person && !error) return <Page title="Aluno"><p className="muted">Carregando…</p></Page>
  if (!person) return <Page title="Aluno"><ErrorNote>{error ?? "Aluno não encontrado."}</ErrorNote></Page>

  return (
    <Page title={person.nome} lede={person.email}>
      <p><Link to="/escola/alunos">Todos os alunos</Link></p>
      <ErrorNote>{error}</ErrorNote>
      <form className="card stack" onSubmit={saveContact}>
        <h2>Contato</h2>
        <div className="row">
          <label>
            Telefone
            <input value={telefone} onChange={(event) => setTelefone(event.target.value)} required />
          </label>
          <label>
            Nascimento
            <input type="date" value={nascimento} onChange={(event) => setNascimento(event.target.value)} />
          </label>
        </div>
        <div className="row">
          <label>
            Instagram
            <input value={instagram} onChange={(event) => setInstagram(event.target.value)} />
          </label>
          <label>
            Outra rede
            <input value={outraRede} onChange={(event) => setOutraRede(event.target.value)} />
          </label>
        </div>
        <p className="muted">WhatsApp da cobrança: {formatPhone(telefone)}</p>
        <label>
          Observação interna
          <textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} rows={3} />
        </label>
        <button className="btn" type="submit">Salvar ficha</button>
      </form>

      <section className="stack">
        <h2>Matrículas</h2>
        {matriculas.length === 0 ? <Empty>Nenhuma matrícula. Use a agenda para ocupar um horário.</Empty> : null}
        {matriculas.map((matricula) => (
          <article key={matricula.id} className="card stack">
            <strong>
              {instrumentos.find((item) => item.id === matricula.instrumento_id)?.nome} ·{" "}
              {professores.get(matricula.professor_id) ?? "Professor"}
            </strong>
            <p>
              {DIAS[matricula.dia_semana]} {formatMinute(matricula.inicio_minuto)} · {matricula.duracao_minutos} min ·{" "}
              {matricula.situacao}
            </p>
            {matricula.situacao === "ativa" ? (
              <div className="row">
                <label>
                  Mensalidade (R$)
                  <input
                    value={precos[matricula.id] ?? ""}
                    onChange={(event) => setPrecos({ ...precos, [matricula.id]: event.target.value })}
                  />
                </label>
                <button className="btn secondary" type="button" onClick={() => savePrice(matricula)}>
                  Salvar {formatMoney(matricula.valor_mensal_centavos)}
                </button>
                <button className="btn danger" type="button" onClick={() => closeEnrollment(matricula)}>
                  Encerrar
                </button>
              </div>
            ) : (
              <p className="muted">Valor combinado: {formatMoney(matricula.valor_mensal_centavos)}</p>
            )}
          </article>
        ))}
      </section>
    </Page>
  )
}
