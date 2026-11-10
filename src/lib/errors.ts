const CONSTRAINTS: Record<string, string> = {
  horarios_sem_sobreposicao: "Esse horário encosta em outro horário ativo do professor.",
  matriculas_aluno_sem_sobreposicao: "O aluno já tem compromisso nesse horário.",
  matriculas_professor_sem_sobreposicao: "O professor já tem compromisso nesse horário.",
  matriculas_um_horario_ativo: "Esse horário já tem uma matrícula ativa.",
  aulas_professor_sem_sobreposicao: "O professor já tem aula nesse intervalo.",
  aulas_aluno_sem_sobreposicao: "O aluno já tem aula nesse intervalo.",
}

export function humanError(error: { code?: string; message?: string } | null) {
  if (!error) return "Não foi possível concluir."
  const message = error.message ?? ""
  for (const [name, text] of Object.entries(CONSTRAINTS)) {
    if (message.includes(name)) return text
  }
  if (error.code === "23P01") return "Esse horário encosta em outro compromisso."
  if (error.code === "23505") return "Já existe um registro igual."
  if (message.includes("duplicate key") || message.includes("already exists")) {
    return "Já existe um registro igual."
  }
  return message || "Não foi possível concluir."
}
