import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { Glyph, instrumentGlyph, type GlyphName } from "../../components/glyphs.tsx"
import { CardSkeleton, Empty, ErrorNote, Menu, Page, StatusBadge } from "../../components/ui.tsx"
import { loadAulas, loadInstrumentos, loadMatriculas, loadMensalidades, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, TIMEZONE, addDays, formatDate, formatMinute, formatMonth, formatWhen, saoPauloDate, saoPauloTimestamp } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import { whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Aula, Matricula, Mensalidade, Pessoa } from "../../types.ts"

type Tab = "matriculas" | "aulas" | "mensalidades" | "historico" | "dados"

const TABS: { id: Tab; label: string; icon: GlyphName }[] = [
  { id: "matriculas", label: "Matrículas", icon: "cap" },
  { id: "aulas", label: "Aulas", icon: "calendar" },
  { id: "mensalidades", label: "Mensalidades", icon: "coin" },
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

function centsOf(value: string) {
  const cents = Math.round(Number(value.replace(",", ".")) * 100)
  return Number.isFinite(cents) ? cents : 0
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

function chargeMonth(value: string) {
  return formatMonth(value.length === 7 ? `${value}-01` : value)
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
    const today = saoPauloDate()
    const until = saoPauloTimestamp(addDays(today, 180), "23:59")
    const [students, enrollments, instruments, teachers, charges, lessons] = await Promise.all([
      loadPessoas("aluno"),
      loadMatriculas({ alunoId: id }),
      loadInstrumentos(),
      loadPessoas("professor"),
      loadMensalidades(id),
      loadAulas({ alunoId: id, from: "2020-01-01T00:00:00-03:00", until }),
    ])
    return {
      person: students.find((item) => item.id === id) ?? null,
      matriculas: enrollments,
      instrumentos: new Map(instruments.map((item) => [item.id, item.nome])),
      professores: new Map(teachers.map((item) => [item.id, item.nome])),
      charges,
      aulas: lessons,
    }
  })
  const person = query.data?.person ?? null
  const matriculas = query.data?.matriculas ?? []
  const instrumentos = query.data?.instrumentos ?? new Map<string, string>()
  const professores = query.data?.professores ?? new Map<string, string>()
  const charges = query.data?.charges ?? []
  const aulas = query.data?.aulas ?? []
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>("matriculas")
  const [editContact, setEditContact] = useState(false)
  const [editNote, setEditNote] = useState(false)
  const [pricing, setPricing] = useState<string | null>(null)
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
    setTab("matriculas")
    setEditContact(false)
    setEditNote(false)
    setPricing(null)
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

  async function saveContact(event?: FormEvent) {
    event?.preventDefault()
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
      setEditContact(false)
      setEditNote(false)
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
      setPricing(null)
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

  if (query.pending && !person) {
    return (
      <Page bare title="Aluno">
        <CardSkeleton />
      </Page>
    )
  }
  if (!person) {
    return (
      <Page bare title="Aluno">
        <Link className="back" to="/escola/alunos">Alunos</Link>
        <ErrorNote>{error ?? query.error ?? "Aluno não encontrado."}</ErrorNote>
      </Page>
    )
  }

  const firstName = person.nome.trim().split(/\s+/)[0] || person.nome
  const wash = washFor(person.nome)
  const active = matriculas.filter((item) => item.situacao === "ativa")
  const ended = matriculas.filter((item) => item.situacao !== "ativa")
  const classes = [...active].sort((a, b) => a.dia_semana - b.dia_semana || a.inicio_minuto - b.inicio_minuto)
  const monthly = active.reduce((sum, item) => sum + item.valor_mensal_centavos, 0)
  const now = Date.now()
  const upcoming = aulas
    .filter((item) => new Date(item.inicio).getTime() > now && (item.situacao === "prevista" || item.situacao === "remarcada"))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  const upcomingIds = new Set(upcoming.map((item) => item.id))
  const history = aulas
    .filter((item) => !upcomingIds.has(item.id))
    .sort((a, b) => b.inicio.localeCompare(a.inicio))
  const realized = aulas.filter((item) => item.situacao === "realizada").length
  const openFees = charges.filter((item) => item.situacao === "aberta").length
  const greeting = whatsAppUrl(person.telefone, `Oi, ${firstName}.`)

  return (
    <Page bare title={person.nome}>
      <div className="student-screen">
        <Link className="back" to="/escola/alunos">Alunos</Link>
        <header className="student-hero">
          <span className="student-avatar" style={{ background: wash.background, color: wash.color }} aria-hidden="true">
            {person.nome.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="student-identity">
            <h1>{person.nome}</h1>
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
              <Link role="menuitem" to="/escola/mensalidades">Mensalidades</Link>
              <Link role="menuitem" to="/escola/agenda">Agenda</Link>
            </Menu>
          </div>
        </header>

        <div className="student-tabs" role="tablist" aria-label="Ficha do aluno">
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
            <Kpi icon="cap" tone="rose" value={String(active.length)} label="Matrículas ativas" />
            <Kpi icon="calendar" tone="lilac" value={String(active.length)} label="Aulas na semana" />
            <Kpi icon="coin" tone="gold" value={formatMoney(monthly)} label="Mensalidade total" />
            <Kpi icon="bars" tone="sand" value={String(realized)} label="Aulas realizadas" />
          </div>
        ) : null}

        <ErrorNote>{error ?? query.error}</ErrorNote>
        {notice ? <p className="muted" role="status">{notice}</p> : null}

        {tab === "matriculas" ? (
          <div className="student-board">
            <section className="panel">
              <div className="panel-head">
                <h2>Matrículas</h2>
                <Link className="text-action" to="/escola/agenda">
                  <Glyph name="plus" size={14} />
                  Nova matrícula
                </Link>
              </div>
              {openFees > 0 ? (
                <button className="quiet-alert" type="button" onClick={() => setTab("mensalidades")}>
                  {openFees === 1 ? "1 mensalidade em aberto." : `${openFees} mensalidades em aberto.`}
                </button>
              ) : null}
              {classes.length === 0 ? <Empty>Nenhuma matrícula ativa. A nova aula é criada na agenda.</Empty> : null}
              <div className="enroll-list">
                {classes.map((matricula) => (
                  <EnrollmentCard
                    key={matricula.id}
                    matricula={matricula}
                    instrument={instrumentos.get(matricula.instrumento_id) ?? "Aula"}
                    teacher={professores.get(matricula.professor_id) ?? "Professor"}
                    pricing={pricing === matricula.id}
                    price={precos[matricula.id] ?? ""}
                    busy={busy}
                    onPrice={(value) => setPrecos({ ...precos, [matricula.id]: value })}
                    onEditPrice={() => setPricing(matricula.id)}
                    onCancelPrice={() => {
                      setPricing(null)
                      setPrecos({
                        ...precos,
                        [matricula.id]: (matricula.valor_mensal_centavos / 100).toFixed(2).replace(".", ","),
                      })
                    }}
                    onSavePrice={() => void savePrice(matricula)}
                    onClose={() => void closeEnrollment(matricula)}
                  />
                ))}
              </div>
            </section>
            <aside className="student-side">
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
              <section className="panel">
                <div className="panel-head">
                  <h2>Observações</h2>
                  {editNote ? null : (
                    <button className="text-action" type="button" onClick={() => setEditNote(true)}>
                      <Glyph name="pencil" size={14} />
                      Editar
                    </button>
                  )}
                </div>
                {editNote ? (
                  <form className="stack" onSubmit={(event) => void saveContact(event)}>
                    <label>
                      Observação interna
                      <textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} rows={4} />
                    </label>
                    <div className="row">
                      <button
                        className="btn secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setObservacao(person.observacao)
                          setEditNote(false)
                        }}
                      >
                        Cancelar
                      </button>
                      <button className="btn" type="submit" disabled={busy}>Salvar</button>
                    </div>
                  </form>
                ) : (
                  <p className={person.observacao ? "note-copy" : "muted"}>{person.observacao || "Nenhuma observação."}</p>
                )}
              </section>
            </aside>
          </div>
        ) : null}

        {tab === "aulas" ? (
          <LessonList
            items={upcoming}
            empty="Nenhuma aula prevista daqui para a frente."
            instrumentos={instrumentos}
            professores={professores}
          />
        ) : null}

        {tab === "mensalidades" ? (
          <section className="panel">
            {charges.length === 0 ? (
              <Empty>
                Nenhuma mensalidade ainda. Elas aparecem ao abrir o mês em{" "}
                <Link to="/escola/mensalidades">Mensalidades</Link>.
              </Empty>
            ) : (
              <ul className="record-list">
                {charges.map((charge) => (
                  <ChargeRow key={charge.id} charge={charge} instrument={instrumentos.get(charge.instrumento_id) ?? "Aula"} />
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === "historico" ? (
          <div className="stack">
            <LessonList
              items={history}
              empty="Nenhuma aula anterior."
              instrumentos={instrumentos}
              professores={professores}
            />
            {ended.length > 0 ? (
              <section className="panel">
                <h2>Matrículas encerradas</h2>
                <ul className="record-list">
                  {ended.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{instrumentos.get(item.instrumento_id) ?? "Aula"}</strong>
                        <small>
                          {dayName(item.dia_semana)} · {professores.get(item.professor_id) ?? "Professor"}
                        </small>
                      </span>
                      <span className="badge" data-status="cancelada">Encerrada</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        {tab === "dados" ? (
          <form className="panel stack data-form" onSubmit={(event) => void saveContact(event)}>
            <h2>Dados do aluno</h2>
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

function EnrollmentCard({
  matricula,
  instrument,
  teacher,
  pricing,
  price,
  busy,
  onPrice,
  onEditPrice,
  onCancelPrice,
  onSavePrice,
  onClose,
}: {
  matricula: Matricula
  instrument: string
  teacher: string
  pricing: boolean
  price: string
  busy: boolean
  onPrice: (value: string) => void
  onEditPrice: () => void
  onCancelPrice: () => void
  onSavePrice: () => void
  onClose: () => void
}) {
  const tone = toneFor(instrument)
  const dirty = centsOf(price) !== matricula.valor_mensal_centavos
  return (
    <article className="enroll-card">
      <span className="enroll-mark" style={{ background: tone.background, color: tone.bar }}>
        <Glyph name={instrumentGlyph(instrument)} size={16} />
      </span>
      <div className="enroll-copy">
        <div className="enroll-title">
          <strong>{instrument}</strong>
          <span className="badge" data-status="realizada">Ativa</span>
        </div>
        <p>Prof. {teacher}</p>
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
        {pricing ? (
          <div className="enroll-price">
            <label>
              Mensalidade (R$)
              <input inputMode="decimal" value={price} onChange={(event) => onPrice(event.target.value)} />
            </label>
            <button className="btn" type="button" disabled={!dirty || busy} onClick={onSavePrice}>
              Salvar
            </button>
            <button className="btn secondary" type="button" disabled={busy} onClick={onCancelPrice}>
              Cancelar
            </button>
          </div>
        ) : null}
      </div>
      <Menu label={`Ações de ${instrument}`}>
        <button role="menuitem" type="button" onClick={onEditPrice}>Alterar valor</button>
        <button role="menuitem" type="button" className="danger" onClick={onClose}>Encerrar</button>
      </Menu>
    </article>
  )
}

function LessonList({
  items,
  empty,
  instrumentos,
  professores,
}: {
  items: Aula[]
  empty: string
  instrumentos: Map<string, string>
  professores: Map<string, string>
}) {
  if (items.length === 0) {
    return (
      <section className="panel">
        <Empty>{empty}</Empty>
      </section>
    )
  }
  const shown = items.slice(0, 12)
  return (
    <section className="panel">
      <ul className="record-list">
        {shown.map((aula) => (
          <li key={aula.id}>
            <Link to={`/escola/aulas/${aula.id}`}>
              <strong>{formatWhen(aula.inicio)}</strong>
              <small>
                {instrumentos.get(aula.instrumento_id) ?? "Aula"} · {professores.get(aula.professor_id) ?? "Professor"}
              </small>
            </Link>
            <StatusBadge value={aula.situacao} />
          </li>
        ))}
      </ul>
      {items.length > shown.length ? (
        <p className="muted">E mais {items.length - shown.length} aulas na agenda.</p>
      ) : null}
    </section>
  )
}

function ChargeRow({ charge, instrument }: { charge: Mensalidade; instrument: string }) {
  return (
    <li>
      <span>
        <strong>{chargeMonth(charge.competencia)}</strong>
        <small>
          {instrument} · vence {formatDate(charge.vencimento)} · {formatMoney(charge.valor_centavos)}
        </small>
      </span>
      <StatusBadge value={charge.situacao} />
    </li>
  )
}
