import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Glyph, instrumentGlyph } from "../../components/glyphs.tsx"
import { Empty, ErrorNote, ListSkeleton, Menu, Page, PersonMark, Stat, StatGrid, ToneBadge } from "../../components/chrome.tsx"
import { loadInstrumentos, loadMatriculas, loadMensalidades, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, TIMEZONE, formatMinute, saoPauloDate, timeToMinute } from "../../lib/dates.ts"
import { accessRedirect, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import { whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Matricula, Pessoa } from "../../types.ts"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type View = "todos" | "aula" | "livre"
type Layout = "tabela" | "cartoes"
type SortKey = "nome" | "instrumento" | "proxima" | "status"

const SHORT_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

function weekIndex(day: number) {
  return day === 0 ? 7 : day
}

function saoPauloNow(date = new Date()) {
  const iso = saoPauloDate(date)
  const [year, month, day] = iso.split("-").map(Number)
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
  return { weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), minute: timeToMinute(time) }
}

function stillThisWeek(day: number, minute: number, nowDay: number, nowMinute: number) {
  const left = weekIndex(day)
  const now = weekIndex(nowDay)
  if (left > now) return true
  return left === now && minute > nowMinute
}

function waitMinutes(day: number, minute: number, nowDay: number, nowMinute: number) {
  let delta = weekIndex(day) - weekIndex(nowDay)
  if (delta < 0 || (delta === 0 && minute <= nowMinute)) delta += 7
  return delta * 24 * 60 + (minute - nowMinute)
}

type StudentsData = {
  people: Pessoa[]
  matriculas: Matricula[]
  instruments: Map<string, string>
  teachers: Map<string, string>
  openFees: Map<string, number>
}

async function loadStudents(): Promise<StudentsData> {
  const [students, enrollments, instrumentList, teacherList, charges] = await Promise.all([
    loadPessoas("aluno"),
    loadMatriculas(),
    loadInstrumentos(),
    loadPessoas("professor"),
    loadMensalidades(),
  ])
  const fees = new Map<string, number>()
  for (const charge of charges) {
    if (charge.situacao !== "aberta") continue
    fees.set(charge.aluno_id, (fees.get(charge.aluno_id) ?? 0) + 1)
  }
  return {
    people: students,
    matriculas: enrollments,
    instruments: new Map(instrumentList.map((item) => [item.id, item.nome])),
    teachers: new Map(teacherList.map((item) => [item.id, item.nome])),
    openFees: fees,
  }
}

function statusOf(classes: number, fees: number) {
  if (fees > 0) return { label: fees === 1 ? "1 em aberto" : `${fees} em aberto`, tone: "aberta", rank: 1 }
  if (classes > 0) return { label: "Em aula", tone: "em-aula", rank: 0 }
  return { label: "Sem aula", tone: "sem-aula", rank: 2 }
}

export function StudentsPage() {
  const list = useQuery("escola:alunos", loadStudents)
  const people = list.data?.people ?? []
  const matriculas = list.data?.matriculas ?? []
  const instruments = list.data?.instruments ?? new Map<string, string>()
  const teachers = list.data?.teachers ?? new Map<string, string>()
  const openFees = list.data?.openFees ?? new Map<string, number>()
  const loading = list.pending && !list.data
  const [search, setSearch] = useState("")
  const [view, setView] = useState<View>("todos")
  const [layout, setLayout] = useState<Layout>("tabela")
  const [sort, setSort] = useState<SortKey>("nome")
  const [ascending, setAscending] = useState(true)
  const [inviting, setInviting] = useState(false)
  const now = saoPauloNow()

  const activeByStudent = useMemo(() => {
    const grouped = new Map<string, Matricula[]>()
    for (const item of matriculas) {
      if (item.situacao !== "ativa") continue
      const rows = grouped.get(item.aluno_id) ?? []
      rows.push(item)
      grouped.set(item.aluno_id, rows)
    }
    return grouped
  }, [matriculas])

  const withClass = people.filter((person) => (activeByStudent.get(person.id)?.length ?? 0) > 0).length
  const withoutClass = people.length - withClass
  const openLessons = [...activeByStudent.values()]
    .flat()
    .filter((item) => stillThisWeek(item.dia_semana, item.inicio_minuto, now.weekday, now.minute)).length

  const query = fold(search.trim())
  const digits = search.replace(/\D/g, "")
  const rows = people
    .map((person) => {
      const classes = activeByStudent.get(person.id) ?? []
      const names = [...new Set(classes.map((item) => instruments.get(item.instrumento_id) ?? "Aula"))]
      let next: Matricula | null = null
      let wait = Number.POSITIVE_INFINITY
      for (const item of classes) {
        const ahead = waitMinutes(item.dia_semana, item.inicio_minuto, now.weekday, now.minute)
        if (ahead < wait) {
          next = item
          wait = ahead
        }
      }
      const fees = openFees.get(person.id) ?? 0
      return { person, classes, names, next, wait, fees, status: statusOf(classes.length, fees) }
    })
    .filter((row) => {
      if (view === "aula" && row.classes.length === 0) return false
      if (view === "livre" && row.classes.length > 0) return false
      if (!query) return true
      const haystack = fold(
        [
          row.person.nome,
          row.person.email,
          row.person.telefone,
          ...row.classes.flatMap((item) => [
            teachers.get(item.professor_id) ?? "",
            instruments.get(item.instrumento_id) ?? "",
          ]),
        ].join(" "),
      )
      if (haystack.includes(query)) return true
      return digits.length > 0 && row.person.telefone.replace(/\D/g, "").includes(digits)
    })
    .sort((a, b) => {
      const direction = ascending ? 1 : -1
      if (sort === "instrumento") return a.names.join(" ").localeCompare(b.names.join(" "), "pt-BR") * direction
      if (sort === "proxima") return (a.wait - b.wait) * direction
      if (sort === "status") return (a.status.rank - b.status.rank) * direction || a.person.nome.localeCompare(b.person.nome, "pt-BR")
      return a.person.nome.localeCompare(b.person.nome, "pt-BR") * direction
    })

  function toggleSort(key: SortKey) {
    if (sort === key) setAscending((value) => !value)
    else {
      setSort(key)
      setAscending(true)
    }
  }

  return (
    <Page
      kicker="Alunos"
      title="Alunos"
      lede="Gerencie seus alunos, turmas e aulas em um só lugar."
      action={
        <Button  type="button" onClick={() => setInviting(true)}>
          <Glyph name="plus" size={16} />
          Convidar aluno
        </Button>
      }
    >
      <ErrorNote>{list.error}</ErrorNote>
      {loading ? (
        <StatGrid>
          {Array.from({ length: 4 }, (_, index) => (
            <Stat key={index} value="—" label="Carregando" />
          ))}
        </StatGrid>
      ) : (
        <StatGrid>
          <Stat icon={<Glyph name="people" />} value={people.length} label="Alunos ativos" />
          <Stat icon={<Glyph name="cap" />} value={withClass} label="Com aula esta semana" />
          <Stat icon={<Glyph name="calendar" />} value={withoutClass} label="Sem aula" />
          <Stat icon={<Glyph name="clock" />} value={openLessons} label={openLessons === 1 ? "Aula em aberto" : "Aulas em aberto"} />
        </StatGrid>
      )}

      <section className="grid gap-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Situação">
            <FilterChip pressed={view === "todos"} onClick={() => setView("todos")}>Todos ({people.length})</FilterChip>
            <FilterChip pressed={view === "aula"} onClick={() => setView("aula")}>Com aula ({withClass})</FilterChip>
            <FilterChip pressed={view === "livre"} onClick={() => setView("livre")}>Sem aula ({withoutClass})</FilterChip>
          </div>
          <Input
            className="lg:ml-auto lg:max-w-xs"
            type="search"
            value={search}
            placeholder="Buscar aluno, telefone ou instrumento..."
            aria-label="Buscar aluno"
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex gap-1" role="group" aria-label="Visualização">
            <Button type="button" size="icon" variant={layout === "tabela" ? "secondary" : "outline"} aria-pressed={layout === "tabela"} aria-label="Lista" onClick={() => setLayout("tabela")}>
              <Glyph name="list" size={16} />
            </Button>
            <Button type="button" size="icon" variant={layout === "cartoes" ? "secondary" : "outline"} aria-pressed={layout === "cartoes"} aria-label="Cartões" onClick={() => setLayout("cartoes")}>
              <Glyph name="grid" size={16} />
            </Button>
          </div>
        </div>

        {loading ? <ListSkeleton /> : people.length === 0 ? (
          <Empty>Nenhum aluno ainda. O convite chega por e-mail e a pessoa cria a própria senha.</Empty>
        ) : rows.length === 0 ? (
          <Empty>Nenhum aluno encontrado.</Empty>
        ) : layout === "cartoes" ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <li key={row.person.id}>
                <StudentTile
                  person={row.person}
                  names={row.names}
                  next={row.next}
                  teachers={teachers}
                  instruments={instruments}
                  status={row.status}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Aluno" active={sort === "nome"} ascending={ascending} onClick={() => toggleSort("nome")} />
                <SortHead label="Instrumento(s)" active={sort === "instrumento"} ascending={ascending} onClick={() => toggleSort("instrumento")} />
                <SortHead label="Próxima aula" active={sort === "proxima"} ascending={ascending} onClick={() => toggleSort("proxima")} />
                <SortHead label="Status" active={sort === "status"} ascending={ascending} onClick={() => toggleSort("status")} />
                <TableHead aria-label="Ações" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.person.id}>
                  <TableCell>
                    <PersonLink person={row.person} />
                  </TableCell>
                  <TableCell>
                    <InstrumentNames names={row.names} />
                  </TableCell>
                  <TableCell>
                    <NextLesson next={row.next} teachers={teachers} instruments={instruments} />
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={row.status.tone}>{row.status.label}</ToneBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <RowActions person={row.person} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {inviting ? (
        <InviteDialog
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

function FilterChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" size="sm" variant={pressed ? "secondary" : "ghost"} aria-pressed={pressed} onClick={onClick}>
      {children}
    </Button>
  )
}

function SortHead({
  label,
  active,
  ascending,
  onClick,
}: {
  label: string
  active: boolean
  ascending: boolean
  onClick: () => void
}) {
  return (
    <TableHead aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}>
      <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onClick}>
        {label}
      </Button>
    </TableHead>
  )
}

function PersonLink({ person }: { person: Pessoa }) {
  return (
    <Link className="flex items-center gap-2" to={`/escola/alunos/${person.id}`}>
      <PersonMark name={person.nome} />
      <span className="grid min-w-0">
        <strong className="truncate font-medium">{person.nome}</strong>
        <small className="truncate text-muted-foreground">{formatPhone(person.telefone) || person.email}</small>
      </span>
    </Link>
  )
}

function InstrumentNames({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {names.map((name) => (
        <span key={name} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
          <Glyph name={instrumentGlyph(name)} size={14} />
          {name}
        </span>
      ))}
    </span>
  )
}

function NextLesson({
  next,
  teachers,
  instruments,
}: {
  next: Matricula | null
  teachers: Map<string, string>
  instruments: Map<string, string>
}) {
  if (!next) return <strong className="font-medium">Sem aula semanal</strong>
  const day = SHORT_DAYS[next.dia_semana] ?? DIAS[next.dia_semana] ?? ""
  return (
    <span className="grid">
      <strong className="font-medium">
        {day}, {formatMinute(next.inicio_minuto)}
      </strong>
      <small className="text-muted-foreground">
        {instruments.get(next.instrumento_id) ?? "Aula"} · {teachers.get(next.professor_id) ?? "Professor"}
      </small>
    </span>
  )
}

function RowActions({ person }: { person: Pessoa }) {
  const first = person.nome.trim().split(/\s+/)[0] || person.nome
  return (
    <>
      <Button variant="outline" size="icon" nativeButton={false} render={<Link to="/escola/agenda" aria-label={`Agenda de ${person.nome}`} />}>
        <Glyph name="calendar" size={16} />
      </Button>
      <Menu label={`Ações de ${person.nome}`}>
        <DropdownMenuItem render={<Link to={`/escola/alunos/${person.id}`} />}>Abrir ficha</DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/escola/agenda" />}>Abrir agenda</DropdownMenuItem>
        {person.telefone ? (
          <DropdownMenuItem nativeButton={false} render={<a href={whatsAppUrl(person.telefone, `Oi, ${first}.`)} target="_blank" rel="noreferrer" />}>
            WhatsApp
          </DropdownMenuItem>
        ) : null}
      </Menu>
    </>
  )
}

function StudentTile({
  person,
  names,
  next,
  teachers,
  instruments,
  status,
}: {
  person: Pessoa
  names: string[]
  next: Matricula | null
  teachers: Map<string, string>
  instruments: Map<string, string>
  status: { label: string; tone: string }
}) {
  return (
    <article className="grid gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-2">
        <PersonLink person={person} />
        <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
      </div>
      <InstrumentNames names={names} />
      <NextLesson next={next} teachers={teachers} instruments={instruments} />
      <div className="flex justify-end gap-1">
        <RowActions person={person} />
      </div>
    </article>
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
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar aluno</DialogTitle>
          <DialogDescription>O convite chega por e-mail. A pessoa define a própria senha.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={onSubmit}>
        <label>
          Nome
          <Input ref={nameRef} value={nome} onChange={(event) => setNome(event.target.value)} required />
        </label>
        <label>
          E-mail
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Telefone
          <Input
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
              <Textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} rows={3} />
            </label>
          </div>
        </details>
        <ErrorNote>{error}</ErrorNote>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando…" : "Enviar convite"}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
