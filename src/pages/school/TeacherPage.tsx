import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { Glyph, instrumentGlyph, type GlyphName } from "../../components/glyphs.tsx"
import { CardSkeleton, Empty, ErrorNote, Menu, Page, Panel, PersonMark, Record, Stat, StatGrid, ToneBadge } from "../../components/chrome.tsx"
import { loadInstrumentos, loadMatriculas, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, TIMEZONE, formatMinute, saoPauloDate } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import { whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Matricula, Pessoa } from "../../types.ts"
import { InstrumentPicks, sameIds } from "./TeachersPage.tsx"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"

type Tab = "aulas" | "alunos" | "instrumentos" | "historico" | "dados"

const TABS: { id: Tab; label: string; icon: GlyphName }[] = [
  { id: "aulas", label: "Aulas", icon: "calendar" },
  { id: "alunos", label: "Alunos", icon: "people" },
  { id: "instrumentos", label: "Instrumentos", icon: "note" },
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
  const [tab, setTab] = useState<Tab>("aulas")
  const [editContact, setEditContact] = useState(false)
  const seed = useRef("")
  const formRef = useRef<TeacherForm>({ selected, telefone, instagram, outraRede, nascimento })
  formRef.current = { selected, telefone, instagram, outraRede, nascimento }

  useEffect(() => {
    seed.current = ""
    setTab("aulas")
    setEditContact(false)
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

  async function saveContact(event?: FormEvent) {
    event?.preventDefault()
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
      setEditContact(false)
      await query.refresh()
    }
  }

  if (query.pending && !person) {
    return (
      <Page bare title="Professor">
        <CardSkeleton />
      </Page>
    )
  }
  if (!person) {
    return (
      <Page bare title="Professor">
        <Button variant="link" className="w-fit px-0" nativeButton={false} render={<Link to="/escola/professores" />}>Professores</Button>
        <ErrorNote>{error ?? query.error ?? "Professor não encontrado."}</ErrorNote>
      </Page>
    )
  }

  const names = new Map(instruments.map((item) => [item.id, item.nome]))
  const firstName = person.nome.trim().split(/\s+/)[0] || person.nome
  const admin = person.papeis.includes("administrador")
  const dirty = !sameIds(selected, person.instrumentos)
  const locked = [
    ...new Set(matriculas.filter((item) => item.situacao === "ativa").map((item) => item.instrumento_id)),
  ]
  const active = matriculas
    .filter((item) => item.situacao === "ativa")
    .sort((a, b) => a.dia_semana - b.dia_semana || a.inicio_minuto - b.inicio_minuto)
  const ended = matriculas
    .filter((item) => item.situacao !== "ativa")
    .sort((a, b) => a.dia_semana - b.dia_semana || a.inicio_minuto - b.inicio_minuto)
  const taught = person.instrumentos
    .map((item) => names.get(item) ?? "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
  const pupilIds = [...new Set(active.map((item) => item.aluno_id))]
  const greeting = whatsAppUrl(person.telefone, `Oi, ${firstName}.`)

  return (
    <Page bare title={person.nome}>
      <div className="grid gap-4">
        <Button variant="link" className="w-fit px-0" nativeButton={false} render={<Link to="/escola/professores" />}>Professores</Button>
        <header className="flex flex-wrap items-center gap-3">
          <PersonMark name={person.nome} />
          <div className="grid min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-medium tracking-tight">
              {person.nome}
              {admin ? <ToneBadge>Administra</ToneBadge> : null}
            </h1>
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
              <DropdownMenuItem render={<Link to="/escola/agenda" />}>Agenda</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTab("instrumentos")}>
                Instrumentos
              </DropdownMenuItem>
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
            <Stat icon={<Glyph name="calendar" />} value={active.length} label="Aulas ativas" />
            <Stat icon={<Glyph name="people" />} value={pupilIds.length} label="Alunos" />
            <Stat icon={<Glyph name="note" />} value={taught.length} label="Instrumentos" />
            <Stat icon={<Glyph name="coin" />} value={formatMoney(active.reduce((sum, item) => sum + item.valor_mensal_centavos, 0))} label="Mensalidade" />
          </StatGrid>
        ) : null}

        <ErrorNote>{error ?? query.error}</ErrorNote>
        {notice ? <p className="muted" role="status">{notice}</p> : null}

        {tab === "aulas" ? (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
            <Panel
              title="Aulas"
              action={
                <Button variant="link" className="h-auto px-0" nativeButton={false} render={<Link to="/escola/agenda" />}>
                  <Glyph name="plus" size={14} />
                  Nova aula
                </Button>
              }
            >
              {active.length === 0 ? <Empty>Nenhuma aula com este professor. A nova aula é criada na agenda.</Empty> : null}
              <div className="grid gap-3">
                {active.map((matricula) => (
                  <ClassCard
                    key={matricula.id}
                    matricula={matricula}
                    instrument={names.get(matricula.instrumento_id) ?? "Aula"}
                    student={students.get(matricula.aluno_id) ?? "Aluno"}
                  />
                ))}
              </div>
            </Panel>
            <aside className="grid gap-4">
              <Panel
                title="Instrumentos"
                action={
                  <Button variant="link" className="h-auto px-0" type="button" onClick={() => setTab("instrumentos")}>
                    <Glyph name="pencil" size={14} />
                    Editar
                  </Button>
                }
              >
                {taught.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum instrumento.</p> : (
                  <span className="flex flex-wrap gap-1">
                    {taught.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
                        <Glyph name={instrumentGlyph(name)} size={14} />
                        {name}
                      </span>
                    ))}
                  </span>
                )}
              </Panel>
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
            </aside>
          </div>
        ) : null}

        {tab === "alunos" ? (
          <Panel title="Alunos">
            {pupilIds.length === 0 ? <Empty>Nenhum aluno com aula ativa.</Empty> : (
              <ul>
                {pupilIds.map((alunoId) => {
                  const classes = active.filter((item) => item.aluno_id === alunoId)
                  return (
                    <Record
                      key={alunoId}
                      to={`/escola/alunos/${alunoId}`}
                      title={students.get(alunoId) ?? "Aluno"}
                      detail={
                        <span className="grid">
                          {classes.map((item) => (
                            <span key={item.id}>
                              {names.get(item.instrumento_id) ?? "Aula"} · {dayName(item.dia_semana)}, {formatMinute(item.inicio_minuto)}
                            </span>
                          ))}
                        </span>
                      }
                      extra={<ToneBadge tone="em-aula">{classes.length === 1 ? "1 aula" : `${classes.length} aulas`}</ToneBadge>}
                    />
                  )
                })}
              </ul>
            )}
          </Panel>
        ) : null}

        {tab === "instrumentos" ? (
          <Panel title="Instrumentos">
            <InstrumentPicks instruments={instruments} selected={selected} locked={locked} onChange={setSelected} />
            {locked.length > 0 ? <p className="muted">Instrumento com aula ativa permanece marcado.</p> : null}
            <Button type="button" disabled={!dirty || busy} onClick={() => void saveInstruments()}>
              Salvar instrumentos
            </Button>
          </Panel>
        ) : null}

        {tab === "historico" ? (
          <Panel title="Aulas encerradas">
            {ended.length === 0 ? <Empty>Nenhuma aula encerrada.</Empty> : (
              <ul>
                {ended.map((item) => (
                  <Record
                    key={item.id}
                    to={`/escola/alunos/${item.aluno_id}`}
                    title={students.get(item.aluno_id) ?? "Aluno"}
                    detail={`${names.get(item.instrumento_id) ?? "Aula"} · ${dayName(item.dia_semana)}, ${formatMinute(item.inicio_minuto)}`}
                    extra={<ToneBadge tone="cancelada">Encerrada</ToneBadge>}
                  />
                ))}
              </ul>
            )}
          </Panel>
        ) : null}

        {tab === "dados" ? (
          <form onSubmit={(event) => void saveContact(event)}>
          <Panel title="Dados do professor">
            <label>
              Telefone
              <Input value={telefone} onChange={(event) => setTelefone(event.target.value)} required inputMode="tel" />
            </label>
            <p className="muted">{formatPhone(telefone) || "Sem telefone"}</p>
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
            <Button type="submit" disabled={busy}>Salvar contato</Button>
          </Panel>
          </form>
        ) : null}
      </div>
    </Page>
  )
}

function ClassCard({ matricula, instrument, student }: { matricula: Matricula; instrument: string; student: string }) {
  const tone = toneFor(instrument)
  return (
    <article className="flex gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: tone.background, color: tone.bar }}>
        <Glyph name={instrumentGlyph(instrument)} size={16} />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex items-center gap-2">
          <strong>
            <Link to={`/escola/alunos/${matricula.aluno_id}`}>{student}</Link>
          </strong>
          <ToneBadge tone="realizada">Ativa</ToneBadge>
        </div>
        <p>{instrument}</p>
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
      </div>
    </article>
  )
}
