import { describe, expect, it } from "vitest"
import { toExceptions, toSeries } from "./records.ts"
import type { Aula, Matricula, Pessoa } from "../types.ts"

const matricula: Matricula = {
  id: "m1",
  aluno_id: "aluno",
  professor_id: "prof",
  instrumento_id: "inst",
  horario_id: "h1",
  valor_mensal_centavos: 20000,
  situacao: "ativa",
  inicio_em: "2026-11-10",
  dia_semana: 1,
  inicio_minuto: 8 * 60,
  duracao_minutos: 60,
}

const people = new Map<string, Pessoa>([
  ["aluno", { id: "aluno", nome: "Caio Teste", email: "", telefone: "", instagram: "", outraRede: "", nascimento: null, observacao: "", criadoEm: "", instrumentos: [], papeis: ["aluno"] }],
  ["prof", { id: "prof", nome: "Brenda", email: "", telefone: "", instagram: "", outraRede: "", nascimento: null, observacao: "", criadoEm: "", instrumentos: [], papeis: ["professor"] }],
])

function lesson(patch: Partial<Aula>): Aula {
  return {
    id: "a1",
    matricula_id: "m1",
    data_serie: "2026-11-16",
    inicio: "2026-11-16T11:00:00.000Z",
    duracao_minutos: 60,
    situacao: "prevista",
    professor_id: "prof",
    aluno_id: "aluno",
    instrumento_id: "inst",
    ...patch,
    confirmacao: patch.confirmacao ?? "pendente",
  }
}

describe("agenda registrada", () => {
  it("monta a recorrência a partir da matrícula", () => {
    expect(toSeries([matricula], people, new Map([["inst", "Canto"]]))).toMatchObject([
      { student: "Caio Teste", teacher: "Brenda", instrument: "Canto", weekday: 1, startMinute: 480 },
    ])
  })

  it("ignora a aula que está no horário da matrícula", () => {
    expect(toExceptions([lesson({})], [matricula])).toEqual([])
  })

  it("guarda o horário real de uma aula remarcada", () => {
    expect(toExceptions([lesson({ situacao: "remarcada", inicio: "2026-11-18T13:00:00.000Z" })], [matricula])).toMatchObject([
      { kind: "remarcada", fromDate: "2026-11-16", date: "2026-11-18", startMinute: 10 * 60 },
    ])
  })
})
