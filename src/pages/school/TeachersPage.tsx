import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { toneFor } from "../../agenda/model.ts"
import { Glyph, instrumentGlyph } from "../../components/glyphs.tsx"
import { Empty, ErrorNote, ListSkeleton, Menu, Page, PersonMark, Stat, StatGrid, ToneBadge } from "../../components/chrome.tsx"
import { loadInstrumentos, loadMatriculas, loadPessoas } from "../../data/api.ts"
import { useQuery } from "../../data/useQuery.ts"
import { DIAS, TIMEZONE, formatMinute, saoPauloDate, timeToMinute } from "../../lib/dates.ts"
import { accessRedirect, formatPhone } from "../../lib/format.ts"
import { client } from "../../lib/supabase.ts"
import { whatsAppUrl } from "../../lib/whatsapp.ts"
import type { Instrumento, Matricula, Pessoa } from "../../types.ts"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const ids = new Set(right)
  return left.every((id) => ids.has(id))
}

export function InstrumentPicks({
  instruments,
  selected,
  locked = [],
  onChange,
}: {
  instruments: Instrumento[]
  selected: string[]
  locked?: string[]
  onChange: (ids: string[]) => void
}) {
  const choices = instruments.filter((item) => item.ativo || selected.includes(item.id))
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Instrumentos">
      {choices.map((item) => {
        const on = selected.includes(item.id)
        const fixed = locked.includes(item.id)
        return (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={on ? "secondary" : "outline"}
            aria-pressed={on}
            disabled={fixed}
            title={fixed ? "Há aula ativa neste instrumento" : undefined}
            onClick={() =>
              onChange(on ? selected.filter((id) => id !== item.id) : [...selected, item.id])
            }
          >
            <i className="size-2 rounded-full" style={{ background: toneFor(item.nome).dot }} />
            {item.nome}
          </Button>
        )
      })}
    </div>
  )
}

type TeachersData = {
  people: Pessoa[]
  instruments: Instrumento[]
  matriculas: Matricula[]
  students: Map<string, string>
}

async function loadTeachers(): Promise<TeachersData> {
  const [teachers, instrumentList, enrollments, alunos] = await Promise.all([
    loadPessoas("professor"),
    loadInstrumentos(),
    loadMatriculas(),
    loadPessoas("aluno"),
  ])
  return {
    people: teachers,
    instruments: instrumentList,
    matriculas: enrollments,
    students: new Map(alunos.map((person) => [person.id, person.nome])),
  }
}

function statusOf(classes: number) {
  if (classes > 0) return { label: "Com alunos", tone: "em-aula", rank: 0 }
  return { label: "Sem alunos", tone: "sem-aula", rank: 1 }
}

export function TeachersPage() {
  const list = useQuery("escola:professores", loadTeachers)
  const people = list.data?.people ?? []
  const instruments = list.data?.instruments ?? []
  const matriculas = list.data?.matriculas ?? []
  const students = list.data?.students ?? new Map<string, string>()
  const loading = list.pending && !list.data
  const [search, setSearch] = useState("")
  const [view, setView] = useState<View>("todos")
  const [layout, setLayout] = useState<Layout>("tabela")
  const [sort, setSort] = useState<SortKey>("nome")
  const [ascending, setAscending] = useState(true)
  const [inviting, setInviting] = useState(false)
  const now = saoPauloNow()

  const names = useMemo(() => new Map(instruments.map((item) => [item.id, item.nome])), [instruments])
  const activeByTeacher = useMemo(() => {
    const grouped = new Map<string, Matricula[]>()
    for (const item of matriculas) {
      if (item.situacao !== "ativa") continue
      const rows = grouped.get(item.professor_id) ?? []
      rows.push(item)
      grouped.set(item.professor_id, rows)
    }
    return grouped
  }, [matriculas])

  const withStudents = people.filter((person) => (activeByTeacher.get(person.id)?.length ?? 0) > 0).length
  const withoutStudents = people.length - withStudents
  const openLessons = [...activeByTeacher.values()]
    .flat()
    .filter((item) => stillThisWeek(item.dia_semana, item.inicio_minuto, now.weekday, now.minute)).length

  const query = fold(search.trim())
  const digits = search.replace(/\D/g, "")
  const rows = people
    .map((person) => {
      const classes = activeByTeacher.get(person.id) ?? []
      const taught = person.instrumentos
        .map((id) => names.get(id) ?? "")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
      let next: Matricula | null = null
      let wait = Number.POSITIVE_INFINITY
      for (const item of classes) {
        const ahead = waitMinutes(item.dia_semana, item.inicio_minuto, now.weekday, now.minute)
        if (ahead < wait) {
          next = item
          wait = ahead
        }
      }
      return { person, classes, taught, next, wait, status: statusOf(classes.length) }
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
          ...row.taught,
          ...row.classes.map((item) => students.get(item.aluno_id) ?? ""),
        ].join(" "),
      )
      if (haystack.includes(query)) return true
      return digits.length > 0 && row.person.telefone.replace(/\D/g, "").includes(digits)
    })
    .sort((a, b) => {
      const direction = ascending ? 1 : -1
      if (sort === "instrumento") return a.taught.join(" ").localeCompare(b.taught.join(" "), "pt-BR") * direction
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
      kicker="Professores"
      title="Professores"
      lede="Gerencie os professores, instrumentos e aulas em um só lugar."
      action={
        <Button  type="button" onClick={() => setInviting(true)}>
          <Glyph name="plus" size={16} />
          Convidar professor
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
          <Stat icon={<Glyph name="people" />} value={people.length} label="Professores ativos" />
          <Stat icon={<Glyph name="cap" />} value={withStudents} label="Com alunos" />
          <Stat icon={<Glyph name="calendar" />} value={withoutStudents} label="Sem alunos" />
          <Stat icon={<Glyph name="clock" />} value={openLessons} label={openLessons === 1 ? "Aula em aberto" : "Aulas em aberto"} />
        </StatGrid>
      )}

      <section className="grid gap-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Situação">
            <FilterChip pressed={view === "todos"} onClick={() => setView("todos")}>Todos ({people.length})</FilterChip>
            <FilterChip pressed={view === "aula"} onClick={() => setView("aula")}>Com alunos ({withStudents})</FilterChip>
            <FilterChip pressed={view === "livre"} onClick={() => setView("livre")}>Sem alunos ({withoutStudents})</FilterChip>
          </div>
          <Input
            className="lg:ml-auto lg:max-w-xs"
            type="search"
            value={search}
            placeholder="Buscar professor, instrumento ou aluno..."
            aria-label="Buscar professor"
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
          <Empty>Nenhum professor ainda. O convite chega por e-mail e a pessoa cria a própria senha.</Empty>
        ) : rows.length === 0 ? (
          <Empty>Nenhum professor encontrado.</Empty>
        ) : layout === "cartoes" ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <li key={row.person.id}>
                <TeacherTile row={row} students={students} names={names} />
              </li>
            ))}
          </ul>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Professor" active={sort === "nome"} ascending={ascending} onClick={() => toggleSort("nome")} />
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
                    <InstrumentCell names={row.taught} />
                  </TableCell>
                  <TableCell>
                    <NextLesson next={row.next} students={students} names={names} />
                  </TableCell>
                  <TableCell>
                    <StatusCell person={row.person} status={row.status} />
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
          instruments={instruments}
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
    <Link className="flex items-center gap-2" to={`/escola/professores/${person.id}`}>
      <PersonMark name={person.nome} />
      <span className="grid min-w-0">
        <strong className="truncate font-medium">{person.nome}</strong>
        <small className="truncate text-muted-foreground">{formatPhone(person.telefone) || person.email}</small>
      </span>
    </Link>
  )
}

function InstrumentCell({ names }: { names: string[] }) {
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
  students,
  names,
}: {
  next: Matricula | null
  students: Map<string, string>
  names: Map<string, string>
}) {
  if (!next) return <strong className="font-medium">Sem aula semanal</strong>
  const day = SHORT_DAYS[next.dia_semana] ?? DIAS[next.dia_semana] ?? ""
  return (
    <span className="grid">
      <strong className="font-medium">
        {day}, {formatMinute(next.inicio_minuto)}
      </strong>
      <small className="text-muted-foreground">
        {students.get(next.aluno_id) ?? "Aluno"} · {names.get(next.instrumento_id) ?? "Aula"}
      </small>
    </span>
  )
}

function StatusCell({ person, status }: { person: Pessoa; status: { label: string; tone: string } }) {
  return (
    <span className="flex flex-wrap gap-1">
      <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
      {person.papeis.includes("administrador") ? <ToneBadge>Administra</ToneBadge> : null}
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
        <DropdownMenuItem render={<Link to={`/escola/professores/${person.id}`} />}>Abrir ficha</DropdownMenuItem>
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

function TeacherTile({
  row,
  students,
  names,
}: {
  row: { person: Pessoa; taught: string[]; next: Matricula | null; status: { label: string; tone: string } }
  students: Map<string, string>
  names: Map<string, string>
}) {
  return (
    <article className="grid gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-2">
        <PersonLink person={row.person} />
        <StatusCell person={row.person} status={row.status} />
      </div>
      <InstrumentCell names={row.taught} />
      <NextLesson next={row.next} students={students} names={names} />
      <div className="flex justify-end gap-1">
        <RowActions person={row.person} />
      </div>
    </article>
  )
}

function InviteDialog({
  instruments,
  onClose,
  onCreated,
}: {
  instruments: Instrumento[]
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [instagram, setInstagram] = useState("")
  const [outraRede, setOutraRede] = useState("")
  const [instrumentIds, setInstrumentIds] = useState<string[]>([])
  const [alsoAdmin, setAlsoAdmin] = useState(false)
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
    if (instrumentIds.length === 0) {
      setError("Escolha ao menos um instrumento.")
      return
    }
    setPending(true)
    setError(null)
    const { error: invokeError } = await client().functions.invoke("invite-user", {
      body: {
        email,
        fullName: nome,
        phone: telefone,
        role: "professor",
        alsoAdmin,
        birthDate: nascimento || null,
        instagram,
        otherSocial: outraRede,
        internalNote: "",
        instrumentIds,
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
          <DialogTitle>Convidar professor</DialogTitle>
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
        <div className="stack">
          <span className="eyebrow">Instrumentos</span>
          <InstrumentPicks instruments={instruments} selected={instrumentIds} onChange={setInstrumentIds} />
        </div>
        <label className="check">
          <Checkbox checked={alsoAdmin} onCheckedChange={(checked) => setAlsoAdmin(checked === true)} />
          Também administra a escola
        </label>
        <details>
          <summary>Nascimento e redes</summary>
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

export { sameIds }
