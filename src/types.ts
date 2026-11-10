export type Papel = "administrador" | "professor" | "aluno"

export type SituacaoAula = "prevista" | "realizada" | "falta" | "cancelada" | "remarcada"

export type SituacaoMatricula = "ativa" | "encerrada"

export type SituacaoMensalidade = "aberta" | "paga"

export type Instrumento = {
  id: string
  nome: string
  valor_mensal_centavos: number
  ativo: boolean
}

export type Pessoa = {
  id: string
  nome: string
  email: string
  telefone: string
  instagram: string
  outraRede: string
  nascimento: string | null
  observacao: string
  instrumentos: string[]
  papeis: Papel[]
}

export type Horario = {
  id: string
  professor_id: string
  dia_semana: number
  inicio_minuto: number
  duracao_minutos: number
  ativo: boolean
}

export type Matricula = {
  id: string
  aluno_id: string
  professor_id: string
  instrumento_id: string
  horario_id: string
  valor_mensal_centavos: number
  situacao: SituacaoMatricula
  inicio_em: string
  dia_semana: number
  inicio_minuto: number
  duracao_minutos: number
}

export type Aula = {
  id: string
  matricula_id: string
  data_serie: string
  inicio: string
  duracao_minutos: number
  situacao: SituacaoAula
  professor_id: string
  aluno_id: string
  instrumento_id: string
}

export type RecadoLink = {
  rotulo: string
  url: string
}

export type Recado = {
  id: string
  aula_id: string
  autor_id: string
  texto: string
  links: RecadoLink[]
  criado_em: string
}

export type Mensalidade = {
  id: string
  matricula_id: string
  aluno_id: string
  instrumento_id: string
  competencia: string
  valor_centavos: number
  vencimento: string
  situacao: SituacaoMensalidade
  paga_em: string | null
  pix_txid: string
}

export type Configuracao = {
  chave_pix: string
  nome_recebedor: string
  cidade_recebedor: string
  vencimento_dia: number
  mensagem_whatsapp: string
}
