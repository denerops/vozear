export function brazilPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("55") && digits.length >= 12) return digits
  return `55${digits}`
}

export const TEMPLATE_FIELDS = [
  { key: "nome", label: "Nome do aluno" },
  { key: "instrumento", label: "Instrumento" },
  { key: "valor", label: "Valor" },
  { key: "vencimento", label: "Vencimento" },
  { key: "pix", label: "Código Pix" },
] as const

export const DEFAULT_TEMPLATE =
  "Olá {nome}! A mensalidade de {instrumento}, no valor de {valor}, vence em {vencimento}.\n\nPix copia-e-cola:\n{pix}"

export function unknownFields(template: string) {
  const known = new Set<string>(TEMPLATE_FIELDS.map((field) => field.key))
  const found = [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1])
  return [...new Set(found.filter((key) => !known.has(key)))]
}

export function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")
}

export function whatsAppUrl(phone: string, text: string) {
  return `https://wa.me/${brazilPhone(phone)}?text=${encodeURIComponent(text)}`
}
