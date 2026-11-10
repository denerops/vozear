import { addDays, formatMinute, saoPauloDate, saoPauloTimestamp } from "../lib/dates.ts"
import { client } from "../lib/supabase.ts"
import type { Aula } from "../types.ts"

export function lessonHorizon(today = saoPauloDate()) {
  return addDays(today, 180)
}

export async function ensureLessons(matriculaIds: string[], until = lessonHorizon()) {
  for (const id of matriculaIds) {
    const { error } = await client().rpc("gerar_aulas", { p_matricula_id: id, p_ate: until })
    if (error) throw error
  }
}

export async function findLesson(matriculaId: string, fromDate: string) {
  const { data, error } = await client()
    .from("aulas")
    .select("id, matricula_id, data_serie, inicio, duracao_minutos, situacao, professor_id, aluno_id, instrumento_id")
    .eq("matricula_id", matriculaId)
    .eq("data_serie", fromDate)
    .maybeSingle()
  if (error) throw error
  return data as Aula | null
}

export async function createEnrollment(input: {
  alunoId: string
  professorId: string
  instrumentoId: string
  valorCentavos: number
  startsOn: string
  weekday: number
  startMinute: number
  durationMinutes: number
}) {
  const db = client()
  const { data: horario, error: horarioError } = await db
    .from("horarios")
    .insert({
      professor_id: input.professorId,
      dia_semana: input.weekday,
      inicio_minuto: input.startMinute,
      duracao_minutos: input.durationMinutes,
      uso: "disponivel",
    })
    .select("id")
    .single()
  if (horarioError) throw horarioError

  const { data: matricula, error: matriculaError } = await db
    .from("matriculas")
    .insert({
      aluno_id: input.alunoId,
      professor_id: input.professorId,
      instrumento_id: input.instrumentoId,
      horario_id: horario.id,
      valor_mensal_centavos: input.valorCentavos,
      inicio_em: input.startsOn,
      dia_semana: input.weekday,
      inicio_minuto: input.startMinute,
      duracao_minutos: input.durationMinutes,
    })
    .select("id")
    .single()
  if (matriculaError) {
    await db.from("horarios").delete().eq("id", horario.id)
    throw matriculaError
  }

  const { error } = await db.rpc("gerar_aulas", {
    p_matricula_id: matricula.id,
    p_ate: lessonHorizon(),
  })
  if (error) throw error
}

export async function moveEnrollment(horarioId: string, matriculaId: string, input: {
  weekday: number
  startMinute: number
  durationMinutes: number
}) {
  const { error } = await client()
    .from("horarios")
    .update({
      dia_semana: input.weekday,
      inicio_minuto: input.startMinute,
      duracao_minutos: input.durationMinutes,
    })
    .eq("id", horarioId)
  if (error) throw error
  await ensureLessons([matriculaId])
}

export async function endEnrollment(matriculaId: string) {
  const { error } = await client().from("matriculas").update({ situacao: "encerrada" }).eq("id", matriculaId)
  if (error) throw error
}

export async function rescheduleLesson(aulaId: string, date: string, startMinute: number) {
  const { error } = await client().rpc("remarcar_aula", {
    p_aula_id: aulaId,
    p_inicio: saoPauloTimestamp(date, formatMinute(startMinute)),
  })
  if (error) throw error
}

export async function cancelLesson(aulaId: string) {
  const { error } = await client().rpc("cancelar_aula", { p_aula_id: aulaId })
  if (error) throw error
}
