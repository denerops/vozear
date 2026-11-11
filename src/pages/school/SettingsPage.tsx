import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useBlocker } from "react-router-dom"
import { PixBlock } from "../../components/PixBlock.tsx"
import { CardSkeleton, ErrorNote, Page } from "../../components/ui.tsx"
import { loadConfiguracao, loadInstrumentos, loadMatriculas, loadPessoas } from "../../data/api.ts"
import { peek } from "../../data/memory.ts"
import { useQuery } from "../../data/useQuery.ts"
import { currentMonth, formatDate } from "../../lib/dates.ts"
import { humanError } from "../../lib/errors.ts"
import { formatMoney } from "../../lib/format.ts"
import { pixCopiaECola, pixLabel } from "../../lib/pix.ts"
import { checkPixKey, PIX_KIND_LABEL } from "../../lib/pixKey.ts"
import { client } from "../../lib/supabase.ts"
import { DEFAULT_TEMPLATE, fillTemplate, TEMPLATE_FIELDS, unknownFields } from "../../lib/whatsapp.ts"
import type { Instrumento, Matricula, Pessoa } from "../../types.ts"
import { InstrumentsPanel } from "./InstrumentsPanel.tsx"

type Form = { chave: string; nome: string; cidade: string; dia: number; mensagem: string }

const EMPTY: Form = { chave: "", nome: "VOZEAR", cidade: "SAO PAULO", dia: 10, mensagem: DEFAULT_TEMPLATE }
const COMMON_DAYS = [5, 10, 15, 20, 25]

type SettingsData = {
  form: Form
  instrumentos: Instrumento[]
  matriculas: Matricula[]
  professores: Pessoa[]
}

async function loadSettings(): Promise<SettingsData> {
  const [school, items, enrollments, faculty] = await Promise.all([
    loadConfiguracao(),
    loadInstrumentos(),
    loadMatriculas(),
    loadPessoas("professor"),
  ])
  return {
    form: school
      ? {
          chave: school.chave_pix,
          nome: school.nome_recebedor,
          cidade: school.cidade_recebedor,
          dia: school.vencimento_dia,
          mensagem: school.mensagem_whatsapp,
        }
      : EMPTY,
    instrumentos: items,
    matriculas: enrollments,
    professores: faculty,
  }
}

export function SettingsPage() {
  const cached = peek<SettingsData>("escola:configuracao")
  const query = useQuery("escola:configuracao", loadSettings)
  const [form, setForm] = useState<Form>(cached?.form ?? EMPTY)
  const [saved, setSaved] = useState<Form>(cached?.form ?? EMPTY)
  const instrumentos = query.data?.instrumentos ?? cached?.instrumentos ?? []
  const matriculas = query.data?.matriculas ?? cached?.matriculas ?? []
  const professores = query.data?.professores ?? cached?.professores ?? []
  const loading = query.pending && !query.data
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef(form)
  const savedRef = useRef(saved)
  formRef.current = form
  savedRef.current = saved

  useEffect(() => {
    const loaded = query.data?.form
    if (!loaded) return
    if (JSON.stringify(formRef.current) !== JSON.stringify(savedRef.current)) return
    setForm(loaded)
    setSaved(loaded)
  }, [query.data])

  async function reloadInstruments() {
    await query.refresh()
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (blocker.state !== "blocked") return
    if (window.confirm("Há alterações não salvas. Sair mesmo assim?")) blocker.proceed()
    else blocker.reset()
  }, [blocker])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function edit(patch: Partial<Form>) {
    setForm((current) => ({ ...current, ...patch }))
    setNotice(null)
  }

  const key = checkPixKey(form.chave)
  const nomePix = pixLabel(form.nome, 25)
  const cidadePix = pixLabel(form.cidade, 15)
  const diaOk = Number.isInteger(form.dia) && form.dia >= 1 && form.dia <= 28
  const unknown = unknownFields(form.mensagem)
  const hasPix = form.mensagem.includes("{pix}")
  const firstActive = instrumentos.find((item) => item.ativo) ?? instrumentos[0]
  const samplePrice = firstActive?.valor_mensal_centavos ?? 20000

  const pixKey = key.status === "ok" ? key.key : ""
  const payload = useMemo(() => {
    if (!pixKey || !nomePix || !cidadePix) return ""
    try {
      return pixCopiaECola({
        chave: pixKey,
        nome: nomePix,
        cidade: cidadePix,
        valor: samplePrice / 100,
        txid: "PREVIA",
      })
    } catch {
      return ""
    }
  }, [pixKey, nomePix, cidadePix, samplePrice])

  const preview = fillTemplate(form.mensagem, {
    nome: "Maria",
    instrumento: firstActive?.nome ?? "Canto",
    valor: formatMoney(samplePrice),
    vencimento: diaOk ? formatDate(`${currentMonth()}-${String(form.dia).padStart(2, "0")}`) : "",
    pix: payload ? `${payload.slice(0, 38)}…` : "(código Pix)",
  })

  const blocked =
    key.status === "invalid" || !nomePix || !cidadePix || !diaOk || form.mensagem.trim().length === 0

  function insertField(field: string) {
    const token = `{${field}}`
    const element = area.current
    const start = element?.selectionStart ?? form.mensagem.length
    const end = element?.selectionEnd ?? start
    edit({ mensagem: form.mensagem.slice(0, start) + token + form.mensagem.slice(end) })
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (blocked || pending) return
    setPending(true)
    setError(null)
    setNotice(null)
    const next: Form = {
      ...form,
      chave: key.status === "ok" ? key.key : "",
      nome: form.nome.trim(),
      cidade: form.cidade.trim(),
    }
    const { error: updateError } = await client()
      .from("configuracao_escola")
      .update({
        chave_pix: next.chave,
        nome_recebedor: next.nome,
        cidade_recebedor: next.cidade,
        vencimento_dia: next.dia,
        mensagem_whatsapp: next.mensagem,
      })
      .eq("id", 1)
    setPending(false)
    if (updateError) {
      setError(humanError(updateError))
      return
    }
    setForm(next)
    setSaved(next)
    setNotice("Configurações salvas.")
  }

  return (
    <Page
      title="Configurações"
      lede="Como a escola recebe, quando cobra e o que cada instrumento custa."
    >
      <ErrorNote>{error ?? query.error}</ErrorNote>
      {notice ? <p className="muted" role="status">{notice}</p> : null}
      {loading ? <CardSkeleton rows={2} /> : (
        <form className="stack settings" onSubmit={(event) => void save(event)}>
          <section className="card settings-card">
            <div className="settings-copy">
              <h2>Recebimento por Pix</h2>
              <p className="muted">
                O aluno vê o QR Code e o código copia-e-cola. O Pix não confirma sozinho: você dá baixa quando o valor cai.
              </p>
              <label>
                Chave Pix
                <input
                  value={form.chave}
                  aria-invalid={key.status === "invalid"}
                  onChange={(event) => edit({ chave: event.target.value })}
                  placeholder="E-mail, celular, CPF, CNPJ ou chave aleatória"
                />
              </label>
              {key.status === "ok" ? (
                <p className="field-hint">
                  <span className="key-kind">{PIX_KIND_LABEL[key.kind]}</span>
                  {key.key !== form.chave.trim() ? ` Será salva como ${key.key}` : " Chave reconhecida."}
                </p>
              ) : key.status === "invalid" ? (
                <p className="field-hint is-error">{key.message}</p>
              ) : (
                <p className="field-hint is-warn">Sem a chave, o aluno não vê o Pix nas mensalidades.</p>
              )}
              <div className="row">
                <label>
                  Nome no Pix
                  <input value={form.nome} maxLength={25} onChange={(event) => edit({ nome: event.target.value })} required />
                  <small className="field-hint">
                    {form.nome.length}/25{nomePix && nomePix !== form.nome.trim() ? ` · Aparece como ${nomePix}` : ""}
                  </small>
                </label>
                <label>
                  Cidade no Pix
                  <input value={form.cidade} maxLength={15} onChange={(event) => edit({ cidade: event.target.value })} required />
                  <small className="field-hint">
                    {form.cidade.length}/15{cidadePix && cidadePix !== form.cidade.trim() ? ` · Aparece como ${cidadePix}` : ""}
                  </small>
                </label>
              </div>
            </div>
            <aside className="settings-preview" aria-label="Prévia do Pix">
              <p className="eyebrow">Como o aluno vê</p>
              {payload ? (
                <>
                  <PixBlock payload={payload} sample />
                  <p className="field-hint">
                    {nomePix} · {cidadePix}
                    <br />
                    Exemplo de {formatMoney(samplePrice)}. Não use para pagar.
                  </p>
                </>
              ) : (
                <p className="field-hint">Informe uma chave válida para ver a prévia.</p>
              )}
            </aside>
          </section>

          <section className="card stack">
            <h2>Vencimento</h2>
            <div className="instrument-picks" role="group" aria-label="Dia de vencimento">
              {COMMON_DAYS.map((day) => (
                <button key={day} type="button" aria-pressed={form.dia === day} onClick={() => edit({ dia: day })}>
                  Dia {day}
                </button>
              ))}
            </div>
            <label className="settings-day">
              Outro dia (1 a 28)
              <input
                type="number"
                min={1}
                max={28}
                value={Number.isNaN(form.dia) ? "" : form.dia}
                aria-invalid={!diaOk}
                onChange={(event) => edit({ dia: Number(event.target.value) })}
              />
            </label>
            {diaOk ? null : <p className="field-hint is-error">Escolha um dia entre 1 e 28.</p>}
            <p className="field-hint">
              Vale para as mensalidades que ainda vão ser abertas. As que já existem mantêm a data.
            </p>
          </section>

          <section className="card settings-card">
            <div className="settings-copy">
              <div className="row spread">
                <h2>Mensagem de cobrança</h2>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={form.mensagem === DEFAULT_TEMPLATE}
                  onClick={() => edit({ mensagem: DEFAULT_TEMPLATE })}
                >
                  Restaurar padrão
                </button>
              </div>
              <p className="muted">O botão de WhatsApp abre o seu aplicativo com este texto. Nada é enviado sozinho.</p>
              <div className="instrument-picks" role="group" aria-label="Inserir campo">
                {TEMPLATE_FIELDS.map((field) => (
                  <button key={field.key} type="button" onClick={() => insertField(field.key)}>
                    {field.label}
                  </button>
                ))}
              </div>
              <label>
                Texto
                <textarea
                  ref={area}
                  value={form.mensagem}
                  rows={7}
                  maxLength={1000}
                  onChange={(event) => edit({ mensagem: event.target.value })}
                  required
                />
              </label>
              {unknown.length > 0 ? (
                <p className="field-hint is-error">
                  {unknown.map((name) => `{${name}}`).join(", ")} não existe e some da mensagem.
                </p>
              ) : null}
              {hasPix ? null : (
                <p className="field-hint is-warn">Sem {"{pix}"}, a mensagem segue sem o código de pagamento.</p>
              )}
            </div>
            <aside className="settings-preview" aria-label="Prévia da mensagem">
              <p className="eyebrow">Como o aluno recebe</p>
              <div className="wa-bubble">{preview || "Mensagem vazia."}</div>
            </aside>
          </section>

          {dirty ? (
            <div className="save-bar" role="region" aria-label="Alterações">
              <span>Alterações não salvas</span>
              <button className="btn secondary" type="button" onClick={() => setForm(saved)}>
                Descartar
              </button>
              <button className="btn" type="submit" disabled={blocked || pending}>
                {pending ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          ) : null}
        </form>
      )}

      {loading ? null : (
        <InstrumentsPanel
          instrumentos={instrumentos}
          matriculas={matriculas}
          professores={professores}
          onReload={reloadInstruments}
        />
      )}
    </Page>
  )
}
