import { useEffect, useState, type FormEvent } from "react"
import { ErrorNote, Page } from "../../components/ui.tsx"
import { loadConfiguracao, loadInstrumentos } from "../../data/api.ts"
import { client } from "../../lib/supabase.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney } from "../../lib/format.ts"
import type { Instrumento } from "../../types.ts"

export function SettingsPage() {
  const [chave, setChave] = useState("")
  const [nome, setNome] = useState("VOZEAR")
  const [cidade, setCidade] = useState("SAO PAULO")
  const [dia, setDia] = useState(10)
  const [mensagem, setMensagem] = useState("")
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [novoNome, setNovoNome] = useState("")
  const [novoValor, setNovoValor] = useState("200,00")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function reload() {
    const [school, items] = await Promise.all([loadConfiguracao(), loadInstrumentos()])
    if (school) {
      setChave(school.chave_pix)
      setNome(school.nome_recebedor)
      setCidade(school.cidade_recebedor)
      setDia(school.vencimento_dia)
      setMensagem(school.mensagem_whatsapp)
    }
    setInstrumentos(items)
  }

  useEffect(() => {
    let alive = true
    reload().catch((reason: { message?: string }) => {
      if (alive) setError(humanError(reason))
    })
    return () => {
      alive = false
    }
  }, [])

  async function saveSchool(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    setError(null)
    const { error: updateError } = await client()
      .from("configuracao_escola")
      .update({
        chave_pix: chave.trim(),
        nome_recebedor: nome.trim(),
        cidade_recebedor: cidade.trim(),
        vencimento_dia: dia,
        mensagem_whatsapp: mensagem,
      })
      .eq("id", 1)
    if (updateError) setError(humanError(updateError))
    else setSaved(true)
  }

  async function addInstrument(event: FormEvent) {
    event.preventDefault()
    const cents = Math.round(Number(novoValor.replace(",", ".")) * 100)
    if (cents <= 0) {
      setError("O valor mensal precisa ser maior que zero.")
      return
    }
    const { error: insertError } = await client()
      .from("instrumentos")
      .insert({ nome: novoNome.trim(), valor_mensal_centavos: cents })
    if (insertError) setError(humanError(insertError))
    else {
      setNovoNome("")
      await reload()
    }
  }

  async function updatePrice(item: Instrumento, value: string) {
    const cents = Math.round(Number(value.replace(",", ".")) * 100)
    if (cents <= 0) return
    const { error: updateError } = await client()
      .from("instrumentos")
      .update({ valor_mensal_centavos: cents })
      .eq("id", item.id)
    if (updateError) setError(humanError(updateError))
    else await reload()
  }

  return (
    <Page
      title="Escola"
      lede="A chave Pix fica visível para o aluno dentro do código de pagamento. Não existe confirmação automática."
    >
      <ErrorNote>{error}</ErrorNote>
      <form className="card stack" onSubmit={saveSchool}>
        <h2>Pix e vencimento</h2>
        <label>
          Chave Pix
          <input value={chave} onChange={(event) => setChave(event.target.value)} placeholder="e-mail, telefone +55, CPF ou chave aleatória" />
        </label>
        <div className="row">
          <label>
            Nome no Pix
            <input value={nome} maxLength={25} onChange={(event) => setNome(event.target.value)} required />
          </label>
          <label>
            Cidade no Pix
            <input value={cidade} maxLength={15} onChange={(event) => setCidade(event.target.value)} required />
          </label>
          <label>
            Dia de vencimento
            <input
              type="number"
              min={1}
              max={28}
              value={dia}
              onChange={(event) => setDia(Number(event.target.value))}
              required
            />
          </label>
        </div>
        <label>
          Mensagem do WhatsApp
          <textarea value={mensagem} rows={5} onChange={(event) => setMensagem(event.target.value)} required />
        </label>
        <p className="muted">Campos: {"{nome}"}, {"{instrumento}"}, {"{valor}"}, {"{vencimento}"}, {"{pix}"}.</p>
        <button className="btn" type="submit">Salvar</button>
        {saved ? <p className="muted">Configuração salva.</p> : null}
      </form>

      <section className="stack">
        <h2>Instrumentos</h2>
        <p className="muted">O valor daqui é a sugestão na matrícula nova. Quem já está matriculado não muda.</p>
        {instrumentos.map((item) => (
          <form
            key={item.id}
            className="card row"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              void updatePrice(item, String(form.get("valor") ?? ""))
            }}
          >
            <strong>{item.nome}</strong>
            <label>
              Mensalidade sugerida
              <input name="valor" defaultValue={(item.valor_mensal_centavos / 100).toFixed(2).replace(".", ",")} />
            </label>
            <button className="btn secondary" type="submit">Atualizar {formatMoney(item.valor_mensal_centavos)}</button>
            <button
              className="btn ghost"
              type="button"
              onClick={async () => {
                const { error: updateError } = await client()
                  .from("instrumentos")
                  .update({ ativo: !item.ativo })
                  .eq("id", item.id)
                if (updateError) setError(humanError(updateError))
                else await reload()
              }}
            >
              {item.ativo ? "Desativar" : "Reativar"}
            </button>
          </form>
        ))}
        <form className="card row" onSubmit={addInstrument}>
          <label>
            Novo instrumento
            <input value={novoNome} onChange={(event) => setNovoNome(event.target.value)} required />
          </label>
          <label>
            Mensalidade
            <input value={novoValor} onChange={(event) => setNovoValor(event.target.value)} required />
          </label>
          <button className="btn" type="submit">Adicionar</button>
        </form>
      </section>
    </Page>
  )
}
