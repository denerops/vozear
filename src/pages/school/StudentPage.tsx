import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { Glyph, instrumentGlyph, type GlyphName } from "../../components/glyphs.tsx"
import { CardSkeleton, Empty, ErrorNote, Menu, Page, Panel, PersonMark, Record, Stat, StatGrid, StatusBadge, ToneBadge } from "../../components/chrome.tsx"
import { loadAulas, loadInstrumentos, loadMatriculas, loadMensalidades, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, TIMEZONE, addDays, formatDate, formatMinute, formatMonth, formatWhen, saoPauloDate, saoPauloTimestamp } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import { whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Aula, Matricula, Mensalidade, Pessoa } from "../../types.ts"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Tab = "matriculas" | "aulas" | "mensalidades" | "historico" | "dados"

const TABS: { id: Tab; label: string; icon: GlyphName }[] = [
  { id: "matriculas", label: "Matrículas", icon: "cap" },
  { id: "aulas", label: "Aulas", icon: "calendar" },
  { id: "mensalidades", label: "Mensalidades", icon: "coin" },
  { id: "historico", label: "Histórico", icon: "clock" },
  { id: "dados", label: "Dados", icon: "user" },
]

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
        <Button variant="link" className="w-fit px-0" nativeButton={false} render={<Link to="/escola/alunos" />}>Alunos</Button>
        <ErrorNote>{error ?? query.error ?? "Aluno não encontrado."}</ErrorNote>
      </Page>
    )
  }

  const firstName = person.nome.trim().split(/\s+/)[0] || person.nome
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
  const openFees = charges.filter((item) => item.situacao === "aberta").length
  const greeting = whatsAppUrl(person.telefone, `Oi, ${firstName}.`)

  return (
    <Page bare title={person.nome}>
      <div className="grid gap-4">
        <Button variant="link" className="w-fit px-0" nativeButton={false} render={<Link to="/escola/alunos" />}>Alunos</Button>
        <header className="flex flex-wrap items-center gap-3">
          <PersonMark name={person.nome} />
          <div className="grid min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-medium tracking-tight">{person.nome}</h1>
            <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
              {person.email ? <span>{person.email}</span> : null}
              {person.telefone ? <span>{formatPhone(person.telefone)}</span> : null}
              {person.criadoEm ? <span>Desde {sinceLabel(person.criadoEm)}</span> : null}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {person.telefone ? (
              <Button variant="outline" size="icon" nativeButton={false} render={<a href={greeting} target="_blank" rel="noreferrer" aria-label="WhatsApp" />}>
                <Glyph name="chat" size={16} />
              </Button>
            ) : null}
            <Button variant="outline" size="icon" nativeButton={false} render={<Link to="/escola/agenda" aria-label="Agenda" />}>
              <Glyph name="calendar" size={16} />
            </Button>
            <Menu label="Mais ações">
              <DropdownMenuItem render={<Link to="/escola/mensalidades" />}>Mensalidades</DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/escola/agenda" />}>Agenda</DropdownMenuItem>
            </Menu>
          </div>
        </header>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            {TABS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                <Glyph name={item.icon} size={15} />
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab !== "dados" ? (
          <StatGrid>
            <Stat icon={<Glyph name="cap" />} value={active.length} label="Matrículas ativas" />
            <Stat icon={<Glyph name="calendar" />} value={upcoming.length} label="Próximas aulas" />
            <Stat icon={<Glyph name="coin" />} value={formatMoney(monthly)} label="Mensalidade total" />
            <Stat icon={<Glyph name="bars" />} value={openFees} label="Mensalidades em aberto" />
          </StatGrid>
        ) : null}

        <ErrorNote>{error ?? query.error}</ErrorNote>
        {notice ? <p className="muted" role="status">{notice}</p> : null}

        {tab === "matriculas" ? (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
            <Panel
              title="Matrículas"
              action={
                <Button variant="link" className="h-auto px-0" nativeButton={false} render={<Link to="/escola/agenda" />}>
                  <Glyph name="plus" size={14} />
                  Nova matrícula
                </Button>
              }
            >
              {openFees > 0 ? (
                <Button variant="link" className="h-auto w-fit justify-start px-0" type="button" onClick={() => setTab("mensalidades")}>
                  {openFees === 1 ? "1 mensalidade em aberto" : `${openFees} mensalidades em aberto`}
                </Button>
              ) : null}
              {classes.length === 0 ? <Empty>Nenhuma matrícula ativa. A nova aula é criada na agenda.</Empty> : null}
              <div className="grid gap-3">
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
            </Panel>
            <aside className="grid gap-4">
              <Panel
                title="Contato"
                action={
                  editContact ? null : (
                    <Button variant="link" className="h-auto px-0" type="button" onClick={() => setEditContact(true)}>
                      <Glyph name="pencil" size={14} />
                      Editar
                    </Button>
                  )
                }
              >
                {editContact ? (
                  <form className="stack" onSubmit={(event) => void saveContact(event)}>
                    <label>
                      Telefone
                      <Input value={telefone} onChange={(event) => setTelefone(event.target.value)} required inputMode="tel" />
                    </label>
                    <label>
                      Nascimento
                      <Input type="date" value={nascimento} onChange={(event) => setNascimento(event.target.value)} />
                    </label>
                    <label>
                      Instagram
                      <Input value={instagram} onChange={(event) => setInstagram(event.target.value)} />
                    </label>
                    <label>
                      Outra rede
                      <Input value={outraRede} onChange={(event) => setOutraRede(event.target.value)} />
                    </label>
                    <div className="row">
                      <Button
                        variant="outline"
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
                      </Button>
                      <Button  type="submit" disabled={busy}>Salvar</Button>
                    </div>
                  </form>
                ) : (
                  <ul className="grid gap-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Glyph name="phone" size={15} />
                      <span>{formatPhone(person.telefone) || "Sem telefone"}</span>
                      {person.telefone ? (
                        <Button variant="ghost" size="icon-sm" nativeButton={false} render={<a href={greeting} target="_blank" rel="noreferrer" aria-label="WhatsApp" />}>
                          <Glyph name="chat" size={14} />
                        </Button>
                      ) : null}
                    </li>
                    <li className="flex items-center gap-2">
                      <Glyph name="mail" size={15} />
                      <span>{person.email || "Sem e-mail"}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Glyph name="cake" size={15} />
                      <span>{person.nascimento ? birthLabel(person.nascimento) : "—"}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Glyph name="user" size={15} />
                      <span>{person.instagram || "—"}</span>
                    </li>
                  </ul>
                )}
              </Panel>
              <Panel
                title="Observações"
                action={
                  editNote ? null : (
                    <Button variant="link" className="h-auto px-0" type="button" onClick={() => setEditNote(true)}>
                      <Glyph name="pencil" size={14} />
                      Editar
                    </Button>
                  )
                }
              >
                {editNote ? (
                  <form className="stack" onSubmit={(event) => void saveContact(event)}>
                    <label>
                      Observação interna
                      <Textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} rows={4} />
                    </label>
                    <div className="row">
                      <Button
                        variant="outline"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setObservacao(person.observacao)
                          setEditNote(false)
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button  type="submit" disabled={busy}>Salvar</Button>
                    </div>
                  </form>
                ) : (
                  <p className={person.observacao ? "text-sm" : "text-sm text-muted-foreground"}>{person.observacao || "Nenhuma observação."}</p>
                )}
              </Panel>
            </aside>
          </div>
        ) : null}

        {tab === "aulas" ? (
          <LessonList
            title="Próximas aulas"
            items={upcoming}
            empty="Nenhuma aula prevista daqui para a frente."
            instrumentos={instrumentos}
            professores={professores}
          />
        ) : null}

        {tab === "mensalidades" ? (
          <Panel title="Mensalidades">
            {charges.length === 0 ? (
              <Empty>
                Nenhuma mensalidade ainda. Elas aparecem ao abrir o mês em{" "}
                <Link to="/escola/mensalidades">Mensalidades</Link>.
              </Empty>
            ) : (
              <ul>
                {charges.map((charge) => {
                  const enrollment = matriculas.find((item) => item.id === charge.matricula_id)
                  const slot = enrollment
                    ? `${dayName(enrollment.dia_semana)}, ${formatMinute(enrollment.inicio_minuto)}`
                    : ""
                  return (
                    <ChargeRow
                      key={charge.id}
                      charge={charge}
                      instrument={instrumentos.get(charge.instrumento_id) ?? "Aula"}
                      slot={slot}
                    />
                  )
                })}
              </ul>
            )}
          </Panel>
        ) : null}

        {tab === "historico" ? (
          <div className="grid gap-4">
            <LessonList
              title="Aulas anteriores"
              items={history}
              empty="Nenhuma aula anterior."
              instrumentos={instrumentos}
              professores={professores}
            />
            {ended.length > 0 ? (
              <Panel title="Matrículas encerradas">
                <ul>
                  {ended.map((item) => (
                    <Record
                      key={item.id}
                      title={instrumentos.get(item.instrumento_id) ?? "Aula"}
                      detail={`${dayName(item.dia_semana)}, ${formatMinute(item.inicio_minuto)} · ${professores.get(item.professor_id) ?? "Professor"}`}
                      extra={<ToneBadge tone="cancelada">Encerrada</ToneBadge>}
                    />
                  ))}
                </ul>
              </Panel>
            ) : null}
          </div>
        ) : null}

        {tab === "dados" ? (
          <form onSubmit={(event) => void saveContact(event)}>
          <Panel title="Dados do aluno">
            <label>
              Telefone
              <Input value={telefone} onChange={(event) => setTelefone(event.target.value)} required inputMode="tel" />
            </label>
            <p className="muted">WhatsApp da cobrança: {formatPhone(telefone) || "sem telefone"}</p>
            <label>
              Nascimento
              <Input type="date" value={nascimento} onChange={(event) => setNascimento(event.target.value)} />
            </label>
            <label>
              Instagram
              <Input value={instagram} onChange={(event) => setInstagram(event.target.value)} />
            </label>
            <label>
              Outra rede
              <Input value={outraRede} onChange={(event) => setOutraRede(event.target.value)} />
            </label>
            <label>
              Observação interna
              <Textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} rows={4} />
            </label>
            <Button type="submit" disabled={busy}>Salvar contato</Button>
          </Panel>
          </form>
        ) : null}
      </div>
    </Page>
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
    <article className="flex gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: tone.background, color: tone.bar }}>
        <Glyph name={instrumentGlyph(instrument)} size={16} />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex items-center gap-2">
          <strong>{instrument}</strong>
          <ToneBadge tone="realizada">Ativa</ToneBadge>
        </div>
        <p>Prof. {teacher}</p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <Glyph name="calendar" size={14} />
            {dayName(matricula.dia_semana)}, {formatMinute(matricula.inicio_minuto)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Glyph name="clock" size={14} />
            {durationLabel(matricula.duracao_minutos)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Glyph name="coin" size={14} />
            {formatMoney(matricula.valor_mensal_centavos)} / mês
          </li>
        </ul>
        {pricing ? (
          <div className="enroll-price">
            <label>
              Mensalidade (R$)
              <Input inputMode="decimal" value={price} onChange={(event) => onPrice(event.target.value)} />
            </label>
            <Button  type="button" disabled={!dirty || busy} onClick={onSavePrice}>
              Salvar
            </Button>
            <Button variant="outline" type="button" disabled={busy} onClick={onCancelPrice}>
              Cancelar
            </Button>
          </div>
        ) : null}
      </div>
      <Menu label={`Ações de ${instrument}`}>
        <DropdownMenuItem onClick={onEditPrice}>Alterar valor</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onClose}>Encerrar</DropdownMenuItem>
      </Menu>
    </article>
  )
}

function LessonList({
  title,
  items,
  empty,
  instrumentos,
  professores,
}: {
  title: string
  items: Aula[]
  empty: string
  instrumentos: Map<string, string>
  professores: Map<string, string>
}) {
  if (items.length === 0) {
    return (
      <Panel title={title}>
        <Empty>{empty}</Empty>
      </Panel>
    )
  }
  const shown = items.slice(0, 12)
  return (
    <Panel title={title}>
      <ul>
        {shown.map((aula) => (
          <Record
            key={aula.id}
            to={`/escola/aulas/${aula.id}`}
            title={formatWhen(aula.inicio)}
            detail={`${instrumentos.get(aula.instrumento_id) ?? "Aula"} · ${professores.get(aula.professor_id) ?? "Professor"}`}
            extra={<StatusBadge value={aula.situacao} />}
          />
        ))}
      </ul>
      {items.length > shown.length ? (
        <p className="text-sm text-muted-foreground">E mais {items.length - shown.length} aulas na agenda.</p>
      ) : null}
    </Panel>
  )
}

function ChargeRow({ charge, instrument, slot }: { charge: Mensalidade; instrument: string; slot: string }) {
  const month = chargeMonth(charge.competencia)
  const title = month.charAt(0).toUpperCase() + month.slice(1)
  return (
    <Record
      title={title}
      detail={[instrument, slot, `vence ${formatDate(charge.vencimento)}`].filter(Boolean).join(" · ")}
      extra={
        <>
          <span className="text-sm font-medium tabular-nums">{formatMoney(charge.valor_centavos)}</span>
          <StatusBadge value={charge.situacao} />
        </>
      }
    />
  )
}
