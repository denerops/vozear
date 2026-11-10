export type PixKeyKind = "email" | "telefone" | "cpf" | "cnpj" | "aleatoria"

export type PixKeyCheck =
  | { status: "empty" }
  | { status: "ok"; kind: PixKeyKind; key: string }
  | { status: "invalid"; message: string }

export const PIX_KIND_LABEL: Record<PixKeyKind, string> = {
  email: "E-mail",
  telefone: "Celular",
  cpf: "CPF",
  cnpj: "CNPJ",
  aleatoria: "Chave aleatória",
}

const UNKNOWN = "Não reconheci a chave. Use e-mail, celular com DDD, CPF, CNPJ ou chave aleatória."

function cpfValid(digits: string) {
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false
  for (const size of [9, 10]) {
    let sum = 0
    for (let i = 0; i < size; i += 1) sum += Number(digits[i]) * (size + 1 - i)
    const check = ((sum * 10) % 11) % 10
    if (check !== Number(digits[size])) return false
  }
  return true
}

function cnpjValid(digits: string) {
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false
  for (const size of [12, 13]) {
    let sum = 0
    let weight = size - 7
    for (let i = 0; i < size; i += 1) {
      sum += Number(digits[i]) * weight
      weight = weight === 2 ? 9 : weight - 1
    }
    const check = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    if (check !== Number(digits[size])) return false
  }
  return true
}

export function checkPixKey(raw: string): PixKeyCheck {
  const text = raw.trim()
  if (!text) return { status: "empty" }

  if (text.includes("@")) {
    const email = text.toLowerCase()
    if (email.length > 77 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { status: "invalid", message: "E-mail inválido." }
    }
    return { status: "ok", kind: "email", key: email }
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    return { status: "ok", kind: "aleatoria", key: text.toLowerCase() }
  }

  if (!/^[+\d\s().\-/]+$/.test(text)) return { status: "invalid", message: UNKNOWN }
  const digits = text.replace(/\D/g, "")

  if (text.startsWith("+")) {
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
      return { status: "ok", kind: "telefone", key: `+${digits}` }
    }
    return { status: "invalid", message: "Celular Pix começa com +55, tem DDD e 9 dígitos." }
  }

  if (digits.length === 14) {
    return cnpjValid(digits)
      ? { status: "ok", kind: "cnpj", key: digits }
      : { status: "invalid", message: "CNPJ inválido." }
  }

  if (digits.length === 11) {
    if (cpfValid(digits)) return { status: "ok", kind: "cpf", key: digits }
    const looksLikeCpf = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(text)
    if (digits[2] === "9" && !looksLikeCpf) return { status: "ok", kind: "telefone", key: `+55${digits}` }
    return { status: "invalid", message: "CPF inválido." }
  }

  if (digits.length === 13 && digits.startsWith("55") && digits[4] === "9") {
    return { status: "ok", kind: "telefone", key: `+${digits}` }
  }

  return { status: "invalid", message: UNKNOWN }
}
