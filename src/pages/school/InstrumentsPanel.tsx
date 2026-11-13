import { useMemo, useState, type FormEvent } from "react"
import { toneFor } from "../../agenda/model.ts"
import { client } from "../../lib/supabase.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoneyInput, parseMoney } from "../../lib/format.ts"
import type { Instrumento, Matricula, Pessoa } from "../../types.ts"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ToneBadge } from "../../components/chrome.tsx"

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

export function InstrumentsPanel({
  instrumentos,
  matriculas,
  professores,
  onReload,
}: {
  instrumentos: Instrumento[]
  matriculas: Matricula[]
  professores: Pessoa[]
  onReload: () => Promise<void>
}) {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [novoNome, setNovoNome] = useState("")
  const [novoValor, setNovoValor] = useState("200,00")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const usage = useMemo(() => {
    const result = new Map<string, { alunos: number; professores: number }>()
    for (const item of instrumentos) {
      const alunos = new Set(
        matriculas
          .filter((matricula) => matricula.situacao === "ativa" && matricula.instrumento_id === item.id)
          .map((matricula) => matricula.aluno_id),
      ).size
      result.set(item.id, {
        alunos,
        professores: professores.filter((person) => person.instrumentos.includes(item.id)).length,
      })
    }
    return result
  }, [instrumentos, matriculas, professores])

  const ordered = [...instrumentos].sort(
    (a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"),
  )

  async function run(id: string | null, work: () => PromiseLike<{ error: { message: string } | null }>, done: string) {
    setBusyId(id)
    setError(null)
    setNotice(null)
    const { error: failure } = await work()
    setBusyId(null)
    if (failure) {
      setError(humanError(failure))
      return false
    }
    setNotice(done)
    await onReload()
    return true
  }

  async function savePrice(item: Instrumento) {
    const cents = parseMoney(prices[item.id] ?? "")
    if (cents === null) return
    const ok = await run(
      item.id,
      () => client().from("instrumentos").update({ valor_mensal_centavos: cents }).eq("id", item.id),
      `Mensalidade de ${item.nome} atualizada.`,
    )
    if (ok) {
      setPrices((current) => {
        const { [item.id]: _removed, ...rest } = current
        return rest
      })
    }
  }

  async function toggle(item: Instrumento) {
    const inUse = usage.get(item.id)?.alunos ?? 0
    if (
      item.ativo &&
      inUse > 0 &&
      !window.confirm(
        `${item.nome} tem ${plural(inUse, "aluno ativo", "alunos ativos")}. As matrículas continuam; só deixa de aparecer para novas aulas. Desativar?`,
      )
    ) {
      return
    }
    await run(
      item.id,
      () => client().from("instrumentos").update({ ativo: !item.ativo }).eq("id", item.id),
      item.ativo ? `${item.nome} desativado.` : `${item.nome} reativado.`,
    )
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    const nome = novoNome.trim()
    const cents = parseMoney(novoValor)
    if (!nome) {
      setError("Informe o nome do instrumento.")
      return
    }
    if (instrumentos.some((item) => fold(item.nome) === fold(nome))) {
      setError("Esse instrumento já existe.")
      return
    }
    if (cents === null) {
      setError("Informe uma mensalidade maior que zero.")
      return
    }
    const ok = await run(
      "novo",
      () => client().from("instrumentos").insert({ nome, valor_mensal_centavos: cents }),
      `${nome} adicionado.`,
    )
    if (ok) {
      setNovoNome("")
      setNovoValor("200,00")
      setAdding(false)
    }
  }

  return (
    <section className="stack settings-instruments">
      <div className="row spread">
        <div>
          <h2>Instrumentos</h2>
          <p className="muted">
            A mensalidade sugerida vira o valor das novas matrículas. Quem já está matriculado mantém o valor combinado.
          </p>
        </div>
        {adding ? null : (
          <Button  type="button" onClick={() => setAdding(true)}>
            Adicionar instrumento
          </Button>
        )}
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {notice ? <p className="muted" role="status">{notice}</p> : null}

      {adding ? (
        <Card>
        <CardContent>
        <form className="grid gap-3" onSubmit={(event) => void add(event)}>
          <h2 className="font-heading text-base font-medium">Novo instrumento</h2>
          <div className="row">
            <label>
              Nome
              <Input value={novoNome} onChange={(event) => setNovoNome(event.target.value)} autoFocus required />
            </label>
            <label>
              Mensalidade sugerida
              <span className="money-field">
                <span aria-hidden="true">R$</span>
                <Input
                  inputMode="decimal"
                  value={novoValor}
                  onChange={(event) => setNovoValor(event.target.value)}
                  required
                />
              </span>
            </label>
          </div>
          <div className="row">
            <Button  type="submit" disabled={busyId === "novo"}>
              {busyId === "novo" ? "Adicionando…" : "Adicionar"}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setAdding(false)
                setError(null)
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
        </CardContent>
        </Card>
      ) : null}

      <ul className="grid gap-2">
        {ordered.map((item) => {
          const counts = usage.get(item.id) ?? { alunos: 0, professores: 0 }
          const typed = prices[item.id]
          const current = typed ?? formatMoneyInput(item.valor_mensal_centavos)
          const cents = parseMoney(current)
          const dirty = typed !== undefined && cents !== item.valor_mensal_centavos
          const invalid = typed !== undefined && cents === null
          return (
            <li key={item.id} className={`grid gap-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 ${item.ativo ? "" : "opacity-60"}`} style={{ boxShadow: `inset 3px 0 0 ${toneFor(item.nome).bar}` }}>
              <div className="flex items-center justify-between gap-3">
                <strong>{item.nome}</strong>
                <ToneBadge tone={item.ativo ? "paga" : undefined}>{item.ativo ? "Ativo" : "Inativo"}</ToneBadge>
              </div>
              <p className="muted">
                {plural(counts.alunos, "aluno ativo", "alunos ativos")} · {plural(counts.professores, "professor", "professores")}
              </p>
              <div className="row">
                <label>
                  Mensalidade sugerida
                  <span className="money-field">
                    <span aria-hidden="true">R$</span>
                    <Input
                      inputMode="decimal"
                      value={current}
                      aria-invalid={invalid}
                      onChange={(event) => setPrices((state) => ({ ...state, [item.id]: event.target.value }))}
                    />
                  </span>
                </label>
                {dirty ? (
                  <Button
                    
                    type="button"
                    disabled={invalid || busyId === item.id}
                    onClick={() => void savePrice(item)}
                  >
                    Salvar valor
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void toggle(item)}
                >
                  {item.ativo ? "Desativar" : "Reativar"}
                </Button>
              </div>
              {invalid ? <p className="field-hint is-error">Informe um valor maior que zero.</p> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
