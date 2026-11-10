import { client } from "../lib/supabase.ts"
import type {
  Aula,
  Configuracao,
  Horario,
  Instrumento,
  Matricula,
  Mensalidade,
  Papel,
  Pessoa,
  Recado,
  RecadoLink,
} from "../types.ts"

type ContatoRow = {
  perfil_id: string
  telefone: string
  instagram: string
  outra_rede: string
  nascimento: string | null
}

type PapelRow = { user_id: string; papel: Papel }
type ObservacaoRow = { aluno_id: string; texto: string }
type ProfessorInstrumentoRow = { professor_id: string; instrumento_id: string }

type Filter = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  eq: (column: string, value: string) => Filter
  in: (column: string, values: string[]) => Filter
  gte: (column: string, value: string) => Filter
  lt: (column: string, value: string) => Filter
  order: (column: string) => Filter
}

async function rows<T>(table: string, columns: string, filter?: (query: Filter) => Filter) {
  const db = client() as unknown as { from: (name: string) => { select: (columns: string) => Filter } }
  let query = db.from(table).select(columns)
  if (filter) query = filter(query)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as T[]
}

export async function loadInstrumentos() {
  const { data, error } = await client()
    .from("instrumentos")
    .select("id, nome, valor_mensal_centavos, ativo")
    .order("nome")
  if (error) throw error
  return (data ?? []) as Instrumento[]
}

export async function loadPessoas(papel?: Papel): Promise<Pessoa[]> {
  const papeis = await rows<PapelRow>("papeis", "user_id, papel")
  const ids = [
    ...new Set(papeis.filter((item) => !papel || item.papel === papel).map((item) => item.user_id)),
  ]
  if (ids.length === 0) return []

  const [perfis, contatos, observacoes, vinculos] = await Promise.all([
    rows<{ id: string; nome: string; email: string }>("perfis", "id, nome, email", (query) =>
      query.in("id", ids),
    ),
    rows<ContatoRow>("contatos", "perfil_id, telefone, instagram, outra_rede, nascimento", (query) =>
      query.in("perfil_id", ids),
    ),
    papel === "professor"
      ? Promise.resolve([] as ObservacaoRow[])
      : rows<ObservacaoRow>("observacoes_internas", "aluno_id, texto", (query) =>
          query.in("aluno_id", ids),
        ),
    rows<ProfessorInstrumentoRow>("professor_instrumentos", "professor_id, instrumento_id", (query) =>
      query.in("professor_id", ids),
    ),
  ])

  const contato = new Map(contatos.map((item) => [item.perfil_id, item]))
  const nota = new Map(observacoes.map((item) => [item.aluno_id, item.texto]))
  const porPessoa = new Map<string, string[]>()
  for (const item of vinculos) {
    const list = porPessoa.get(item.professor_id) ?? []
    list.push(item.instrumento_id)
    porPessoa.set(item.professor_id, list)
  }

  return perfis
    .map((perfil) => {
      const contact = contato.get(perfil.id)
      return {
        id: perfil.id,
        nome: perfil.nome,
        email: perfil.email,
        telefone: contact?.telefone ?? "",
        instagram: contact?.instagram ?? "",
        outraRede: contact?.outra_rede ?? "",
        nascimento: contact?.nascimento ?? null,
        observacao: nota.get(perfil.id) ?? "",
        instrumentos: porPessoa.get(perfil.id) ?? [],
        papeis: papeis.filter((item) => item.user_id === perfil.id).map((item) => item.papel),
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

export async function loadHorarios(professorId?: string) {
  const data = await rows<Horario>(
    "horarios",
    "id, professor_id, dia_semana, inicio_minuto, duracao_minutos, ativo, uso",
    (query) => (professorId ? query.eq("professor_id", professorId) : query),
  )
  return data.sort((a, b) => a.dia_semana - b.dia_semana || a.inicio_minuto - b.inicio_minuto)
}

export async function loadMatriculas(filter?: { professorId?: string; alunoId?: string }) {
  const data = await rows<Matricula>(
    "matriculas",
    "id, aluno_id, professor_id, instrumento_id, horario_id, valor_mensal_centavos, situacao, inicio_em, dia_semana, inicio_minuto, duracao_minutos",
    (query) => {
      if (filter?.professorId) return query.eq("professor_id", filter.professorId)
      if (filter?.alunoId) return query.eq("aluno_id", filter.alunoId)
      return query
    },
  )
  return data
}

export async function loadAulas(filter: { from: string; until: string; professorId?: string; alunoId?: string }) {
  const data = await rows<Aula>(
    "aulas",
    "id, matricula_id, data_serie, inicio, duracao_minutos, situacao, professor_id, aluno_id, instrumento_id",
    (query) => {
      let next = query.gte("inicio", filter.from).lt("inicio", filter.until).order("inicio")
      if (filter.professorId) next = next.eq("professor_id", filter.professorId)
      if (filter.alunoId) next = next.eq("aluno_id", filter.alunoId)
      return next
    },
  )
  return data
}

export async function loadAula(id: string) {
  const { data, error } = await client()
    .from("aulas")
    .select("id, matricula_id, data_serie, inicio, duracao_minutos, situacao, professor_id, aluno_id, instrumento_id")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data as Aula | null
}

export async function loadRecados(aulaId: string) {
  const { data, error } = await client()
    .from("recados")
    .select("id, aula_id, autor_id, texto, links, criado_em")
    .eq("aula_id", aulaId)
    .order("criado_em")
  if (error) throw error
  return ((data ?? []) as Recado[]).map((item) => ({
    ...item,
    links: Array.isArray(item.links) ? (item.links as RecadoLink[]) : [],
  }))
}

export async function loadMensalidades(alunoId?: string) {
  const data = await rows<Mensalidade>(
    "mensalidades",
    "id, matricula_id, aluno_id, instrumento_id, competencia, valor_centavos, vencimento, situacao, paga_em, pix_txid",
    (query) => (alunoId ? query.eq("aluno_id", alunoId) : query),
  )
  return data.sort((a, b) => b.competencia.localeCompare(a.competencia) || a.vencimento.localeCompare(b.vencimento))
}

export async function loadConfiguracao() {
  const { data, error } = await client()
    .from("configuracao_escola")
    .select("chave_pix, nome_recebedor, cidade_recebedor, vencimento_dia, mensagem_whatsapp")
    .eq("id", 1)
    .maybeSingle()
  if (error) throw error
  return data as Configuracao | null
}

export async function nomesPorId(ids: string[]) {
  const unique = [...new Set(ids)]
  const data = await rows<{ id: string; nome: string }>("perfis", "id, nome", (query) =>
    unique.length ? query.in("id", unique) : query.eq("id", "00000000-0000-0000-0000-000000000000"),
  )
  return new Map(data.map((item) => [item.id, item.nome]))
}
