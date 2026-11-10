import type { SituacaoAula, SituacaoMensalidade } from "../types.ts"

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return phone
}

export const SITUACAO_AULA: Record<SituacaoAula, string> = {
  prevista: "Prevista",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
}

export const SITUACAO_MENSALIDADE: Record<SituacaoMensalidade, string> = {
  aberta: "Em aberto",
  paga: "Paga",
}

export function accessRedirect() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "")
  return `${window.location.origin}${base}/acesso`
}
