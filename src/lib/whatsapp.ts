export function brazilPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("55") && digits.length >= 12) return digits
  return `55${digits}`
}

export function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")
}

export function whatsAppUrl(phone: string, text: string) {
  return `https://wa.me/${brazilPhone(phone)}?text=${encodeURIComponent(text)}`
}
