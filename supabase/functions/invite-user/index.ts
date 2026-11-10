import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type Papel = "aluno" | "professor" | "administrador"

type InviteBody = {
  email?: string
  fullName?: string
  phone?: string
  role?: Papel
  alsoAdmin?: boolean
  birthDate?: string | null
  instagram?: string
  otherSocial?: string
  internalNote?: string
  instrumentIds?: string[]
  redirectTo?: string
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })
}

function digits(value: string) {
  return value.replace(/\D/g, "")
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json(405, { error: "método inválido" })

  const url = Deno.env.get("SUPABASE_URL") ?? ""
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!url || !anon || !service) return json(500, { error: "servidor sem credenciais" })

  const authorization = req.headers.get("Authorization") ?? ""
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json(401, { error: "sessão inválida" })

  const { data: adminRole, error: roleError } = await admin
    .from("papeis")
    .select("papel")
    .eq("user_id", userData.user.id)
    .eq("papel", "administrador")
    .maybeSingle()
  if (roleError) return json(500, { error: "não foi possível confirmar o acesso" })
  if (!adminRole) return json(403, { error: "somente administrador convida" })

  let body: InviteBody
  try {
    body = await req.json()
  } catch {
    return json(400, { error: "pedido inválido" })
  }

  const email = clean(body.email, 160).toLowerCase()
  const fullName = clean(body.fullName, 80)
  const phone = digits(clean(body.phone, 30))
  const role = body.role
  const instagram = clean(body.instagram, 80).replace(/^@/, "")
  const otherSocial = clean(body.otherSocial, 160)
  const internalNote = clean(body.internalNote, 2000)
  const birthDate = clean(body.birthDate, 10)
  const instrumentIds = Array.isArray(body.instrumentIds) ? body.instrumentIds : []
  const redirectTo = clean(body.redirectTo, 300)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "e-mail inválido" })
  if (fullName.length < 2) return json(400, { error: "informe o nome" })
  if (phone.length < 10 || phone.length > 13) return json(400, { error: "informe o telefone com DDD" })
  if (role !== "aluno" && role !== "professor" && role !== "administrador") {
    return json(400, { error: "papel inválido" })
  }
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return json(400, { error: "data de nascimento inválida" })
  }
  if (redirectTo && !/^https?:\/\/[^@\s]+$/i.test(redirectTo)) {
    return json(400, { error: "endereço de convite inválido" })
  }
  if (role === "professor") {
    if (instrumentIds.length === 0) return json(400, { error: "escolha ao menos um instrumento" })
    if (instrumentIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
      return json(400, { error: "instrumento inválido" })
    }
    const { data: instruments, error: instrumentError } = await admin
      .from("instrumentos")
      .select("id")
      .in("id", instrumentIds)
      .eq("ativo", true)
    if (instrumentError) return json(500, { error: "não foi possível ler os instrumentos" })
    if ((instruments ?? []).length !== new Set(instrumentIds).size) {
      return json(400, { error: "há instrumento inativo ou desconhecido" })
    }
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: redirectTo || undefined,
  })
  if (inviteError || !invited.user) {
    const message = inviteError?.message?.toLowerCase() ?? ""
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return json(409, { error: "já existe uma conta com esse e-mail" })
    }
    return json(400, { error: inviteError?.message ?? "convite não enviado" })
  }

  const userId = invited.user.id
  const fail = async (status: number, error: string) => {
    await admin.auth.admin.deleteUser(userId)
    return json(status, { error })
  }

  const { error: profileError } = await admin
    .from("perfis")
    .update({ nome: fullName, email })
    .eq("id", userId)
  if (profileError) return fail(500, "não foi possível gravar o perfil")

  const roles: Papel[] = [role]
  if (role === "professor" && body.alsoAdmin) roles.push("administrador")
  const { error: rolesError } = await admin
    .from("papeis")
    .insert(roles.map((papel) => ({ user_id: userId, papel })))
  if (rolesError) return fail(500, "não foi possível gravar o acesso")

  const { error: contactError } = await admin.from("contatos").insert({
    perfil_id: userId,
    telefone: phone,
    instagram,
    outra_rede: otherSocial,
    nascimento: birthDate || null,
  })
  if (contactError) return fail(500, "não foi possível gravar o contato")

  if (role === "aluno" && internalNote) {
    const { error: noteError } = await admin.from("observacoes_internas").insert({
      aluno_id: userId,
      texto: internalNote,
    })
    if (noteError) return fail(500, "não foi possível gravar a observação")
  }

  if (role === "professor") {
    const { error: teachError } = await admin.from("professor_instrumentos").insert(
      [...new Set(instrumentIds)].map((instrumento_id) => ({
        professor_id: userId,
        instrumento_id,
      })),
    )
    if (teachError) return fail(500, "não foi possível gravar os instrumentos")
  }

  return json(200, { ok: true })
})
